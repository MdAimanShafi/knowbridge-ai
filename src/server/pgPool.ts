/**
 * KNOWBRIDGE AI — PostgreSQL Connection Pool
 *
 * Provides a connection pool when DATABASE_URL is configured or when a test pool is injected.
 * Features:
 * - Lazy pool instantiation with sensible defaults (pool size, timeouts, SSL)
 * - Safe transaction execution with automatic rollback on error
 * - Database health checks measuring roundtrip query latency
 * - Graceful shutdown via closePool()
 * - Automatic advisory-locked schema migration execution
 */
import 'dotenv/config';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

let pool: Pool | null = null;
let isCustomPool = false;

export function isPostgresConfigured(): boolean {
  return isCustomPool || Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
}

export function isCustomPoolConfigured(): boolean {
  return isCustomPool;
}

export function setPool(customPool: Pool | null): void {
  pool = customPool;
  isCustomPool = customPool !== null;
}

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not configured. PostgreSQL connection pool cannot be initialized.'
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool error on idle client:', err.message);
    });
  }
  return pool;
}

export async function checkPostgresHealth(): Promise<{
  status: 'UP' | 'DOWN';
  latencyMs?: number;
  error?: string;
}> {
  try {
    const pg = getPool();
    const start = Date.now();
    await pg.query('SELECT 1 AS health');
    const latencyMs = Date.now() - start;
    return { status: 'UP', latencyMs };
  } catch (err: any) {
    return {
      status: 'DOWN',
      error: err?.message || 'Database connection could not be established',
    };
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pg = getPool();
  const result = await pg.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pg = getPool();
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      console.error('[PostgreSQL] Transaction rollback failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch (err: any) {
      console.warn('[PostgreSQL] Error ending connection pool:', err.message);
    }
    pool = null;
    isCustomPool = false;
  }
}

/** Run SQL migration files against the connected database. */
export async function runMigrations(): Promise<void> {
  if (!isPostgresConfigured()) return;
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(__dirname, '../../migrations');

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  const pg = getPool();
  const lockClient = await pg.connect();
  let hasLock = false;

  try {
    // Attempt advisory lock for concurrency safety across app instances
    try {
      await lockClient.query('SELECT pg_advisory_lock($1)', [712039140]);
      hasLock = true;
    } catch {
      // In-memory or emulated test database without advisory locks
    }

    const tableExists = await lockClient
      .query('SELECT 1 FROM schema_migrations LIMIT 0')
      .then(() => true)
      .catch(() => false);
    if (!tableExists) {
      await lockClient.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          description TEXT NOT NULL
        )
      `);
    }

    for (const file of files) {
      const version = file.split('_')[0];
      const existing = await lockClient.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      if (existing.rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      try {
        await lockClient.query(sql);
        await lockClient.query(
          'INSERT INTO schema_migrations (version, description) VALUES ($1, $2)',
          [version, file.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/_/g, ' ')]
        );
        console.log(`[PostgreSQL] Migration ${file} applied.`);
      } catch (err) {
        console.error(`[PostgreSQL] Migration ${file} failed:`, err);
        throw err;
      }
    }
  } finally {
    if (hasLock) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [712039140]);
      } catch {
        // Ignore unlock error on cleanup
      }
    }
    lockClient.release();
  }
}
