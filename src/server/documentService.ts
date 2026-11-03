import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { ProjectDocument, DocumentPageChunk, SourceRecord } from '../types/index.ts';

export interface ParsedDocumentResult {
  pageCount: number;
  extractedText: string;
  pages: DocumentPageChunk[];
  contentHash: string;
}

/**
 * Calculates SHA-256 hash of buffer for duplicate detection
 */
export function calculateContentHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Parses uploaded document buffer across supported office and text formats.
 */
export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedDocumentResult> {
  const contentHash = calculateContentHash(buffer);
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (!['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json'].includes(ext)) {
    throw new Error('Unsupported file type. Upload a PDF, DOCX, XLSX, XLS, CSV, TXT, MD, or JSON file.');
  }

  // 1. PDF Parser
  if (ext === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const pages: DocumentPageChunk[] = result.pages
        .filter((page) => page.text.trim().length > 0)
        .map((page) => ({
          pageNumber: page.num,
          text: page.text.trim(),
          chunkHash: crypto.createHash('md5').update(page.text.trim()).digest('hex'),
        }));
      const fullText = result.text || '';

      if (!fullText.trim()) {
        throw new Error('This PDF contains no extractable text. Scanned PDFs require OCR before upload.');
      }

      return {
        pageCount: result.total || pages.length || 1,
        extractedText: fullText,
        pages,
        contentHash,
      };
    } finally {
      await parser.destroy();
    }
  }

  // 2. DOCX Parser
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value || '';
    const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const pages: DocumentPageChunk[] = [];
    const parasPerPage = 6;
    const numPages = Math.max(1, Math.ceil(paragraphs.length / parasPerPage));

    for (let i = 0; i < numPages; i++) {
      const chunkText = paragraphs.slice(i * parasPerPage, (i + 1) * parasPerPage).join('\n\n');
      pages.push({
        pageNumber: i + 1,
        text: chunkText,
        chunkHash: crypto.createHash('md5').update(chunkText).digest('hex'),
      });
    }

    if (!fullText.trim()) throw new Error('No readable text was found in the DOCX file.');
    return {
      pageCount: pages.length,
      extractedText: fullText,
      pages,
      contentHash,
    };
  }

  // 3. XLSX & CSV Parser
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const pages: DocumentPageChunk[] = [];
    let fullText = '';

    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetCsv = XLSX.utils.sheet_to_csv(worksheet);
      if (sheetCsv.trim().length > 0) {
        fullText += `--- SHEET: ${sheetName} ---\n${sheetCsv}\n\n`;
        pages.push({
          pageNumber: index + 1,
          sheetName,
          text: `[Sheet: ${sheetName}]\n${sheetCsv}`,
          chunkHash: crypto.createHash('md5').update(sheetCsv).digest('hex'),
        });
      }
    });

    if (!fullText.trim()) throw new Error('No readable data was found in the spreadsheet.');
    return {
      pageCount: Math.max(1, pages.length),
      extractedText: fullText,
      pages,
      contentHash,
    };
  }

  // 4. Plain Text (.txt, .md, .json, source files)
  const textContent = buffer.toString('utf-8');
  if (!textContent.trim()) throw new Error('The uploaded text file is empty.');
  const paragraphs = textContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const parasPerPage = 8;
  const numPages = Math.max(1, Math.ceil(paragraphs.length / parasPerPage));
  const pages: DocumentPageChunk[] = [];

  for (let i = 0; i < numPages; i++) {
    const chunkText = paragraphs.slice(i * parasPerPage, (i + 1) * parasPerPage).join('\n\n');
    pages.push({
      pageNumber: i + 1,
      text: chunkText,
      chunkHash: crypto.createHash('md5').update(chunkText).digest('hex'),
    });
  }

  return {
    pageCount: pages.length || 1,
    extractedText: textContent,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: textContent }],
    contentHash,
  };
}

/**
 * Converts Document Pages into Canonical SourceRecords for the Unified Knowledge Base
 */
export function convertDocumentToSourceRecords(doc: ProjectDocument): SourceRecord[] {
  if (!doc.pages || doc.pages.length === 0) {
    return [
      {
        id: `sr-doc-${doc.id}-1`,
        projectId: doc.projectId,
        sourcePlatform: 'DOCUMENT',
        externalSourceId: doc.id,
        sourceUrl: `/api/documents/${doc.id}`,
        recordType: 'FILE',
        title: `${doc.originalName || doc.filename}`,
        content: doc.extractedText || '',
        author: doc.uploaderName || 'System Uploader',
        createdDate: doc.uploadedAt,
        updatedDate: doc.uploadedAt,
        retrievedDate: new Date().toISOString(),
        lastSynchronisedDate: new Date().toISOString(),
        contentHash: doc.contentHash || '',
        permissionMetadata: {
          isPublic: false,
          visibility: 'PROJECT_MEMBERS',
          requiredRole: 'MEMBER',
        },
        version: 1,
        metadata: {
          mimeType: doc.mimeType,
          pageCount: doc.pageCount,
        },
      },
    ];
  }

  return doc.pages.map((p) => ({
    id: `sr-doc-${doc.id}-p${p.pageNumber}`,
    projectId: doc.projectId,
    sourcePlatform: 'DOCUMENT',
    externalSourceId: `${doc.id}#page-${p.pageNumber}`,
    sourceUrl: `/api/documents/${doc.id}?page=${p.pageNumber}`,
    recordType: 'DOCUMENT_CHUNK',
    title: `${doc.originalName || doc.filename} (Page ${p.pageNumber}${p.sheetName ? ` - ${p.sheetName}` : ''})`,
    content: p.text,
    author: doc.uploaderName || 'Project Member',
    createdDate: doc.uploadedAt,
    updatedDate: doc.uploadedAt,
    retrievedDate: new Date().toISOString(),
    lastSynchronisedDate: new Date().toISOString(),
    contentHash: p.chunkHash || doc.contentHash || '',
    permissionMetadata: {
      isPublic: false,
      visibility: 'PROJECT_MEMBERS',
      requiredRole: 'MEMBER',
    },
    version: 1,
    metadata: {
      documentId: doc.id,
      pageNumber: p.pageNumber,
      sheetName: p.sheetName,
      filename: doc.originalName || doc.filename,
    },
  }));
}
