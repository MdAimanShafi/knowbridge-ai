import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { newDb, DataType } from 'pg-mem';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-more-than-32-characters';
process.env.DATABASE_MODE = 'postgres';

let pgPoolModule;
let migrationModule;
let createdBackups = [];
const dataFilePath = path.join(process.cwd(), 'data', 'knowbridge_store.json');
let originalDataHash;

function setupMockPostgres() {
  const mem = newDb();

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
  return { mem, pool };
}

before(async () => {
  assert.ok(fs.existsSync(dataFilePath), 'knowbridge_store.json must exist');
  const originalBytes = fs.readFileSync(dataFilePath);
  originalDataHash = createHash('sha256').update(originalBytes).digest('hex');

  const { pool } = setupMockPostgres();
  pgPoolModule = await import('../src/server/pgPool.ts');
  pgPoolModule.setPool(pool);

  migrationModule = await import('../src/server/migrateJsonToPostgres.ts');
});

after(async () => {
  // Clean up any test backup files
  for (const backup of createdBackups) {
    if (fs.existsSync(backup)) {
      try {
        fs.unlinkSync(backup);
      } catch {}
    }
  }
  await pgPoolModule.closePool();
});

test('1. Validates store schema and relationships on knowbridge_store.json', async () => {
  const content = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  assert.doesNotThrow(() => migrationModule.validateStore(content));
  assert.doesNotThrow(() => migrationModule.validateStoreRelationships(content));
});

test('2. Migrates JSON store into isolated PostgreSQL and verifies all table counts', async () => {
  const result = await migrationModule.migrate(dataFilePath);
  if (result.backupPath) {
    createdBackups.push(result.backupPath);
  }

  assert.ok(result.backupPath);
  assert.ok(fs.existsSync(result.backupPath));

  const tables = [
    'users',
    'projects',
    'project_members',
    'documents',
    'findings',
    'source_records',
    'source_connections',
    'handover_reports',
    'github_connections',
    'activity_logs',
    'rag_queries',
  ];

  for (const table of tables) {
    assert.equal(
      result.targetCounts[table],
      result.sourceCounts[table],
      `Count mismatch on table ${table}`
    );
    assert.ok(
      result.targetCounts[table] >= 0,
      `Table ${table} count must be non-negative`
    );
  }

  // Ensure key tables have actual seed records
  assert.ok(result.targetCounts.users >= 4);
  assert.ok(result.targetCounts.projects >= 2);
  assert.ok(result.targetCounts.findings >= 10);
});

test('3. Relationship & Integrity Verification across migrated PostgreSQL tables', async () => {
  const pool = pgPoolModule.getPool();

  // Verify all projects have valid owners in users
  const orphanProjects = await pool.query(`
    SELECT p.id, p.owner_id
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    WHERE u.id IS NULL
  `);
  assert.equal(orphanProjects.rows.length, 0, 'Every project must reference an existing user');

  // Verify all documents belong to an existing project and uploader
  const orphanDocs = await pool.query(`
    SELECT d.id
    FROM documents d
    LEFT JOIN projects p ON p.id = d.project_id
    LEFT JOIN users u ON u.id = d.uploader_id
    WHERE p.id IS NULL OR u.id IS NULL
  `);
  assert.equal(orphanDocs.rows.length, 0, 'Every document must reference a valid project and uploader');

  // Verify all findings belong to an existing project
  const orphanFindings = await pool.query(`
    SELECT f.id
    FROM findings f
    LEFT JOIN projects p ON p.id = f.project_id
    WHERE p.id IS NULL
  `);
  assert.equal(orphanFindings.rows.length, 0, 'Every finding must reference an existing project');

  // Verify all handover reports belong to an existing project and generated_by user
  const orphanReports = await pool.query(`
    SELECT h.id
    FROM handover_reports h
    LEFT JOIN projects p ON p.id = h.project_id
    LEFT JOIN users u ON u.id = h.generated_by_id
    WHERE p.id IS NULL OR u.id IS NULL
  `);
  assert.equal(orphanReports.rows.length, 0, 'Every handover report must reference a valid project and generator');
});

test('4. Migration Idempotency: Re-running migration detects prior import and succeeds safely', async () => {
  const repeatResult = await migrationModule.migrate(dataFilePath);
  if (repeatResult.backupPath) {
    createdBackups.push(repeatResult.backupPath);
  }

  for (const key of Object.keys(repeatResult.sourceCounts)) {
    assert.equal(repeatResult.targetCounts[key], repeatResult.sourceCounts[key]);
  }
});

test('5. Non-empty Database Safeguard: Refuses to overwrite or merge differing data into populated DB', async () => {
  // Create a temporary differing JSON store
  const tempJsonPath = path.join(process.cwd(), 'data', 'temp_differing_store.json');
  const tempStore = {
    users: [{ id: 'user-diff-999', email: 'diff@test.org', name: 'Diff', passwordHash: 'hash', role: 'MEMBER' }],
    projects: [{ id: 'proj-diff-999', name: 'Diff Proj', ownerId: 'user-diff-999', ownerName: 'Diff' }],
    projectMembers: [],
    documents: [],
    findings: [],
    sourceRecords: [],
    sourceConnections: [],
    handoverReports: [],
    githubConnections: [],
    activityLogs: [],
    ragQueries: [],
  };
  fs.writeFileSync(tempJsonPath, JSON.stringify(tempStore, null, 2), 'utf8');
  const backupPrefix = `${path.basename(tempJsonPath)}.backup-`;
  const existingBackups = new Set(
    fs.readdirSync(path.dirname(tempJsonPath)).filter((name) => name.startsWith(backupPrefix))
  );

  try {
    await assert.rejects(
      async () => {
        await migrationModule.migrate(tempJsonPath);
      },
      (err) => {
        return err instanceof Error && err.message.includes('Refusing to merge or overwrite existing records');
      }
    );
  } finally {
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
    for (const name of fs.readdirSync(path.dirname(tempJsonPath))) {
      if (name.startsWith(backupPrefix) && !existingBackups.has(name)) {
        fs.unlinkSync(path.join(path.dirname(tempJsonPath), name));
      }
    }
  }
});

test('6. Immutability Safeguard: Original knowbridge_store.json is never modified or deleted', async () => {
  assert.ok(fs.existsSync(dataFilePath), 'Original knowbridge_store.json must still exist');
  const currentBytes = fs.readFileSync(dataFilePath);
  const currentHash = createHash('sha256').update(currentBytes).digest('hex');
  assert.equal(
    currentHash,
    originalDataHash,
    'Original knowbridge_store.json hash must match exactly - file was not altered'
  );
});
