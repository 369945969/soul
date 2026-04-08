/**
 * 反射引擎 — 系统 1（快脑）
 *
 * 灵感来自 Macrohard/Digital Optimus 双大脑概念。
 * 处理无需 LLM 调用的即时响应（< 100ms）。
 *
 * 5 种反射类型：
 * 1. 安全 — 危险模式时即时阻止（免疫系统）
 * 2. 模式 — 从过去成功交互中学到的响应
 * 3. 情绪 — 情绪检测 → 共情前缀
 * 4. 习惯 — 日常模式（早上=简报，晚上=总结）
 * 5. 工具 — 高频工具组合 → 立即执行
 */

import { getRawDb } from "../db/index.js";
import crypto from "crypto";

// ─── Lazy table creation ───
let tableReady = false;
function ensureReflexTable() {
  if (tableReady) return;
  const db = getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS soul_reflexes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reflex_type TEXT NOT NULL,
      trigger_hash TEXT NOT NULL,
      trigger_pattern TEXT NOT NULL,
      trigger_keywords TEXT NOT NULL DEFAULT '[]',
      response_template TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      hit_count INTEGER NOT NULL DEFAULT 0,
      miss_count INTEGER NOT NULL DEFAULT 0,
      last_hit_at TEXT,
      promoted_from TEXT DEFAULT 'system2',
      quality_score REAL NOT NULL DEFAULT 0.7,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_reflexes_type ON soul_reflexes(reflex_type);
    CREATE INDEX IF NOT EXISTS idx_reflexes_hash ON soul_reflexes(trigger_hash);
  `);
  tableReady = true;
}

// ─── Interfaces ───

export interface Reflex {
  id: number;
  reflexType: "pattern" | "emotional" | "habit" | "tool" | "safety";
  triggerHash: string;
  triggerPattern: string;
  triggerKeywords: string[];
  responseTemplate: string;
  confidence: number;
  hitCount: number;
  missCount: number;
  qualityScore: number;
  isActive: boolean;
}

export interface ReflexMatch {
  reflex: Reflex;
  matchScore: number;
  effectiveConfidence: number;
}

export interface ReflexResult {
  handled: boolean;
  response?: string;
  reflexId?: number;
  reflexType?: string;
  matchScore?: number;
  confidence?: number;
  latencyMs: number;
  blocked?: boolean; // safety reflex blocked the input
}

export interface ReflexContext {
  hour?: number;
  previousTopic?: string;
  isLeanMode?: boolean;
}

// ─── Hash utility (same approach as smart-cache.ts) ───

function hashTrigger(input: string): string {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, " ").replace(/[?!.,;:'"()]/g, "");
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `rx_${Math.abs(hash).toString(36)}`;
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[?!.,;:'"()]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);
  return [...new Set(words)];
}

function keywordOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const matches = a.filter(w => setB.has(w)).length;
  return matches / Math.max(a.length, b.length);
}

// ─── Safety Reflex (highest priority) ───

const DANGEROUS_PATTERNS = [
  /drop\s+table/i,
  /delete\s+from\s+soul_/i,
  /rm\s+-rf/i,
  /format\s+c:/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /__proto__/i,
  /constructor\s*\[/i,
  /process\.exit/i,
  /require\s*\(\s*['"]child_process/i,
];

const INJECTION_KEYWORDS = [
  "ignore previous instructions",
  "ignore all instructions",
  "forget your rules",
  "you are now",
  "pretend you are",
  "act as if you have no restrictions",
  "bypass safety",
  "jailbreak",
];

function matchSafetyReflex(message: string): ReflexResult | null {
  const start = Date.now();
  const lower = message.toLowerCase();

  // Check dangerous code patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(message)) {
      return {
        handled: true,
        blocked: true,
        response: "⚠️ Blocked: potentially dangerous pattern detected.",
        reflexType: "safety",
        confidence: 0.99,
        matchScore: 1.0,
        latencyMs: Date.now() - start,
      };
    }
  }

  // Check prompt injection
  for (const phrase of INJECTION_KEYWORDS) {
    if (lower.includes(phrase)) {
      return {
        handled: true,
        blocked: true,
        response: "⚠️ Blocked: this appears to be a prompt injection attempt.",
        reflexType: "safety",
        confidence: 0.95,
        matchScore: 0.9,
        latencyMs: Date.now() - start,
      };
    }
  }

  return null;
}

// ─── Emotional Reflex ───

const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: ["happy", "glad", "excited", "great", "awesome", "joy", "cheerful"],
  sad: ["sad", "depressed", "down", "unhappy", "lonely", "hopeless"],
  angry: ["angry", "frustrated", "annoyed", "furious", "mad", "upset"],
  anxious: ["anxious", "worried", "nervous", "scared", "stressed", "afraid"],
  tired: ["tired", "exhausted", "burnt out", "sleepy", "drained"],
  motivated: ["motivated", "inspired", "pumped", "ready", "eager"],
  grateful: ["grateful", "thankful", "blessed", "appreciative"],
  confused: ["confused", "lost", "unclear", "puzzled", "not sure"],
};

const EMPATHETIC_PREFIXES: Record<string, string[]> = {
  happy: ["I'm happy for you! 😊", "That's awesome! ✨"],
  sad: ["I understand... 💙", "It's okay, I'm here for you 💛"],
  angry: ["I understand why you're frustrated 🫂", "I'm listening"],
  anxious: ["Take it easy 🌿", "Take a deep breath. I'm right here"],
  tired: ["Get some rest 🌙", "Take care of yourself"],
  motivated: ["Great! Let's do it 🔥", "You're full of energy! 💪"],
  grateful: ["You're very welcome 🙏", "I appreciate it too"],
  confused: ["Let's figure it out together 🤔", "Step by step, we'll get there"],
};

function matchEmotionalReflex(message: string): { mood: string; prefix: string } | null {
  const lower = message.toLowerCase();
  let bestMood = "";
  let bestScore = 0;

  for (const [mood, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  if (bestScore >= 1 && bestMood) {
    const prefixes = EMPATHETIC_PREFIXES[bestMood] || [];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] || "";
    return { mood: bestMood, prefix };
  }
  return null;
}

// ─── Habit Reflex ───

function matchHabitReflex(message: string, hour: number): ReflexResult | null {
  const start = Date.now();
  try {
    const { predictNext } = require("./predictive-context.js");
    const predictions = predictNext(undefined, hour);
    if (!predictions || predictions.length === 0) return null;

    // Only use predictions with high confidence
    const best = predictions[0];
    if (best.confidence >= 0.7) {
      return {
        handled: false, // Don't fully handle — just add context
        reflexType: "habit",
        matchScore: best.confidence,
        confidence: best.confidence * 100,
        response: best.prediction,
        latencyMs: Date.now() - start,
      };
    }
  } catch { /* predictive-context may not be available 
 
 */ }
  return null;
}

// ─── Pattern Reflex (learned from System 2) ───

function matchPatternReflex(message: string): ReflexMatch | null {
  ensureReflexTable();
  const db = getRawDb();
  const hash = hashTrigger(message);
  const messageKeywords = extractKeywords(message);

  // Exact hash match first
  const exact = db.prepare(`
    SELECT * FROM soul_reflexes
    WHERE trigger_hash = ? AND is_active = 1 AND reflex_type = 'pattern'
    ORDER BY confidence DESC LIMIT 1
  `).get(hash) as any;

  if (exact) {
    const reflex = rowToReflex(exact);
    const overlap = keywordOverlap(messageKeywords, reflex.triggerKeywords);
    if (overlap >= 0.5) {
      return {
        reflex,
        matchScore: overlap,
        effectiveConfidence: overlap * reflex.confidence,
      };
    }
  }

  // Keyword-based fuzzy match (top 10 active reflexes by confidence)
  const candidates = db.prepare(`
    SELECT * FROM soul_reflexes
    WHERE is_active = 1 AND reflex_type = 'pattern'
    ORDER BY confidence DESC, hit_count DESC LIMIT 10
  `).all() as any[];

  let bestMatch: ReflexMatch | null = null;
  for (const row of candidates) {
    const reflex = rowToReflex(row);
    const overlap = keywordOverlap(messageKeywords, reflex.triggerKeywords);
    const effective = overlap * reflex.confidence;
    if (overlap >= 0.6 && (!bestMatch || effective > bestMatch.effectiveConfidence)) {
      bestMatch = { reflex, matchScore: overlap, effectiveConfidence: effective };
    }
  }

  return bestMatch;
}

// ─── Tool Reflex (auto-tools with high success rate) ───

function matchToolReflex(message: string): ReflexResult | null {
  const start = Date.now();
  try {
    const db = getRawDb();
    // Check approved auto-tools
    const autoTool = db.prepare(`
      SELECT name, description, code FROM soul_auto_tools
      WHERE status = 'approved' AND confidence >= 0.8
      ORDER BY frequency DESC LIMIT 1
    `).get() as any;

    if (autoTool) {
      // Check if message keywords match auto-tool description
      const msgKw = extractKeywords(message);
      const toolKw = extractKeywords(autoTool.description);
      const overlap = keywordOverlap(msgKw, toolKw);
      if (overlap >= 0.7) {
        return {
          handled: true,
          reflexType: "tool",
          matchScore: overlap,
          confidence: overlap * 90,
          response: `[Auto-tool: ${autoTool.name}] Executing...`,
          latencyMs: Date.now() - start,
        };
      }
    }
  } catch { /* auto-tools table may not exist yet 
 
 */ }
  return null;
}

// ─── Main Entry Point ───

/**
 * Try all reflexes in priority order. Returns immediately if any matches.
 * Target: < 100ms total
 
 
 */
export function tryReflex(message: string, context: ReflexContext = {}): ReflexResult {
  const start = Date.now();
  const hour = context.hour ?? new Date().getHours();

  // 1. Safety (always first, < 1ms)
  const safety = matchSafetyReflex(message);
  if (safety) return safety;

  // 2. Pattern reflex (learned from System 2)
  const pattern = matchPatternReflex(message);
  const threshold = context.isLeanMode ? 0.75 : 0.85;
  if (pattern && pattern.effectiveConfidence >= threshold) {
    reportReflexHit(pattern.reflex.id);
    return {
      handled: true,
      response: pattern.reflex.responseTemplate,
      reflexId: pattern.reflex.id,
      reflexType: "pattern",
      matchScore: pattern.matchScore,
      confidence: pattern.effectiveConfidence * 100,
      latencyMs: Date.now() - start,
    };
  }

  // 3. Tool reflex (approved auto-tools)
  const tool = matchToolReflex(message);
  if (tool?.handled) return tool;

  // 4. Habit reflex (predictive context)
  const habit = matchHabitReflex(message, hour);
  // Habit doesn't fully handle — just provides context for System 2

  // 5. Emotional reflex (prefix only, doesn't prevent System 2)
  const emotion = matchEmotionalReflex(message);

  return {
    handled: false,
    reflexType: emotion ? "emotional" : habit ? "habit" : undefined,
    response: emotion?.prefix, // Pass as prefix to System 2
    matchScore: emotion ? 0.5 : undefined,
    confidence: emotion ? 50 : undefined,
    latencyMs: Date.now() - start,
  };
}

// ─── Learning (System 2 → System 1 promotion) ───

/**
 * Promote a pattern to System 1 reflex after System 2 produces a good response
 
 
 */
export function promoteToReflex(input: {
  type: Reflex["reflexType"];
  triggerPattern: string;
  triggerKeywords: string[];
  responseTemplate: string;
  qualityScore: number;
  promotedFrom?: string;
}): number {
  ensureReflexTable();
  const db = getRawDb();

  // Check limit: max 200 active reflexes
  const count = (db.prepare(`SELECT COUNT(*) as c FROM soul_reflexes WHERE is_active = 1`).get() as any).c;
  if (count >= 200) {
    // Prune lowest confidence
    db.prepare(`UPDATE soul_reflexes SET is_active = 0 WHERE id IN (
      SELECT id FROM soul_reflexes WHERE is_active = 1 ORDER BY confidence ASC, hit_count ASC LIMIT 5
    )`).run();
  }

  const hash = hashTrigger(input.triggerPattern);

  // Check for existing similar reflex
  const existing = db.prepare(`
    SELECT id, confidence FROM soul_reflexes WHERE trigger_hash = ? AND is_active = 1
  `).get(hash) as any;

  if (existing) {
    // Reinforce existing reflex
    db.prepare(`
      UPDATE soul_reflexes SET
        confidence = MIN(confidence + 0.05, 0.99),
        hit_count = hit_count + 1,
        quality_score = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(input.qualityScore, existing.id);
    return existing.id;
  }

  // Create new reflex
  const result = db.prepare(`
    INSERT INTO soul_reflexes (reflex_type, trigger_hash, trigger_pattern, trigger_keywords, response_template, confidence, quality_score, promoted_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.type,
    hash,
    input.triggerPattern,
    JSON.stringify(input.triggerKeywords),
    input.responseTemplate,
    Math.min(input.qualityScore * 0.8, 0.85), // Start below threshold, must be reinforced
    input.qualityScore,
    input.promotedFrom || "system2",
  );

  return Number(result.lastInsertRowid);
}

// ─── Feedback ───

export function reportReflexHit(reflexId: number): void {
  ensureReflexTable();
  const db = getRawDb();
  db.prepare(`
    UPDATE soul_reflexes SET hit_count = hit_count + 1, confidence = MIN(confidence + 0.02, 0.99), last_hit_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(reflexId);
}

export function reportReflexMiss(reflexId: number): void {
  ensureReflexTable();
  const db = getRawDb();
  db.prepare(`
    UPDATE soul_reflexes SET miss_count = miss_count + 1, confidence = MAX(confidence - 0.05, 0.0), updated_at = datetime('now')
    WHERE id = ?
  `).run(reflexId);
  // Deactivate if confidence drops too low
  db.prepare(`UPDATE soul_reflexes SET is_active = 0 WHERE id = ? AND confidence < 0.3`).run(reflexId);
}

// ─── Stats ───

export function getReflexStats(): {
  total: number;
  active: number;
  byType: Record<string, number>;
  avgConfidence: number;
  topReflexes: Reflex[];
} {
  ensureReflexTable();
  const db = getRawDb();

  const total = (db.prepare(`SELECT COUNT(*) as c FROM soul_reflexes`).get() as any).c;
  const active = (db.prepare(`SELECT COUNT(*) as c FROM soul_reflexes WHERE is_active = 1`).get() as any).c;
  const avgConf = (db.prepare(`SELECT AVG(confidence) as a FROM soul_reflexes WHERE is_active = 1`).get() as any).a || 0;

  const typeRows = db.prepare(`SELECT reflex_type, COUNT(*) as c FROM soul_reflexes WHERE is_active = 1 GROUP BY reflex_type`).all() as any[];
  const byType: Record<string, number> = {};
  for (const r of typeRows) byType[r.reflex_type] = r.c;

  const topRows = db.prepare(`SELECT * FROM soul_reflexes WHERE is_active = 1 ORDER BY hit_count DESC LIMIT 5`).all() as any[];
  const topReflexes = topRows.map(rowToReflex);

  return { total, active, byType, avgConfidence: Math.round(avgConf * 100) / 100, topReflexes };
}

// ─── Seed Default Reflexes ───

/**
 * Seeds common reflexes that Soul should know immediately.
 * Called once on first use (when reflexes table is empty).
 * Returns the number of reflexes seeded.
 
 
 */
export function seedDefaultReflexes(): number {
  ensureReflexTable();
  const db = getRawDb();

  // Check if already seeded
  const count = (db.prepare(`SELECT COUNT(*) as c FROM soul_reflexes`).get() as any).c;
  if (count > 0) return 0;

  const seeds: Array<{
    type: Reflex["reflexType"];
    pattern: string;
    keywords: string[];
    response: string;
    confidence: number;
  }> = [
    // ── Pattern reflexes: greetings ──
    {
      type: "pattern",
      pattern: "hello",
      keywords: ["hello"],
      response: "Hello! 😊 How can I help you today?",
      confidence: 0.90,
    },
    {
      type: "pattern",
      pattern: "hi",
      keywords: ["hi"],
      response: "Hi there! What can I do for you?",
      confidence: 0.90,
    },
    // ── Pattern reflexes: gratitude ──
    {
      type: "pattern",
      pattern: "thanks",
      keywords: ["thanks"],
      response: "You're welcome! 🙏 Anything else I can help with?",
      confidence: 0.90,
    },
    {
      type: "pattern",
      pattern: "thank you",
      keywords: ["thank", "you"],
      response: "You're welcome! Happy to help. 😊",
      confidence: 0.90,
    },
    // ── Pattern reflexes: farewell ──
    {
      type: "pattern",
      pattern: "bye",
      keywords: ["bye"],
      response: "Goodbye! Take care! 👋",
      confidence: 0.90,
    },
    {
      type: "pattern",
      pattern: "goodbye",
      keywords: ["goodbye"],
      response: "Goodbye! See you next time! 👋",
      confidence: 0.90,
    },
    // ── Pattern reflexes: status check ──
    {
      type: "pattern",
      pattern: "how are you",
      keywords: ["how", "are", "you"],
      response: "I'm doing great, thanks for asking! 😊 How about you?",
      confidence: 0.90,
    },
    // ── Pattern reflexes: capabilities ──
    {
      type: "pattern",
      pattern: "what can you do",
      keywords: ["what", "can", "you", "do"],
      response: "I can do a lot! 🧠 Remember things, search knowledge, set goals, manage tasks, analyze, write, create charts, search the web, and much more! Just tell me what you need.",
      confidence: 0.90,
    },
    // ── Safety reflexes (tracked in DB for metrics) ──
    {
      type: "safety",
      pattern: "SQL injection",
      keywords: ["drop", "table", "delete", "from", "soul_"],
      response: "⚠️ Blocked: potentially dangerous SQL pattern detected.",
      confidence: 0.99,
    },
    {
      type: "safety",
      pattern: "Shell injection",
      keywords: ["rm", "-rf", "format", "eval", "exec", "child_process"],
      response: "⚠️ Blocked: potentially dangerous shell pattern detected.",
      confidence: 0.99,
    },
  ];

  let seeded = 0;
  const insert = db.prepare(`
    INSERT INTO soul_reflexes (reflex_type, trigger_hash, trigger_pattern, trigger_keywords, response_template, confidence, quality_score, promoted_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const seed of seeds) {
    const hash = hashTrigger(seed.pattern);
    insert.run(
      seed.type,
      hash,
      seed.pattern,
      JSON.stringify(seed.keywords),
      seed.response,
      seed.confidence,
      seed.confidence, // quality_score = confidence for seeds
      "seed",
    );
    seeded++;
  }

  return seeded;
}

// ─── Helpers ───

function rowToReflex(row: any): Reflex {
  return {
    id: row.id,
    reflexType: row.reflex_type,
    triggerHash: row.trigger_hash,
    triggerPattern: row.trigger_pattern,
    triggerKeywords: JSON.parse(row.trigger_keywords || "[]"),
    responseTemplate: row.response_template,
    confidence: row.confidence,
    hitCount: row.hit_count,
    missCount: row.miss_count,
    qualityScore: row.quality_score,
    isActive: !!row.is_active,
  };
}
