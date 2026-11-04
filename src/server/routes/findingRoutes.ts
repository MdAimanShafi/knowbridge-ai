import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { Finding, FindingCategory, EvidenceStatus, ReviewStatus } from '../../types/index.ts';
import {
  findingProjectId,
  projectIdParam,
  projectReviewerRoles,
  projectWriterRoles,
  requireProjectAccess,
  requireResourceProjectAccess,
} from '../accessControl.ts';

export const findingRoutes = Router();
const projectReadAccess = requireProjectAccess(projectIdParam());
const projectReviewerAccess = requireProjectAccess(projectIdParam(), projectReviewerRoles);
const findingReadAccess = requireResourceProjectAccess(findingProjectId(), undefined, 'Finding');
const findingWriterAccess = requireResourceProjectAccess(findingProjectId(), projectWriterRoles, 'Finding');
const findingReviewerAccess = requireResourceProjectAccess(findingProjectId(), projectReviewerRoles, 'Finding');

// Get findings for project with optional filtering
findingRoutes.get('/projects/:projectId/findings', authMiddleware, projectReadAccess, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { category, evidenceStatus, reviewStatus, search } = req.query;

  let findings = await db.getFindings(projectId);

  if (category && typeof category === 'string' && category !== 'ALL') {
    findings = findings.filter((f) => f.category === category);
  }
  if (evidenceStatus && typeof evidenceStatus === 'string' && evidenceStatus !== 'ALL') {
    findings = findings.filter((f) => f.evidenceStatus === evidenceStatus);
  }
  if (reviewStatus && typeof reviewStatus === 'string' && reviewStatus !== 'ALL') {
    findings = findings.filter((f) => f.reviewStatus === reviewStatus);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    findings = findings.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.evidenceExcerpt && f.evidenceExcerpt.toLowerCase().includes(q))
    );
  }

  res.json({ findings });
});

// Get single finding
findingRoutes.get('/findings/:id', authMiddleware, findingReadAccess, async (req: Request, res: Response) => {
  const finding = await db.getFindingById(req.params.id);
  if (!finding) {
    return res.status(404).json({ error: 'Finding not found.' });
  }
  res.json({ finding });
});

// Human Review Action (STAGE 4: REVIEW)
// Rule: AI must never approve its own findings. Reviewer must approve/reject/request clarification with notes.
findingRoutes.post('/findings/:id/review', authMiddleware, findingReviewerAccess, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { reviewStatus, reviewerNotes } = req.body || {};

  if (!['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION'].includes(reviewStatus)) {
    return res.status(400).json({ error: 'Valid reviewStatus is REQUIRED (APPROVED, REJECTED, NEEDS_CLARIFICATION).' });
  }
  if (reviewerNotes !== undefined && (typeof reviewerNotes !== 'string' || reviewerNotes.length > 5000)) {
    return res.status(400).json({ error: 'Reviewer notes must be a string of 5,000 characters or fewer.' });
  }

  const existing = await db.getFindingById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Finding not found.' });
  }
  const updated = await db.updateFinding(req.params.id, {
    reviewStatus: reviewStatus as ReviewStatus,
    reviewerId: user.id,
    reviewerName: user.name,
    reviewedAt: new Date().toISOString(),
    reviewerNotes: reviewerNotes || existing.reviewerNotes || '',
  });

  await db.logActivity({
    projectId: existing.projectId,
    userId: user.id,
    userName: user.name,
    action: `Finding ${reviewStatus}`,
    category: 'REVIEW',
    details: `${user.name} marked "${existing.title}" as ${reviewStatus}.${reviewerNotes ? ` Note: "${reviewerNotes}"` : ''}`,
  });

  res.json({ finding: updated });
});

// Edit Finding
findingRoutes.put('/findings/:id', authMiddleware, findingWriterAccess, async (req: Request, res: Response) => {
  const editableFields = [
    'title',
    'description',
    'category',
    'evidenceStatus',
    'evidenceExcerpt',
    'owner',
    'deadline',
    'severity',
    'rationale',
    'impact',
    'conflictingDetails',
    'uncertaintyReason',
  ] as const;
  const updates = Object.fromEntries(
    editableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field))
      .map((field) => [field, req.body[field]])
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide at least one editable finding field.' });
  }
  const categories = ['DECISION', 'COMPLETED_WORK', 'PENDING_TASK', 'DEPENDENCY', 'BLOCKER', 'RISK', 'ARCHITECTURE', 'UNRESOLVED_QUESTION'];
  const evidenceStatuses = ['VERIFIED', 'UNCERTAIN', 'CONFLICTING', 'MISSING_EVIDENCE'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (updates.category !== undefined && !categories.includes(String(updates.category))) {
    return res.status(400).json({ error: 'Unsupported finding category.' });
  }
  if (updates.evidenceStatus !== undefined && !evidenceStatuses.includes(String(updates.evidenceStatus))) {
    return res.status(400).json({ error: 'Unsupported evidence status.' });
  }
  if (updates.severity !== undefined && updates.severity !== null && !severities.includes(String(updates.severity))) {
    return res.status(400).json({ error: 'Unsupported severity.' });
  }
  for (const field of ['title', 'description', 'evidenceExcerpt', 'owner', 'rationale', 'impact'] as const) {
    const value = updates[field];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > (field === 'description' ? 5000 : 2000))) {
      return res.status(400).json({ error: `Invalid ${field}.` });
    }
  }
  const user = (req as any).user;
  const existing = await db.getFindingById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Finding not found.' });

  const updated = await db.updateFinding(req.params.id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await db.logActivity({
    projectId: existing.projectId,
    userId: user.id,
    userName: user.name,
    action: 'Finding Edited',
    category: 'REVIEW',
    details: `${user.name} modified finding "${existing.title}".`,
  });

  res.json({ finding: updated });
});

// Create manual verified finding
findingRoutes.post(
  '/projects/:projectId/findings',
  authMiddleware,
  projectReviewerAccess,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId } = req.params;
    const {
      title,
      description,
      category,
      evidenceStatus,
      sourceDocumentId,
      sourceDocumentName,
      pageNumber,
      evidenceExcerpt,
      owner,
      deadline,
      severity,
      rationale,
    } = req.body || {};

    if (
      typeof title !== 'string' || !title.trim() || title.length > 200 ||
      typeof description !== 'string' || !description.trim() || description.length > 5000 ||
      typeof category !== 'string' ||
      !['DECISION', 'COMPLETED_WORK', 'PENDING_TASK', 'DEPENDENCY', 'BLOCKER', 'RISK', 'ARCHITECTURE', 'UNRESOLVED_QUESTION'].includes(category)
    ) {
      return res.status(400).json({ error: 'Title, description, and category are required.' });
    }
    if (
      evidenceStatus !== undefined &&
      !['VERIFIED', 'UNCERTAIN', 'CONFLICTING', 'MISSING_EVIDENCE'].includes(evidenceStatus)
    ) {
      return res.status(400).json({ error: 'Unsupported evidence status.' });
    }
    if (sourceDocumentId !== undefined) {
      if (typeof sourceDocumentId !== 'string') return res.status(400).json({ error: 'Invalid sourceDocumentId.' });
      const sourceDocument = await db.getDocumentById(sourceDocumentId);
      if (!sourceDocument || sourceDocument.projectId !== projectId) {
        return res.status(400).json({ error: 'Source document must belong to this project.' });
      }
    }
    const newFinding: Finding = {
      id: `fnd-manual-${Date.now()}`,
      projectId,
      title,
      description,
      category: category as FindingCategory,
      evidenceStatus: (evidenceStatus || 'UNCERTAIN') as EvidenceStatus,
      reviewStatus: 'PENDING',
      sourceDocumentId,
      sourceDocumentName,
      pageNumber: pageNumber ? Number(pageNumber) : undefined,
      evidenceExcerpt,
      owner,
      deadline,
      severity,
      rationale,
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.addFinding(newFinding);

    await db.logActivity({
      projectId,
      userId: user.id,
      userName: user.name,
      action: 'Manual Finding Added',
      category: 'REVIEW',
      details: `${user.name} logged manual verified finding: "${title}".`,
    });

    res.status(201).json({ finding: newFinding });
  }
);
