import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newDb, DataType } from 'pg-mem';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-more-than-32-characters';
process.env.GEMINI_API_KEY = 'API';
process.env.DATABASE_MODE = 'postgres';

let server;
let baseUrl;
let pgPoolModule;
let dbModule;
let appModule;
let ownerToken;
let memberToken;
let reviewerToken;
let outsiderToken;
let testProjectId;
let testDocId;
let testFindingId;
let testReportId;

function setupMockPostgres() {
  const mem = newDb();

  // Register PostgreSQL advisory lock functions for test environment
  mem.public.registerFunction({
    name: 'pg_advisory_lock',
    args: [DataType.integer],
    returns: DataType.bool,
    implementation: () => true,
  });
  mem.public.registerFunction({
    name: 'pg_advisory_unlock',
    args: [DataType.integer],
    returns: DataType.bool,
    implementation: () => true,
  });
  mem.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.bool,
    implementation: () => true,
  });

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();

  // Wire transaction BEGIN / ROLLBACK into memory snapshots for test isolation
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => {
    const client = await originalConnect();
    let backup = null;
    const originalQuery = client.query.bind(client);
    client.query = async (text, params) => {
      if (typeof text === 'string') {
        const trimmed = text.trim().toUpperCase();
        if (trimmed === 'BEGIN') {
          backup = mem.backup();
          return { rows: [] };
        }
        if (trimmed === 'ROLLBACK') {
          if (backup) {
            backup.restore();
            backup = null;
          }
          return { rows: [] };
        }
        if (trimmed === 'COMMIT') {
          backup = null;
          return { rows: [] };
        }
      }
      return originalQuery(text, params);
    };
    return client;
  };

  return { mem, pool };
}

async function request(method, route, token, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

before(async () => {
  // 1. Initialize isolated PostgreSQL engine
  const { pool } = setupMockPostgres();

  pgPoolModule = await import('../src/server/pgPool.ts');
  pgPoolModule.setPool(pool);

  dbModule = await import('../src/server/db.ts');
  dbModule.setDatabaseModeForTesting('postgres');

  // 2. Run migrations against isolated PostgreSQL database
  await pgPoolModule.runMigrations();

  // 3. Start Express server with PostgreSQL runtime
  appModule = await import('../server.ts');
  server = appModule.app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pgPoolModule.closePool();
  dbModule.setDatabaseModeForTesting(null);
});

test('1. Database health check reports PostgreSQL active and UP', async () => {
  const health = await dbModule.getDatabaseHealth();
  assert.equal(health.mode, 'postgres');
  assert.equal(health.status, 'UP');
  assert.ok(typeof health.latencyMs === 'number');

  const { response, data } = await request('GET', '/api/health');
  assert.equal(response.status, 200);
  assert.equal(data.status, 'HEALTHY');
  assert.equal(data.database.mode, 'postgres');
  assert.equal(data.database.status, 'UP');
});

test('2. Authentication: Registration and Login work against PostgreSQL', async () => {
  // Register Owner
  const ownerRes = await request('POST', '/api/auth/register', null, {
    name: 'PG Project Owner',
    email: 'pg-owner@knowbridge.ai',
    password: 'password-12345',
    title: 'Lead Architect',
  });
  assert.equal(ownerRes.response.status, 201);
  assert.ok(ownerRes.data.token);
  assert.equal(ownerRes.data.user.email, 'pg-owner@knowbridge.ai');
  ownerToken = ownerRes.data.token;

  // Register Member
  const memberRes = await request('POST', '/api/auth/register', null, {
    name: 'PG Project Member',
    email: 'pg-member@knowbridge.ai',
    password: 'password-12345',
    title: 'Software Engineer',
  });
  assert.equal(memberRes.response.status, 201);
  memberToken = memberRes.data.token;

  // Register Reviewer
  const reviewerRes = await request('POST', '/api/auth/register', null, {
    name: 'PG Project Reviewer',
    email: 'pg-reviewer@knowbridge.ai',
    password: 'password-12345',
    title: 'QA / Reviewer',
  });
  assert.equal(reviewerRes.response.status, 201);
  reviewerToken = reviewerRes.data.token;

  // Register Outsider (not added to project)
  const outsiderRes = await request('POST', '/api/auth/register', null, {
    name: 'PG Outsider',
    email: 'pg-outsider@knowbridge.ai',
    password: 'password-12345',
  });
  assert.equal(outsiderRes.response.status, 201);
  outsiderToken = outsiderRes.data.token;

  // Login verification
  const loginRes = await request('POST', '/api/auth/login', null, {
    email: 'pg-owner@knowbridge.ai',
    password: 'password-12345',
  });
  assert.equal(loginRes.response.status, 200);
  assert.ok(loginRes.data.token);

  // Profile lookup
  const meRes = await request('GET', '/api/auth/me', ownerToken);
  assert.equal(meRes.response.status, 200);
  assert.equal(meRes.data.user.name, 'PG Project Owner');
});

test('3. Projects & Project Membership: Creation, RBAC, and Member Management in PostgreSQL', async () => {
  // Create Project as Owner
  const createRes = await request('POST', '/api/projects', ownerToken, {
    name: 'PostgreSQL Core Migration',
    code: 'PG-MIG',
    description: 'Transitioning the KnowBridge runtime to PostgreSQL.',
    category: 'Infrastructure',
    targetHandoverDate: '2026-12-31',
  });
  assert.equal(createRes.response.status, 201);
  assert.ok(createRes.data.project.id);
  testProjectId = createRes.data.project.id;

  // Verify Project Retrieval
  const getRes = await request('GET', `/api/projects/${testProjectId}`, ownerToken);
  assert.equal(getRes.response.status, 200);
  assert.equal(getRes.data.project.name, 'PostgreSQL Core Migration');
  assert.equal(getRes.data.project.documentCount, 0);

  // List projects for owner
  const listRes = await request('GET', '/api/projects', ownerToken);
  assert.equal(listRes.response.status, 200);
  assert.ok(listRes.data.projects.some((p) => p.id === testProjectId));

  // Outsider cannot access project
  const outsiderAccess = await request('GET', `/api/projects/${testProjectId}`, outsiderToken);
  assert.equal(outsiderAccess.response.status, 403);

  // Add Member
  const memberProfile = await request('GET', '/api/auth/me', memberToken);
  const addMemberRes = await request('POST', `/api/projects/${testProjectId}/members`, ownerToken, {
    userId: memberProfile.data.user.id,
    role: 'MEMBER',
  });
  assert.equal(addMemberRes.response.status, 201);

  // Add Reviewer
  const reviewerProfile = await request('GET', '/api/auth/me', reviewerToken);
  const addReviewerRes = await request('POST', `/api/projects/${testProjectId}/members`, ownerToken, {
    userId: reviewerProfile.data.user.id,
    role: 'REVIEWER',
  });
  assert.equal(addReviewerRes.response.status, 201);

  // Member can now access project
  const memberAccess = await request('GET', `/api/projects/${testProjectId}`, memberToken);
  assert.equal(memberAccess.response.status, 200);

  // RBAC: Member cannot update project settings
  const memberUpdate = await request('PUT', `/api/projects/${testProjectId}`, memberToken, {
    name: 'Unauthorized Change',
  });
  assert.equal(memberUpdate.response.status, 403);

  // Owner CAN update project settings
  const ownerUpdate = await request('PUT', `/api/projects/${testProjectId}`, ownerToken, {
    description: 'Updated description by Owner.',
  });
  assert.equal(ownerUpdate.response.status, 200);
  assert.equal(ownerUpdate.data.project.description, 'Updated description by Owner.');
});

test('4. Documents: Ingestion, Duplication Detection, and Extraction in PostgreSQL', async () => {
  // Ingest Document via text body
  const docContent =
    'PostgreSQL Architecture Specification:\n1. Use Connection Pooling.\n2. Ensure ACID Transactions across all operations.\n3. Automatic migrations on startup.';
  const uploadRes = await request('POST', `/api/projects/${testProjectId}/documents`, ownerToken, {
    title: 'PG_Architecture_Guide.txt',
    text: docContent,
  });
  assert.equal(uploadRes.response.status, 201);
  assert.ok(uploadRes.data.document.id);
  testDocId = uploadRes.data.document.id;

  // Verify Document Listed
  const listDocs = await request('GET', `/api/projects/${testProjectId}/documents`, memberToken);
  assert.equal(listDocs.response.status, 200);
  assert.equal(listDocs.data.documents.length, 1);
  assert.equal(listDocs.data.documents[0].filename, 'PG_Architecture_Guide.txt');

  // Verify Duplicate Hash Detection
  const dupUpload = await request('POST', `/api/projects/${testProjectId}/documents`, ownerToken, {
    title: 'Duplicate_Guide.txt',
    text: docContent,
  });
  assert.equal(dupUpload.response.status, 200);
  assert.equal(dupUpload.data.isDuplicate, true);
  const sourceRecordsAfterDuplicate = await request(
    'GET',
    `/api/projects/${testProjectId}/source-records?platform=DOCUMENT`,
    ownerToken
  );
  assert.equal(
    sourceRecordsAfterDuplicate.data.records.filter((record) => record.externalSourceId.startsWith(`${testDocId}#page-`)).length,
    uploadRes.data.sourceRecordsCount
  );

  // Reprocess Document
  const processRes = await request('POST', `/api/documents/${testDocId}/process`, ownerToken);
  assert.equal(processRes.response.status, 200);
  assert.equal(processRes.data.success, true);
});

test('5. Findings: Creation, Human Review Approval, and Filter in PostgreSQL', async () => {
  // Create Manual Finding as Reviewer
  const createFinding = await request('POST', `/api/projects/${testProjectId}/findings`, reviewerToken, {
    title: 'Enforce Foreign Key Constraints',
    description: 'All child tables in PostgreSQL must specify ON DELETE CASCADE or RESTRICT.',
    category: 'ARCHITECTURE',
    evidenceStatus: 'VERIFIED',
    sourceDocumentId: testDocId,
    severity: 'HIGH',
  });
  assert.equal(createFinding.response.status, 201);
  assert.ok(createFinding.data.finding.id);
  testFindingId = createFinding.data.finding.id;
  assert.equal(createFinding.data.finding.reviewStatus, 'PENDING');

  // Review & Approve Finding
  const reviewRes = await request('POST', `/api/findings/${testFindingId}/review`, reviewerToken, {
    reviewStatus: 'APPROVED',
    reviewerNotes: 'Verified and aligned with production database standard.',
  });
  assert.equal(reviewRes.response.status, 200);
  assert.equal(reviewRes.data.finding.reviewStatus, 'APPROVED');

  // Filter by reviewStatus
  const approvedList = await request(
    'GET',
    `/api/projects/${testProjectId}/findings?reviewStatus=APPROVED`,
    memberToken
  );
  assert.equal(approvedList.response.status, 200);
  assert.ok(approvedList.data.findings.some((f) => f.id === testFindingId));
});

test('6. Connectors & Source Records in PostgreSQL', async () => {
  // Query connectors
  const connRes = await request('GET', `/api/projects/${testProjectId}/connectors`, memberToken);
  assert.equal(connRes.response.status, 200);
  assert.ok(Array.isArray(connRes.data.connectors));

  // Query source records
  const recordsRes = await request('GET', `/api/projects/${testProjectId}/source-records`, memberToken);
  assert.equal(recordsRes.response.status, 200);
  assert.ok(recordsRes.data.records.length > 0);
});

test('7. RAG Intelligence: Query & Audit Trail in PostgreSQL', async () => {
  // Submit RAG question
  const ragRes = await request('POST', `/api/projects/${testProjectId}/rag/query`, memberToken, {
    question: 'What is the architecture specification regarding database transactions?',
  });
  assert.equal(ragRes.response.status, 200);
  assert.ok(ragRes.data.answer);

  // Retrieve query history
  const historyRes = await request('GET', `/api/projects/${testProjectId}/rag/history`, memberToken);
  assert.equal(historyRes.response.status, 200);
  assert.ok(historyRes.data.history.length > 0);
});

test('8. Handover Reports: Generation, Sign-off, and PDF Export in PostgreSQL', async () => {
  // Generate Report
  const genRes = await request('POST', `/api/projects/${testProjectId}/handover`, reviewerToken, {
    title: 'PostgreSQL Cutover Handover Dossier',
  });
  assert.equal(genRes.response.status, 201);
  assert.ok(genRes.data.report.id);
  testReportId = genRes.data.report.id;

  // Retrieve Report
  const getReport = await request('GET', `/api/handover/${testReportId}`, reviewerToken);
  assert.equal(getReport.response.status, 200);
  assert.equal(getReport.data.report.title, 'PostgreSQL Cutover Handover Dossier');

  // Verify and approve any pending findings before sign-off
  const projectFindings = await dbModule.getActiveDatabase().getFindings(testProjectId);
  for (const f of projectFindings) {
    if (f.reviewStatus === 'PENDING') {
      await request('POST', `/api/findings/${f.id}/review`, reviewerToken, {
        reviewStatus: 'APPROVED',
        reviewerNotes: 'Verified and approved before handover sign-off.',
      });
    }
  }

  // Executive Sign-Off
  const signoffRes = await request('POST', `/api/handover/${testReportId}/signoff`, reviewerToken, {
    notes: 'Executive verification complete. PostgreSQL runtime approved.',
  });
  assert.equal(signoffRes.response.status, 200);
  assert.equal(signoffRes.data.report.executiveSignOff.approvedBy, 'PG Project Reviewer');

  // PDF Export Route
  const pdfRes = await fetch(`${baseUrl}/api/handover/${testReportId}/pdf`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert.equal(pdfRes.status, 200);
  assert.match(pdfRes.headers.get('content-type'), /application\/pdf/);
  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(pdfBytes.length > 1000, 'Generated handover PDF should contain the report body.');
});

test('9. Activity Logs and Dashboard Continuity Stats in PostgreSQL', async () => {
  // Activity logs
  const actRes = await request('GET', `/api/projects/${testProjectId}/activity`, memberToken);
  assert.equal(actRes.response.status, 200);
  assert.ok(actRes.data.logs.length > 0);

  // Dashboard Stats
  const statsRes = await request('GET', '/api/stats', ownerToken);
  assert.equal(statsRes.response.status, 200);
  assert.ok(statsRes.data.totalProjects >= 1);
  assert.ok(statsRes.data.totalDocuments >= 1);
});

test('10. Transaction Rollback & Database Failure Handling', async () => {
  const currentDb = dbModule.getActiveDatabase();

  // Test Transaction Rollback
  let rollbackErrorTriggered = false;
  try {
    await currentDb.withTransaction(async (txDb) => {
      await txDb.createUser({
        email: 'transient-user@test.org',
        name: 'Transient User',
        title: 'Tester',
        password: 'password123',
      });
      // Verify user exists inside transaction
      const inTxUser = await txDb.findUserByEmail('transient-user@test.org');
      assert.ok(inTxUser);

      // Force an unexpected error to trigger ROLLBACK
      throw new Error('SIMULATED_TRANSACTION_FAILURE');
    });
  } catch (err) {
    if (err.message === 'SIMULATED_TRANSACTION_FAILURE') {
      rollbackErrorTriggered = true;
    }
  }

  assert.equal(rollbackErrorTriggered, true);

  // Assert user does NOT exist after rollback
  const afterRollbackUser = await currentDb.findUserByEmail('transient-user@test.org');
  assert.equal(afterRollbackUser, undefined);

  // Test Database Failure Handling: Never silently switch databases
  assert.equal(dbModule.getDatabaseMode(), 'postgres');
});
