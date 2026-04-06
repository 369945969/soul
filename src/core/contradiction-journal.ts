/**
 * 矛盾日志 — 跟踪主人变化的观点
 *
 * 升级 #10：当主人说与之前陈述矛盾的话时，
 * Soul 会注意到并记录这个变化。这让 Soul 能够：
 * 1. 避免使用过时的信息
 * 2. 理解主人观点的演变
 * 3. 当困惑时提出澄清问题
 * 4. 向主人展示他们自己的思想演变
 */

import { getRawDb } from "../db/index.js";

export interface ContradictionEntry {
  id: number;
  topic: string;
  oldStatement: string;
  newStatement: string;
  resolution: string; // "updated" | "clarified" | "context_dependent" | "unresolved"
  confidence: number;
  createdAt: string;
}

function ensureContradictionTable() {
  const rawDb = getRawDb();
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS soul_contradiction_journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      old_statement TEXT NOT NULL,
      new_statement TEXT NOT NULL,
      resolution TEXT NOT NULL DEFAULT 'unresolved',
      confidence REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Record a contradiction between old and new statements
 
 
 */
export function recordContradiction(input: {
  topic: string;
  oldStatement: string;
  newStatement: string;
  resolution?: string;
  confidence?: number;
}): ContradictionEntry {
  ensureContradictionTable();
  const rawDb = getRawDb();

  const row = rawDb.prepare(`
    INSERT INTO soul_contradiction_journal (topic, old_statement, new_statement, resolution, confidence)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    input.topic,
    input.oldStatement,
    input.newStatement,
    input.resolution || "unresolved",
    input.confidence || 0.5
  ) as any;

  return mapContradiction(row);
}

/**
 * Search for contradictions about a topic
 
 
 */
export function findContradictions(topic: string, limit = 5): ContradictionEntry[] {
  ensureContradictionTable();
  const rawDb = getRawDb();

  const rows = rawDb.prepare(`
    SELECT * FROM soul_contradiction_journal
    WHERE topic LIKE ? OR old_statement LIKE ? OR new_statement LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(`%${topic}%`, `%${topic}%`, `%${topic}%`, limit) as any[];

  return rows.map(mapContradiction);
}

/**
 * Get recent unresolved contradictions
 
 
 */
export function getUnresolvedContradictions(limit = 5): ContradictionEntry[] {
  ensureContradictionTable();
  const rawDb = getRawDb();

  const rows = rawDb.prepare(`
    SELECT * FROM soul_contradiction_journal
    WHERE resolution = 'unresolved'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(mapContradiction);
}

/**
 * Resolve a contradiction
 
 
 */
export function resolveContradiction(id: number, resolution: string): boolean {
  ensureContradictionTable();
  const rawDb = getRawDb();

  const result = rawDb.prepare(`
    UPDATE soul_contradiction_journal SET resolution = ? WHERE id = ?
  `).run(resolution, id);

  return (result as any).changes > 0;
}

/**
 * Check a statement against existing knowledge for potential contradictions
 * Returns any conflicting statements found
 
 
 */
export function checkForContradictions(statement: string): ContradictionEntry[] {
  ensureContradictionTable();
  const rawDb = getRawDb();

  // Extract key words from statement
  const words = statement.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) return [];

  // Search for entries that might contradict
  const conditions = words.slice(0, 5).map(() =>
    "(topic LIKE ? OR new_statement LIKE ?)"
  ).join(" OR ");

  const params: any[] = [];
  for (const w of words.slice(0, 5)) {
    params.push(`%${w}%`, `%${w}%`);
  }
  params.push(10);

  try {
    const rows = rawDb.prepare(`
      SELECT * FROM soul_contradiction_journal
      WHERE ${conditions}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(...params) as any[];

    return rows.map(mapContradiction);
  } catch {
    return [];
  }
}

/**
 * Get contradiction stats
 
 
 */
export function getContradictionStats(): {
  total: number;
  unresolved: number;
  topTopics: { topic: string; count: number }[];
} {
  ensureContradictionTable();
  const rawDb = getRawDb();

  const total = (rawDb.prepare("SELECT COUNT(*) as c FROM soul_contradiction_journal").get() as any)?.c || 0;
  const unresolved = (rawDb.prepare("SELECT COUNT(*) as c FROM soul_contradiction_journal WHERE resolution = 'unresolved'").get() as any)?.c || 0;

  const topTopics = rawDb.prepare(`
    SELECT topic, COUNT(*) as c FROM soul_contradiction_journal
    GROUP BY topic
    ORDER BY c DESC
    LIMIT 5
  `).all() as any[];

  return {
    total,
    unresolved,
    topTopics: topTopics.map((r: any) => ({ topic: r.topic, count: r.c })),
  };
}

function mapContradiction(row: any): ContradictionEntry {
  return {
    id: row.id,
    topic: row.topic,
    oldStatement: row.old_statement,
    newStatement: row.new_statement,
    resolution: row.resolution,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}
