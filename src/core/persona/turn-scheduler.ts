/**
 * Turn Scheduler (会话调度器)
 * 管理多角色对话的发言顺序和调度
 */

import { getRawDb } from "../../db/index.js";
import type { TurnSchedulerOptions, TurnScheduleResult } from "./persona-types.js";

/**
 * 调度模式
 */
export type SchedulerMode = "strict_rr" | "priority_rr" | "free_form";

/**
 * 调度器状态
 */
export interface SchedulerState {
  sessionId: string;
  activePersonaId: string;
  turnHistory: Array<{
    personaId: string;
    turnNumber: number;
    timestamp: string;
  }>;
  consecutiveCounts: Map<string, number>; // personaId -> 连续发言次数
  lastTurnAt: string;
  createdAt: string;
}

/**
 * 确保调度器表存在
 */
function ensureTables() {
  const rawDb = getRawDb();
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS turn_scheduler_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      active_persona_id TEXT,
      turn_history TEXT DEFAULT '[]',
      consecutive_counts TEXT DEFAULT '{}',
      last_turn_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_scheduler_session ON turn_scheduler_state(session_id);
  `);
}

/**
 * 创建新的调度器状态
 */
export function createSchedulerState(sessionId: string, initialPersonaId: string): SchedulerState {
  ensureTables();
  const rawDb = getRawDb();
  const now = new Date().toISOString();

  const state: SchedulerState = {
    sessionId,
    activePersonaId: initialPersonaId,
    turnHistory: [],
    consecutiveCounts: new Map(),
    lastTurnAt: now,
    createdAt: now,
  };

  rawDb.prepare(
    `INSERT INTO turn_scheduler_state (session_id, active_persona_id, turn_history, consecutive_counts, last_turn_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    initialPersonaId,
    JSON.stringify(state.turnHistory),
    JSON.stringify(Object.fromEntries(state.consecutiveCounts)),
    now,
    now
  );

  return state;
}

/**
 * 获取或创建调度器状态
 */
export function getOrCreateSchedulerState(sessionId: string, initialPersonaId?: string): SchedulerState {
  ensureTables();
  const rawDb = getRawDb();

  const row = rawDb.prepare("SELECT * FROM turn_scheduler_state WHERE session_id = ?").get(sessionId) as any;

  if (row) {
    return {
      sessionId: row.session_id,
      activePersonaId: row.active_persona_id,
      turnHistory: JSON.parse(row.turn_history || "[]"),
      consecutiveCounts: new Map(Object.entries(JSON.parse(row.consecutive_counts || "{}"))),
      lastTurnAt: row.last_turn_at,
      createdAt: row.created_at,
    };
  }

  return createSchedulerState(sessionId, initialPersonaId || "default");
}

/**
 * 更新调度器状态
 */
export function updateSchedulerState(state: SchedulerState): void {
  ensureTables();
  const rawDb = getRawDb();
  const now = new Date().toISOString();

  rawDb.prepare(
    `UPDATE turn_scheduler_state SET
       active_persona_id = ?,
       turn_history = ?,
       consecutive_counts = ?,
       last_turn_at = ?
     WHERE session_id = ?`
  ).run(
    state.activePersonaId,
    JSON.stringify(state.turnHistory),
    JSON.stringify(Object.fromEntries(state.consecutiveCounts)),
    now,
    state.sessionId
  );
}

/**
 * 严格轮询调度
 * 严格按照角色顺序轮流发言
 */
export function strictRoundRobin(
  personas: Array<{ id: string; name: string }>,
  state: SchedulerState
): TurnScheduleResult {
  if (personas.length === 0) {
    throw new Error("No personas available for scheduling");
  }

  if (personas.length === 1) {
    return {
      selectedPersonaId: personas[0].id,
      reason: "only_one_persona",
      turnNumber: state.turnHistory.length + 1,
      isConsecutive: true,
      consecutiveCount: 1,
    };
  }

  // 找到最后一个发言的角色
  const lastTurn = state.turnHistory[state.turnHistory.length - 1];
  if (!lastTurn) {
    // 第一次发言，选择第一个角色
    return {
      selectedPersonaId: personas[0].id,
      reason: "first_turn",
      turnNumber: 1,
      isConsecutive: false,
      consecutiveCount: 1,
    };
  }

  // 找到下一个角色
  const lastIndex = personas.findIndex(p => p.id === lastTurn.personaId);
  const nextIndex = (lastIndex + 1) % personas.length;

  return {
    selectedPersonaId: personas[nextIndex].id,
    reason: "strict_round_robin",
    turnNumber: state.turnHistory.length + 1,
    isConsecutive: false,
    consecutiveCount: 1,
  };
}

/**
 * 优先级轮询调度
 * 结合发言欲望和公平性进行调度
 */
export function priorityRoundRobin(
  personas: Array<{ id: string; name: string; desire?: number }>,
  state: SchedulerState
): TurnScheduleResult {
  const maxConsecutive = 3; // default

  if (personas.length === 0) {
    throw new Error("No personas available for scheduling");
  }

  if (personas.length === 1) {
    return {
      selectedPersonaId: personas[0].id,
      reason: "only_one_persona",
      turnNumber: state.turnHistory.length + 1,
      isConsecutive: true,
      consecutiveCount: 1,
    };
  }

  // 检查是否有角色达到连续发言上限
  const lastTurn = state.turnHistory[state.turnHistory.length - 1];
  const currentConsecutive = state.consecutiveCounts.get(lastTurn?.personaId || "default") || 0;

  // 如果当前角色已达到上限，强制切换
  if (lastTurn && currentConsecutive >= maxConsecutive) {
    // 选择连续发言次数最少的角色
    const sorted = [...personas].sort((a, b) => {
      const aCount = state.consecutiveCounts.get(a.id) || 0;
      const bCount = state.consecutiveCounts.get(b.id) || 0;
      return aCount - bCount;
    });

    return {
      selectedPersonaId: sorted[0].id,
      reason: "anti_monopoly",
      turnNumber: state.turnHistory.length + 1,
      isConsecutive: false,
      consecutiveCount: 1,
    };
  }

  // 计算每个角色的优先级得分
  const scored = personas.map(p => {
    const desire = p.desire || 0.5;
    const fairness = 1 - ((state.consecutiveCounts.get(p.id) || 0) / maxConsecutive);
    return {
      ...p,
      score: desire * 0.6 + fairness * 0.4,
    };
  });

  // 选择得分最高的角色
  const best = scored.reduce((max, p) => p.score > max.score ? p : max);

  return {
    selectedPersonaId: best.id,
    reason: "priority_score",
    turnNumber: state.turnHistory.length + 1,
    isConsecutive: lastTurn?.personaId === best.id,
    consecutiveCount: (state.consecutiveCounts.get(best.id) || 0) + 1,
  };
}

/**
 * 自由发言调度
 * 角色主动竞争发言权
 */
export function freeForm(
  personas: Array<{ id: string; name: string; desire?: number }>,
  state: SchedulerState
): TurnScheduleResult {
  const maxConsecutive = 3; // default

  if (personas.length === 0) {
    throw new Error("No personas available for scheduling");
  }

  if (personas.length === 1) {
    return {
      selectedPersonaId: personas[0].id,
      reason: "only_one_persona",
      turnNumber: state.turnHistory.length + 1,
      isConsecutive: true,
      consecutiveCount: 1,
    };
  }

  // 检查反垄断
  const lastTurn = state.turnHistory[state.turnHistory.length - 1];
  const currentConsecutive = state.consecutiveCounts.get(lastTurn?.personaId || "default") || 0;

  if (lastTurn && currentConsecutive >= maxConsecutive) {
    // 排除当前角色，选择其他角色中欲望最高的
    const others = personas.filter(p => p.id !== lastTurn.personaId);
    const best = others.reduce((max, p) => (p.desire || 0) > (max.desire || 0) ? p : max);

    return {
      selectedPersonaId: best.id,
      reason: "anti_monopoly_free_form",
      turnNumber: state.turnHistory.length + 1,
      isConsecutive: false,
      consecutiveCount: 1,
    };
  }

  // 选择欲望最高的角色
  const best = personas.reduce((max, p) => (p.desire || 0) > (max.desire || 0) ? p : max);

  return {
    selectedPersonaId: best.id,
    reason: "highest_desire",
    turnNumber: state.turnHistory.length + 1,
    isConsecutive: lastTurn?.personaId === best.id,
    consecutiveCount: (state.consecutiveCounts.get(best.id) || 0) + 1,
  };
}

/**
 * 计算角色发言欲望
 * 基于用户输入和当前上下文
 */
export function calculatePersonaDesire(
  personaId: string,
  userInput: string,
  context?: {
    topicsOfInterest?: string[];
    personalityCore?: string[];
  }
): number {
  let desire = 0.5; // 基础欲望

  // 1. 话题匹配度
  if (context?.topicsOfInterest) {
    for (const topic of context.topicsOfInterest) {
      if (userInput.includes(topic)) {
        desire += 0.2;
      }
    }
  }

  // 2. 性格匹配度
  if (context?.personalityCore) {
    const personalityKeywords = {
      "外向": ["聊天", "聊天", "聊", "聊天"],
      "幽默": ["笑", "哈哈", "呵呵", "有趣"],
      "好奇": ["什么", "为什么", "怎么", "如何"],
      "认真": ["分析", "讨论", "研究", "思考"],
    };

    for (const [trait, keywords] of Object.entries(personalityKeywords)) {
      if (context.personalityCore?.includes(trait)) {
        for (const keyword of keywords) {
          if (userInput.includes(keyword)) {
            desire += 0.1;
          }
        }
      }
    }
  }

  return Math.min(1.0, desire);
}

/**
 * 调度发言
 */
export function scheduleTurn(
  personas: Array<{ id: string; name: string; desire?: number }>,
  sessionId: string,
  options: TurnSchedulerOptions
): TurnScheduleResult {
  const state = getOrCreateSchedulerState(sessionId);
  const mode = options.mode || "priority_rr";

  let result: TurnScheduleResult;

  switch (mode) {
    case "strict_rr":
      result = strictRoundRobin(personas, state);
      break;
    case "free_form":
      result = freeForm(personas, state);
      break;
    case "priority_rr":
    default:
      result = priorityRoundRobin(personas, state);
      break;
  }

  // 更新状态
  state.activePersonaId = result.selectedPersonaId;
  state.turnHistory.push({
    personaId: result.selectedPersonaId,
    turnNumber: result.turnNumber,
    timestamp: new Date().toISOString(),
  });

  // 更新连续计数
  if (result.isConsecutive) {
    state.consecutiveCounts.set(result.selectedPersonaId, result.consecutiveCount);
  } else {
    // 重置其他角色的连续计数
    for (const [pid] of state.consecutiveCounts) {
      if (pid !== result.selectedPersonaId) {
        state.consecutiveCounts.set(pid, 0);
      }
    }
    state.consecutiveCounts.set(result.selectedPersonaId, 1);
  }

  state.lastTurnAt = new Date().toISOString();
  updateSchedulerState(state);

  return result;
}

/**
 * 获取调度器统计信息
 */
export function getSchedulerStats(sessionId: string): {
  totalTurns: number;
  personaTurnDistribution: Record<string, number>;
  averageTurnsPerPersona: number;
} {
  const state = getOrCreateSchedulerState(sessionId);

  const distribution: Record<string, number> = {};
  for (const turn of state.turnHistory) {
    distribution[turn.personaId] = (distribution[turn.personaId] || 0) + 1;
  }

  const totalTurns = state.turnHistory.length;
  const personaCount = Object.keys(distribution).length;

  return {
    totalTurns,
    personaTurnDistribution: distribution,
    averageTurnsPerPersona: personaCount > 0 ? totalTurns / personaCount : 0,
  };
}

/**
 * 重置调度器状态
 */
export function resetSchedulerState(sessionId: string): void {
  ensureTables();
  const rawDb = getRawDb();
  rawDb.prepare("DELETE FROM turn_scheduler_state WHERE session_id = ?").run(sessionId);
}
