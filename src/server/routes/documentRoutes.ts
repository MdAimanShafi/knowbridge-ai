import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { parseDocumentBuffer, convertDocumentToSourceRecords } from '../documentService.ts';
import { analyzeDocumentsWithGemini } from '../gemini.ts';
import { ProjectDocument } from '../../types/index.ts';

export const documentRoutes = Router();

// Multer memory storage configuration with 30MB file limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// List documents for project
documentRoutes.get('/projects/:projectId/documents', authMiddleware, (req: Request, res: Response) => {
  const docs = db.getDocuments(req.params.projectId);
  res.json({ documents: docs });
});

// Upload document (PDF, DOCX, XLSX, CSV, TXT)
documentRoutes.post(
  '/projects/:projectId/documents',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId } = req.params;

    const project = db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Target project workspace not found.' });
    }

    try {
      let originalName = 'uploaded-document.txt';
      let mimeType = 'text/plain';
      let filesize = 0;
      let buffer: Buffer;

      if (req.file) {
        originalName = req.file.originalname;
        mimeType = req.file.mimetype;
        filesize = req.file.size;
        buffer = req.file.buffer;
      } else if (req.body.text) {
        originalName = req.body.title || 'Project_Handover_Notes.txt';
        mimeType = 'text/plain';
        buffer = Buffer.from(req.body.text, 'utf-8');
        filesize = buffer.length;
      } else {
        return res.status(400).json({ error: 'Please upload a PDF/DOCX/XLSX/CSV file or provide text content.' });
      }

      // Parse document buffer
      let parsed;
      try {
        parsed = await parseDocumentBuffer(buffer, originalName);
      } catch (err) {
        return res.status(422).json({
          error: err instanceof Error ? err.message : 'The uploaded document could not be parsed.',
        });
      }

      // Duplicate detection using SHA-256 hash
      const existingDoc = db.findDocumentByHash(projectId, parsed.contentHash);
      if (existingDoc) {
        return res.status(200).json({
          document: existingDoc,
          isDuplicate: true,
          message: `Document with identical content hash (${parsed.contentHash.substring(0, 10)}...) is already indexed as "${existingDoc.filename}".`,
          findingsExtracted: 0,
        });
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

      db.addDocument(newDoc);

      // Convert pages into canonical SourceRecords for Unified Knowledge Base
      const sourceRecords = convertDocumentToSourceRecords(newDoc);
      db.saveSourceRecords(sourceRecords);

      db.logActivity({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'Document Ingested & Indexed',
        category: 'DOCUMENT',
        details: `Uploaded & indexed "${originalName}" (${parsed.pageCount} pages/sheets, ${(filesize / 1024).toFixed(1)} KB, SHA-256: ${parsed.contentHash.slice(0, 8)}).`,
      });

      // Automatically trigger AI extraction on upload
      const allDocs = db.getDocuments(projectId).map((d) => ({
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
        db.replaceAiFindingsForDocument(newDoc.id, extractedFindings);
        db.logActivity({
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
      console.error('Document upload error:', err);
      res.status(500).json({ error: `Failed to process document: ${err.message || 'Unknown error'}` });
    }
  }
);

// Process / Reprocess Document with Gemini API
documentRoutes.post('/documents/:id/process', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const doc = db.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  try {
    db.updateDocument(doc.id, { status: 'PROCESSING' });

    const allDocs = db.getDocuments(doc.projectId).map((d) => ({
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
    if (!db.replaceAiFindingsForDocument(doc.id, findings)) {
      db.updateDocument(doc.id, { status: 'EXTRACTED', error: undefined });
      return res.status(409).json({
        error: 'This document already has reviewed AI findings. Upload a revised document to preserve the existing review history.',
      });
    }
    db.updateDocument(doc.id, {
      status: 'EXTRACTED',
      processedAt: new Date().toISOString(),
      error: undefined,
    });

    db.logActivity({
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
    db.updateDocument(doc.id, { status: 'ERROR', error: err.message });
    res.status(500).json({ error: `Extraction pipeline error: ${err.message}` });
  }
});

// Get document detail
documentRoutes.get('/documents/:id', authMiddleware, (req: Request, res: Response) => {
  const doc = db.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }
  res.json({ document: doc });
});

// Delete document
documentRoutes.delete('/documents/:id', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const doc = db.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const projectId = doc.projectId;
  const filename = doc.filename;
  db.deleteDocument(doc.id);

  db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'Document Deleted',
    category: 'DOCUMENT',
    details: `Removed document "${filename}" and cleared related unverified findings.`,
  });

  res.json({ success: true, message: 'Document and linked findings removed.' });
});
