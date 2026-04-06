/**
 * DuckDB Database Adapter (WASM)
 * 
 * Migrates from SQLite (better-sqlite3) to DuckDB for better scalability.
 * Supports:
 * - Vector storage and search (FLOAT32 arrays)
 * - FTS5 full-text search
 * - HNSW vector indexing (future)
 * - Multi-user concurrency
 * 
 * Design: Keep the same API as better-sqlite3 for minimal code changes.
 * 
 * Note: DuckDB uses ?::TYPE syntax for parameter binding instead of ?
 */

// @ts-nocheck

import duckdb from 'duckdb';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';

const SOUL_DIR = join(homedir(), '.soul');
const DB_PATH = join(SOUL_DIR, 'soul.duckdb');

let _db: duckdb.Database | null = null;
let _dbPath: string = DB_PATH;

export function getSoulDir(): string {
  return SOUL_DIR;
}

export function getDbPath(): string {
  return _dbPath;
}

/**
 * Initialize DuckDB database
 */
export function initDatabase(dbPath?: string): void {
  if (dbPath) {
    _dbPath = dbPath;
  }
  getDb();
}

export function getDb() {
  if (_db) return _db;

  // Ensure directory exists
  if (_dbPath !== ':memory:' && !existsSync(SOUL_DIR)) {
    mkdirSync(SOUL_DIR, { recursive: true });
  }

  try {
    _db = new duckdb.Database(_dbPath);
    console.log('[DuckDB] Database initialized:', _dbPath);
  } catch (err) {
    console.error('[DuckDB] Failed to initialize:', err);
    throw err;
  }

  return _db;
}

export function getRawDb() {
  return getDb();
}

/**
 * Close database
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Convert SQL parameters to DuckDB format (?::TYPE)
 */
function convertSqlParams(sql: string, params: any[]): { sql: string, params: any[] } {
  // DuckDB uses ?::TYPE syntax for parameter binding
  // For simplicity, we'll just use the values directly without type casting
  // The caller should ensure correct types
  return { sql, params };
}

/**
 * Run a SQL command (async)
 */
export function run(sql: string, ...params: any[]): Promise<{ changes: number }> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const callback = function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes || 0 });
    };
    if (params.length === 0) {
      db.run(sql, callback);
    } else {
      db.run(sql, params, callback);
    }
  });
}

/**
 * Get a single row (async)
 */
export function get(sql: string, ...params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Get all rows (async)
 */
export function all(sql: string, ...params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Prepare a statement (returns promise-based prepared statement)
 */
export function prepare(sql: string): any {
  const db = getDb();
  const stmt = db.prepare(sql);
  
  // Wrap to return promises
  return {
    run: (...params: any[]) => new Promise((resolve, reject) => {
      const callback = function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes || 0 });
      };
      stmt.run(params, callback);
    }),
    get: (...params: any[]) => new Promise((resolve, reject) => {
      stmt.get(params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    all: (...params: any[]) => new Promise((resolve, reject) => {
      stmt.all(params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    }),
    finalize: () => stmt.finalize(),
  };
}

/**
 * Execute a transaction (async)
 */
export async function transaction(fn: () => Promise<void>): Promise<void> {
  await run('BEGIN TRANSACTION');
  try {
    await fn();
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

/**
 * Enable extensions (for vector search, FTS, etc.)
 */
export async function enableExtensions(): Promise<void> {
  // Enable vector extension (if available)
  try {
    await run("INSTALL vector;");
    await run("LOAD vector;");
    console.log('[DuckDB] Vector extension loaded');
  } catch (err) {
    console.log('[DuckDB] Vector extension not available:', err.message);
  }
  
  // Enable FTS extension
  try {
    await run("INSTALL fts;");
    await run("LOAD fts;");
    console.log('[DuckDB] FTS extension loaded');
  } catch (err) {
    console.log('[DuckDB] FTS extension not available:', err.message);
  }
}

/**
 * Export database to file
 */
export async function exportDatabase(outputPath: string): Promise<void> {
  await run(`COPY '${_dbPath}' TO '${outputPath}';`);
}

/**
 * Import database from file
 */
export async function importDatabase(inputPath: string): Promise<void> {
  await run(`ATTACH '${inputPath}' AS import_db;`);
  // Copy tables from import_db to main database
  // (implementation depends on specific needs)
}
