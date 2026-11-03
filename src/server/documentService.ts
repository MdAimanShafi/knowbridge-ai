import crypto from 'crypto';
import * as pdfParseModule from 'pdf-parse';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { ProjectDocument, DocumentPageChunk, SourceRecord } from '../types/index.ts';

const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

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
 * Parses uploaded document buffer across PDF, DOCX, XLSX, CSV, and TXT
 */
export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedDocumentResult> {
  const contentHash = calculateContentHash(buffer);
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 1. PDF Parser
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    try {
      const data = await pdfParse(buffer);
      const totalPages = data.numpages || 1;
      const fullText = data.text || '';

      // Chunk pages based on form feeds or proportional splitting
      const rawPages = fullText.split('\f');
      const pages: DocumentPageChunk[] = [];

      if (rawPages.length > 1) {
        rawPages.forEach((pageText: string, idx: number) => {
          const trimmed = pageText.trim();
          if (trimmed.length > 0) {
            pages.push({
              pageNumber: idx + 1,
              text: trimmed,
              chunkHash: crypto.createHash('md5').update(trimmed).digest('hex'),
            });
          }
        });
      } else {
        // Fallback: chunk roughly by lines if form feed is absent
        const lines = fullText.split('\n');
        const linesPerPage = Math.max(30, Math.ceil(lines.length / totalPages));
        for (let i = 0; i < totalPages; i++) {
          const pageLines = lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n').trim();
          if (pageLines.length > 0) {
            pages.push({
              pageNumber: i + 1,
              text: pageLines,
              chunkHash: crypto.createHash('md5').update(pageLines).digest('hex'),
            });
          }
        }
      }

      if (pages.length === 0 && fullText.trim().length > 0) {
        pages.push({
          pageNumber: 1,
          text: fullText.trim(),
          chunkHash: crypto.createHash('md5').update(fullText).digest('hex'),
        });
      }

      return {
        pageCount: pages.length || totalPages,
        extractedText: fullText,
        pages,
        contentHash,
      };
    } catch (err: any) {
      console.error('PDF parsing error, attempting text fallback:', err.message);
      const fallbackText = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
      return {
        pageCount: 1,
        extractedText: fallbackText,
        pages: [{ pageNumber: 1, text: fallbackText }],
        contentHash,
      };
    }
  }

  // 2. DOCX Parser
  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const fullText = result.value || '';
      // Chunk DOCX by sections / paragraphs
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

      return {
        pageCount: pages.length,
        extractedText: fullText,
        pages,
        contentHash,
      };
    } catch (err: any) {
      console.error('DOCX parsing error:', err.message);
      const text = buffer.toString('utf-8');
      return {
        pageCount: 1,
        extractedText: text,
        pages: [{ pageNumber: 1, text }],
        contentHash,
      };
    }
  }

  // 3. XLSX & CSV Parser
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
    try {
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

      return {
        pageCount: Math.max(1, pages.length),
        extractedText: fullText,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
        contentHash,
      };
    } catch (err: any) {
      console.error('XLSX/CSV parsing error:', err.message);
      const text = buffer.toString('utf-8');
      return {
        pageCount: 1,
        extractedText: text,
        pages: [{ pageNumber: 1, text }],
        contentHash,
      };
    }
  }

  // 4. Plain Text (.txt, .md, .json, source files)
  const textContent = buffer.toString('utf-8');
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
