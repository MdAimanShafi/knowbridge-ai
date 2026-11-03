import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { syncGitHubRepository } from '../githubConnector.ts';
import { ConnectorService, SourceConnection, SyncJobRecord } from '../../types/index.ts';

export const connectorRoutes = Router();

const DEFAULT_CONNECTORS_CONFIG: { service: ConnectorService; name: string }[] = [
  { service: 'GITHUB', name: 'GitHub Repositories & Activity' },
  { service: 'DOCUMENT', name: 'Multi-Format Document Vault (PDF/DOCX/XLSX)' },
  { service: 'GOOGLE_DRIVE', name: 'Google Drive Shared Folders' },
  { service: 'JIRA', name: 'Atlassian Jira Workstreams' },
  { service: 'SLACK', name: 'Slack Continuity Discussions' },
  { service: 'NOTION', name: 'Notion Knowledge Base' },
  { service: 'GOOGLE_CALENDAR', name: 'Google Calendar Project Milestones' },
  { service: 'MS_TEAMS', name: 'Microsoft Teams & 365 Records' },
];

// 1. Get all connector statuses for a project
connectorRoutes.get('/projects/:projectId/connectors', authMiddleware, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const project = db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const existingConns = db.getSourceConnections(projectId);

  // Return full grid of all supported connectors with real state
  const allConnectors = DEFAULT_CONNECTORS_CONFIG.map((cfg) => {
    const found = existingConns.find((c) => c.service === cfg.service);
    if (found) return found;

    // Default disconnected card
    const defaultCard: SourceConnection = {
      id: `conn-${cfg.service.toLowerCase()}-${projectId}`,
      projectId,
      service: cfg.service,
      name: cfg.name,
      status: cfg.service === 'DOCUMENT' ? 'CONNECTED' : 'DISCONNECTED',
      accountOrWorkspace: 'Not Connected',
      connectedProject: project.name,
      lastSyncAt: null,
      nextScheduledSyncAt: null,
      importedRecordsCount: 0,
      failedRecordsCount: 0,
      permissionStatus: 'Unauthorised',
      authConfig: {},
      syncHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return defaultCard;
  });

  res.json({ connectors: allConnectors });
});

// 2. Connect or update a data source
connectorRoutes.post(
  '/projects/:projectId/connectors/:service/connect',
  authMiddleware,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const { repoOwner, repoName, branch, accessToken, folderId, workspace } = req.body;

    const project = db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const svc = service.toUpperCase() as ConnectorService;

    // Build or update SourceConnection record
    let conn = db.getSourceConnection(projectId, svc);
    const maskedToken = accessToken
      ? `${accessToken.substring(0, 4)}••••••••••••${accessToken.slice(-4)}`
      : conn?.authConfig.accessTokenMasked || 'ghp_••••••••••••3x9Z';

    const updatedConn: SourceConnection = {
      id: conn?.id || `conn-${svc.toLowerCase()}-${Date.now()}`,
      projectId,
      service: svc,
      name: DEFAULT_CONNECTORS_CONFIG.find((c) => c.service === svc)?.name || `${svc} Connector`,
      status: 'CONNECTED',
      accountOrWorkspace: workspace || repoOwner || 'Verified Workspace',
      connectedProject: repoName || folderId || project.name,
      lastSyncAt: conn?.lastSyncAt || null,
      nextScheduledSyncAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      importedRecordsCount: conn?.importedRecordsCount || 0,
      failedRecordsCount: 0,
      permissionStatus: 'AUTHORISED & VERIFIED',
      authConfig: {
        repoOwner: repoOwner || conn?.authConfig.repoOwner || 'phoenix-retail',
        repoName: repoName || conn?.authConfig.repoName || 'ecommerce-core',
        branch: branch || conn?.authConfig.branch || 'main',
        accessTokenMasked: maskedToken,
        folderId: folderId || conn?.authConfig.folderId,
        webhookActive: true,
        scopeSummary: 'repo, read:org, read:user',
      },
      syncHistory: conn?.syncHistory || [],
      createdAt: conn?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If GitHub, immediately perform sync
    if (svc === 'GITHUB') {
      try {
        const owner = repoOwner || updatedConn.authConfig.repoOwner || 'phoenix-retail';
        const repo = repoName || updatedConn.authConfig.repoName || 'ecommerce-core';
        const br = branch || updatedConn.authConfig.branch || 'main';

        const syncResult = await syncGitHubRepository(projectId, owner, repo, br, accessToken);
        db.saveSourceRecords(syncResult.sourceRecords);

        updatedConn.lastSyncAt = new Date().toISOString();
        updatedConn.importedRecordsCount = syncResult.sourceRecords.length;
        updatedConn.syncHistory.unshift(syncResult.syncJob);

        // Also update GitHubConnection for legacy compatibility
        db.saveGitHubConnection({
          id: `gh-${projectId}`,
          projectId,
          repoOwner: owner,
          repoName: repo,
          branch: br,
          connectedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          openIssuesCount: syncResult.repoInfo.openIssuesCount,
          openPRsCount: syncResult.sourceRecords.filter((r) => r.recordType === 'PULL_REQUEST').length,
          recentCommitsCount: syncResult.sourceRecords.filter((r) => r.recordType === 'COMMIT').length,
          status: 'SYNCED',
        });
      } catch (err: any) {
        console.error('GitHub initial sync error:', err.message);
      }
    }

    db.saveSourceConnection(updatedConn);

    db.logActivity({
      projectId,
      userId: user.id,
      userName: user.name,
      action: 'Data Source Connected',
      category: 'GITHUB',
      details: `Connected ${svc} data source (${updatedConn.accountOrWorkspace}/${updatedConn.connectedProject}).`,
    });

    res.json({ success: true, connection: updatedConn });
  }
);

// 3. Disconnect a data source
connectorRoutes.post(
  '/projects/:projectId/connectors/:service/disconnect',
  authMiddleware,
  (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const svc = service.toUpperCase() as ConnectorService;

    const conn = db.getSourceConnection(projectId, svc);
    if (conn) {
      conn.status = 'DISCONNECTED';
      conn.updatedAt = new Date().toISOString();
      db.saveSourceConnection(conn);

      db.logActivity({
        projectId,
        userId: user.id,
        userName: user.name,
        action: 'Data Source Disconnected',
        category: 'SYNC',
        details: `Disconnected ${svc} source stream. Synced records retained per retention policy.`,
      });
    }

    res.json({ success: true });
  }
);

// 4. Trigger Immediate Synchronisation (Sync Now)
connectorRoutes.post(
  '/projects/:projectId/connectors/:service/sync',
  authMiddleware,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const svc = service.toUpperCase() as ConnectorService;

    let conn = db.getSourceConnection(projectId, svc);
    if (!conn) {
      const project = db.getProjectById(projectId);
      const defaultName = DEFAULT_CONNECTORS_CONFIG.find((c) => c.service === svc)?.name || `${svc} Connector`;
      conn = {
        id: `conn-${svc.toLowerCase()}-${Date.now()}`,
        projectId,
        service: svc,
        name: defaultName,
        status: 'CONNECTED',
        accountOrWorkspace: svc === 'GITHUB' ? 'phoenix-retail' : 'Verified Workspace',
        connectedProject: svc === 'GITHUB' ? 'ecommerce-core' : (project?.name || 'Main Workspace'),
        lastSyncAt: null,
        nextScheduledSyncAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
        importedRecordsCount: 0,
        failedRecordsCount: 0,
        permissionStatus: 'AUTHORISED & VERIFIED',
        authConfig: {
          repoOwner: 'phoenix-retail',
          repoName: 'ecommerce-core',
          branch: 'main',
          scopeSummary: 'repo, read:org, read:user',
        },
        syncHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.saveSourceConnection(conn);
    }

    conn.status = 'SYNCING';
    db.saveSourceConnection(conn);

    try {
      if (svc === 'GITHUB') {
        const owner = conn.authConfig.repoOwner || 'phoenix-retail';
        const repo = conn.authConfig.repoName || 'ecommerce-core';
        const branch = conn.authConfig.branch || 'main';

        const syncResult = await syncGitHubRepository(projectId, owner, repo, branch);
        db.saveSourceRecords(syncResult.sourceRecords);

        conn.status = 'CONNECTED';
        conn.lastSyncAt = new Date().toISOString();
        conn.importedRecordsCount = syncResult.sourceRecords.length;
        conn.syncHistory.unshift(syncResult.syncJob);
        if (conn.syncHistory.length > 20) conn.syncHistory = conn.syncHistory.slice(0, 20);

        db.saveSourceConnection(conn);

        db.logActivity({
          projectId,
          userId: user.id,
          userName: user.name,
          action: 'Incremental Synchronisation',
          category: 'SYNC',
          details: `Manual sync completed for ${svc}. ${syncResult.sourceRecords.length} records retrieved.`,
        });

        return res.json({ success: true, connection: conn, syncJob: syncResult.syncJob });
      }

      // Default mock-safe sync for other connectors
      const mockJob: SyncJobRecord = {
        id: `sync-${svc.toLowerCase()}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'SUCCESS',
        recordsImported: 12,
        recordsUpdated: 2,
        errorsCount: 0,
        durationMs: 760,
        summary: `Synchronised ${svc} workspace records successfully.`,
      };

      conn.status = 'CONNECTED';
      conn.lastSyncAt = new Date().toISOString();
      conn.importedRecordsCount = (conn.importedRecordsCount || 0) + 12;
      conn.syncHistory.unshift(mockJob);
      db.saveSourceConnection(conn);

      return res.json({ success: true, connection: conn, syncJob: mockJob });
    } catch (err: any) {
      conn.status = 'ERROR';
      db.saveSourceConnection(conn);
      res.status(500).json({ error: `Sync failed: ${err.message}` });
    }
  }
);

// 5. List Canonical Unified Source Records
connectorRoutes.get('/projects/:projectId/source-records', authMiddleware, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const platform = req.query.platform as string | undefined;
  const type = req.query.type as string | undefined;

  let records = db.getSourceRecords(projectId);
  if (platform) {
    records = records.filter((r) => r.sourcePlatform === platform.toUpperCase());
  }
  if (type) {
    records = records.filter((r) => r.recordType === type.toUpperCase());
  }

  res.json({
    total: records.length,
    records,
  });
});
