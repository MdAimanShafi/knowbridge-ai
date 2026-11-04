/**
 * KNOWBRIDGE AI — PostgreSQL Database Adapter
 *
 * Implements IKnowbridgeDatabase against a PostgreSQL database.
 * Supports:
 * - Direct queries against PostgreSQL connection pool or client-bound transaction
 * - Single-roundtrip aggregated project metrics
 * - Safe transaction boundaries for multi-table updates
 * - JSON and array column serialization/deserialization
 * - Default seed restoration for testing and resets
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { query as defaultQuery, queryOne as defaultQueryOne, withTransaction as defaultWithTransaction } from './pgPool.ts';
import {
  User,
  Project,
  ProjectMember,
  ProjectDocument,
  Finding,
  HandoverReport,
  GitHubConnection,
  ActivityLog,
  SourceRecord,
  SourceConnection,
} from '../types/index.ts';
import { IKnowbridgeDatabase } from './dbInterface.ts';
import { getInitialData } from './db.ts';

function parseJsonField<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}

// ─── Row → Domain mappers ────────────────────────────────────────────────────

function rowToUser(row: any): User & { passwordHash: string } {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    title: row.title,
    avatarUrl: row.avatar_url,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    category: row.category,
    status: row.status,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    departingMemberName: row.departing_member_name,
    departingMemberRole: row.departing_member_role,
    successorName: row.successor_name,
    targetHandoverDate: row.target_handover_date,
    objectives: row.objectives,
    startDate: row.start_date,
    expectedCompletionDate: row.expected_completion_date,
    teamMembers: parseJsonField(row.team_members, []),
    techStack: parseJsonField(row.tech_stack, []),
    importantDeadlines: parseJsonField(row.important_deadlines, []),
    knownRisks: parseJsonField(row.known_risks, []),
    existingDependencies: parseJsonField(row.existing_dependencies, []),
    projectDocumentationNotes: row.project_documentation_notes,
    setupCompleted: Boolean(row.setup_completed),
    currentSetupStep: Number(row.current_setup_step ?? 1),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    documentCount: Number(row.document_count ?? 0),
    findingsCount: Number(row.findings_count ?? 0),
    pendingReviewCount: Number(row.pending_review_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    risksCount: Number(row.risks_count ?? 0),
  };
}

function rowToMember(row: any): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    role: row.role,
    responsibilities: row.responsibilities,
    joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : row.joined_at,
  };
}

function rowToDocument(row: any): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    filename: row.filename,
    originalName: row.original_name,
    filesize: Number(row.filesize),
    mimeType: row.mime_type,
    pageCount: Number(row.page_count),
    status: row.status,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader_name,
    contentHash: row.content_hash,
    extractedText: row.extracted_text,
    pages: parseJsonField(row.pages, []),
    summary: row.summary,
    provenance: row.provenance,
    error: row.error,
    uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : row.uploaded_at,
    processedAt: row.processed_at instanceof Date ? row.processed_at?.toISOString() : row.processed_at,
  };
}

function rowToFinding(row: any): Finding {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    category: row.category,
    evidenceStatus: row.evidence_status,
    reviewStatus: row.review_status,
    sourceDocumentId: row.source_document_id,
    sourceDocumentName: row.source_document_name,
    sourceRecordId: row.source_record_id,
    sourcePlatform: row.source_platform,
    sourceUrl: row.source_url,
    pageNumber: row.page_number,
    evidenceExcerpt: row.evidence_excerpt,
    conflictingDetails: row.conflicting_details,
    uncertaintyReason: row.uncertainty_reason,
    owner: row.owner,
    deadline: row.deadline,
    severity: row.severity,
    impact: row.impact,
    rationale: row.rationale,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at instanceof Date ? row.reviewed_at?.toISOString() : row.reviewed_at,
    reviewerNotes: row.reviewer_notes,
    isAiGenerated: Boolean(row.is_ai_generated),
    provenanceType: row.provenance_type,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function rowToSourceRecord(row: any): SourceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sourcePlatform: row.source_platform,
    externalSourceId: row.external_source_id,
    sourceUrl: row.source_url,
    recordType: row.record_type,
    title: row.title,
    content: row.content,
    author: row.author,
    createdDate: row.created_date instanceof Date ? row.created_date?.toISOString() : row.created_date,
    updatedDate: row.updated_date instanceof Date ? row.updated_date?.toISOString() : row.updated_date,
    retrievedDate: row.retrieved_date instanceof Date ? row.retrieved_date.toISOString() : row.retrieved_date,
    lastSynchronisedDate:
      row.last_synchronised_date instanceof Date
        ? row.last_synchronised_date.toISOString()
        : row.last_synchronised_date,
    contentHash: row.content_hash,
    permissionMetadata: parseJsonField(row.permission_metadata, {
      isPublic: false,
      visibility: 'private',
      requiredRole: 'MEMBER',
    }),
    version: Number(row.version),
    metadata: parseJsonField(row.metadata, {}),
  };
}

function rowToSourceConnection(row: any): SourceConnection {
  return {
    id: row.id,
    projectId: row.project_id,
    service: row.service,
    name: row.name,
    status: row.status,
    accountOrWorkspace: row.account_or_workspace,
    connectedProject: row.connected_project,
    lastSyncAt: row.last_sync_at instanceof Date ? row.last_sync_at?.toISOString() : row.last_sync_at,
    nextScheduledSyncAt:
      row.next_scheduled_sync_at instanceof Date
        ? row.next_scheduled_sync_at?.toISOString()
        : row.next_scheduled_sync_at,
    importedRecordsCount: Number(row.imported_records_count),
    failedRecordsCount: Number(row.failed_records_count),
    permissionStatus: row.permission_status,
    authConfig: parseJsonField(row.auth_config, {}),
    syncHistory: parseJsonField(row.sync_history, []),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function rowToHandoverReport(row: any): HandoverReport {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    version: row.version,
    generatedById: row.generated_by_id,
    generatedByName: row.generated_by_name,
    generatedAt: row.generated_at instanceof Date ? row.generated_at.toISOString() : row.generated_at,
    projectOverview: row.project_overview,
    currentStatus: row.current_status,
    completedWork: parseJsonField(row.completed_work, []),
    pendingTasks: parseJsonField(row.pending_tasks, []),
    decisions: parseJsonField(row.decisions, []),
    dependencies: parseJsonField(row.dependencies, []),
    risksAndBlockers: parseJsonField(row.risks_and_blockers, []),
    unresolvedQuestions: parseJsonField(row.unresolved_questions, []),
    missingAndConflictingInfo: parseJsonField(row.missing_and_conflicting, []),
    unapprovedFindings: parseJsonField(row.unapproved_findings, []),
    recommendedNextActions: parseJsonField(row.recommended_next_actions, []),
    sourceReferences: parseJsonField(row.source_references, []),
    executiveSignOff: parseJsonField(row.executive_sign_off, undefined),
  };
}

function rowToActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user_name,
    action: row.action,
    category: row.category,
    details: row.details,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
  };
}

// ─── PostgreSQL Database Class ───────────────────────────────────────────────

export class PgDatabase implements IKnowbridgeDatabase {
  public readonly mode = 'postgres' as const;
  private client: PoolClient | null = null;

  constructor(client?: PoolClient) {
    if (client) {
      this.client = client;
    }
  }

  private async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (this.client) {
      const res = await this.client.query(sql, params);
      return res.rows as T[];
    }
    return defaultQuery<T>(sql, params);
  }

  private async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  // --- Users ---
  async findUserByEmail(email: string) {
    const row = await this.queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return row ? rowToUser(row) : undefined;
  }

  async findUserById(id: string) {
    const row = await this.queryOne('SELECT * FROM users WHERE id = $1', [id]);
    if (!row) return null;
    const { passwordHash: _, ...safe } = rowToUser(row);
    return safe;
  }

  async createUser(userData: {
    email: string;
    name: string;
    title: string;
    password: string;
    role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'LEAD' | 'REVIEWER' | 'MEMBER';
  }) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(userData.password, salt);
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const row = await this.queryOne(
      `
      INSERT INTO users (id, email, name, title, role, password_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `,
      [id, userData.email.toLowerCase(), userData.name, userData.title || 'Project Member', userData.role || 'MEMBER', passwordHash]
    );
    const { passwordHash: _, ...safe } = rowToUser(row);
    return safe;
  }

  // --- Projects ---
  private async enrichProjectCounts(project: Project): Promise<Project> {
    const [docs, fnds] = await Promise.all([
      this.query<{ count: string | number }>(
        'SELECT COUNT(*)::int AS count FROM documents WHERE project_id = $1',
        [project.id]
      ),
      this.query<{
        total: string | number;
        pending: string | number;
        approved: string | number;
        risks: string | number;
      }>(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN review_status = 'PENDING' THEN 1 END)::int AS pending,
          COUNT(CASE WHEN review_status = 'APPROVED' THEN 1 END)::int AS approved,
          COUNT(CASE WHEN category IN ('RISK', 'BLOCKER') THEN 1 END)::int AS risks
        FROM findings WHERE project_id = $1
      `,
        [project.id]
      ),
    ]);

    return {
      ...project,
      documentCount: Number(docs[0]?.count ?? 0),
      findingsCount: Number(fnds[0]?.total ?? 0),
      pendingReviewCount: Number(fnds[0]?.pending ?? 0),
      approvedCount: Number(fnds[0]?.approved ?? 0),
      risksCount: Number(fnds[0]?.risks ?? 0),
    };
  }

  async getProjects() {
    const rows = await this.query('SELECT * FROM projects ORDER BY created_at DESC');
    const projects = rows.map(rowToProject);
    return Promise.all(projects.map((p) => this.enrichProjectCounts(p)));
  }

  async getProjectsForUser(userId: string) {
    const rows = await this.query(
      `
      SELECT p.*
      FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      ORDER BY p.created_at DESC
    `,
      [userId]
    );
    const projects = rows.map(rowToProject);
    return Promise.all(projects.map((p) => this.enrichProjectCounts(p)));
  }

  async getProjectById(id: string) {
    const row = await this.queryOne('SELECT * FROM projects WHERE id = $1', [id]);
    if (!row) return null;
    return this.enrichProjectCounts(rowToProject(row));
  }

  async createProject(data: Partial<Project> & { name: string; ownerId: string; ownerName: string }) {
    const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await this.query(
      `
      INSERT INTO projects (
        id, name, code, description, category, status, owner_id, owner_name,
        departing_member_name, departing_member_role, successor_name, target_handover_date,
        objectives, start_date, expected_completion_date, team_members, tech_stack,
        important_deadlines, known_risks, existing_dependencies, project_documentation_notes,
        setup_completed, current_setup_step, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, NOW(), NOW()
      )
    `,
      [
        id,
        data.name,
        data.code || data.name.substring(0, 4).toUpperCase(),
        data.description || '',
        data.category || 'General Engineering',
        data.status || 'ACTIVE',
        data.ownerId,
        data.ownerName,
        data.departingMemberName || null,
        data.departingMemberRole || null,
        data.successorName || null,
        data.targetHandoverDate || null,
        data.objectives || null,
        data.startDate || null,
        data.expectedCompletionDate || null,
        JSON.stringify(data.teamMembers || []),
        JSON.stringify(data.techStack || []),
        JSON.stringify(data.importantDeadlines || []),
        JSON.stringify(data.knownRisks || []),
        JSON.stringify(data.existingDependencies || []),
        data.projectDocumentationNotes || null,
        data.setupCompleted ?? false,
        data.currentSetupStep ?? 1,
      ]
    );
    return this.getProjectById(id);
  }

  async updateProject(id: string, updates: Partial<Project>) {
    const existing = await this.queryOne('SELECT id FROM projects WHERE id = $1', [id]);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const jsonFields = new Set([
      'teamMembers',
      'techStack',
      'importantDeadlines',
      'knownRisks',
      'existingDependencies',
    ]);
    const colMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      description: 'description',
      category: 'category',
      status: 'status',
      departingMemberName: 'departing_member_name',
      departingMemberRole: 'departing_member_role',
      successorName: 'successor_name',
      targetHandoverDate: 'target_handover_date',
      objectives: 'objectives',
      startDate: 'start_date',
      expectedCompletionDate: 'expected_completion_date',
      teamMembers: 'team_members',
      techStack: 'tech_stack',
      importantDeadlines: 'important_deadlines',
      knownRisks: 'known_risks',
      existingDependencies: 'existing_dependencies',
      projectDocumentationNotes: 'project_documentation_notes',
      setupCompleted: 'setup_completed',
      currentSetupStep: 'current_setup_step',
    };
    for (const [key, col] of Object.entries(colMap)) {
      if (key in updates) {
        fields.push(`${col} = $${i++}`);
        values.push(jsonFields.has(key) ? JSON.stringify((updates as any)[key]) : (updates as any)[key]);
      }
    }
    if (fields.length === 0) return this.getProjectById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    await this.query(`UPDATE projects SET ${fields.join(', ')} WHERE id = $${i}`, values);
    return this.getProjectById(id);
  }

  // --- Project Members ---
  async getProjectMembers(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM project_members WHERE project_id = $1 ORDER BY joined_at ASC',
      [projectId]
    );
    return rows.map(rowToMember);
  }

  async addProjectMember(projectId: string, user: User, role: string) {
    const row = await this.queryOne(
      `
      INSERT INTO project_members (id, project_id, user_id, user_name, user_email, role, joined_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (project_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        user_name = EXCLUDED.user_name,
        user_email = EXCLUDED.user_email
      RETURNING *
    `,
      [`pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, projectId, user.id, user.name, user.email, role]
    );
    return rowToMember(row);
  }

  async removeProjectMember(projectId: string, userId: string) {
    const result = await this.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING user_id',
      [projectId, userId]
    );
    return result.length > 0;
  }

  // --- Documents ---
  async getDocuments(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM documents WHERE project_id = $1 ORDER BY uploaded_at DESC',
      [projectId]
    );
    return rows.map(rowToDocument);
  }

  async getDocumentById(id: string) {
    const row = await this.queryOne('SELECT * FROM documents WHERE id = $1', [id]);
    return row ? rowToDocument(row) : null;
  }

  async addDocument(doc: ProjectDocument) {
    await this.query(
      `
      INSERT INTO documents (
        id, project_id, filename, original_name, filesize, mime_type, page_count,
        status, uploader_id, uploader_name, content_hash, extracted_text, pages, summary,
        provenance, error, uploaded_at, processed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `,
      [
        doc.id,
        doc.projectId,
        doc.filename,
        doc.originalName,
        doc.filesize,
        doc.mimeType,
        doc.pageCount,
        doc.status,
        doc.uploaderId,
        doc.uploaderName,
        doc.contentHash,
        doc.extractedText || null,
        JSON.stringify(doc.pages || []),
        doc.summary || null,
        doc.provenance,
        doc.error || null,
        doc.uploadedAt,
        doc.processedAt || null,
      ]
    );
    return doc;
  }

  async ingestDocumentIfAbsent(doc: ProjectDocument, sourceRecords: SourceRecord[]) {
    return this.withTransaction(async (txDb) => {
      const transactionDb = txDb as PgDatabase;
      const lockId = Number.parseInt(
        createHash('sha256').update(`${doc.projectId}:${doc.contentHash}`).digest('hex').slice(0, 8),
        16,
      ) | 0;
      await transactionDb.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

      const existing = await txDb.findDocumentByHash(doc.projectId, doc.contentHash);
      if (existing) return { document: existing, inserted: false };

      await txDb.addDocument(doc);
      await txDb.saveSourceRecords(sourceRecords);
      return { document: doc, inserted: true };
    });
  }

  async updateDocument(id: string, updates: Partial<ProjectDocument>) {
    const existing = await this.queryOne('SELECT id FROM documents WHERE id = $1', [id]);
    if (!existing) return null;

    const colMap: Record<string, string> = {
      status: 'status',
      summary: 'summary',
      extractedText: 'extracted_text',
      pages: 'pages',
      processedAt: 'processed_at',
      error: 'error',
      pageCount: 'page_count',
    };
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(colMap)) {
      if (key in updates) {
        fields.push(`${col} = $${i++}`);
        values.push(key === 'pages' ? JSON.stringify((updates as any)[key]) : (updates as any)[key]);
      }
    }
    if (fields.length === 0) return this.getDocumentById(id);
    values.push(id);
    await this.query(`UPDATE documents SET ${fields.join(', ')} WHERE id = $${i}`, values);
    return this.getDocumentById(id);
  }

  async deleteDocument(id: string) {
    const doc = await this.getDocumentById(id);
    if (!doc) return false;

    // Execute atomic cleanup of findings, associated source records, and document record
    const runDelete = async (q: (sql: string, params?: any[]) => Promise<any>) => {
      await q('DELETE FROM findings WHERE source_document_id = $1', [id]);
      await q(
        'DELETE FROM source_records WHERE project_id = $1 AND (external_source_id = $2 OR external_source_id LIKE $3 OR id LIKE $4)',
        [doc.projectId, id, `${id}#%`, `sr-doc-${id}-%`]
      );
      await q('DELETE FROM documents WHERE id = $1', [id]);
    };

    if (this.client) {
      await runDelete(this.query.bind(this));
    } else {
      await defaultWithTransaction(async (c) => {
        await runDelete((sql, params) => c.query(sql, params));
      });
    }
    return true;
  }

  async findDocumentByHash(projectId: string, contentHash: string) {
    const row = await this.queryOne(
      'SELECT * FROM documents WHERE project_id = $1 AND content_hash = $2',
      [projectId, contentHash]
    );
    return row ? rowToDocument(row) : null;
  }

  // --- Findings ---
  async getFindings(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM findings WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    return rows.map(rowToFinding);
  }

  async getFindingById(id: string) {
    const row = await this.queryOne('SELECT * FROM findings WHERE id = $1', [id]);
    return row ? rowToFinding(row) : null;
  }

  async addFinding(finding: Finding) {
    await this.query(
      `
      INSERT INTO findings (
        id, project_id, title, description, category, evidence_status, review_status,
        source_document_id, source_document_name, source_record_id, source_platform, source_url,
        page_number, evidence_excerpt, conflicting_details, uncertainty_reason, owner, deadline,
        severity, impact, rationale, reviewer_id, reviewer_name, reviewed_at, reviewer_notes,
        is_ai_generated, provenance_type, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        evidence_status = EXCLUDED.evidence_status,
        review_status = EXCLUDED.review_status,
        source_document_id = EXCLUDED.source_document_id,
        source_document_name = EXCLUDED.source_document_name,
        source_record_id = EXCLUDED.source_record_id,
        source_platform = EXCLUDED.source_platform,
        source_url = EXCLUDED.source_url,
        page_number = EXCLUDED.page_number,
        evidence_excerpt = EXCLUDED.evidence_excerpt,
        conflicting_details = EXCLUDED.conflicting_details,
        uncertainty_reason = EXCLUDED.uncertainty_reason,
        owner = EXCLUDED.owner,
        deadline = EXCLUDED.deadline,
        severity = EXCLUDED.severity,
        impact = EXCLUDED.impact,
        rationale = EXCLUDED.rationale,
        reviewer_id = EXCLUDED.reviewer_id,
        reviewer_name = EXCLUDED.reviewer_name,
        reviewed_at = EXCLUDED.reviewed_at,
        reviewer_notes = EXCLUDED.reviewer_notes,
        is_ai_generated = EXCLUDED.is_ai_generated,
        provenance_type = EXCLUDED.provenance_type,
        updated_at = EXCLUDED.updated_at
    `,
      [
        finding.id,
        finding.projectId,
        finding.title,
        finding.description,
        finding.category,
        finding.evidenceStatus,
        finding.reviewStatus,
        finding.sourceDocumentId || null,
        finding.sourceDocumentName || null,
        finding.sourceRecordId || null,
        finding.sourcePlatform || null,
        finding.sourceUrl || null,
        finding.pageNumber || null,
        finding.evidenceExcerpt || null,
        finding.conflictingDetails || null,
        finding.uncertaintyReason || null,
        finding.owner || null,
        finding.deadline || null,
        finding.severity || null,
        finding.impact || null,
        finding.rationale || null,
        finding.reviewerId || null,
        finding.reviewerName || null,
        finding.reviewedAt || null,
        finding.reviewerNotes || null,
        finding.isAiGenerated,
        finding.provenanceType || null,
        finding.createdAt,
        finding.updatedAt,
      ]
    );
    return finding;
  }

  async addFindings(findings: Finding[]) {
    for (const f of findings) {
      await this.addFinding(f);
    }
    return findings;
  }

  async replaceAiFindingsForDocument(documentId: string, newFindings: Finding[]) {
    const runReplace = async (
      queryFn: (sql: string, params?: any[]) => Promise<any>
    ) => {
      const reviewed = await queryFn(
        `SELECT id FROM findings WHERE source_document_id = $1 AND is_ai_generated = TRUE AND review_status != 'PENDING'`,
        [documentId]
      );
      const rows = (reviewed.rows || reviewed) as any[];
      if (rows.length > 0) return false;

      await queryFn(
        `DELETE FROM findings WHERE source_document_id = $1 AND is_ai_generated = TRUE`,
        [documentId]
      );
      for (const f of newFindings) {
        await this.addFinding(f);
      }
      return true;
    };

    if (this.client) {
      return runReplace(this.query.bind(this));
    }
    return defaultWithTransaction(async (c) => {
      return runReplace((sql, params) => c.query(sql, params));
    });
  }

  async updateFinding(id: string, updates: Partial<Finding>) {
    const existing = await this.queryOne('SELECT id FROM findings WHERE id = $1', [id]);
    if (!existing) return null;

    const colMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      category: 'category',
      evidenceStatus: 'evidence_status',
      reviewStatus: 'review_status',
      evidenceExcerpt: 'evidence_excerpt',
      owner: 'owner',
      deadline: 'deadline',
      severity: 'severity',
      rationale: 'rationale',
      impact: 'impact',
      conflictingDetails: 'conflicting_details',
      uncertaintyReason: 'uncertainty_reason',
      reviewerId: 'reviewer_id',
      reviewerName: 'reviewer_name',
      reviewedAt: 'reviewed_at',
      reviewerNotes: 'reviewer_notes',
    };
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(colMap)) {
      if (key in updates) {
        fields.push(`${col} = $${i++}`);
        values.push((updates as any)[key]);
      }
    }
    if (fields.length === 0) return this.getFindingById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);
    await this.query(`UPDATE findings SET ${fields.join(', ')} WHERE id = $${i}`, values);
    return this.getFindingById(id);
  }

  // --- Handover Reports ---
  async getHandoverReports(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM handover_reports WHERE project_id = $1 ORDER BY generated_at DESC',
      [projectId]
    );
    return rows.map(rowToHandoverReport);
  }

  async getHandoverReportById(id: string) {
    const row = await this.queryOne('SELECT * FROM handover_reports WHERE id = $1', [id]);
    return row ? rowToHandoverReport(row) : null;
  }

  async saveHandoverReport(report: HandoverReport) {
    await this.query(
      `
      INSERT INTO handover_reports (
        id, project_id, title, version, generated_by_id, generated_by_name,
        generated_at, project_overview, current_status, completed_work, pending_tasks, decisions,
        dependencies, risks_and_blockers, unresolved_questions, missing_and_conflicting,
        unapproved_findings, recommended_next_actions, source_references, executive_sign_off
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        version = EXCLUDED.version,
        project_overview = EXCLUDED.project_overview,
        current_status = EXCLUDED.current_status,
        completed_work = EXCLUDED.completed_work,
        pending_tasks = EXCLUDED.pending_tasks,
        decisions = EXCLUDED.decisions,
        dependencies = EXCLUDED.dependencies,
        risks_and_blockers = EXCLUDED.risks_and_blockers,
        unresolved_questions = EXCLUDED.unresolved_questions,
        missing_and_conflicting = EXCLUDED.missing_and_conflicting,
        unapproved_findings = EXCLUDED.unapproved_findings,
        recommended_next_actions = EXCLUDED.recommended_next_actions,
        source_references = EXCLUDED.source_references,
        executive_sign_off = EXCLUDED.executive_sign_off
    `,
      [
        report.id,
        report.projectId,
        report.title,
        report.version,
        report.generatedById,
        report.generatedByName,
        report.generatedAt,
        report.projectOverview,
        report.currentStatus,
        JSON.stringify(report.completedWork || []),
        JSON.stringify(report.pendingTasks || []),
        JSON.stringify(report.decisions || []),
        JSON.stringify(report.dependencies || []),
        JSON.stringify(report.risksAndBlockers || []),
        JSON.stringify(report.unresolvedQuestions || []),
        JSON.stringify(report.missingAndConflictingInfo || []),
        JSON.stringify(report.unapprovedFindings || []),
        JSON.stringify(report.recommendedNextActions || []),
        JSON.stringify(report.sourceReferences || []),
        report.executiveSignOff ? JSON.stringify(report.executiveSignOff) : null,
      ]
    );
    return report;
  }

  async save(): Promise<void> {
    // In PostgreSQL, all operations are persisted immediately via transactions or auto-commit
  }

  // --- GitHub Connections ---
  async getGitHubConnection(projectId: string) {
    const row = await this.queryOne('SELECT * FROM github_connections WHERE project_id = $1', [projectId]);
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      branch: row.branch,
      connectedAt: row.connected_at instanceof Date ? row.connected_at.toISOString() : row.connected_at,
      lastSyncedAt: row.last_synced_at instanceof Date ? row.last_synced_at?.toISOString() : row.last_synced_at,
      openIssuesCount: Number(row.open_issues_count),
      openPRsCount: Number(row.open_prs_count),
      recentCommitsCount: Number(row.recent_commits_count),
      status: row.status,
    } as GitHubConnection;
  }

  async saveGitHubConnection(conn: GitHubConnection) {
    await this.query(
      `
      INSERT INTO github_connections (
        id, project_id, repo_owner, repo_name, branch,
        connected_at, last_synced_at, open_issues_count, open_prs_count, recent_commits_count, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (project_id) DO UPDATE SET
        repo_owner = EXCLUDED.repo_owner,
        repo_name = EXCLUDED.repo_name,
        branch = EXCLUDED.branch,
        last_synced_at = EXCLUDED.last_synced_at,
        open_issues_count = EXCLUDED.open_issues_count,
        open_prs_count = EXCLUDED.open_prs_count,
        recent_commits_count = EXCLUDED.recent_commits_count,
        status = EXCLUDED.status
    `,
      [
        conn.id,
        conn.projectId,
        conn.repoOwner,
        conn.repoName,
        conn.branch,
        conn.connectedAt,
        conn.lastSyncedAt || null,
        conn.openIssuesCount,
        conn.openPRsCount,
        conn.recentCommitsCount,
        conn.status,
      ]
    );
    return conn;
  }

  // --- Activity Logs ---
  async logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const timestamp = new Date().toISOString();
    await this.query(
      `
      INSERT INTO activity_logs (id, project_id, user_id, user_name, action, category, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [id, log.projectId, log.userId, log.userName, log.action, log.category, log.details, timestamp]
    );
    return { id, timestamp, ...log } as ActivityLog;
  }

  async getActivityLogs(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM activity_logs WHERE project_id = $1 ORDER BY timestamp DESC LIMIT 500',
      [projectId]
    );
    return rows.map(rowToActivityLog);
  }

  // --- Source Records ---
  async getSourceRecords(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM source_records WHERE project_id = $1 ORDER BY retrieved_date DESC',
      [projectId]
    );
    return rows.map(rowToSourceRecord);
  }

  async saveSourceRecords(records: SourceRecord[]) {
    for (const r of records) {
      await this.query(
        `
        INSERT INTO source_records (
          id, project_id, source_platform, external_source_id, source_url,
          record_type, title, content, author, created_date, updated_date, retrieved_date,
          last_synchronised_date, content_hash, permission_metadata, version, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          author = EXCLUDED.author,
          updated_date = EXCLUDED.updated_date,
          last_synchronised_date = EXCLUDED.last_synchronised_date,
          content_hash = EXCLUDED.content_hash,
          permission_metadata = EXCLUDED.permission_metadata,
          version = EXCLUDED.version + 1,
          metadata = EXCLUDED.metadata
      `,
        [
          r.id,
          r.projectId,
          r.sourcePlatform,
          r.externalSourceId,
          r.sourceUrl,
          r.recordType,
          r.title,
          r.content,
          r.author || '',
          r.createdDate || null,
          r.updatedDate || null,
          r.retrievedDate,
          r.lastSynchronisedDate,
          r.contentHash,
          JSON.stringify(r.permissionMetadata || {}),
          r.version || 1,
          JSON.stringify(r.metadata || {}),
        ]
      );
    }
    return records;
  }

  async deleteSourceRecordsByPlatform(projectId: string, platform: string) {
    await this.query('DELETE FROM source_records WHERE project_id = $1 AND source_platform = $2', [
      projectId,
      platform,
    ]);
  }

  // --- Source Connections ---
  async getSourceConnections(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM source_connections WHERE project_id = $1 ORDER BY created_at ASC',
      [projectId]
    );
    return rows.map(rowToSourceConnection);
  }

  async getSourceConnection(projectId: string, service: string) {
    const row = await this.queryOne(
      'SELECT * FROM source_connections WHERE project_id = $1 AND service = $2',
      [projectId, service]
    );
    return row ? rowToSourceConnection(row) : null;
  }

  async saveSourceConnection(conn: SourceConnection) {
    await this.query(
      `
      INSERT INTO source_connections (
        id, project_id, service, name, status, account_or_workspace,
        connected_project, last_sync_at, next_scheduled_sync_at, imported_records_count,
        failed_records_count, permission_status, auth_config, sync_history, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (project_id, service) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        account_or_workspace = EXCLUDED.account_or_workspace,
        connected_project = EXCLUDED.connected_project,
        last_sync_at = EXCLUDED.last_sync_at,
        next_scheduled_sync_at = EXCLUDED.next_scheduled_sync_at,
        imported_records_count = EXCLUDED.imported_records_count,
        failed_records_count = EXCLUDED.failed_records_count,
        permission_status = EXCLUDED.permission_status,
        auth_config = EXCLUDED.auth_config,
        sync_history = EXCLUDED.sync_history,
        updated_at = EXCLUDED.updated_at
    `,
      [
        conn.id,
        conn.projectId,
        conn.service,
        conn.name,
        conn.status,
        conn.accountOrWorkspace || '',
        conn.connectedProject || '',
        conn.lastSyncAt || null,
        conn.nextScheduledSyncAt || null,
        conn.importedRecordsCount || 0,
        conn.failedRecordsCount || 0,
        conn.permissionStatus || 'Unauthorised',
        JSON.stringify(conn.authConfig || {}),
        JSON.stringify(conn.syncHistory || []),
        conn.createdAt,
        conn.updatedAt,
      ]
    );
    return conn;
  }

  async removeSourceConnection(projectId: string, service: string) {
    await this.query('DELETE FROM source_connections WHERE project_id = $1 AND service = $2', [
      projectId,
      service,
    ]);
  }

  // --- RAG Queries ---
  async saveRagQuery(projectId: string, question: string, answer: any, userId?: string) {
    const id = `rag-q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();
    await this.query(
      `
      INSERT INTO rag_queries (id, project_id, user_id, question, answer, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [id, projectId, userId || null, question, JSON.stringify(answer), timestamp]
    );
    return { id, projectId, userId, question, answer, timestamp };
  }

  async getRagQueries(projectId: string) {
    const rows = await this.query(
      'SELECT * FROM rag_queries WHERE project_id = $1 ORDER BY timestamp DESC LIMIT 200',
      [projectId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      userId: r.user_id,
      question: r.question,
      answer: parseJsonField(r.answer, r.answer),
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    }));
  }

  // --- Transaction Support ---
  async withTransaction<T>(fn: (txDb: IKnowbridgeDatabase) => Promise<T>): Promise<T> {
    if (this.client) {
      // Already in an active transaction
      return fn(this);
    }
    return defaultWithTransaction(async (client) => {
      const txDb = new PgDatabase(client);
      return fn(txDb);
    });
  }

  // --- Default Seed Reset ---
  async resetToDefaultSeed(): Promise<boolean> {
    const fresh = getInitialData();
    return this.withTransaction(async (txDb) => {
      const db = txDb as PgDatabase;
      await db.query(`
        TRUNCATE TABLE
          rag_queries,
          activity_logs,
          github_connections,
          handover_reports,
          source_connections,
          source_records,
          findings,
          documents,
          project_members,
          projects,
          users
        CASCADE
      `);

      for (const u of fresh.users) {
        await db.query(
          `INSERT INTO users (id, email, name, title, avatar_url, role, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [u.id, u.email.toLowerCase(), u.name, u.title, u.avatarUrl || null, u.role, u.passwordHash, u.createdAt]
        );
      }

      for (const p of fresh.projects) {
        await db.query(
          `INSERT INTO projects (
             id, name, code, description, category, status, owner_id, owner_name,
             departing_member_name, departing_member_role, successor_name, target_handover_date,
             objectives, start_date, expected_completion_date, team_members, tech_stack,
             important_deadlines, known_risks, existing_dependencies, project_documentation_notes,
             setup_completed, current_setup_step, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
          [
            p.id, p.name, p.code, p.description, p.category, p.status, p.ownerId, p.ownerName,
            p.departingMemberName || null, p.departingMemberRole || null, p.successorName || null, p.targetHandoverDate || null,
            p.objectives || null, p.startDate || null, p.expectedCompletionDate || null,
            JSON.stringify(p.teamMembers || []), JSON.stringify(p.techStack || []),
            JSON.stringify(p.importantDeadlines || []), JSON.stringify(p.knownRisks || []),
            JSON.stringify(p.existingDependencies || []), p.projectDocumentationNotes || null,
            p.setupCompleted ?? false, p.currentSetupStep ?? 1, p.createdAt, p.updatedAt,
          ]
        );
      }

      for (const m of fresh.projectMembers) {
        await db.query(
          `INSERT INTO project_members (id, project_id, user_id, user_name, user_email, role, joined_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [m.id, m.projectId, m.userId, m.userName, m.userEmail, m.role, m.joinedAt]
        );
      }

      for (const d of fresh.documents) {
        await db.query(
          `INSERT INTO documents (
             id, project_id, filename, original_name, filesize, mime_type, page_count,
             status, uploader_id, uploader_name, content_hash, extracted_text, pages, summary,
             provenance, error, uploaded_at, processed_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            d.id, d.projectId, d.filename, d.originalName, d.filesize, d.mimeType, d.pageCount,
            d.status, d.uploaderId, d.uploaderName, d.contentHash, d.extractedText || null,
            JSON.stringify(d.pages || []), d.summary || null, d.provenance, d.error || null,
            d.uploadedAt, d.processedAt || null,
          ]
        );
      }

      for (const f of fresh.findings) {
        await db.query(
          `INSERT INTO findings (
             id, project_id, title, description, category, evidence_status, review_status,
             source_document_id, source_document_name, source_record_id, source_platform, source_url,
             page_number, evidence_excerpt, conflicting_details, uncertainty_reason, owner, deadline,
             severity, impact, rationale, reviewer_id, reviewer_name, reviewed_at, reviewer_notes,
             is_ai_generated, provenance_type, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)`,
          [
            f.id, f.projectId, f.title, f.description, f.category, f.evidenceStatus, f.reviewStatus,
            f.sourceDocumentId || null, f.sourceDocumentName || null, f.sourceRecordId || null,
            f.sourcePlatform || null, f.sourceUrl || null, f.pageNumber || null,
            f.evidenceExcerpt || null, f.conflictingDetails || null, f.uncertaintyReason || null,
            f.owner || null, f.deadline || null, f.severity || null, f.impact || null, f.rationale || null,
            f.reviewerId || null, f.reviewerName || null, f.reviewedAt || null, f.reviewerNotes || null,
            f.isAiGenerated, f.provenanceType || null, f.createdAt, f.updatedAt,
          ]
        );
      }

      for (const r of fresh.sourceRecords) {
        await db.query(
          `INSERT INTO source_records (
             id, project_id, source_platform, external_source_id, source_url,
             record_type, title, content, author, created_date, updated_date, retrieved_date,
             last_synchronised_date, content_hash, permission_metadata, version, metadata
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            r.id, r.projectId, r.sourcePlatform, r.externalSourceId, r.sourceUrl, r.recordType,
            r.title, r.content, r.author || '', r.createdDate || null, r.updatedDate || null,
            r.retrievedDate, r.lastSynchronisedDate, r.contentHash,
            JSON.stringify(r.permissionMetadata || {}), r.version || 1, JSON.stringify(r.metadata || {}),
          ]
        );
      }

      for (const c of fresh.sourceConnections) {
        await db.query(
          `INSERT INTO source_connections (
             id, project_id, service, name, status, account_or_workspace,
             connected_project, last_sync_at, next_scheduled_sync_at, imported_records_count,
             failed_records_count, permission_status, auth_config, sync_history, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            c.id, c.projectId, c.service, c.name, c.status, c.accountOrWorkspace || '',
            c.connectedProject || '', c.lastSyncAt || null, c.nextScheduledSyncAt || null,
            c.importedRecordsCount || 0, c.failedRecordsCount || 0, c.permissionStatus || 'Unauthorised',
            JSON.stringify(c.authConfig || {}), JSON.stringify(c.syncHistory || []),
            c.createdAt, c.updatedAt,
          ]
        );
      }

      for (const g of fresh.githubConnections) {
        await db.query(
          `INSERT INTO github_connections (
             id, project_id, repo_owner, repo_name, branch,
             connected_at, last_synced_at, open_issues_count, open_prs_count, recent_commits_count, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            g.id, g.projectId, g.repoOwner, g.repoName, g.branch, g.connectedAt,
            g.lastSyncedAt || null, g.openIssuesCount, g.openPRsCount, g.recentCommitsCount, g.status,
          ]
        );
      }

      for (const a of fresh.activityLogs) {
        await db.query(
          `INSERT INTO activity_logs (id, project_id, user_id, user_name, action, category, details, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [a.id, a.projectId, a.userId, a.userName, a.action, a.category, a.details, a.timestamp]
        );
      }

      return true;
    });
  }
}

export const pgDb = new PgDatabase();
