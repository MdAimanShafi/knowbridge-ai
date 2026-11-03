import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { Finding, ReviewStatus } from '../../types/index.ts';

export const findingRoutes = Router();

function canReviewProject(projectId: string, userId: string) {
  const membership = db.getProjectMembers(projectId).find((member) => member.userId === userId);
  return membership && ['OWNER', 'LEAD', 'REVIEWER'].includes(membership.role);
}

// Get findings for project with optional filtering
findingRoutes.get('/projects/:projectId/findings', authMiddleware, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { category, evidenceStatus, reviewStatus, search } = req.query;

  let findings = db.getFindings(projectId);

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
findingRoutes.get('/findings/:id', authMiddleware, (req: Request, res: Response) => {
  const finding = db.getFindingById(req.params.id);
  if (!finding) {
    return res.status(404).json({ error: 'Finding not found.' });
  }
  res.json({ finding });
});

// Human Review Action (STAGE 4: REVIEW)
// Rule: AI must never approve its own findings. Reviewer must approve/reject/request clarification with notes.
findingRoutes.post('/findings/:id/review', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { reviewStatus, reviewerNotes } = req.body;

  if (!['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION'].includes(reviewStatus)) {
    return res.status(400).json({ error: 'Valid reviewStatus is REQUIRED (APPROVED, REJECTED, NEEDS_CLARIFICATION).' });
  }

  const existing = db.getFindingById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Finding not found.' });
  }
  if (!canReviewProject(existing.projectId, user.id)) {
    return res.status(403).json({ error: 'Project reviewer access is required to review this finding.' });
  }
  if (typeof reviewerNotes === 'string' && reviewerNotes.length > 5000) {
    return res.status(400).json({ error: 'Reviewer notes must be 5,000 characters or fewer.' });
  }

  const updated = db.updateFinding(req.params.id, {
    reviewStatus: reviewStatus as ReviewStatus,
    reviewerId: user.id,
    reviewerName: user.name,
    reviewedAt: new Date().toISOString(),
    reviewerNotes: reviewerNotes || existing.reviewerNotes || '',
  });

  db.logActivity({
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
findingRoutes.put('/findings/:id', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const existing = db.getFindingById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Finding not found.' });
  }

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
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
      .map((field) => [field, req.body[field]])
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Provide at least one editable finding field.' });
  }

  const updated = db.updateFinding(req.params.id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  db.logActivity({
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
findingRoutes.post('/projects/:projectId/findings', authMiddleware, (req: Request, res: Response) => {
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
  } = req.body;

  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Title, description, and category are required.' });
  }
  if (!db.getProjectById(projectId)) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const newFinding: Finding = {
    id: `fnd-manual-${Date.now()}`,
    projectId,
    title,
    description,
    category,
    evidenceStatus: evidenceStatus || 'VERIFIED',
    reviewStatus: 'APPROVED', // Human manually authored this
    sourceDocumentId,
    sourceDocumentName,
    pageNumber: pageNumber ? Number(pageNumber) : undefined,
    evidenceExcerpt,
    owner,
    deadline,
    severity,
    rationale,
    reviewerId: user.id,
    reviewerName: user.name,
    reviewedAt: new Date().toISOString(),
    reviewerNotes: 'Manually logged and verified by project member.',
    isAiGenerated: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.addFinding(newFinding);

  db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'Manual Finding Added',
    category: 'REVIEW',
    details: `${user.name} logged manual verified finding: "${title}".`,
  });

  res.status(201).json({ finding: newFinding });
});
