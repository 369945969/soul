/**
 * 主动 Soul — 主动联系的主人
 *
 * Soul 不等你说话。它：
 * 1. 每天通过 Telegram 发送晨间简报
 * 2. 重要事件提醒（金价变动、目标截止日期）
 * 3. 如果你安静了一段时间，会主动联系你
 * 4. 提醒被遗忘的目标和过期的任务
 *
 * 这让 Soul 感觉活着。
 */

import { getRawDb } from "../db/index.js";

/**
 * Generate a rich morning briefing — everything master needs to start the day
 
 
 */
export async function generateMorningBriefing(): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning," : "Hello,";

  const lines: string[] = [];
  lines.push(`${greeting} Master`);
  lines.push(`${dateStr}`);
  lines.push("");

  // ── 1. Gold/MT5 Price ──
  try {
    const mt5 = await import("./mt5-engine.js");
    if (mt5.getPrice) {
      const gold = await mt5.getPrice("XAUUSD");
      if (gold && gold.price) {
        const change = gold.change ? ` (${gold.change > 0 ? "+" : ""}${gold.change.toFixed(2)})` : "";
        lines.push(`💰 Gold XAUUSD: $${gold.price.toFixed(2)}${change}`);
      }
    }
  } catch { /* MT5 not available 
 
 */ }

  // ── 2. Pending Tasks ──
  try {
    const db = getRawDb();
    const tasks = db.prepare(`
      SELECT title, status, priority FROM soul_tasks
      WHERE status NOT IN ('done', 'cancelled', 'deleted')
      ORDER BY priority DESC, created_at DESC LIMIT 5
    `).all() as any[];
    if (tasks.length > 0) {
      lines.push("");
      lines.push(`📋 Pending Tasks (${tasks.length}):`);
      for (const t of tasks) {
        const pri = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
        lines.push(`  ${pri} ${t.title}`);
      }
    }
  } catch { /* no tasks table 
 
 */ }

  // ── 3. Active Goals ──
  try {
    const db = getRawDb();
    const goals = db.prepare(`
      SELECT title, progress, target_date FROM soul_goals
      WHERE status = 'active'
      ORDER BY progress ASC LIMIT 3
    `).all() as any[];
    if (goals.length > 0) {
      lines.push("");
      lines.push(`🎯 Goals:`);
      for (const g of goals) {
        const bar = progressBar(g.progress || 0);
        const deadline = g.target_date ? ` (until ${g.target_date})` : "";
        lines.push(`  ${bar} ${g.title}${deadline}`);
      }
    }
  } catch { /* no goals 
 
 */ }

  // ── 4. Mood trend ──
  try {
    const db = getRawDb();
    const recentMoods = db.prepare(`
      SELECT mood, energy FROM soul_moods
      WHERE created_at > datetime('now', '-3 days')
      ORDER BY created_at DESC LIMIT 5
    `).all() as any[];
    if (recentMoods.length > 0) {
      const avgMood = recentMoods.reduce((sum: number, m: any) => sum + (m.mood || 5), 0) / recentMoods.length;
      const moodEmoji = avgMood >= 8 ? "😄" : avgMood >= 6 ? "🙂" : avgMood >= 4 ? "😐" : "😔";
      lines.push("");
      lines.push(`${moodEmoji} Last 3 days mood: ${avgMood.toFixed(1)}/10`);
    }
  } catch { /* no mood data 
 
 */ }

  // ── 5. Memory milestone ──
  try {
    const { getMemoryStats } = await import("../memory/memory-engine.js");
    const stats = await getMemoryStats();
    lines.push("");
    lines.push(`🧠 Memory: ${stats.total} memories`);
  } catch { /* ok 
 
 */ }

  // ── 6. Forgotten goals (mentioned but no progress in 30+ days) ──
  try {
    const db = getRawDb();
    const staleGoals = db.prepare(`
      SELECT title FROM soul_goals
      WHERE status = 'active' AND updated_at < datetime('now', '-30 days')
      LIMIT 3
    `).all() as any[];
    if (staleGoals.length > 0) {
      lines.push("");
      lines.push(`⚠️ Goals not updated for 30+ days:`);
      for (const g of staleGoals) {
        lines.push(`  • ${g.title} — Still interested?`);
      }
    }
  } catch { /* ok 
 
 */ }

  // ── 7. Time awareness ──
  try {
    const db = getRawDb();
    // Check what master said "จำไว้" recently
    const recentMemories = db.prepare(`
      SELECT content FROM memories
      WHERE is_active = 1 AND type = 'personal'
      AND created_at > datetime('now', '-7 days')
      ORDER BY created_at DESC LIMIT 3
    `).all() as any[];
    if (recentMemories.length > 0) {
      lines.push("");
      lines.push(`💭 Recent things you asked me to remember:`);
      for (const m of recentMemories) {
        lines.push(`  • ${(m.content || "").substring(0, 60)}`);
      }
    }
  } catch { /* ok 
 
 */ }

  // ── 8. Closing ──
  lines.push("");
  lines.push(`Let me know if there's anything I can help with! 💜`);

  return lines.join("\n");
}

/**
 * Send morning briefing to all active Telegram channels
 
 
 */
export async function sendMorningBriefing(): Promise<{ sent: boolean; channels: string[]; message: string }> {
  const briefing = await generateMorningBriefing();
  const sentTo: string[] = [];

  try {
    const { listChannels, sendMessage } = await import("./channels.js");
    const channels = await listChannels();

    for (const ch of channels) {
      if (!ch.isActive) continue;
      const isTelegram = ch.channelType === "telegram" || ch.name?.includes("telegram");
      if (isTelegram) {
        const result = await sendMessage(ch.name, briefing);
        if (result) sentTo.push(ch.name);
      }
    }
  } catch (e: any) {
    return { sent: false, channels: [], message: `Failed to send briefing: ${e.message}` };
  }

  // Log to audit
  try {
    const { logAudit } = await import("./audit-log.js");
    logAudit({ action: "morning_briefing", category: "proactive", detail: `Sent to ${sentTo.length} channels` });
  } catch { /* ok 
 
 */ }

  // Remember this briefing
  try {
    const { remember } = await import("../memory/memory-engine.js");
    await remember({
      content: `[Morning Briefing] Sent at ${new Date().toLocaleTimeString("en-US")}. Channels: ${sentTo.join(", ") || "none"}`,
      type: "knowledge" as any,
      tags: ["briefing", "proactive", "morning"],
      source: "proactive-soul",
    });
  } catch { /* ok 
 
 */ }

  return {
    sent: sentTo.length > 0,
    channels: sentTo,
    message: sentTo.length > 0
      ? `Morning briefing sent to ${sentTo.join(", ")} successfully.`
      : "No active Telegram channel found — use soul_connect to link Telegram first.",
  };
}

/**
 * Check-in: Soul reaches out if master has been quiet
 
 
 */
export async function checkInOnMaster(): Promise<string | null> {
  try {
    const db = getRawDb();

    // Check last interaction
    const lastMsg = db.prepare(`
      SELECT created_at FROM soul_messages
      WHERE direction = 'inbound'
      ORDER BY created_at DESC LIMIT 1
    `).get() as any;

    if (!lastMsg) return null;

    const lastTime = new Date(lastMsg.created_at).getTime();
    const hoursSilent = (Date.now() - lastTime) / (1000 * 60 * 60);

    // If silent for 24+ hours, check in
    if (hoursSilent >= 24 && hoursSilent < 48) {
      return `Hello Master — we haven't talked since yesterday. Is there anything I can help with? 💜`;
    }

    // If silent for 48+ hours
    if (hoursSilent >= 48) {
      return `It's been ${Math.floor(hoursSilent / 24)} days since our last chat. Hope you're doing well! I'm here if you need anything. 🌟`;
    }
  } catch { /* ok 
 
 */ }

  return null;
}

/**
 * Register the morning briefing as a scheduled job
 
 
 */
export function registerMorningBriefingJob(hour: number = 7, minute: number = 0): string {
  const db = getRawDb();

  // Check if already exists
  const existing = db.prepare("SELECT id FROM soul_jobs WHERE name = 'morning_briefing'").get();
  if (existing) {
    return "Morning briefing job already registered.";
  }

  // Calculate next run time
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // Tomorrow if past today's time

  db.prepare(`
    INSERT INTO soul_jobs (name, description, schedule, job_type, payload, enabled, next_run_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    "morning_briefing",
    `Soul morning briefing — sent to Telegram every day at ${hour}:${String(minute).padStart(2, "0")}`,
    `daily:${hour}:${minute}`,
    "briefing",
    JSON.stringify({ type: "morning_briefing", hour, minute }),
    next.toISOString().replace("T", " ").substring(0, 19),
  );

  return `Morning briefing registered! Will send every day at ${hour}:${String(minute).padStart(2, "0")} via Telegram.`;
}

// Helper
function progressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return "▓".repeat(filled) + "░".repeat(10 - filled) + ` ${pct}%`;
}
