import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';

export const activityRoutes = Router();

// Project activity logs
activityRoutes.get('/projects/:projectId/activity', authMiddleware, (req: Request, res: Response) => {
  const logs = db.getActivityLogs(req.params.projectId);
  res.json({ logs });
});

// Global dashboard metrics and continuity status
activityRoutes.get('/stats', authMiddleware, (_req: Request, res: Response) => {
  const projects = db.getProjects();
  let totalDocs = 0;
  let totalFindings = 0;
  let totalPending = 0;
  let totalApproved = 0;
  let totalRisks = 0;

  projects.forEach((p) => {
    totalDocs += p.documentCount || 0;
    totalFindings += p.findingsCount || 0;
    totalPending += p.pendingReviewCount || 0;
    totalApproved += p.approvedCount || 0;
    totalRisks += p.risksCount || 0;
  });

  // Calculate project continuity readiness score
  const continuityScore = totalFindings > 0 ? Math.round((totalApproved / totalFindings) * 100) : 0;

  res.json({
    totalProjects: projects.length,
    totalDocuments: totalDocs,
    totalFindings,
    totalPendingReview: totalPending,
    totalApproved,
    totalRisks,
    continuityScore,
  });
});

// Reset demo state back to pristine seed
activityRoutes.post('/system/reset-demo', authMiddleware, (_req: Request, res: Response) => {
  db.resetToDefaultSeed();
  res.json({ success: true, message: 'Platform data store re-initialized to official demo seed.' });
});
