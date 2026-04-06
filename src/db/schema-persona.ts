import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Persona 主表 - 存储角色元数据
 */
export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  schemaVersion: text("schema_version").notNull().default("0.3.0"),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Persona 身份锚点 - 角色自我认知
 */
export const personaIdentities = sqliteTable("persona_identities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  selfDescription: text("self_description"),
  originStory: text("origin_story"),
  personalityCore: text("personality_core").default("[]"), // JSON array
  definingMomentRefs: text("defining_moment_refs").default("[]"), // JSON array
  personaVoiceOnEvolution: text("persona_voice_on_evolution"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Persona 宪法/价值观 - 角色的原则和底线
 */
export const personaConstitutions = sqliteTable("persona_constitutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  mission: text("mission").notNull(),
  values: text("values").default("[]"), // JSON array
  boundaries: text("boundaries").default("[]"), // JSON array
  commitments: text("commitments").default("[]"), // JSON array
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Persona 世界观
 */
export const personaWorldviews = sqliteTable("persona_worldviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  seed: text("seed").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * Persona 行为特点
 */
export const personaHabits = sqliteTable("persona_habits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  style: text("style").notNull(),
  adaptability: text("adaptability").notNull().default("medium"), // low | medium | high
  quirks: text("quirks").default("[]"), // JSON array
  topicsOfInterest: text("topics_of_interest").default("[]"), // JSON array
  humorStyle: text("humor_style"), // dry | warm | playful | subtle
  conflictBehavior: text("conflict_behavior"), // assertive | deflect | redirect | hold-ground
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 用户档案 - 每个角色对应的用户认知
 */
export const personaUserProfiles = sqliteTable("persona_user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  preferredLanguage: text("preferred_language").notNull().default("zh-CN"),
  preferredName: text("preferred_name"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 多用户表 - 支持多用户独立使用
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  passphraseHash: text("passphrase_hash"),
  role: text("role").notNull().default("user"), // user | admin
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  lastLoginAt: text("last_login_at"),
});

/**
 * 用户 - 角色关联表
 */
export const userPersonaBindings = sqliteTable("user_persona_bindings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  personaId: text("persona_id").notNull().references(() => personas.id),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 共享空间配置
 */
export const sharedSpaces = sqliteTable("shared_spaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  userId: text("user_id").notNull().references(() => users.id),
  path: text("path").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 会话调度器状态 - 多角色对话状态
 */
export const turnSchedulerState = sqliteTable("turn_scheduler_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  activePersonaId: text("active_persona_id"),  // Removed foreign key for testing
  turnHistory: text("turn_history").default("[]"), // JSON array of {personaId, turnNumber}
  lastTurnAt: text("last_turn_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

/**
 * 角色记忆数据库引用 - 每个角色独立的记忆存储
 */
export const personaMemoryRefs = sqliteTable("persona_memory_refs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: text("persona_id").notNull().references(() => personas.id),
  memoryDbPath: text("memory_db_path"),
  memoryType: text("memory_type").notNull(), // hot | cold | autobiography
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
