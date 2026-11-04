-- KNOWBRIDGE AI — PostgreSQL Schema Migration 001
-- Creates core tables. The migration runner applies this file transactionally.

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT 'Project Member',
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'MEMBER',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));

-- ─── PROJECTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  code                        TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  category                    TEXT NOT NULL DEFAULT 'General Engineering',
  status                      TEXT NOT NULL DEFAULT 'ACTIVE',
  owner_id                    TEXT NOT NULL REFERENCES users(id),
  owner_name                  TEXT NOT NULL,
  departing_member_name       TEXT,
  departing_member_role       TEXT,
  successor_name              TEXT,
  target_handover_date        TEXT,
  objectives                  TEXT,
  start_date                  TEXT,
  expected_completion_date    TEXT,
  team_members                JSONB DEFAULT '[]',
  tech_stack                  JSONB DEFAULT '[]',
  important_deadlines         JSONB DEFAULT '[]',
  known_risks                 JSONB DEFAULT '[]',
  existing_dependencies       JSONB DEFAULT '[]',
  project_documentation_notes TEXT,
  setup_completed             BOOLEAN DEFAULT FALSE,
  current_setup_step          INTEGER DEFAULT 1,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- ─── PROJECT MEMBERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name        TEXT NOT NULL,
  user_email       TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'MEMBER',
  responsibilities TEXT,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);

-- ─── DOCUMENTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  original_name  TEXT NOT NULL,
  filesize       BIGINT NOT NULL DEFAULT 0,
  mime_type      TEXT NOT NULL,
  page_count     INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'UPLOADED',
  uploader_id    TEXT NOT NULL REFERENCES users(id),
  uploader_name  TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  extracted_text TEXT,
  pages          JSONB DEFAULT '[]',
  summary        TEXT,
  provenance     TEXT NOT NULL DEFAULT 'USER_UPLOAD',
  ocr_status     TEXT,
  error          TEXT,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents (project_id, content_hash);

-- ─── FINDINGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS findings (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  category             TEXT NOT NULL,
  evidence_status      TEXT NOT NULL DEFAULT 'UNCERTAIN',
  review_status        TEXT NOT NULL DEFAULT 'PENDING',
  source_document_id   TEXT REFERENCES documents(id) ON DELETE SET NULL,
  source_document_name TEXT,
  source_record_id     TEXT,
  source_platform      TEXT,
  source_url           TEXT,
  page_number          INTEGER,
  evidence_excerpt     TEXT,
  conflicting_details  TEXT,
  uncertainty_reason   TEXT,
  owner                TEXT,
  deadline             TEXT,
  severity             TEXT,
  impact               TEXT,
  rationale            TEXT,
  reviewer_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name        TEXT,
  reviewed_at          TIMESTAMPTZ,
  reviewer_notes       TEXT,
  is_ai_generated      BOOLEAN NOT NULL DEFAULT TRUE,
  provenance_type      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_project ON findings (project_id);
CREATE INDEX IF NOT EXISTS idx_findings_review_status ON findings (project_id, review_status);
CREATE INDEX IF NOT EXISTS idx_findings_category ON findings (project_id, category);

-- ─── SOURCE RECORDS (Unified Knowledge Base) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS source_records (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_platform      TEXT NOT NULL,
  external_source_id   TEXT NOT NULL,
  source_url           TEXT NOT NULL,
  record_type          TEXT NOT NULL,
  title                TEXT NOT NULL,
  content              TEXT NOT NULL,
  author               TEXT NOT NULL DEFAULT '',
  created_date         TIMESTAMPTZ,
  updated_date         TIMESTAMPTZ,
  retrieved_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synchronised_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash         TEXT NOT NULL,
  permission_metadata  JSONB DEFAULT '{}',
  version              INTEGER NOT NULL DEFAULT 1,
  metadata             JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_source_records_project ON source_records (project_id);
CREATE INDEX IF NOT EXISTS idx_source_records_platform ON source_records (project_id, source_platform);
CREATE INDEX IF NOT EXISTS idx_source_records_hash ON source_records (project_id, content_hash);

-- ─── SOURCE CONNECTIONS (Connector Registry) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS source_connections (
  id                      TEXT PRIMARY KEY,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  service                 TEXT NOT NULL,
  name                    TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'DISCONNECTED',
  account_or_workspace    TEXT NOT NULL DEFAULT '',
  connected_project       TEXT NOT NULL DEFAULT '',
  last_sync_at            TIMESTAMPTZ,
  next_scheduled_sync_at  TIMESTAMPTZ,
  imported_records_count  INTEGER NOT NULL DEFAULT 0,
  failed_records_count    INTEGER NOT NULL DEFAULT 0,
  permission_status       TEXT NOT NULL DEFAULT 'Unauthorised',
  -- Encrypted token storage: store AES-256-GCM encrypted tokens here
  encrypted_token         TEXT,
  auth_config             JSONB DEFAULT '{}',
  sync_history            JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, service)
);
CREATE INDEX IF NOT EXISTS idx_source_connections_project ON source_connections (project_id);

-- ─── HANDOVER REPORTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS handover_reports (
  id                        TEXT PRIMARY KEY,
  project_id                TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                     TEXT NOT NULL,
  version                   TEXT NOT NULL DEFAULT '1.0.0',
  generated_by_id           TEXT NOT NULL REFERENCES users(id),
  generated_by_name         TEXT NOT NULL,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_overview          TEXT NOT NULL DEFAULT '',
  current_status            TEXT NOT NULL DEFAULT '',
  completed_work            JSONB DEFAULT '[]',
  pending_tasks             JSONB DEFAULT '[]',
  decisions                 JSONB DEFAULT '[]',
  dependencies              JSONB DEFAULT '[]',
  risks_and_blockers        JSONB DEFAULT '[]',
  unresolved_questions      JSONB DEFAULT '[]',
  missing_and_conflicting   JSONB DEFAULT '[]',
  unapproved_findings       JSONB DEFAULT '[]',
  recommended_next_actions  JSONB DEFAULT '[]',
  source_references         JSONB DEFAULT '[]',
  executive_sign_off        JSONB
);
CREATE INDEX IF NOT EXISTS idx_handover_reports_project ON handover_reports (project_id);

-- ─── GITHUB CONNECTIONS (Legacy compatibility) ───────────────────────────────
CREATE TABLE IF NOT EXISTS github_connections (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  repo_owner           TEXT NOT NULL,
  repo_name            TEXT NOT NULL,
  branch               TEXT NOT NULL DEFAULT 'main',
  connected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at       TIMESTAMPTZ,
  open_issues_count    INTEGER NOT NULL DEFAULT 0,
  open_prs_count       INTEGER NOT NULL DEFAULT 0,
  recent_commits_count INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'CONNECTED',
  UNIQUE (project_id)
);

-- ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  user_name  TEXT NOT NULL,
  action     TEXT NOT NULL,
  category   TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs (project_id, timestamp DESC);

-- ─── RAG QUERY LOG ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_queries (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id    TEXT,
  question   TEXT NOT NULL,
  answer     JSONB NOT NULL,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_queries_project ON rag_queries (project_id, timestamp DESC);
