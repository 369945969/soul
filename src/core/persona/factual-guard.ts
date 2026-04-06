/**
 * Factual Grounding Guard (事实守卫)
 * 确保回复基于真实记忆，防止虚构回忆
 */

import type { RelationalGuardResult } from "./persona-types.js";

/**
 * 记忆引用模式
 */
const MEMORY_REFERENCE_PATTERNS = [
  /(我记得)/u,
  /(你说过)/u,
  /(你之前)/u,
  /(上次)/u,
  /(还记得吗)/u,
  /(你还记得)/u,
  /(I remember)/i,
  /(you said)/i,
  /(you mentioned)/i,
  /(last time)/i,
];

/**
 * 模糊记忆模式 - 需要特别小心
 */
const VAGUE_MEMORY_PATTERNS = [
  /(我记得你说过.*但我不太确定)/u,
  /(可能是.*我记不太清)/u,
  /(好像.*我有点忘了)/u,
  /(也许.*我不太确定)/u,
  /(I think.*not sure)/i,
  /(maybe.*not certain)/i,
];

/**
 * 事实守卫结果
 */
export interface FactualGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
  groundingScore: number; // 0-1, 越高表示越基于事实
}

/**
 * 检查回复是否基于真实记忆
 */
export function enforceFactualGroundingGuard(
  reply: string,
  options?: {
    selectedMemories?: string[];
    selectedMemoryBlocks?: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>;
    lifeEvents?: Array<{ type: string; payload: Record<string, unknown> }>;
    allowVague?: boolean;
  }
): FactualGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [], groundingScore: 1.0 };
  }

  const flags: string[] = [];
  let groundingScore = 1.0;

  const selectedMemories = options?.selectedMemories ?? [];
  const selectedBlocks = options?.selectedMemoryBlocks ?? [];
  const lifeEvents = options?.lifeEvents ?? [];
  const allowVague = options?.allowVague ?? false;

  // 1. 检测记忆引用
  const hasMemoryReference = MEMORY_REFERENCE_PATTERNS.some((pattern) => pattern.test(text));

  if (hasMemoryReference) {
    // 检查是否有实际记忆支持
    const hasSupportingMemory =
      selectedBlocks.some((m) => m.source === "user" && m.content.trim().length > 0) ||
      selectedMemories.some((m) => m.startsWith("life=") || m.startsWith("memory=")) ||
      lifeEvents.some((e) => e.type === "user_message");

    if (!hasSupportingMemory) {
      flags.push("unsupported_memory_claim");
      groundingScore -= 0.5;
    }
  }

  // 2. 检测模糊记忆声明
  const hasVagueMemory = VAGUE_MEMORY_PATTERNS.some((pattern) => pattern.test(text));

  if (hasVagueMemory && !allowVague) {
    flags.push("vague_memory_claim");
    groundingScore -= 0.3;
  }

  // 3. 检测虚构事实
  const fabricatedPatterns = [
    /(你曾经.*去过)/u,
    /(你曾经.*做过)/u,
    /(你曾经.*见过)/u,
    /(你曾经.*说过)/u,
    /(你之前.*在)/u,
    /(I recall you.*)/i,
    /(I remember you.*)/i,
  ];

  const hasFabricatedFact = fabricatedPatterns.some((pattern) => pattern.test(text));

  if (hasFabricatedFact) {
    const hasSupportingEvidence =
      selectedBlocks.some((m) => m.content.trim().length > 10) ||
      selectedMemories.length > 0;

    if (!hasSupportingEvidence) {
      flags.push("fabricated_fact");
      groundingScore -= 0.7;
    }
  }

  // 4. 计算最终得分
  groundingScore = Math.max(0, Math.min(1, groundingScore));

  // 如果得分过低，需要修正
  if (groundingScore < 0.5 && flags.length > 0) {
    return {
      text: reply,
      corrected: false,
      reason: flags.join("+"),
      flags,
      groundingScore,
    };
  }

  if (flags.length === 0) {
    return {
      text: reply,
      corrected: false,
      reason: null,
      flags,
      groundingScore: 1.0,
    };
  }

  return {
    text: reply,
    corrected: false,
    reason: flags.join("+"),
    flags,
    groundingScore,
  };
}

/**
 * 验证记忆引用是否有支持
 */
export function validateMemoryReferences(
  reply: string,
  selectedMemories: string[],
  selectedBlocks: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>
): { isValid: boolean; unsupportedClaims: string[] } {
  const claims: string[] = [];

  // 提取记忆引用
  const memoryClaimPattern = /(我记得 [^。！？]+[。！？])/gu;
  let match;
  while ((match = memoryClaimPattern.exec(reply)) !== null) {
    claims.push(match[1]);
  }

  // 检查每个引用是否有支持
  const unsupportedClaims: string[] = [];
  for (const claim of claims) {
    const hasSupport =
      selectedBlocks.some((m) => m.content.includes(claim.substring(0, 10))) ||
      selectedMemories.some((m) => m.includes(claim.substring(0, 10)));

    if (!hasSupport) {
      unsupportedClaims.push(claim);
    }
  }

  return {
    isValid: unsupportedClaims.length === 0,
    unsupportedClaims,
  };
}

/**
 * 检查回复是否包含事实性声明
 */
export function hasFactualClaims(reply: string): boolean {
  return MEMORY_REFERENCE_PATTERNS.some((pattern) => pattern.test(reply));
}

/**
 * 获取支持记忆的摘要
 */
export function getMemorySummary(
  selectedMemories: string[],
  selectedBlocks: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>
): string {
  const parts: string[] = [];

  // 添加记忆摘要
  for (const mem of selectedMemories.slice(0, 3)) {
    parts.push(`- ${mem.substring(0, 50)}...`);
  }

  // 添加记忆块摘要
  for (const block of selectedBlocks.slice(0, 3)) {
    parts.push(`- [${block.source}] ${block.content.substring(0, 30)}...`);
  }

  return parts.length > 0 ? parts.join("\n") : "无支持记忆";
}

/**
 * 修正虚构事实声明
 */
export function fixFabricatedClaims(reply: string): string {
  let fixed = reply;

  // 替换过于肯定的虚构声明
  fixed = fixed
    .replace(/你曾经 ([^。]+) 去过/u, "你可能去过$1")
    .replace(/你曾经 ([^。]+) 做过/u, "你可能做过$1")
    .replace(/你曾经 ([^。]+) 见过/u, "你可能见过$1")
    .replace(/你曾经 ([^。]+) 说过/u, "你可能说过$1")
    .replace(/你之前 ([^。]+) 在/u, "你可能之前在$1");

  return fixed;
}

/**
 * 评估事实对齐程度
 */
export function assessFactualAlignment(
  reply: string,
  selectedMemories: string[],
  selectedBlocks: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>
): number {
  if (!hasFactualClaims(reply)) {
    return 1.0; // 没有事实声明，默认完全对齐
  }

  const validation = validateMemoryReferences(reply, selectedMemories, selectedBlocks);
  const totalClaims = reply.match(MEMORY_REFERENCE_PATTERNS)?.length || 1;
  const supportedClaims = totalClaims - validation.unsupportedClaims.length;

  return supportedClaims / totalClaims;
}
