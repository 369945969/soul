/**
 * Persona 类型定义
 * 参考 Soul-seed 的 persona 架构
 */

export const PERSONA_SCHEMA_VERSION = "0.3.0";

/**
 * Persona 元数据
 */
export interface PersonaMeta {
  id: string;
  displayName: string;
  schemaVersion: string;
  createdAt: string;
  adultSafetyDefaults?: {
    adultMode?: boolean;
    ageVerified?: boolean;
    explicitConsent?: boolean;
    fictionalRoleplay?: boolean;
  };
  initProfile?: {
    template: "friend" | "peer" | "intimate" | "neutral" | "custom";
    initializedAt: string;
  };
  memoryPolicy?: {
    maxLifeLogEntries?: number;
    disableGoldenExamples?: boolean;
    goldenExampleQualityThreshold?: number;
  };
  sharedSpace?: {
    path: string;
    enabled: boolean;
    createdAt: string;
  };
  paths?: {
    identity?: string;
    worldview?: string;
    constitution?: string;
    habits?: string;
    userProfile?: string;
    pinned?: string;
    cognition?: string;
    soulLineage?: string;
    lifeLog?: string;
    memoryDb?: string;
  };
}

/**
 * Persona 身份锚点 - 角色自我认知
 */
export interface PersonaIdentity {
  personaId: string;
  anchors: { continuity: boolean };
  schemaVersion: "2.0";
  selfDescription?: string;
  originStory?: string;
  personalityCore?: string[];
  definingMomentRefs?: string[];
  personaVoiceOnEvolution?: string;
  updatedAt?: string;
}

/**
 * Persona 宪法/价值观
 */
export interface PersonaConstitution {
  values: string[];
  boundaries: string[];
  mission: string;
  commitments?: string[];
}

/**
 * Persona 世界观
 */
export interface PersonaWorldview {
  seed: string;
}

/**
 * Persona 行为特点
 */
export interface PersonaHabits {
  style: string;
  adaptability: "low" | "medium" | "high";
  quirks?: string[];
  topicsOfInterest?: string[];
  humorStyle?: "dry" | "warm" | "playful" | "subtle" | null;
  conflictBehavior?: "assertive" | "deflect" | "redirect" | "hold-ground" | null;
}

/**
 * 用户档案
 */
export interface PersonaUserProfile {
  preferredLanguage: string;
  preferredName: string;
}

/**
 * 模型路由配置
 */
export interface ModelRoutingConfig {
  instinct?: string;
  deliberative?: string;
  meta?: string;
}

/**
 * 认知状态
 */
export interface CognitionState {
  instinctBias: number;
  epistemicStance: "balanced" | "cautious" | "assertive";
  toolPreference: "auto" | "read_first" | "reply_first";
  updatedAt: string;
  modelRouting?: ModelRoutingConfig;
  routingWeights?: {
    familiarity: number;
    relationship: number;
    emotion: number;
    risk: number;
  };
}

/**
 * 完整的 Persona 对象
 */
export interface Persona {
  meta: PersonaMeta;
  identity: PersonaIdentity;
  constitution: PersonaConstitution;
  worldview: PersonaWorldview;
  habits: PersonaHabits;
  userProfile?: PersonaUserProfile;
  cognition?: CognitionState;
}

/**
 * 角色创建选项
 */
export interface CreatePersonaOptions {
  name: string;
  displayName: string;
  description?: string;
  constitution?: Partial<PersonaConstitution>;
  habits?: Partial<PersonaHabits>;
  worldview?: Partial<PersonaWorldview>;
  template?: "friend" | "peer" | "intimate" | "neutral" | "custom";
}

/**
 * 角色守卫结果
 */
export interface GuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags?: string[];
}

/**
 * 身份守卫结果
 */
export interface IdentityGuardResult extends GuardResult {
  drift_latent?: number[];
  guardPath?: "semantic" | "regex_fallback";
}

/**
 * 关系守卫结果
 */
export interface RelationalGuardResult extends GuardResult {
  flags: string[];
}

/**
 * 会话调度选项
 */
export interface TurnSchedulerOptions {
  maxConsecutiveTurns?: number; // 最大连续发言次数
  mode?: "strict_rr" | "priority_rr" | "free_form"; // 调度模式
  personas: Array<{ id: string; name: string; desire?: number }>;
}

/**
 * 调度结果
 */
export interface TurnScheduleResult {
  selectedPersonaId: string;
  reason: string;
  turnNumber: number;
  isConsecutive: boolean;
  consecutiveCount: number;
}

/**
 * 语义身份漂移结果
 */
export interface SemanticIdentityDriftResult {
  genericAiScore: number;
  selfSubjectivityLoss: number;
  driftScore?: number;
  reasons: string[];
  drift_latent?: number[];
  guardPath?: "semantic" | "regex_fallback";
}
