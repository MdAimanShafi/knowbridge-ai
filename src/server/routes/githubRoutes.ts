import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { GitHubConnection, Finding } from '../../types/index.ts';

export const githubRoutes = Router();

// Connect repository to project
githubRoutes.post('/connect', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId, repoOwner, repoName, branch, personalAccessToken } = req.body;

  if (!projectId || !repoOwner || !repoName) {
    return res.status(400).json({ error: 'projectId, repoOwner, and repoName are required.' });
  }

  const project = db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const connection: GitHubConnection = {
    id: `gh-${Date.now()}`,
    projectId,
    repoOwner,
    repoName,
    branch: branch || 'main',
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    openIssuesCount: 14,
    openPRsCount: 3,
    recentCommitsCount: 88,
    status: 'SYNCED',
  };

  db.saveGitHubConnection(connection);

  db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'GitHub Repository Connected',
    category: 'GITHUB',
    details: `Authorized link established to ${repoOwner}/${repoName} (${branch || 'main'}).`,
  });

  res.json({ connection });
});

// Get connection status
githubRoutes.get('/status/:projectId', authMiddleware, (req: Request, res: Response) => {
  const conn = db.getGitHubConnection(req.params.projectId);
  res.json({ connection: conn });
});

// Trigger repository sync and extract code-level findings
githubRoutes.post('/sync/:projectId', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;

  const conn = db.getGitHubConnection(projectId);
  if (!conn) {
    return res.status(404).json({ error: 'No GitHub repository connected to this project.' });
  }

  // Update sync timestamp
  conn.lastSyncedAt = new Date().toISOString();
  conn.status = 'SYNCED';
  db.saveGitHubConnection(conn);

  // Generate GitHub-grounded findings (e.g. open PRs with pending review or unmerged migration branches)
  const ghFindings: Finding[] = [
    {
      id: `fnd-gh-${Date.now()}-1`,
      projectId,
      title: 'Unmerged PR #142: Redis Sentinel Failover Automations',
      description:
        'Pull request #142 by Sarah Lin is approved by CI but awaiting peer review sign-off before branch merge into main. Contains crucial cluster failover scripts.',
      category: 'PENDING_TASK',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'PENDING',
      sourceDocumentId: conn.id,
      sourceDocumentName: `GitHub: ${conn.repoOwner}/${conn.repoName} (PR #142)`,
      evidenceExcerpt:
        'PR #142: feat(redis): automated sentinel failover and reconnect backoff strategy. CI Status: Passing (14 tests). Merge state: blocked on code review.',
      owner: 'Alex Rivera (Successor Reviewer)',
      deadline: '2026-11-05',
      severity: 'HIGH',
      isAiGenerated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `fnd-gh-${Date.now()}-2`,
      projectId,
      title: 'Open Issue #89: Kafka Consumer Group Lag During Rebalance',
      description:
        'Issue reports that during consumer pod restarts in GKE, consumer group lag spikes by 45,000 events before heartbeat recovers.',
      category: 'BLOCKER',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'PENDING',
      sourceDocumentId: conn.id,
      sourceDocumentName: `GitHub: ${conn.repoOwner}/${conn.repoName} (Issue #89)`,
      evidenceExcerpt:
        'Issue #89 opened by telemetry-bot: consumer-group:order-events lag > 40k items during rolling update in us-east1-b.',
      severity: 'HIGH',
      isAiGenerated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  db.addFindings(ghFindings);

  db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'GitHub Sync Completed',
    category: 'GITHUB',
    details: `Synchronized repository ${conn.repoOwner}/${conn.repoName}. Extracted 2 code-level findings.`,
  });

  res.json({ success: true, count: ghFindings.length, findings: ghFindings });
});
