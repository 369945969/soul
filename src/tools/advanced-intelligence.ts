/**
 * 高级智能 MCP 工具定义 — 第 3 阶段功能
 *
 * 这些工具定义导出供 MCP 工具列表处理器使用。
 * 实际执行由 agent-loop.ts 内部工具注册表处理。
 */

export const ADVANCED_TOOL_DEFINITIONS = [
  {
    name: "soul_dream",
    description: "Run a dream cycle — Soul discovers connections between knowledge entries",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "soul_dreams_pending",
    description: "Get dreams/insights not yet shared with master",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Max dreams (default 3)" } },
    },
  },
  {
    name: "soul_contradiction_record",
    description: "Record when master's opinion changes",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: { type: "string", description: "The topic" },
        old_statement: { type: "string", description: "What was said before" },
        new_statement: { type: "string", description: "What is said now" },
      },
      required: ["topic", "old_statement", "new_statement"] as const,
    },
  },
  {
    name: "soul_contradiction_check",
    description: "Check if a topic has recorded opinion changes",
    inputSchema: {
      type: "object" as const,
      properties: { topic: { type: "string", description: "Topic to check" } },
      required: ["topic"] as const,
    },
  },
  {
    name: "soul_undo_memory",
    description: "Mark a memory as incorrect with correction",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search for the wrong memory" },
        correction: { type: "string", description: "Correct information" },
      },
      required: ["query", "correction"] as const,
    },
  },
  {
    name: "soul_correction_history",
    description: "Show history of corrected memories",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "number" } },
    },
  },
  {
    name: "soul_context_export",
    description: "Export context for handoff to another AI",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "soul_context_import",
    description: "Import context from another AI",
    inputSchema: {
      type: "object" as const,
      properties: {
        context_json: { type: "string", description: "JSON context from other AI" },
      },
      required: ["context_json"] as const,
    },
  },
  {
    name: "soul_energy",
    description: "Show Soul's energy report (tokens, cost, efficiency)",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "soul_confidence_explain",
    description: "Explain Soul's confidence scoring system",
    inputSchema: { type: "object" as const, properties: {} },
  },
];
