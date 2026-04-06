/**
 * DuckDB Schema Definitions
 * 
 * Migrates from SQLite schema to DuckDB-compatible schema.
 * All tables use DuckDB SQL syntax.
 */

import { getDb } from './duckdb-adapter.js';

// ─── Table Creation ───

export async function ensureMasterTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS masters (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR NOT NULL,
        passphrase_hash VARCHAR NOT NULL,
        personality_traits VARCHAR DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureMemoriesTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        type VARCHAR NOT NULL,
        content TEXT NOT NULL,
        tags VARCHAR DEFAULT '[]',
        source VARCHAR,
        context VARCHAR,
        superseded_by INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
  
  // Create indexes
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`, (err: any) => err ? reject(err) : resolve());
  });
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(is_active)`, (err: any) => err ? reject(err) : resolve());
  });
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at)`, (err: any) => err ? reject(err) : resolve());
  });
  
  // FTS index (if FTS extension is available)
  try {
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          content,
          content='memories',
          content_rowid='id'
        )
      `, (err: any) => err ? reject(err) : resolve());
    });
  } catch (err: any) {
    console.log('[DuckDB] FTS5 not available, skipping FTS index');
  }
}

export async function ensureLearningsTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS learnings (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        pattern VARCHAR NOT NULL,
        insight TEXT NOT NULL,
        confidence DOUBLE DEFAULT 0.5,
        evidence_count INTEGER DEFAULT 1,
        memory_ids VARCHAR DEFAULT '[]',
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
  
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_learnings_pattern ON learnings(pattern)`, (err: any) => err ? reject(err) : resolve());
  });
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON learnings(confidence)`, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureSkillsTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR UNIQUE NOT NULL,
        description TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        module_path VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureJournalTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS journal (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        entry TEXT NOT NULL,
        mood VARCHAR,
        tags VARCHAR DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureConfigTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureEmbeddingsTable(): Promise<void> {
  const db = getDb();
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS soul_embeddings (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        memory_id INTEGER UNIQUE NOT NULL,
        embedding BLOB,
        dimensions INTEGER NOT NULL,
        model VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (memory_id) REFERENCES memories(id)
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
  
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_embeddings_memory ON soul_embeddings(memory_id)`, (err: any) => err ? reject(err) : resolve());
  });
  
  // HNSW vector index (if vector extension is available)
  try {
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw 
        ON soul_embeddings USING hnsw(embedding)
      `, (err: any) => err ? reject(err) : resolve());
    });
    console.log('[DuckDB] HNSW vector index created');
  } catch (err: any) {
    console.log('[DuckDB] HNSW index not available, using sequential scan');
  }
}

export async function ensureLLMTables(): Promise<void> {
  const db = getDb();
  
  // LLM configs
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS soul_llm_config (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        provider_id VARCHAR NOT NULL,
        model_id VARCHAR NOT NULL,
        base_url VARCHAR,
        api_key VARCHAR,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider_id, model_id)
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
  
  // LLM usage tracking
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS soul_llm_usage (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        provider_id VARCHAR NOT NULL,
        model_id VARCHAR NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost_usd DOUBLE DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err: any) => err ? reject(err) : resolve());
  });
  
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON soul_llm_usage(provider_id)`, (err: any) => err ? reject(err) : resolve());
  });
  await new Promise<void>((resolve, reject) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON soul_llm_usage(created_at)`, (err: any) => err ? reject(err) : resolve());
  });
}

export async function ensureAllTables(): Promise<void> {
  await ensureMasterTable();
  await ensureMemoriesTable();
  await ensureLearningsTable();
  await ensureSkillsTable();
  await ensureJournalTable();
  await ensureConfigTable();
  await ensureEmbeddingsTable();
  await ensureLLMTables();
  
  console.log('[DuckDB] All tables initialized');
}

// ─── Migration Helpers ───

/**
 * Migrate from SQLite to DuckDB
 */
export async function migrateFromSqlite(sqlitePath: string): Promise<void> {
  console.log('[DuckDB] Migrating from SQLite:', sqlitePath);
  
  // TODO: Implement migration logic
  // 1. Open SQLite database
  // 2. Read all tables
  // 3. Insert into DuckDB
  // 4. Verify data integrity
  
  console.log('[DuckDB] Migration not yet implemented');
}
