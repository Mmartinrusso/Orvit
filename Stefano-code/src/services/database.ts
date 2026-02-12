import pg from 'pg';
import type { Pool as PgPool, PoolClient as PgClient } from 'pg';
import { createChildLogger } from '../utils/logger.js';
import { config } from '../config.js';

const logger = createChildLogger('database');

let pgPool: PgPool | null = null;

/**
 * Initialize the database connection pool
 */
export async function initDatabase(): Promise<void> {
  if (!config.database.enabled) {
    logger.info('Database is disabled, skipping initialization');
    return;
  }

  try {
    // PostgreSQL configuration
    pgPool = new pg.Pool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased from 2000 to 10000
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    });

    // Add error handler to the pool
    pgPool.on('error', (err: Error & { code?: string }) => {
      logger.error({ error: err.message, code: err.code, stack: err.stack }, 'PostgreSQL pool error');
    });

    // Add connection handler
    pgPool.on('connect', () => {
      logger.debug('PostgreSQL client connected');
    });

    // Add removal handler
    pgPool.on('remove', () => {
      logger.debug('PostgreSQL client removed from pool');
    });

    // Test the connection
    const client = await pgPool.connect();
    logger.info({
      host: config.database.host,
      database: config.database.name,
      type: 'postgres'
    }, 'Database connected');
    client.release();
  } catch (error: any) {
    // Redact password from error messages to avoid leaking credentials in logs
    const safeError = {
      message: error?.message?.replace(config.database.password, '***') || 'Unknown error',
      code: error?.code,
    };
    logger.error({ error: safeError, host: config.database.host, database: config.database.name }, 'Failed to initialize database');
    throw error;
  }
}

/**
 * Get a connection from the pool
 */
export async function getConnection(): Promise<PgClient | null> {
  if (!pgPool) {
    logger.warn('Database pool not initialized');
    return null;
  }

  return await pgPool.connect();
}

/**
 * Execute a query
 */
export async function query<T>(sql: string, params?: any[]): Promise<T | null> {
  if (!pgPool) {
    logger.debug('Database not enabled, skipping query');
    return null;
  }

  try {
    // Convert MySQL-style ? placeholders to PostgreSQL-style $1, $2, etc.
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const result = await pgPool.query(pgSql, params);
    return result.rows as T;
  } catch (error: any) {
    logger.error({
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      sql,
      params: params ? '[REDACTED]' : undefined
    }, 'Database query failed');
    throw error;
  }
}

/**
 * Execute an insert and return the inserted ID
 */
export async function insert(sql: string, params?: any[]): Promise<number | null> {
  if (!pgPool) {
    logger.debug('Database not enabled, skipping insert');
    return null;
  }

  try {
    // PostgreSQL: convert placeholders
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // Try with RETURNING id first (for tables with auto-increment id)
    // If it fails because id column doesn't exist, retry without it
    try {
      if (!pgSql.toLowerCase().includes('returning')) {
        const resultWithId = await pgPool.query(pgSql + ' RETURNING id', params);
        return resultWithId.rows[0]?.id || null;
      }
    } catch (err: any) {
      // Error 42703 means column doesn't exist - table uses VARCHAR primary key
      if (err.code !== '42703') {
        throw err; // Re-throw if it's a different error
      }
    }

    // Execute without RETURNING (for tables with VARCHAR primary keys)
    const result = await pgPool.query(pgSql, params);
    return null;
  } catch (error: any) {
    logger.error({
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      sql,
      params: params ? '[REDACTED]' : undefined
    }, 'Database insert failed');
    throw error;
  }
}

/**
 * Close the database pool
 */
export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    logger.info('PostgreSQL connection closed');
  }
}

/**
 * Check if database is enabled and connected
 */
export function isDatabaseEnabled(): boolean {
  return config.database.enabled && pgPool !== null;
}

/**
 * Get the database pool directly (for complex queries)
 */
export function getPool(): PgPool | null {
  return pgPool;
}
