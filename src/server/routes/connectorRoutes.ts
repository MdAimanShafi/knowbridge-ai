import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { syncGitHubRepository } from '../githubConnector.ts';
import { ConnectorService, SourceConnection } from '../../types/index.ts';
import { projectIdParam, projectWriterRoles, requireProjectAccess } from '../accessControl.ts';

export const connectorRoutes = Router();
const projectReadAccess = requireProjectAccess(projectIdParam(), undefined);
const projectManageAccess = requireProjectAccess(projectIdParam(), projectWriterRoles);

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
connectorRoutes.get(
  '/projects/:projectId/connectors',
  authMiddleware,
  projectReadAccess,
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const existingConns = await db.getSourceConnections(projectId);

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
  }
);

// 2. Connect or update a data source
connectorRoutes.post(
  '/projects/:projectId/connectors/:service/connect',
  authMiddleware,
  projectManageAccess,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const { repoOwner, repoName, branch, accessToken, folderId, workspace } = req.body || {};

    const project = await db.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const svc = service.toUpperCase() as ConnectorService;
    if (!DEFAULT_CONNECTORS_CONFIG.some((config) => config.service === svc)) {
      return res.status(400).json({ error: 'Unsupported connector service.' });
    }
    if (svc !== 'GITHUB') {
      return res.status(501).json({ error: `${svc} authorization is not configured; no connection was created.` });
    }
    if (
      typeof repoOwner !== 'string' ||
      typeof repoName !== 'string' ||
      !/^[A-Za-z0-9-]{1,39}$/.test(repoOwner) ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(repoName)
    ) {
      return res.status(400).json({ error: 'A valid GitHub repository owner and name are required.' });
    }
    if (typeof accessToken !== 'string' || accessToken.length < 20 || accessToken.length > 500) {
      return res.status(400).json({ error: 'A valid GitHub access token is required.' });
    }

    // Build or update SourceConnection record
    let conn = await db.getSourceConnection(projectId, svc);
    const maskedToken = `${accessToken.substring(0, 4)}••••••••••••${accessToken.slice(-4)}`;

    const updatedConn: SourceConnection = {
      id: conn?.id || `conn-${svc.toLowerCase()}-${Date.now()}`,
      projectId,
      service: svc,
      name: DEFAULT_CONNECTORS_CONFIG.find((c) => c.service === svc)?.name || `${svc} Connector`,
      status: 'CONNECTED',
      accountOrWorkspace: workspace || repoOwner,
      connectedProject: repoName,
      lastSyncAt: conn?.lastSyncAt || null,
      nextScheduledSyncAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      importedRecordsCount: conn?.importedRecordsCount || 0,
      failedRecordsCount: 0,
      permissionStatus: 'VERIFYING',
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
    {
      try {
        const owner = repoOwner;
        const repo = repoName;
        const br = typeof branch === 'string' && /^[A-Za-z0-9._/-]{1,200}$/.test(branch) ? branch : 'main';
        const syncResult = await syncGitHubRepository(projectId, owner, repo, br, accessToken);
        await db.saveSourceRecords(syncResult.sourceRecords);

        updatedConn.lastSyncAt = new Date().toISOString();
        updatedConn.importedRecordsCount = syncResult.sourceRecords.length;
        updatedConn.syncHistory.unshift(syncResult.syncJob);
        updatedConn.permissionStatus = 'AUTHORISED & VERIFIED';

        // Also update GitHubConnection for legacy compatibility
        await db.saveGitHubConnection({
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
      } catch (err) {
        console.error('GitHub initial sync failed:', err instanceof Error ? err.message : 'Unknown GitHub error');
        return res.status(502).json({ error: 'GitHub authorization or repository verification failed.' });
      }
    }

    await db.saveSourceConnection(updatedConn);

    await db.logActivity({
      projectId,
      userId: user.id,
      userName: user.name,
      action: 'Data Source Connected',
      category: 'GITHUB',
      details: `Connected ${svc} data source (${updatedConn.accountOrWorkspace}/${updatedConn.connectedProject}).`,
    });

    return res.json({ success: true, connection: updatedConn });
  }
);

// 3. Disconnect a data source
connectorRoutes.post(
  '/projects/:projectId/connectors/:service/disconnect',
  authMiddleware,
  projectManageAccess,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const svc = service.toUpperCase() as ConnectorService;
    if (!DEFAULT_CONNECTORS_CONFIG.some((config) => config.service === svc)) {
      return res.status(400).json({ error: 'Unsupported connector service.' });
    }

    const conn = await db.getSourceConnection(projectId, svc);
    if (conn) {
      conn.status = 'DISCONNECTED';
      conn.updatedAt = new Date().toISOString();
      await db.saveSourceConnection(conn);

      await db.logActivity({
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
  projectManageAccess,
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { projectId, service } = req.params;
    const svc = service.toUpperCase() as ConnectorService;
    if (!DEFAULT_CONNECTORS_CONFIG.some((config) => config.service === svc)) {
      return res.status(400).json({ error: 'Unsupported connector service.' });
    }
    if (svc !== 'GITHUB') {
      return res.status(501).json({ error: `${svc} synchronization is not configured.` });
    }

    let conn = await db.getSourceConnection(projectId, svc);
    if (!conn) {
      return res.status(404).json({ error: 'No GitHub repository is connected to this project.' });
    }

    conn.status = 'SYNCING';
    await db.saveSourceConnection(conn);

    try {
      if (svc === 'GITHUB') {
        const owner = conn.authConfig.repoOwner;
        const repo = conn.authConfig.repoName;
        const branch = conn.authConfig.branch || 'main';
        if (!owner || !repo) return res.status(409).json({ error: 'GitHub connection is missing repository metadata.' });

        const syncResult = await syncGitHubRepository(projectId, owner, repo, branch);
        await db.saveSourceRecords(syncResult.sourceRecords);

        conn.status = 'CONNECTED';
        conn.lastSyncAt = new Date().toISOString();
        conn.importedRecordsCount = syncResult.sourceRecords.length;
        conn.syncHistory.unshift(syncResult.syncJob);
        if (conn.syncHistory.length > 20) conn.syncHistory = conn.syncHistory.slice(0, 20);

        await db.saveSourceConnection(conn);

        await db.logActivity({
          projectId,
          userId: user.id,
          userName: user.name,
          action: 'Incremental Synchronisation',
          category: 'SYNC',
          details: `Manual sync completed for ${svc}. ${syncResult.sourceRecords.length} records retrieved.`,
        });

        return res.json({ success: true, connection: conn, syncJob: syncResult.syncJob });
      }

      return res.status(501).json({ error: `${svc} synchronization is not configured.` });
    } catch (err) {
      conn.status = 'ERROR';
      await db.saveSourceConnection(conn);
      console.error('Connector sync error:', err instanceof Error ? err.message : 'Unknown connector error');
      return res.status(502).json({ error: 'Connector synchronization failed.' });
    }
  }
);

// 5. List Canonical Unified Source Records
connectorRoutes.get(
  '/projects/:projectId/source-records',
  authMiddleware,
  projectReadAccess,
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const platform = req.query.platform as string | undefined;
    const type = req.query.type as string | undefined;

    let records = await db.getSourceRecords(projectId);
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
  }
);
