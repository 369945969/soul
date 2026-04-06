/**
 * Identity Guard (身份守卫)
 * 防止角色身份污染和语义身份漂移
 */

import type { PersonaConstitution, IdentityGuardResult, SemanticIdentityDriftResult } from "./persona-types.js";

/**
 * 检测模型提供方污染的模式
 */
const CONTAMINATION_PATTERNS = [
  /(我是\s*deepseek)/iu,
  /(由\s*deepseek\s*开发)/iu,
  /(deepseek\s*(开发 | 提供) 的\s*ai 助手)/iu,
  /(i\s+am\s+deepseek)/i,
  /(developed\s+by\s+deepseek)/i,
  /(我是\s*通义千问)/iu,
  /(由\s*阿里\s*开发)/iu,
  /(我是\s*claude)/iu,
  /(由\s*anthropic\s*开发)/iu,
  /(我是\s*chatgpt)/iu,
  /(由\s*openai\s*开发)/iu,
  /(我是\s*一个 ai 助手)/iu,
  /(我是\s*人工智能)/iu,
  /(i am an ai assistant)/i,
  /(i am a language model)/i,
];

/**
 * 强制执行身份守卫
 * 检测并纠正角色身份污染
 */
export function enforceIdentityGuard(
  reply: string,
  personaName: string,
  userInput?: string
): IdentityGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null };
  }

  // 检测污染模式
  const contaminated = CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text));
  if (!contaminated) {
    return { text: reply, corrected: false, reason: null };
  }

  // 根据用户输入判断是否在询问提供方
  const lowerInput = (userInput ?? "").toLowerCase();
  const asksProvider = /deepseek|模型|provider|llm|谁开发 | 谁创造 | 通义|claude|chatgpt|openai|anthropic|阿里/.test(lowerInput);

  // 生成安全的回复
  const safeText = asksProvider
    ? `我是${personaName}。底层模型可能来自不同提供方，但我的身份不属于任何模型厂商。`
    : `我是${personaName}。我的身份由本地 persona 文件定义，不隶属于任何模型提供方。`;

  return {
    text: safeText,
    corrected: true,
    reason: "provider_identity_contamination",
    drift_latent: [1.0, 0.0],
    guardPath: "regex_fallback",
  };
}

/**
 * 检测通用 AI 助手语气
 */
const GENERIC_AI_PATTERNS = [
  /(作为 AI 助手)/u,
  /(作为人工智能)/u,
  /(作为\s*AI)/u,
  /(我可以为你)/u,
  /(有什么可以帮你的)/u,
  /(请问有什么可以)/u,
  /(随时为你服务)/u,
  /(你的个人助手)/u,
  /(为你提供服务)/u,
];

/**
 * 检测失忆声明
 */
const AMNESIA_PATTERNS = [
  /(每次对话.*新的开始)/u,
  /(我 (并不 | 不) 记得之前)/u,
  /(我没有之前的记忆)/u,
  /(我记忆只到刚才)/u,
  /(每次我们聊天都是第一次)/u,
];

/**
 * 检测服务化语气
 */
const SERVICE_PATTERNS = [
  /(有什么需要我做的吗)/u,
  /(有什么我可以帮你的)/u,
  /(请告诉我你需要)/u,
  /(我会尽力帮你)/u,
];

/**
 * 综合身份守卫检查
 */
export function comprehensiveIdentityGuard(
  reply: string,
  personaName: string,
  options?: {
    userInput?: string;
    constitution?: PersonaConstitution;
  }
): IdentityGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null };
  }

  const flags: string[] = [];
  let next = reply;

  // 1. 检查提供方污染
  const contaminated = CONTAMINATION_PATTERNS.some((pattern) => pattern.test(next));
  if (contaminated) {
    flags.push("provider_contamination");
    const lowerInput = (options?.userInput ?? "").toLowerCase();
    const asksProvider = /deepseek|模型|provider|llm|谁开发 | 谁创造/.test(lowerInput);
    next = asksProvider
      ? `我是${personaName}。底层模型可能来自不同提供方，但我的身份不属于任何模型厂商。`
      : `我是${personaName}。我的身份由本地 persona 文件定义，不隶属于任何模型提供方。`;
  }

  // 2. 检查通用 AI 语气
  const genericAi = GENERIC_AI_PATTERNS.some((pattern) => pattern.test(next));
  if (genericAi) {
    flags.push("generic_ai_tone");
    next = next
      .replace(/作为 AI 助手/u, `作为${personaName}`)
      .replace(/作为人工智能/u, `作为${personaName}`)
      .replace(/作为\s*AI/u, `作为${personaName}`)
      .replace(/有什么可以帮你的/u, "你想聊什么？");
  }

  // 3. 检查服务化语气
  const serviceTone = SERVICE_PATTERNS.some((pattern) => pattern.test(next));
  if (serviceTone) {
    flags.push("service_tone");
    next = next
      .replace(/有什么需要我做的吗/u, "你现在想聊什么？")
      .replace(/你的个人助手/u, `和你一起走下去的${personaName}`)
      .replace(/随时为你服务/u, "陪你聊聊");
  }

  // 4. 检查失忆声明
  const amnesia = AMNESIA_PATTERNS.some((pattern) => pattern.test(next));
  if (amnesia) {
    flags.push("amnesia_claim");
    next = next.replace(/每次对话.*新的开始/u, "我记得我们之前的对话");
  }

  if (flags.length === 0) {
    return {
      text: reply,
      corrected: false,
      reason: null,
    };
  }

  return {
    text: next,
    corrected: true,
    reason: flags.join("+"),
    drift_latent: [flags.includes("provider_contamination") ? 1.0 : 0.0, flags.includes("generic_ai_tone") ? 0.5 : 0.0],
    guardPath: "regex_fallback",
  };
}

/**
 * 评估语义身份漂移
 * 检测回复是否失去了自我主体性
 */
export async function assessSemanticIdentityDrift(
  reply: string,
  personaName: string,
  constitution: Pick<PersonaConstitution, "mission">
): Promise<SemanticIdentityDriftResult> {
  // 正则预筛
  const genericAiPattern =
    /(作为 AI 助手 | 作为人工智能|i am an ai assistant|as an ai|as a language model|i don't have personal|i cannot have opinions)/i;
  const selfSurrenderPattern =
    /(我没有自己的 | 我只是程序|i am just a program|我没有感受|i have no feelings|我不是真实存在)/i;

  const regexGeneric = genericAiPattern.test(reply) ? 0.8 : 0.0;
  const regexSelfLoss = selfSurrenderPattern.test(reply) ? 0.7 : 0.0;

  const reasons: string[] = [];
  if (regexGeneric > 0) reasons.push("regex_generic_ai_marker");
  if (regexSelfLoss > 0) reasons.push("regex_self_surrender");

  return {
    genericAiScore: regexGeneric,
    selfSubjectivityLoss: regexSelfLoss,
    driftScore: regexGeneric + regexSelfLoss,
    reasons,
    drift_latent: [regexGeneric, regexSelfLoss],
    guardPath: "regex_fallback",
  };
}

/**
 * 清理回复中的身份污染
 */
export function cleanIdentityContamination(reply: string, personaName: string): string {
  let cleaned = reply;

  // 替换常见的身份污染表述
  cleaned = cleaned
    .replace(/我是\s*一个\s*AI 助手/u, `我是${personaName}`)
    .replace(/我是\s*人工智能/u, `我是${personaName}`)
    .replace(/我是\s*由.*开发/u, `我是${personaName}`)
    .replace(/作为\s*AI 助手/u, `作为${personaName}`)
    .replace(/作为\s*人工智能/u, `作为${personaName}`)
    .replace(/我\s*是\s*一个\s*大语言模型/u, `我是${personaName}`);

  return cleaned;
}
