#!/usr/bin/env node

/**
 * Persona Guard Integration — 角色守卫集成到聊天流程
 * 
 * 在聊天前自动应用角色守卫：
 * 1. Identity Guard - 防止模型提供方污染
 * 2. Relational Guard - 防止服务化语气
 * 3. Factual Guard - 确保基于真实记忆
 * 4. Turn Scheduler - 多角色发言调度
 */

import { getRawDb } from "../../db/index.js";
import { enforceIdentityGuard } from "./identity-guard.js";
import { enforceRelationalGuard } from "./relational-guard.js";
import { enforceFactualGroundingGuard, type FactualGuardResult } from "./factual-guard.js";
import { scheduleTurn, getOrCreateSchedulerState } from "./turn-scheduler.js";
import type { PersonaGuardResult, IdentityGuardResult, RelationalGuardResult } from "./persona-types.js";

/**
 * 应用所有角色守卫到回复文本
 */
export async function applyPersonaGuards(
  text: string,
  personaName: string,
  userInput: string,
  memories: Array<{ id: string; content: string }> = []
): Promise<PersonaGuardResult> {
  let correctedText = text;
  const corrections: string[] = [];

  // 1. 身份守卫 - 防止模型提供方污染
  const identityResult = enforceIdentityGuard(correctedText, personaName, userInput);
  if (identityResult.corrected) {
    correctedText = identityResult.text;
    corrections.push(`身份守卫：${identityResult.reason}`);
  }

  // 2. 关系守卫 - 防止服务化语气
  const relationalResult = enforceRelationalGuard(correctedText, { personaName });
  if (relationalResult.corrected) {
    correctedText = relationalResult.text;
    corrections.push(`关系守卫：${relationalResult.reason}`);
  }

  // 3. 事实守卫 - 确保基于真实记忆
  const factualResult = enforceFactualGroundingGuard(correctedText, { selectedMemories: memories.map(m => m.content) });
  if (factualResult.corrected) {
    correctedText = factualResult.text;
    corrections.push(`事实守卫：${factualResult.reason}`);
  }

  return {
    text: correctedText,
    corrections,
    identity: identityResult,
    relational: relationalResult,
    factual: factualResult,
  };
}

/**
 * 为多角色会话选择下一个发言角色
 */
export async function selectNextPersona(
  sessionId: string,
  personas: Array<{ id: string; name: string }>,
  mode: "strict_rr" | "priority_rr" | "free_form" = "strict_rr"
): Promise<{
  selectedPersonaId: string;
  turnNumber: number;
  isConsecutive: boolean;
  consecutiveCount: number;
}> {
  if (personas.length === 0) {
    throw new Error("No personas available for scheduling");
  }

  if (personas.length === 1) {
    return {
      selectedPersonaId: personas[0].id,
      turnNumber: 1,
      isConsecutive: false,
      consecutiveCount: 1,
    };
  }

  const state = getOrCreateSchedulerState(sessionId);
  
  const result = scheduleTurn(personas, sessionId, { mode });
  
  // 更新状态
  const rawDb = getRawDb();
  rawDb.prepare(`
    UPDATE turn_scheduler_state 
    SET turn_history = ?, 
        last_turn_at = ?,
        updated_at = ?
    WHERE session_id = ?
  `).run(
    JSON.stringify([...state.turnHistory, { 
      personaId: result.selectedPersonaId, 
      turnNumber: result.turnNumber 
    }]),
    new Date().toISOString(),
    new Date().toISOString(),
    sessionId
  );

  return {
    selectedPersonaId: result.selectedPersonaId,
    turnNumber: result.turnNumber,
    isConsecutive: result.isConsecutive,
    consecutiveCount: result.consecutiveCount,
  };
}

/**
 * 获取当前会话的活跃角色
 */
export async function getActivePersona(sessionId: string): Promise<{
  personaId: string;
  personaName: string;
  displayName: string;
} | null> {
  const rawDb = getRawDb();
  
  const state = rawDb.prepare(`
    SELECT active_persona_id, turn_history 
    FROM turn_scheduler_state 
    WHERE session_id = ?
  `).get(sessionId) as { active_persona_id: string; turn_history: string } | undefined;

  if (!state || !state.active_persona_id) {
    return null;
  }

  const persona = rawDb.prepare(`
    SELECT id, name, display_name 
    FROM personas 
    WHERE id = ?
  `).get(state.active_persona_id) as { id: string; name: string; display_name: string };

  if (!persona) {
    return null;
  }

  return {
    personaId: persona.id,
    personaName: persona.name,
    displayName: persona.display_name,
  };
}

/**
 * 获取会话可用的角色列表
 */
export async function getAvailablePersonas(sessionId: string): Promise<Array<{
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}>> {
  const rawDb = getRawDb();
  
  // 获取当前活跃角色
  const state = rawDb.prepare(`
    SELECT active_persona_id 
    FROM turn_scheduler_state 
    WHERE session_id = ?
  `).get(sessionId) as { active_persona_id: string } | undefined;

  const activePersonaId = state?.active_persona_id;

  // 获取所有角色
  const personas = rawDb.prepare(`
    SELECT id, name, display_name, is_active 
    FROM personas 
    ORDER BY is_active DESC, name ASC
  `).all() as Array<{ id: string; name: string; display_name: string; is_active: number }>;

  return personas.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    isActive: p.is_active === 1,
  }));
}

/**
 * 绑定角色到会话
 */
export async function bindPersonaToSession(
  sessionId: string,
  personaId: string
): Promise<boolean> {
  const rawDb = getRawDb();
  
  // 检查角色是否存在
  const persona = rawDb.prepare(`
    SELECT id FROM personas WHERE id = ?
  `).get(personaId);

  if (!persona) {
    return false;
  }

  // 创建或更新调度器状态
  const existing = rawDb.prepare(`
    SELECT id FROM turn_scheduler_state WHERE session_id = ?
  `).get(sessionId);

  if (existing) {
    rawDb.prepare(`
      UPDATE turn_scheduler_state 
      SET active_persona_id = ?, updated_at = ?
      WHERE session_id = ?
    `).run(personaId, new Date().toISOString(), sessionId);
  } else {
    rawDb.prepare(`
      INSERT INTO turn_scheduler_state 
      (session_id, active_persona_id, turn_history, mode, created_at, updated_at)
      VALUES (?, ?, '[]', 'strict_rr', ?, ?)
    `).run(sessionId, personaId, new Date().toISOString(), new Date().toISOString());
  }

  return true;
}

/**
 * 检查守卫是否启用
 */
export function isPersonaGuardsEnabled(): boolean {
  return process.env.ENABLE_PERSONA_GUARDS !== "false";
}

/**
 * 获取守卫配置
 */
export function getPersonaGuardConfig(): {
  identityGuard: boolean;
  relationalGuard: boolean;
  factualGuard: boolean;
  schedulingMode: "strict_rr" | "priority_rr" | "free_form";
} {
  return {
    identityGuard: process.env.ENABLE_IDENTITY_GUARD !== "false",
    relationalGuard: process.env.ENABLE_RELATIONAL_GUARD !== "false",
    factualGuard: process.env.ENABLE_FACTUAL_GUARD !== "false",
    schedulingMode: (process.env.SCHEDULING_MODE as "strict_rr" | "priority_rr" | "free_form") || "strict_rr",
  };
}
