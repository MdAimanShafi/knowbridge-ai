import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import {
  projectIdParam,
  projectWriterRoles,
  requireProjectAccess,
} from '../accessControl.ts';

export const githubRoutes = Router();
const projectReadAccess = requireProjectAccess(projectIdParam('projectId'));
const projectManageAccess = requireProjectAccess(projectIdParam('projectId'), projectWriterRoles);
const projectBodyManageAccess = requireProjectAccess(
  (req) => (typeof req.body?.projectId === 'string' ? req.body.projectId : undefined),
  projectWriterRoles
);

// Connect repository to project
githubRoutes.post('/connect', authMiddleware, projectBodyManageAccess, (_req: Request, res: Response) =>
  res.status(501).json({ error: 'GitHub authorization is not configured; no repository was connected.' })
);

// Get connection status
githubRoutes.get('/status/:projectId', authMiddleware, projectReadAccess, async (req: Request, res: Response) => {
  const conn = await db.getGitHubConnection(req.params.projectId);
  res.json({ connection: conn });
});

// Trigger repository sync and extract code-level findings
githubRoutes.post('/sync/:projectId', authMiddleware, projectManageAccess, (_req: Request, res: Response) =>
  res.status(501).json({ error: 'Use the authorized source connector sync endpoint; this legacy sync route is disabled.' })
);
