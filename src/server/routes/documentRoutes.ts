import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { parseDocumentBuffer, convertDocumentToSourceRecords } from '../documentService.ts';
import { analyzeDocumentsWithGemini } from '../gemini.ts';
import { ProjectDocument } from '../../types/index.ts';
import {
  documentProjectId,
  projectContributorRoles,
  projectIdParam,
  projectWriterRoles,
  requireProjectAccess,
  requireResourceProjectAccess,
} from '../accessControl.ts';

export const documentRoutes = Router();

// Multer stores uploads only in memory; no uploaded file is exposed from a public directory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});
const projectReadAccess = requireProjectAccess(projectIdParam());
const projectWriteAccess = requireProjectAccess(projectIdParam(), projectContributorRoles);
const documentReadAccess = requireResourceProjectAccess(documentProjectId(), undefined, 'Document');
const documentManageAccess = requireResourceProjectAccess(documentProjectId(), projectWriterRoles, 'Document');

// List documents for project
documentRoutes.get('/projects/:projectId/documents', authMiddleware, projectReadAccess, async (req: Request, res: Response) => {
  const docs = await db.getDocuments(req.params.projectId);
  res.json({ documents: docs });
});

// Upload document (PDF, DOCX, XLSX, CSV, TXT)
documentRoutes.post(
  '/projects/:projectId/documents',
  authMiddleware,
  projectWriteAccess,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId } = req.params;

    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Target project workspace not found.' });
    }

    try {
      let originalName = 'uploaded-document.txt';
      let mimeType = 'text/plain';
      let filesize = 0;
      let buffer: Buffer;

      if (req.file) {
        originalName = sanitizeFilename(req.file.originalname);
        mimeType = req.file.mimetype;
        filesize = req.file.size;
        buffer = req.file.buffer;
      } else if (req.body?.text) {
        originalName = sanitizeFilename(typeof req.body?.title === 'string' ? req.body.title : 'Project_Handover_Notes.txt');
        mimeType = 'text/plain';
        buffer = Buffer.from(req.body.text, 'utf-8');
        filesize = buffer.length;
      } else {
        return res.status(400).json({ error: 'Please upload a PDF/DOCX/XLSX/CSV file or provide text content.' });
      }

      const signatureError = validateUploadSignature(buffer, originalName, mimeType);
      if (signatureError) return res.status(415).json({ error: signatureError });

      // Parse document buffer
      let parsed;
      try {
        parsed = await parseDocumentBuffer(buffer, originalName);
      } catch (err) {
        console.warn('Document parsing rejected an upload:', err instanceof Error ? err.message : 'Unknown parse error');
        return res.status(422).json({ error: 'The uploaded document could not be parsed or contains no readable text.' });
      }

      const newDoc: ProjectDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        filename: originalName,
        originalName,
        filesize,
        mimeType,
        pageCount: parsed.pageCount,
        status: 'EXTRACTED',
        uploaderId: user.id,
        uploaderName: user.name,
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        summary: parsed.extractedText.slice(0, 220).replace(/\s+/g, ' ') + '...',
        extractedText: parsed.extractedText,
        pages: parsed.pages,
        contentHash: parsed.contentHash,
        provenance: 'USER_UPLOAD',
      };

      // Convert pages into canonical SourceRecords for Unified Knowledge Base
      const sourceRecords = convertDocumentToSourceRecords(newDoc);
      const ingestion = await db.ingestDocumentIfAbsent(newDoc, sourceRecords);
      if (!ingestion.inserted) {
        return res.status(200).json({
          document: ingestion.document,
          isDuplicate: true,
          message: `Document with identical content hash (${parsed.contentHash.substring(0, 10)}...) is already indexed as "${ingestion.document.filename}".`,
          findingsExtracted: 0,
        });
      }

      await db.logActivity({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'Document Ingested & Indexed',
        category: 'DOCUMENT',
        details: `Uploaded & indexed "${originalName}" (${parsed.pageCount} pages/sheets, ${(filesize / 1024).toFixed(1)} KB, SHA-256: ${parsed.contentHash.slice(0, 8)}).`,
      });

      // Automatically trigger AI extraction on upload
      const allDocsRaw = await db.getDocuments(projectId);
      const allDocs = allDocsRaw.map((d) => ({
        id: d.id,
        filename: d.filename,
        pages: d.pages || [{ pageNumber: 1, text: d.extractedText || '' }],
      }));

      const targetDocToAnalyze = {
        id: newDoc.id,
        filename: newDoc.filename,
        pages: parsed.pages,
      };

      const analysis = await analyzeDocumentsWithGemini(projectId, targetDocToAnalyze, allDocs);
      const extractedFindings = analysis.findings;
      if (extractedFindings.length > 0) {
        await db.replaceAiFindingsForDocument(newDoc.id, extractedFindings);
        await db.logActivity({
          projectId,
          userId: user.id,
          userName: user.name,
          action: 'AI Knowledge Reconstruction',
          category: 'AI_EXTRACTION',
          details: `${analysis.provider} extracted ${extractedFindings.length} structured findings from "${newDoc.filename}".`,
        });
      }

      res.status(201).json({
        document: newDoc,
        findingsExtracted: extractedFindings.length,
        findings: extractedFindings,
        sourceRecordsCount: sourceRecords.length,
        analysisProvider: analysis.provider,
        analysisWarning: analysis.warning,
      });
    } catch (err: any) {
      console.error('Document upload error:', err instanceof Error ? err.message : 'Unknown upload error');
      res.status(500).json({ error: 'Failed to process document.' });
    }
  }
);

// Process / Reprocess Document with Gemini API
documentRoutes.post(
  '/documents/:id/process',
  authMiddleware,
  requireResourceProjectAccess(documentProjectId(), ['OWNER', 'ADMIN', 'MANAGER']),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const doc = await db.getDocumentById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    try {
      await db.updateDocument(doc.id, { status: 'PROCESSING' });

      const allDocsRaw = await db.getDocuments(doc.projectId);
      const allDocs = allDocsRaw.map((d) => ({
        id: d.id,
        filename: d.filename,
        pages: d.pages || [{ pageNumber: 1, text: d.extractedText || '' }],
      }));

      const targetDocToAnalyze = {
        id: doc.id,
        filename: doc.filename,
        pages: doc.pages || [{ pageNumber: 1, text: doc.extractedText || 'No text content' }],
      };

      const analysis = await analyzeDocumentsWithGemini(doc.projectId, targetDocToAnalyze, allDocs);
      const findings = analysis.findings;
      const replaced = await db.replaceAiFindingsForDocument(doc.id, findings);
      if (!replaced) {
        await db.updateDocument(doc.id, { status: 'EXTRACTED', error: undefined });
        return res.status(409).json({
          error: 'This document already has reviewed AI findings. Upload a revised document to preserve the existing review history.',
        });
      }
      await db.updateDocument(doc.id, {
        status: 'EXTRACTED',
        processedAt: new Date().toISOString(),
        error: undefined,
      });

      await db.logActivity({
        projectId: doc.projectId,
        userId: user.id,
        userName: user.name,
        action: 'AI Knowledge Reconstruction',
        category: 'AI_EXTRACTION',
        details: `${analysis.provider} reconstructed ${findings.length} findings from "${doc.filename}".`,
      });

      res.json({
        success: true,
        count: findings.length,
        findings,
        analysisProvider: analysis.provider,
        analysisWarning: analysis.warning,
      });
    } catch (err: any) {
      await db.updateDocument(doc.id, { status: 'ERROR', error: 'Document extraction failed.' });
      console.error('Document extraction error:', err instanceof Error ? err.message : 'Unknown extraction error');
      res.status(500).json({ error: 'Document extraction failed.' });
    }
  }
);

// Get document detail
documentRoutes.get('/documents/:id', authMiddleware, documentReadAccess, async (req: Request, res: Response) => {
  const doc = await db.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }
  res.json({ document: doc });
});

// Delete document
documentRoutes.delete('/documents/:id', authMiddleware, documentManageAccess, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const doc = await db.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const projectId = doc.projectId;
  const filename = doc.filename;
  await db.deleteDocument(doc.id);

  await db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'Document Deleted',
    category: 'DOCUMENT',
    details: `Removed document "${filename}" and cleared related unverified findings.`,
  });

  res.json({ success: true, message: 'Document and linked findings removed.' });
});

function sanitizeFilename(filename: string): string {
  const basename = filename.replace(/\\/g, '/').split('/').pop() || 'uploaded-document.txt';
  const safe = basename
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
    .slice(0, 180);
  return safe && safe !== '.' && safe !== '..' ? safe : 'uploaded-document.txt';
}

function validateUploadSignature(buffer: Buffer, filename: string, mimeType: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  const signatures: Record<string, (data: Buffer) => boolean> = {
    pdf: (data) => data.subarray(0, 5).toString('ascii') === '%PDF-',
    docx: (data) => data.length >= 4 && data.readUInt32LE(0) === 0x04034b50,
    xlsx: (data) => data.length >= 4 && data.readUInt32LE(0) === 0x04034b50,
    xls: (data) =>
      data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  };
  const declaredMimes: Record<string, string[]> = {
    pdf: ['application/pdf'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    xls: ['application/vnd.ms-excel', 'application/octet-stream'],
    csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'],
    txt: ['text/plain', 'application/octet-stream'],
    md: ['text/markdown', 'text/plain', 'application/octet-stream'],
    json: ['application/json', 'text/json', 'text/plain', 'application/octet-stream'],
  };
  if (!extension || !declaredMimes[extension]) return 'Unsupported file type.';
  if (!declaredMimes[extension].includes(mimeType.toLowerCase()))
    return 'The uploaded file MIME type does not match its extension.';
  if (signatures[extension] && !signatures[extension](buffer))
    return 'The uploaded file signature does not match its extension.';
  if (['csv', 'txt', 'md', 'json'].includes(extension) && buffer.includes(0))
    return 'Binary content is not allowed for this file type.';
  return null;
}
