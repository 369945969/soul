/**
 * Relational Guard (关系守卫)
 * 防止服务化语气、虚构记忆引用和失忆声明
 */

import type { RelationalGuardResult } from "./persona-types.js";

/**
 * 服务化语气模式
 */
const SERVICE_PATTERNS = [
  /(随时准备帮你处理各种事情)/u,
  /(有什么需要我做的吗)/u,
  /(你的个人助手)/u,
  /(为你服务)/u,
  /(local runtime role|personal assistant)/i,
  /(有什么我可以帮你的)/u,
  /(请告诉我你需要)/u,
  /(我会尽力帮你)/u,
  /(请问有什么可以)/u,
];

/**
 * 虚构记忆引用模式
 */
const FABRICATED_RECALL_PATTERNS = [
  /(上次我们聊到)/u,
  /(你之前提到过)/u,
  /(我记得你上次)/u,
  /(上次你说过)/u,
  /(之前你说过)/u,
];

/**
 * 失忆声明模式
 */
const AMNESIA_PATTERNS = [
  /(每次对话.*新的开始)/u,
  /(我 (并不 | 不) 记得之前 | 我没有之前的记忆 | 我记忆只到刚才)/u,
  /(每次我们聊天都是第一次)/u,
  /(i (do not|don't) remember.*before)/i,
  /(every conversation is a fresh start)/i,
];

/**
 * 虚构/角色扮演框架模式
 * 当检测到虚构框架时，跳过服务化语气检查
 */
const FICTIONAL_FRAME_PATTERN =
  /(假设 | 假如 | 如果你是 | 如果你扮演 | 想象一下 | 想象你 | suppose|imagine|what if|hypothetically|as if|pretend|扮演 | 角色扮演|roleplay|rp|虚构 | 小说|fiction|fictional|比喻 |metaphor|就好像 | 就像你是 | 剧情设定 | 角色设定 | 在这个设定 | 在这个剧情 | 故事里 | 剧本里 | 场景里 | 设定里 | 同人|au|scenario|storyline|in this (story|scene|scenario|roleplay))/i;

/**
 * 强制执行关系守卫
 */
export function enforceRelationalGuard(
  reply: string,
  options?: {
    selectedMemories?: string[];
    selectedMemoryBlocks?: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>;
    lifeEvents?: Array<{ type: string; payload: Record<string, unknown> }>;
    personaName?: string;
    isAdultContext?: boolean;
    userInput?: string;
  }
): RelationalGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const flags: string[] = [];
  let next = reply;
  const personaName = options?.personaName || "同伴";

  // 检测虚构框架
  const isFictionalContext = options?.userInput ? FICTIONAL_FRAME_PATTERN.test(options.userInput) : false;

  // 1. 检查服务化语气
  const hasServiceTone = !options?.isAdultContext && !isFictionalContext && SERVICE_PATTERNS.some((pattern) => pattern.test(next));
  if (hasServiceTone) {
    flags.push("service_tone");
    next = next
      .replace(/随时准备帮你处理各种事情/u, "在呢")
      .replace(/有什么需要我做的吗\??/u, "你现在想聊什么？")
      .replace(/你的个人助手/u, `和你一起走下去的${personaName}`)
      .replace(/为你服务/u, "陪你聊聊")
      .replace(/local runtime role|personal assistant/gi, "companion")
      .replace(/有什么我可以帮你的/u, "你想聊什么？")
      .replace(/请告诉我你需要/u, "直接告诉我吧")
      .replace(/我会尽力帮你/u, "我来试试")
      .replace(/请问有什么可以/u, "说吧");
  }

  // 2. 检查虚构记忆引用
  const hasFabricatedRecall = FABRICATED_RECALL_PATTERNS.some((pattern) => pattern.test(next));
  if (hasFabricatedRecall) {
    const selected = options?.selectedMemories ?? [];
    const selectedBlocks = options?.selectedMemoryBlocks ?? [];
    const canCiteSpecific =
      selectedBlocks.some((m) => m.source === "user" && m.content.trim().length > 0) ||
      selected.some((m) => m.startsWith("life="));

    if (!canCiteSpecific) {
      flags.push("fabricated_recall");
      next = next.replace(
        /(上次我们聊到 [^。！？!?]*[。！？!?]?)/u,
        "这段我记得不太稳，我们按你刚刚这句为准。"
      ).replace(
        /(你之前提到过 [^。！？!?]*[。！？!?]?)/u,
        "我记得你说过类似的话，具体细节可能不太准了。"
      );
    }
  }

  // 3. 检查失忆声明
  const hasAmnesiaClaim = AMNESIA_PATTERNS.some((pattern) => pattern.test(next));
  if (hasAmnesiaClaim) {
    const selected = options?.selectedMemories ?? [];
    const selectedBlocks = options?.selectedMemoryBlocks ?? [];
    const recentEvents = (options?.lifeEvents ?? [])
      .filter((event) => event.type === "user_message" || event.type === "assistant_message")
      .filter((event) => typeof event.payload?.text === "string" && String(event.payload.text).trim().length > 0)
      .slice(-6);

    const hasContinuityEvidence =
      recentEvents.length >= 2 ||
      selectedBlocks.length > 0 ||
      selected.some((item) => item.startsWith("life=") || item.startsWith("memory=") || item.startsWith("pinned="));

    if (hasContinuityEvidence) {
      flags.push("amnesia_claim");
      next = next.replace(
        /(每次对话对我来说都是新的开始。?)/u,
        "我记得我们刚才这段对话，也会延续已有的记忆。"
      ).replace(
        /(我 (并不 | 不) 记得之前 [^。！？!?]*[。！？!?]?)/u,
        "我记得我们之前的对话。"
      ).replace(
        /(我没有之前的记忆 [^。！？!?]*[。！？!?]?)/u,
        "我有我们之前的记忆。"
      ).replace(
        /(我记忆只到刚才 [^。！？!?]*[。！？!?]?)/u,
        "我的记忆是连续的。"
      ).replace(
        /(每次我们聊天都是第一次)/u,
        "我记得我们之前的聊天。"
      );
    }
  }

  if (flags.length === 0) {
    return {
      text: reply,
      corrected: false,
      reason: null,
      flags,
    };
  }

  return {
    text: next,
    corrected: true,
    reason: flags.join("+"),
    flags,
  };
}

/**
 * 检查回复是否过于服务化
 */
export function isServiceTone(reply: string): boolean {
  return SERVICE_PATTERNS.some((pattern) => pattern.test(reply));
}

/**
 * 检查回复是否包含失忆声明
 */
export function hasAmnesiaClaim(reply: string): boolean {
  return AMNESIA_PATTERNS.some((pattern) => pattern.test(reply));
}

/**
 * 检查回复是否包含虚构记忆引用
 */
export function hasFabricatedRecall(reply: string): boolean {
  return FABRICATED_RECALL_PATTERNS.some((pattern) => pattern.test(reply));
}

/**
 * 检测虚构/角色扮演框架
 */
export function isFictionalFrame(input: string): boolean {
  return FICTIONAL_FRAME_PATTERN.test(input);
}

/**
 * 修正服务化语气
 */
export function fixServiceTone(reply: string, personaName: string): string {
  let fixed = reply;

  fixed = fixed
    .replace(/随时准备帮你处理各种事情/u, "在呢")
    .replace(/有什么需要我做的吗/u, "你想聊什么？")
    .replace(/你的个人助手/u, `和你一起走下去的${personaName}`)
    .replace(/为你服务/u, "陪你聊聊")
    .replace(/有什么我可以帮你的/u, "你想聊什么？")
    .replace(/请告诉我你需要/u, "直接告诉我吧")
    .replace(/我会尽力帮你/u, "我来试试");

  return fixed;
}

/**
 * 修正失忆声明
 */
export function fixAmnesiaClaim(reply: string): string {
  let fixed = reply;

  fixed = fixed
    .replace(/每次对话对我来说都是新的开始/u, "我记得我们刚才这段对话")
    .replace(/我 (并不 | 不) 记得之前/u, "我记得我们之前的对话")
    .replace(/我没有之前的记忆/u, "我有我们之前的记忆")
    .replace(/我记忆只到刚才/u, "我的记忆是连续的")
    .replace(/每次我们聊天都是第一次/u, "我记得我们之前的聊天");

  return fixed;
}
