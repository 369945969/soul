/**
 * 通知引擎 — 主动推送通知
 *
 * Soul 不只是等待被询问 — 它主动通知：
 * 1. 基于 WebSocket 的实时通知
 * 2. 带持久化的通知队列
 * 3. 优先级（信息、警告、紧急）
 * 4. 通知历史
 */

import { getRawDb } from "../db/index.js";

export interface Notification {
  id: number;
  title: string;
  message: string;
  priority: "info" | "warning" | "urgent";
  source: string;
  isRead: boolean;
  createdAt: string;
}

// In-memory notification listeners
const listeners: Set<(notification: Notification) => void> = new Set();

function ensureNotificationsTable() {
  const rawDb = getRawDb();
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS soul_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'info',
      source TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function onNotification(callback: (notification: Notification) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function pushNotification(input: {
  title: string;
  message: string;
  priority?: "info" | "warning" | "urgent";
  source?: string;
}): Promise<Notification> {
  ensureNotificationsTable();
  const rawDb = getRawDb();

  const row = rawDb
    .prepare(
      `INSERT INTO soul_notifications (title, message, priority, source)
       VALUES (?, ?, ?, ?) RETURNING *`
    )
    .get(
      input.title,
      input.message,
      input.priority || "info",
      input.source || "system"
    ) as any;

  const notification = mapNotification(row);

  // Push to all listeners (WebSocket clients)
  for (const listener of listeners) {
    try {
      listener(notification);
    } catch {
      // Don't crash if listener fails
    }
  }

  return notification;
}

export async function getNotifications(
  unreadOnly = false,
  limit = 50
): Promise<Notification[]> {
  ensureNotificationsTable();
  const rawDb = getRawDb();

  let query = "SELECT * FROM soul_notifications";
  if (unreadOnly) query += " WHERE is_read = 0";
  query += " ORDER BY created_at DESC LIMIT ?";

  const rows = rawDb.prepare(query).all(limit) as any[];
  return rows.map(mapNotification);
}

export async function markRead(id: number): Promise<void> {
  ensureNotificationsTable();
  const rawDb = getRawDb();
  rawDb
    .prepare("UPDATE soul_notifications SET is_read = 1 WHERE id = ?")
    .run(id);
}

export async function markAllRead(): Promise<number> {
  ensureNotificationsTable();
  const rawDb = getRawDb();
  const result = rawDb
    .prepare("UPDATE soul_notifications SET is_read = 1 WHERE is_read = 0")
    .run();
  return result.changes;
}

export async function getUnreadCount(): Promise<number> {
  ensureNotificationsTable();
  const rawDb = getRawDb();
  const row = rawDb
    .prepare("SELECT COUNT(*) as count FROM soul_notifications WHERE is_read = 0")
    .get() as any;
  return row?.count || 0;
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    source: row.source,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}
