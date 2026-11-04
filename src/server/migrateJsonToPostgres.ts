#!/usr/bin/env node
/**
 * KNOWBRIDGE AI — JSON → PostgreSQL Data Migration Script
 *
 * Safely migrates all data from knowbridge_store.json into PostgreSQL.
 * - Validates the JSON snapshot structure and all entity relationships before import.
 * - Backs up the JSON file before starting.
 * - Refuses to merge into a populated target database.
 * - Verifies row counts between source JSON and target tables after import.
 * - Does NOT delete or overwrite the JSON store after migration.
 * - Safeguards production and existing user data.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node --import tsx src/server/migrateJsonToPostgres.ts
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { closePool, withTransaction, runMigrations, isPostgresConfigured } from './pgPool.ts';

const DATA_FILE = path.resolve(
  process.env.KNOWBRIDGE_DATA_FILE ||
  path.join(process.cwd(), 'data', 'knowbridge_store.json')
);

const COLLECTIONS = [
  'users', 'projects', 'projectMembers', 'documents', 'findings', 'sourceRecords',
  'sourceConnections', 'handoverReports', 'githubConnections', 'activityLogs', 'ragQueries',
];

const TABLES = [
  'users', 'projects', 'project_members', 'documents', 'findings', 'source_records',
  'source_connections', 'handover_reports', 'github_connections', 'activity_logs', 'rag_queries',
];

export function validateStore(store: unknown): asserts store is Record<string, any[]> {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    throw new Error('JSON store must be an object.');
  }
  const data = store as Record<string, unknown>;
  for (const collection of COLLECTIONS) {
    const records = data[collection];
    if (records === undefined) continue;
    if (!Array.isArray(records)) {
      throw new Error(`JSON store collection "${collection}" must be an array.`);
    }
    for (const [index, record] of records.entries()) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error(`Invalid record at ${collection}[${index}].`);
      }
      const id = (record as { id?: unknown }).id;
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error(`Missing id at ${collection}[${index}].`);
      }
    }
  }
}

export function validateStoreRelationships(store: Record<string, any[]>): void {
  const userIds = new Set((store.users || []).map((u) => u.id));
  const projectIds = new Set((store.projects || []).map((p) => p.id));
  const documentIds = new Set((store.documents || []).map((d) => d.id));

  for (const [idx, p] of (store.projects || []).entries()) {
    if (!userIds.has(p.ownerId)) {
      throw new Error(
        `Relationship violation in projects[${idx}] (${p.id}): ownerId "${p.ownerId}" does not exist in users.`
      );
    }
  }

  for (const [idx, m] of (store.projectMembers || []).entries()) {
    if (!projectIds.has(m.projectId)) {
      throw new Error(
        `Relationship violation in projectMembers[${idx}] (${m.id}): projectId "${m.projectId}" does not exist in projects.`
      );
    }
    if (!userIds.has(m.userId)) {
      throw new Error(
        `Relationship violation in projectMembers[${idx}] (${m.id}): userId "${m.userId}" does not exist in users.`
      );
    }
  }

  for (const [idx, d] of (store.documents || []).entries()) {
    if (!projectIds.has(d.projectId)) {
      throw new Error(
        `Relationship violation in documents[${idx}] (${d.id}): projectId "${d.projectId}" does not exist in projects.`
      );
    }
    if (!userIds.has(d.uploaderId)) {
      throw new Error(
        `Relationship violation in documents[${idx}] (${d.id}): uploaderId "${d.uploaderId}" does not exist in users.`
      );
    }
  }

  for (const [idx, f] of (store.findings || []).entries()) {
    if (!projectIds.has(f.projectId)) {
      throw new Error(
        `Relationship violation in findings[${idx}] (${f.id}): projectId "${f.projectId}" does not exist in projects.`
      );
    }
    if (f.sourceDocumentId && !documentIds.has(f.sourceDocumentId)) {
      throw new Error(
        `Relationship violation in findings[${idx}] (${f.id}): sourceDocumentId "${f.sourceDocumentId}" does not exist in documents.`
      );
    }
    if (f.reviewerId && !userIds.has(f.reviewerId)) {
      throw new Error(
        `Relationship violation in findings[${idx}] (${f.id}): reviewerId "${f.reviewerId}" does not exist in users.`
      );
    }
  }

  for (const [idx, h] of (store.handoverReports || []).entries()) {
    if (!projectIds.has(h.projectId)) {
      throw new Error(
        `Relationship violation in handoverReports[${idx}] (${h.id}): projectId "${h.projectId}" does not exist in projects.`
      );
    }
    if (!userIds.has(h.generatedById)) {
      throw new Error(
        `Relationship violation in handoverReports[${idx}] (${h.id}): generatedById "${h.generatedById}" does not exist in users.`
      );
    }
  }
}

function createBackup(dataFile: string): string {
  let suffix = Date.now();
  let backupPath = `${dataFile}.backup-${suffix}.json`;
  while (fs.existsSync(backupPath)) {
    suffix += 1;
    backupPath = `${dataFile}.backup-${suffix}.json`;
  }
  fs.copyFileSync(dataFile, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

export interface MigrationResult {
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  backupPath: string;
}

export async function migrate(dataFile = DATA_FILE): Promise<MigrationResult> {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is not set and no pool configured. Cannot migrate.');
  }

  if (!fs.existsSync(dataFile)) {
    throw new Error(`JSON store not found at ${dataFile}`);
  }

  const source = fs.readFileSync(dataFile);
  let store: Record<string, any[]>;
  try {
    store = JSON.parse(source.toString('utf8'));
  } catch {
    throw new Error('JSON store is not valid JSON.');
  }
  validateStore(store);
  validateStoreRelationships(store);

  const backupPath = createBackup(dataFile);
  console.log(`[Migration] JSON store backed up to: ${backupPath}`);

  await runMigrations();
  console.log('[Migration] Schema migrations applied.');

  const sourceHash = createHash('sha256').update(source).digest('hex');
  const sourceCounts: Record<string, number> = {
    users: store.users?.length || 0,
    projects: store.projects?.length || 0,
    project_members: store.projectMembers?.length || 0,
    documents: store.documents?.length || 0,
    findings: store.findings?.length || 0,
    source_records: store.sourceRecords?.length || 0,
    source_connections: store.sourceConnections?.length || 0,
    handover_reports: store.handoverReports?.length || 0,
    github_connections: store.githubConnections?.length || 0,
    activity_logs: store.activityLogs?.length || 0,
    rag_queries: store.ragQueries?.length || 0,
  };

  const actualCounts: Record<string, number> = {};

  await withTransaction(async (client) => {
    try {
      await client.query('SELECT pg_advisory_xact_lock($1)', [712039141]);
    } catch {
      // In-memory or emulated test database
    }

    const hasDataImports = await client
      .query('SELECT 1 FROM data_imports LIMIT 0')
      .then(() => true)
      .catch(() => false);
    if (!hasDataImports) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS data_imports (
          source_hash TEXT PRIMARY KEY,
          imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          record_counts JSONB NOT NULL
        )
      `);
    }

    const priorImport = await client.query(
      'SELECT record_counts FROM data_imports WHERE source_hash = $1',
      [sourceHash]
    );
    if (priorImport.rows.length > 0) {
      console.log('[Migration] This exact JSON snapshot was already imported:', priorImport.rows[0].record_counts);
      for (const table of TABLES) {
        const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
        actualCounts[table] = result.rows[0].count;
      }
      return;
    }

    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      if (result.rows[0].count !== 0) {
        throw new Error(
          `The target database already contains application data. Refusing to merge or overwrite existing records in ${table}.`
        );
      }
    }

    for (const u of store.users ?? []) {
      await client.query(`
        INSERT INTO users (id, email, name, title, avatar_url, role, password_hash, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT DO NOTHING
      `, [
        u.id, u.email.toLowerCase(), u.name, u.title || 'Project Member',
        u.avatarUrl || null, u.role || 'MEMBER', u.passwordHash,
        u.createdAt || new Date().toISOString(),
      ]);
    }

    for (const p of store.projects ?? []) {
      await client.query(`
        INSERT INTO projects (id, name, code, description, category, status, owner_id, owner_name,
          departing_member_name, departing_member_role, successor_name, target_handover_date,
          objectives, start_date, expected_completion_date, team_members, tech_stack,
          important_deadlines, known_risks, existing_dependencies, project_documentation_notes,
          setup_completed, current_setup_step, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        ON CONFLICT DO NOTHING
      `, [
        p.id, p.name, p.code || p.name.substring(0, 4).toUpperCase(), p.description || '', p.category || 'General Engineering',
        p.status || 'ACTIVE', p.ownerId, p.ownerName, p.departingMemberName || null, p.departingMemberRole || null,
        p.successorName || null, p.targetHandoverDate || null, p.objectives || null, p.startDate || null,
        p.expectedCompletionDate || null, JSON.stringify(p.teamMembers || []), JSON.stringify(p.techStack || []),
        JSON.stringify(p.importantDeadlines || []), JSON.stringify(p.knownRisks || []),
        JSON.stringify(p.existingDependencies || []), p.projectDocumentationNotes || null,
        p.setupCompleted ?? false, p.currentSetupStep ?? 1, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString(),
      ]);
    }

    for (const m of store.projectMembers ?? []) {
      await client.query(`
        INSERT INTO project_members (id, project_id, user_id, user_name, user_email, role, joined_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING
      `, [
        m.id, m.projectId, m.userId, m.userName, m.userEmail, m.role || 'MEMBER',
        m.joinedAt || new Date().toISOString(),
      ]);
    }

    for (const d of store.documents ?? []) {
      await client.query(`
        INSERT INTO documents (id, project_id, filename, original_name, filesize, mime_type, page_count,
          status, uploader_id, uploader_name, content_hash, extracted_text, pages, summary,
          provenance, error, uploaded_at, processed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (id) DO NOTHING
      `, [
        d.id, d.projectId, d.filename, d.originalName, d.filesize || 0, d.mimeType, d.pageCount || 1,
        d.status || 'EXTRACTED', d.uploaderId, d.uploaderName, d.contentHash, d.extractedText || null,
        JSON.stringify(d.pages || []), d.summary || null, d.provenance || 'USER_UPLOAD',
        d.error || null, d.uploadedAt || new Date().toISOString(), d.processedAt || null,
      ]);
    }

    for (const f of store.findings ?? []) {
      await client.query(`
        INSERT INTO findings (id, project_id, title, description, category, evidence_status, review_status,
          source_document_id, source_document_name, source_record_id, source_platform, source_url,
          page_number, evidence_excerpt, conflicting_details, uncertainty_reason, owner, deadline,
          severity, impact, rationale, reviewer_id, reviewer_name, reviewed_at, reviewer_notes,
          is_ai_generated, provenance_type, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        ON CONFLICT DO NOTHING
      `, [
        f.id, f.projectId, f.title, f.description, f.category, f.evidenceStatus || 'UNCERTAIN',
        f.reviewStatus || 'PENDING', f.sourceDocumentId || null, f.sourceDocumentName || null,
        f.sourceRecordId || null, f.sourcePlatform || null, f.sourceUrl || null,
        f.pageNumber || null, f.evidenceExcerpt || null, f.conflictingDetails || null,
        f.uncertaintyReason || null, f.owner || null, f.deadline || null, f.severity || null,
        f.impact || null, f.rationale || null, f.reviewerId || null, f.reviewerName || null,
        f.reviewedAt || null, f.reviewerNotes || null, f.isAiGenerated ?? true,
        f.provenanceType || null, f.createdAt || new Date().toISOString(), f.updatedAt || new Date().toISOString(),
      ]);
    }

    for (const r of store.sourceRecords ?? []) {
      await client.query(`
        INSERT INTO source_records (id, project_id, source_platform, external_source_id, source_url,
          record_type, title, content, author, created_date, updated_date, retrieved_date,
          last_synchronised_date, content_hash, permission_metadata, version, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id, r.projectId, r.sourcePlatform, r.externalSourceId, r.sourceUrl, r.recordType,
        r.title, r.content, r.author || '', r.createdDate || null, r.updatedDate || null,
        r.retrievedDate || new Date().toISOString(), r.lastSynchronisedDate || new Date().toISOString(),
        r.contentHash, JSON.stringify(r.permissionMetadata || {}), r.version || 1,
        JSON.stringify(r.metadata || {}),
      ]);
    }

    for (const c of store.sourceConnections ?? []) {
      await client.query(`
        INSERT INTO source_connections (id, project_id, service, name, status, account_or_workspace,
          connected_project, last_sync_at, next_scheduled_sync_at, imported_records_count,
          failed_records_count, permission_status, auth_config, sync_history, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT DO NOTHING
      `, [
        c.id, c.projectId, c.service, c.name, c.status || 'DISCONNECTED',
        c.accountOrWorkspace || '', c.connectedProject || '', c.lastSyncAt || null,
        c.nextScheduledSyncAt || null, c.importedRecordsCount || 0, c.failedRecordsCount || 0,
        c.permissionStatus || 'Unauthorised', JSON.stringify(c.authConfig || {}),
        JSON.stringify(c.syncHistory || []), c.createdAt || new Date().toISOString(), c.updatedAt || new Date().toISOString(),
      ]);
    }

    for (const h of store.handoverReports ?? []) {
      await client.query(`
        INSERT INTO handover_reports (id, project_id, title, version, generated_by_id, generated_by_name,
          generated_at, project_overview, current_status, completed_work, pending_tasks, decisions,
          dependencies, risks_and_blockers, unresolved_questions, missing_and_conflicting,
          unapproved_findings, recommended_next_actions, source_references, executive_sign_off)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT DO NOTHING
      `, [
        h.id, h.projectId, h.title, h.version || '1.0.0', h.generatedById, h.generatedByName,
        h.generatedAt || new Date().toISOString(), h.projectOverview || '', h.currentStatus || '',
        JSON.stringify(h.completedWork || []), JSON.stringify(h.pendingTasks || []),
        JSON.stringify(h.decisions || []), JSON.stringify(h.dependencies || []),
        JSON.stringify(h.risksAndBlockers || []), JSON.stringify(h.unresolvedQuestions || []),
        JSON.stringify(h.missingAndConflictingInfo || []), JSON.stringify(h.unapprovedFindings || []),
        JSON.stringify(h.recommendedNextActions || []), JSON.stringify(h.sourceReferences || []),
        h.executiveSignOff ? JSON.stringify(h.executiveSignOff) : null,
      ]);
    }

    for (const g of store.githubConnections ?? []) {
      await client.query(`
        INSERT INTO github_connections (id, project_id, repo_owner, repo_name, branch,
          connected_at, last_synced_at, open_issues_count, open_prs_count, recent_commits_count, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT DO NOTHING
      `, [
        g.id, g.projectId, g.repoOwner, g.repoName, g.branch || 'main',
        g.connectedAt || new Date().toISOString(), g.lastSyncedAt || null,
        g.openIssuesCount || 0, g.openPRsCount || 0, g.recentCommitsCount || 0, g.status || 'CONNECTED',
      ]);
    }

    for (const a of store.activityLogs ?? []) {
      await client.query(`
        INSERT INTO activity_logs (id, project_id, user_id, user_name, action, category, details, timestamp)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [
        a.id, a.projectId, a.userId, a.userName, a.action, a.category, a.details || '', a.timestamp || new Date().toISOString(),
      ]);
    }

    for (const q of store.ragQueries ?? []) {
      await client.query(`
        INSERT INTO rag_queries (id, project_id, user_id, question, answer, timestamp)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO NOTHING
      `, [
        q.id, q.projectId, q.userId || null, q.question, JSON.stringify(q.answer), q.timestamp || new Date().toISOString(),
      ]);
    }

    for (const table of TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      actualCounts[table] = result.rows[0].count;
      if (actualCounts[table] !== sourceCounts[table]) {
        throw new Error(
          `Post-migration row count mismatch for ${table}: expected ${sourceCounts[table]}, got ${actualCounts[table]}.`
        );
      }
    }

    await client.query(
      'INSERT INTO data_imports (source_hash, record_counts) VALUES ($1, $2)',
      [sourceHash, JSON.stringify(actualCounts)]
    );

    console.log('[Migration] Verified database row counts match source JSON:', actualCounts);
  });

  console.log('[Migration] Migration completed successfully. JSON store preserved at:', dataFile);
  console.log('[Migration] Backup stored at:', backupPath);

  return { sourceCounts, targetCounts: actualCounts, backupPath };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  migrate()
    .catch((err) => {
      console.error('[Migration] Migration failed:', err instanceof Error ? err.message : 'Unknown error');
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
