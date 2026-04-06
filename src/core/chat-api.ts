/**
 * Chat API - WebSocket 和 HTTP 接口
 * 
 * 支持：
 * - 通过 UUID 进行对话
 * - 第一次对话自动创建角色
 * - WebSocket 实时通信
 * - HTTP REST API
 */

import { randomUUID } from "crypto";
import { getRawDb } from "../db/index.js";
import { runAgentLoop } from "./agent-loop.js";
import { createPersona } from "./persona/persona-manager.js";

// ─── Session Management ───

interface ChatSession {
  sessionId: string;
  userId: string;          // 用户 UUID
  personaId: string;       // 角色 ID
  createdAt: string;
  lastActivity: string;
  messageCount: number;
}

const sessions = new Map<string, ChatSession>();

/**
 * 获取或创建会话
 */
export function getOrCreateSession(userId: string): ChatSession {
  // 查找现有会话
  for (const session of sessions.values()) {
    if (session.userId === userId) {
      session.lastActivity = new Date().toISOString();
      return session;
    }
  }

  // 创建新会话
  const sessionId = randomUUID();
  
  // 检查用户是否已有角色
  const rawDb = getRawDb();
  const existingPersona = rawDb.prepare(`
    SELECT p.id, p.name, p.display_name 
    FROM personas p
    JOIN user_persona_bindings upb ON p.id = upb.persona_id
    WHERE upb.user_id = ?
  `).get(userId) as any;

  let personaId: string;
  
  if (existingPersona) {
    // 使用现有角色
    personaId = existingPersona.id;
  } else {
    // 自动创建角色
    const persona = createPersona({
      name: `user-${userId.slice(0, 8)}`,
      displayName: `用户 ${userId.slice(0, 4)}`,
      description: "自动创建的用户角色",
      schemaVersion: "0.3.0",
      constitution: {
        mission: "与用户进行自然对话",
        values: ["友好", " helpful", "诚实"],
        boundaries: ["不伤害", "不欺骗"],
      },
      habits: {
        style: "友好、自然",
        adaptability: "high",
        quirks: [],
      },
    });
    personaId = persona.meta.id;
    
    // 绑定用户和角色
    rawDb.prepare(`
      INSERT INTO user_persona_bindings (user_id, persona_id, is_default)
      VALUES (?, ?, 1)
    `).run(userId, personaId);
  }

  const session: ChatSession = {
    sessionId,
    userId,
    personaId,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    messageCount: 0,
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * 获取会话列表
 */
export function listSessions(): ChatSession[] {
  return Array.from(sessions.values());
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * 清理过期会话（24 小时无活动）
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const [id, session] of sessions) {
    if (now - new Date(session.lastActivity).getTime() > ONE_DAY) {
      sessions.delete(id);
      removed++;
    }
  }

  return removed;
}

// ─── Chat Processing ───

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  messageCount: number;
  personaId: string;
  personaName: string;
}

/**
 * 处理聊天消息
 */
export async function processChatMessage(
  userId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  // 获取或创建会话
  const session = sessionId 
    ? (sessions.get(sessionId) || getOrCreateSession(userId))
    : getOrCreateSession(userId);

  // 获取角色信息
  const rawDb = getRawDb();
  const personaRow = rawDb.prepare(`
    SELECT name, display_name FROM personas WHERE id = ?
  `).get(session.personaId) as any;

  // 准备消息历史
  const messages: ChatMessage[] = [
    { role: 'user', content: message },
  ];

  // 运行 Agent Loop
  try {
    const result = await runAgentLoop(message, {
      sessionId: session.sessionId,
      maxIterations: 10,
    });

    session.messageCount++;
    session.lastActivity = new Date().toISOString();

    return {
      sessionId: session.sessionId,
      response: result.reply || "收到消息",
      messageCount: session.messageCount,
      personaId: session.personaId,
      personaName: personaRow?.display_name || "助手",
    };
  } catch (err: any) {
    console.error('[Chat API] Error:', err.message);
    return {
      sessionId: session.sessionId,
      response: "抱歉，我遇到了一些问题，请稍后再试。",
      messageCount: session.messageCount,
      personaId: session.personaId,
      personaName: personaRow?.display_name || "助手",
    };
  }
}

/**
 * 获取对话历史
 */
export function getConversationHistory(sessionId: string): ChatMessage[] {
  const rawDb = getRawDb();
  const history = rawDb.prepare(`
    SELECT role, content FROM conversation_turns
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT 100
  `).all(sessionId) as any[];

  return history.map(h => ({
    role: h.role as 'user' | 'assistant' | 'system',
    content: h.content,
  }));
}

// ─── User Management ───

/**
 * 创建用户
 */
export function createUser(userId?: string): { userId: string; personaId: string } {
  const newUserId = userId || randomUUID();
  const rawDb = getRawDb();

  // 创建用户记录
  rawDb.prepare(`
    INSERT OR IGNORE INTO users (id, username, display_name, role)
    VALUES (?, ?, ?, ?)
  `).run(newUserId, `user_${newUserId.slice(0, 4)}`, `用户 ${newUserId.slice(0, 4)}`, 'user');

  // 创建会话（会自动创建角色）
  const session = getOrCreateSession(newUserId);

  return {
    userId: newUserId,
    personaId: session.personaId,
  };
}

/**
 * 获取用户信息
 */
export function getUserInfo(userId: string): any {
  const rawDb = getRawDb();
  
  const user = rawDb.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(userId) as any;

  if (!user) return null;

  const personas = rawDb.prepare(`
    SELECT p.id, p.name, p.display_name, upb.is_default
    FROM personas p
    JOIN user_persona_bindings upb ON p.id = upb.persona_id
    WHERE upb.user_id = ?
  `).all(userId) as any[];

  return {
    ...user,
    personas,
  };
}

/**
 * 列出所有用户
 */
export function listUsers(): any[] {
  const rawDb = getRawDb();
  const users = rawDb.prepare(`
    SELECT id, username, display_name, role, created_at
    FROM users
    ORDER BY created_at DESC
  `).all() as any[];

  return users;
}
