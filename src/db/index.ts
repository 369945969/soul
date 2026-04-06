import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import * as personaSchema from "./schema-persona.js";
import { sql } from "drizzle-orm";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

const SOUL_DIR = join(homedir(), ".soul");
const DB_PATH = join(SOUL_DIR, "soul.db");

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;
let _dbPath: string = DB_PATH;

export function getSoulDir(): string {
  return SOUL_DIR;
}

export function getDbPath(): string {
  return _dbPath;
}

/**
 * Initialize database with optional custom path (for testing)
 */
export function initDatabase(dbPath?: string): void {
  if (dbPath) {
    _dbPath = dbPath;
  }
  getDb();
}

export function getDb() {
  if (_db) return _db;

  // Ensure directory exists (only for non-memory databases)
  if (_dbPath !== ":memory:" && !existsSync(SOUL_DIR)) {
    mkdirSync(SOUL_DIR, { recursive: true });
  }

  try {
    _sqlite = new Database(_dbPath);

    // Enable WAL mode for better concurrency
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    // Reduce SQLITE_BUSY errors with a 5-second timeout
    _sqlite.pragma("busy_timeout = 5000");

    _db = drizzle(_sqlite, { schema });

    // Create tables
    initializeDatabase(_sqlite);
  } catch (err: any) {
    _sqlite = null;
    _db = null;
    throw new Error(`Failed to open Soul database at ${DB_PATH}: ${err.message}`);
  }

  return _db;
}

export function getRawDb(): Database.Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}

function initializeDatabase(sqlite: Database.Database) {
  // Create tables using raw SQL (Drizzle push doesn't work at runtime)
  sqlite.exec(`
    -- Original tables
    CREATE TABLE IF NOT EXISTS masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      passphrase_hash TEXT NOT NULL,
      personality_traits TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      source TEXT,
      context TEXT,
      superseded_by INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      insight TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      memory_ids TEXT DEFAULT '[]',
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      module_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry TEXT NOT NULL,
      mood TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Persona tables
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      schema_version TEXT NOT NULL DEFAULT '0.3.0',
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      self_description TEXT,
      origin_story TEXT,
      personality_core TEXT DEFAULT '[]',
      defining_moment_refs TEXT DEFAULT '[]',
      persona_voice_on_evolution TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_constitutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      mission TEXT NOT NULL,
      "values" TEXT DEFAULT '[]',
      boundaries TEXT DEFAULT '[]',
      commitments TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_worldviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      seed TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      style TEXT NOT NULL,
      adaptability TEXT NOT NULL DEFAULT 'medium',
      quirks TEXT DEFAULT '[]',
      topics_of_interest TEXT DEFAULT '[]',
      humor_style TEXT,
      conflict_behavior TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      preferred_language TEXT NOT NULL DEFAULT 'zh-CN',
      preferred_name TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      passphrase_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_persona_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      persona_id TEXT NOT NULL REFERENCES personas(id),
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shared_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      path TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS turn_scheduler_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      active_persona_id TEXT,
      turn_history TEXT DEFAULT '[]',
      consecutive_counts TEXT DEFAULT '{}',
      last_turn_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS persona_memory_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id TEXT NOT NULL REFERENCES personas(id),
      memory_db_path TEXT,
      memory_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_personas_name ON personas(name);
    CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active);
    CREATE INDEX IF NOT EXISTS idx_scheduler_session ON turn_scheduler_state(session_id);

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- FTS5 virtual table for full-text search on memories
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      tags,
      content='memories',
      content_rowid='id'
    );

    -- Triggers to keep FTS5 in sync
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.id, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags) VALUES('delete', old.id, old.content, old.tags);
      INSERT INTO memories_fts(rowid, content, tags) VALUES (new.id, new.content, new.tags);
    END;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(is_active);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON learnings(confidence DESC);
    CREATE INDEX IF NOT EXISTS idx_journal_created ON journal(created_at);
  `);
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}
