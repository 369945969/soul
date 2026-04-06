/**
 * Persona 管理器
 * 负责角色的创建、加载、切换和管理
 */

import { getRawDb } from "../../db/index.js";
import { randomUUID } from "crypto";
import type {
  Persona,
  PersonaMeta,
  PersonaIdentity,
  PersonaConstitution,
  PersonaWorldview,
  PersonaHabits,
  PersonaUserProfile,
  CreatePersonaOptions,
} from "./persona-types.js";

/**
 * 确保所有 persona 相关表存在
 */
function ensureTables() {
  const rawDb = getRawDb();
  rawDb.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_personas_name ON personas(name);
    CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active);
  `);
}

/**
 * 映射数据库行到 PersonaMeta
 */
function mapMeta(row: any): PersonaMeta {
  return {
    id: row.id,
    displayName: row.display_name,
    schemaVersion: row.schema_version || "0.3.0",
    createdAt: row.created_at,
    description: row.description,
  };
}

/**
 * 创建新角色
 */
export function createPersona(options: CreatePersonaOptions): Persona {
  ensureTables();
  const rawDb = getRawDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  // 插入主表
  rawDb.prepare(
    `INSERT INTO personas (id, name, display_name, description, schema_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, options.name, options.displayName, options.description || "", options.schemaVersion || "0.3.0", now, now);

  // 插入身份锚点
  const identity: PersonaIdentity = {
    personaId: id,
    anchors: { continuity: true },
    schemaVersion: "2.0",
    selfDescription: options.constitution?.mission || "",
    originStory: "",
    personalityCore: options.habits?.quirks || [],
    updatedAt: now,
  };
  rawDb.prepare(
    `INSERT INTO persona_identities (persona_id, self_description, origin_story, personality_core, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, identity.selfDescription, identity.originStory, JSON.stringify(identity.personalityCore), now);

  // 插入宪法
  const constitution: PersonaConstitution = {
    mission: options.constitution?.mission || "帮助主人",
    values: options.constitution?.values || ["诚实", "善良", "忠诚"],
    boundaries: options.constitution?.boundaries || ["不伤害", "不欺骗"],
    commitments: options.constitution?.commitments || [],
  };
  rawDb.prepare(
    `INSERT INTO persona_constitutions (persona_id, mission, "values", boundaries, commitments, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, constitution.mission, JSON.stringify(constitution.values), JSON.stringify(constitution.boundaries), JSON.stringify(constitution.commitments || []), now);

  // 插入世界观
  const worldview: PersonaWorldview = {
    seed: options.worldview?.seed || "我存在，故我思考",
  };
  rawDb.prepare(
    `INSERT INTO persona_worldviews (persona_id, seed, updated_at) VALUES (?, ?, ?)`
  ).run(id, worldview.seed, now);

  // 插入行为特点
  const habits: PersonaHabits = {
    style: options.habits?.style || "友好、幽默",
    adaptability: options.habits?.adaptability || "medium",
    quirks: options.habits?.quirks || [],
    topicsOfInterest: options.habits?.topicsOfInterest || [],
    humorStyle: options.habits?.humorStyle || null,
    conflictBehavior: options.habits?.conflictBehavior || null,
  };
  rawDb.prepare(
    `INSERT INTO persona_habits (persona_id, style, adaptability, quirks, topics_of_interest, humor_style, conflict_behavior, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, habits.style, habits.adaptability, JSON.stringify(habits.quirks), JSON.stringify(habits.topicsOfInterest), habits.humorStyle, habits.conflictBehavior, now);

  // 插入用户档案
  const userProfile: PersonaUserProfile = {
    preferredLanguage: "zh-CN",
    preferredName: "主人",
  };
  rawDb.prepare(
    `INSERT INTO persona_user_profiles (persona_id, preferred_language, preferred_name, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, userProfile.preferredLanguage, userProfile.preferredName, now);

  return buildPersona(id);
}

/**
 * 从数据库构建完整的 Persona 对象
 */
function buildPersona(id: string): Persona {
  const rawDb = getRawDb();

  const metaRow = rawDb.prepare("SELECT * FROM personas WHERE id = ?").get(id) as any;
  const identityRow = rawDb.prepare("SELECT * FROM persona_identities WHERE persona_id = ?").get(id) as any;
  const constitutionRow = rawDb.prepare("SELECT * FROM persona_constitutions WHERE persona_id = ?").get(id) as any;
  const worldviewRow = rawDb.prepare("SELECT * FROM persona_worldviews WHERE persona_id = ?").get(id) as any;
  const habitsRow = rawDb.prepare("SELECT * FROM persona_habits WHERE persona_id = ?").get(id) as any;
  const profileRow = rawDb.prepare("SELECT * FROM persona_user_profiles WHERE persona_id = ?").get(id) as any;

  return {
    meta: mapMeta(metaRow),
    identity: {
      personaId: identityRow.persona_id,
      anchors: { continuity: true },
      schemaVersion: "2.0",
      selfDescription: identityRow.self_description,
      originStory: identityRow.origin_story,
      personalityCore: JSON.parse(identityRow.personality_core || "[]"),
      definingMomentRefs: JSON.parse(identityRow.defining_moment_refs || "[]"),
      personaVoiceOnEvolution: identityRow.persona_voice_on_evolution,
      updatedAt: identityRow.updated_at,
    },
    constitution: {
      mission: constitutionRow.mission,
      values: JSON.parse(constitutionRow.values || "[]"),
      boundaries: JSON.parse(constitutionRow.boundaries || "[]"),
      commitments: JSON.parse(constitutionRow.commitments || "[]"),
    },
    worldview: {
      seed: worldviewRow.seed,
    },
    habits: {
      style: habitsRow.style,
      adaptability: habitsRow.adaptability,
      quirks: JSON.parse(habitsRow.quirks || "[]"),
      topicsOfInterest: JSON.parse(habitsRow.topics_of_interest || "[]"),
      humorStyle: habitsRow.humor_style,
      conflictBehavior: habitsRow.conflict_behavior,
    },
    userProfile: profileRow ? {
      preferredLanguage: profileRow.preferred_language,
      preferredName: profileRow.preferred_name,
    } : undefined,
  };
}

/**
 * 列出所有角色
 */
export function listPersonas(): Array<{ id: string; name: string; displayName: string; description: string | null; isActive: boolean }> {
  ensureTables();
  const rawDb = getRawDb();
  const rows = rawDb.prepare("SELECT id, name, display_name, description, is_active FROM personas ORDER BY created_at DESC").all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    isActive: !!row.is_active,
  }));
}

/**
 * 获取角色详情
 */
export function getPersona(id: string): Persona | null {
  ensureTables();
  try {
    return buildPersona(id);
  } catch {
    return null;
  }
}

/**
 * 通过名称获取角色
 */
export function getPersonaByName(name: string): Persona | null {
  ensureTables();
  const rawDb = getRawDb();
  const row = rawDb.prepare("SELECT id FROM personas WHERE name = ?").get(name) as any;
  if (!row) return null;
  return buildPersona(row.id);
}

/**
 * 删除角色
 */
export function deletePersona(id: string): boolean {
  ensureTables();
  const rawDb = getRawDb();
  const result = rawDb.prepare("DELETE FROM personas WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * 激活/停用角色
 */
export function setPersonaActive(id: string, active: boolean): boolean {
  ensureTables();
  const rawDb = getRawDb();
  const now = new Date().toISOString();
  const result = rawDb.prepare("UPDATE personas SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, now, id);
  return result.changes > 0;
}

/**
 * 导出角色为 JSON
 */
export function exportPersona(id: string): string {
  const persona = getPersona(id);
  if (!persona) throw new Error(`Persona not found: ${id}`);
  return JSON.stringify(persona, null, 2);
}

/**
 * 从 JSON 导入角色
 */
export function importPersona(json: string): Persona {
  const data = JSON.parse(json) as Persona;
  ensureTables();
  const rawDb = getRawDb();
  const now = new Date().toISOString();

  // 检查名称是否已存在
  const existing = rawDb.prepare("SELECT id FROM personas WHERE name = ?").get(data.meta.displayName) as any;
  if (existing) {
    throw new Error(`Persona name already exists: ${data.meta.displayName}`);
  }

  const id = randomUUID();

  // 插入主表
  rawDb.prepare(
    `INSERT INTO personas (id, name, display_name, description, schema_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.meta.displayName, data.meta.displayName, data.meta.description || "", data.meta.schemaVersion, now, now);

  // 插入身份
  rawDb.prepare(
    `INSERT INTO persona_identities (persona_id, self_description, origin_story, personality_core, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, data.identity.selfDescription, data.identity.originStory, JSON.stringify(data.identity.personalityCore || []), now);

  // 插入宪法
  rawDb.prepare(
    `INSERT INTO persona_constitutions (persona_id, mission, "values", boundaries, commitments, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.constitution.mission, JSON.stringify(data.constitution.values), JSON.stringify(data.constitution.boundaries), JSON.stringify(data.constitution.commitments || []), now);

  // 插入世界观
  rawDb.prepare(
    `INSERT INTO persona_worldviews (persona_id, seed, updated_at) VALUES (?, ?, ?)`
  ).run(id, data.worldview.seed, now);

  // 插入行为特点
  rawDb.prepare(
    `INSERT INTO persona_habits (persona_id, style, adaptability, quirks, topics_of_interest, humor_style, conflict_behavior, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.habits.style, data.habits.adaptability, JSON.stringify(data.habits.quirks || []), JSON.stringify(data.habits.topicsOfInterest || []), data.habits.humorStyle, data.habits.conflictBehavior, now);

  // 插入用户档案
  rawDb.prepare(
    `INSERT INTO persona_user_profiles (persona_id, preferred_language, preferred_name, updated_at)
     VALUES (?, ?, ?, ?)`
  ).run(id, data.userProfile?.preferredLanguage || "zh-CN", data.userProfile?.preferredName || "主人", now);

  return buildPersona(id);
}

/**
 * 更新角色
 */
export function updatePersona(id: string, updates: Partial<CreatePersonaOptions>): Persona {
  ensureTables();
  const rawDb = getRawDb();
  const now = new Date().toISOString();

  if (updates.displayName) {
    rawDb.prepare("UPDATE personas SET display_name = ?, updated_at = ? WHERE id = ?").run(updates.displayName, now, id);
  }
  if (updates.description) {
    rawDb.prepare("UPDATE personas SET description = ?, updated_at = ? WHERE id = ?").run(updates.description, now, id);
  }

  return buildPersona(id);
}
