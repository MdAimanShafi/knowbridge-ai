import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { HandoverReport, Finding } from '../../types/index.ts';
import { generateHandoverPdf } from '../handoverPdfService.ts';
import {
  handoverProjectId,
  projectIdParam,
  projectReviewerRoles,
  requireProjectAccess,
  requireResourceProjectAccess,
} from '../accessControl.ts';

export const handoverRoutes = Router();
const projectReviewerAccess = requireProjectAccess(projectIdParam(), projectReviewerRoles);
const handoverReviewerAccess = requireResourceProjectAccess(
  handoverProjectId(),
  projectReviewerRoles,
  'Handover report'
);

// Generate structured Handover Report from stored findings
handoverRoutes.post('/projects/:projectId/handover', authMiddleware, projectReviewerAccess, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { title } = req.body || {};

  const project = await db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 200)) {
    return res.status(400).json({ error: 'Report title must be 200 characters or fewer.' });
  }

  const allFindings = await db.getFindings(projectId);
  const documents = await db.getDocuments(projectId);

  const approvedFindings = allFindings.filter((f) => f.reviewStatus === 'APPROVED');
  const unapprovedFindings = allFindings.filter(
    (f) => f.reviewStatus === 'PENDING' || f.reviewStatus === 'NEEDS_CLARIFICATION'
  );

  const completedWork = approvedFindings.filter((f) => f.category === 'COMPLETED_WORK');
  const pendingTasks = approvedFindings.filter((f) => f.category === 'PENDING_TASK');
  const decisions = approvedFindings.filter((f) => f.category === 'DECISION');
  const dependencies = approvedFindings.filter((f) => f.category === 'DEPENDENCY');
  const risksAndBlockers = approvedFindings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');
  const unresolvedQuestions = approvedFindings.filter((f) => f.category === 'UNRESOLVED_QUESTION');
  const missingAndConflictingInfo = approvedFindings.filter(
    (f) =>
      f.evidenceStatus === 'CONFLICTING' ||
      f.evidenceStatus === 'MISSING_EVIDENCE' ||
      f.evidenceStatus === 'UNCERTAIN'
  );

  const recommendedNextActions = [...pendingTasks, ...risksAndBlockers].slice(0, 5).map((finding, index) => ({
    priority: index + 1,
    title: finding.title,
    description: finding.description,
    suggestedOwner: finding.owner || project.successorName || 'Successor Engineer',
    deadline: finding.deadline,
  }));

  const sourceReferences = documents.map((doc) => {
    const findingsFromDoc = approvedFindings.filter((f) => f.sourceDocumentId === doc.id);
    const pages = Array.from(new Set(findingsFromDoc.map((f) => f.pageNumber).filter(Boolean))).sort(
      (a, b) => (a as number) - (b as number)
    );
    return {
      documentId: doc.id,
      filename: doc.filename,
      pagesCovered: pages.length > 0 ? `Pages ${pages.join(', ')}` : 'All Pages',
      findingsCount: findingsFromDoc.length,
    };
  });

  const report: HandoverReport = {
    id: `rpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    projectId,
    title: title || `${project.name} — Official Knowledge Handover Report`,
    version: '1.0.0',
    generatedById: user.id,
    generatedByName: user.name,
    generatedAt: new Date().toISOString(),
    projectOverview:
      project.description ||
      'Complete operational knowledge synthesis compiled from verified technical documentation, decisions records, and peer reviews.',
    currentStatus: `Project Status: ${project.status}. Total documents analyzed: ${documents.length}. Human-approved findings: ${approvedFindings.length}. Findings awaiting review: ${unapprovedFindings.length}. Outgoing lead: ${project.departingMemberName || 'Not specified'}. Incoming successor: ${project.successorName || 'Not specified'}.`,
    completedWork,
    pendingTasks,
    decisions,
    dependencies,
    risksAndBlockers,
    unresolvedQuestions,
    missingAndConflictingInfo,
    unapprovedFindings,
    recommendedNextActions,
    sourceReferences,
  };

  await db.saveHandoverReport(report);

  await db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'Handover Report Generated',
    category: 'HANDOVER',
    details: `Generated official handover dossier "${report.title}" with ${approvedFindings.length} verified findings.`,
  });

  res.status(201).json({ report });
});

// List handover reports for project
handoverRoutes.get('/projects/:projectId/handover', authMiddleware, projectReviewerAccess, async (req: Request, res: Response) => {
  const proj = await db.getProjectById(req.params.projectId);
  if (!proj) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const reports = await db.getHandoverReports(req.params.projectId);
  res.json({ reports });
});

// Get single handover report
handoverRoutes.get('/handover/:id', authMiddleware, handoverReviewerAccess, async (req: Request, res: Response) => {
  const report = await db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
  }
  res.json({ report });
});

// Executive sign-off on report
handoverRoutes.post('/handover/:id/signoff', authMiddleware, handoverReviewerAccess, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const report = await db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
  }
  if (req.body?.notes !== undefined && (typeof req.body.notes !== 'string' || req.body.notes.length > 5000)) {
    return res.status(400).json({ error: 'Sign-off notes must be 5,000 characters or fewer.' });
  }
  const allFindings = await db.getFindings(report.projectId);
  const pendingReviews = allFindings.filter(
    (finding) => finding.reviewStatus === 'PENDING' || finding.reviewStatus === 'NEEDS_CLARIFICATION'
  );
  if (pendingReviews.length > 0) {
    return res.status(409).json({
      error: `Resolve all ${pendingReviews.length} pending or clarification-requested finding(s) before signing off.`,
    });
  }

  const { notes } = req.body || {};
  report.executiveSignOff = {
    approvedBy: user.name,
    approvalDate: new Date().toISOString(),
    notes: notes || 'Handover transition accepted and verified against source evidence.',
  };
  await db.saveHandoverReport(report);
  await db.save();

  await db.logActivity({
    projectId: report.projectId,
    userId: user.id,
    userName: user.name,
    action: 'Executive Handover Sign-Off',
    category: 'HANDOVER',
    details: `${user.name} signed off on handover report "${report.title}".`,
  });

  res.json({ report });
});

// Printable / Clean PDF View (supports both singular and plural paths)
const handlePdfExport = async (req: Request, res: Response) => {
  const report = await db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
  }

  try {
    const pdf = await generateHandoverPdf(report);
    const filenameId = report.id.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${req.query.download === '1' || req.query.download === 'true' ? 'attachment' : 'inline'}; filename="KNOWBRIDGE_Handover_${filenameId}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    console.error('Handover PDF generation failed:', error instanceof Error ? error.message : 'Unknown PDF error');
    return res.status(500).json({ error: 'Could not generate the handover PDF.' });
  }
};

handoverRoutes.get('/handover/:id/pdf', authMiddleware, handoverReviewerAccess, handlePdfExport);
handoverRoutes.get('/handovers/:id/pdf', authMiddleware, handoverReviewerAccess, handlePdfExport);
