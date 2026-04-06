/**
 * 深度研究引擎 — 多步骤自主研究，带来源验证
 *
 * 灵感来自：Gemini Deep Research, Perplexity
 *
 * 功能：
 * 1. 将研究问题分解为子问题
 * 2. 为每个子问题搜索多个来源
 * 3. 交叉引用发现，标记冲突
 * 4. 综合成带来源的结构化报告
 * 5. 存储为永久知识
 *
 * 这不只是"搜索" — 它是一种研究方法。
 */

import { getRawDb } from "../db/index.js";
import { remember, hybridSearch } from "../memory/memory-engine.js";
import { addLearning } from "../memory/learning.js";

export interface ResearchProject {
  id: number;
  topic: string;
  status: "planning" | "researching" | "synthesizing" | "completed" | "failed";
  subQuestions: string[];
  findings: ResearchFinding[];
  synthesis: string;
  sources: string[];
  confidence: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ResearchFinding {
  question: string;
  answer: string;
  source: string;
  confidence: number;
  contradicts?: string; // ID of finding it contradicts
}

function ensureResearchTable() {
  const rawDb = getRawDb();
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS soul_deep_research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      sub_questions TEXT NOT NULL DEFAULT '[]',
      findings TEXT NOT NULL DEFAULT '[]',
      synthesis TEXT NOT NULL DEFAULT '',
      sources TEXT NOT NULL DEFAULT '[]',
      confidence REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);
}

/**
 * Plan a research project — break topic into sub-questions
 
 
 */
export async function planResearch(topic: string, subQuestions?: string[]): Promise<{
  project: ResearchProject;
  researchPlan: string;
}> {
  ensureResearchTable();
  const rawDb = getRawDb();

  // Auto-generate sub-questions if not provided
  const questions = subQuestions || generateSubQuestions(topic);

  const row = rawDb.prepare(
    `INSERT INTO soul_deep_research (topic, status, sub_questions)
     VALUES (?, 'planning', ?) RETURNING *`
  ).get(topic, JSON.stringify(questions)) as any;

  // Check existing knowledge
  const existing = await hybridSearch(topic, 10);

  let plan = `=== Deep Research Plan: "${topic}" ===\n\n`;
  plan += `Sub-questions to investigate (${questions.length}):\n\n`;
  questions.forEach((q, i) => {
    plan += `  ${i + 1}. ${q}\n`;
  });

  if (existing.length > 0) {
    plan += `\nExisting knowledge found (${existing.length} memories):\n`;
    for (const m of existing.slice(0, 5)) {
      plan += `  - [${m.type}] ${m.content.substring(0, 120)}\n`;
    }
    plan += `\nUse existing knowledge as starting point, then fill gaps.\n`;
  } else {
    plan += `\nNo existing knowledge on this topic. Starting fresh.\n`;
  }

  plan += `\n--- Research Protocol ---\n`;
  plan += `1. For each sub-question, use soul_learn_web / soul_learn_from_url / soul_learn_youtube\n`;
  plan += `2. Record each finding with soul_research_finding\n`;
  plan += `3. After all questions answered, use soul_research_synthesize\n`;
  plan += `4. Cross-check findings for contradictions\n`;
  plan += `5. Final report stored as permanent knowledge\n`;

  return {
    project: mapProject(row),
    researchPlan: plan,
  };
}

/**
 * Add a research finding
 
 
 */
export function addFinding(
  projectId: number,
  finding: ResearchFinding
): ResearchProject | null {
  ensureResearchTable();
  const rawDb = getRawDb();

  const existing = rawDb.prepare(
    "SELECT * FROM soul_deep_research WHERE id = ?"
  ).get(projectId) as any;
  if (!existing) return null;

  const findings: ResearchFinding[] = JSON.parse(existing.findings || "[]");
  findings.push(finding);

  const sources: string[] = JSON.parse(existing.sources || "[]");
  if (finding.source && !sources.includes(finding.source)) {
    sources.push(finding.source);
  }

  rawDb.prepare(
    "UPDATE soul_deep_research SET findings = ?, sources = ?, status = 'researching' WHERE id = ?"
  ).run(JSON.stringify(findings), JSON.stringify(sources), projectId);

  return mapProject(rawDb.prepare("SELECT * FROM soul_deep_research WHERE id = ?").get(projectId) as any);
}

/**
 * Synthesize research findings into a report
 
 
 */
export async function synthesizeResearch(projectId: number, synthesis: string): Promise<{
  project: ResearchProject;
  report: string;
} | null> {
  ensureResearchTable();
  const rawDb = getRawDb();

  const existing = rawDb.prepare(
    "SELECT * FROM soul_deep_research WHERE id = ?"
  ).get(projectId) as any;
  if (!existing) return null;

  const findings: ResearchFinding[] = JSON.parse(existing.findings || "[]");
  const sources: string[] = JSON.parse(existing.sources || "[]");
  const subQuestions: string[] = JSON.parse(existing.sub_questions || "[]");

  // Calculate confidence based on coverage and finding quality
  const answeredQuestions = subQuestions.filter(q =>
    findings.some(f => f.question.toLowerCase().includes(q.toLowerCase().substring(0, 20)))
  ).length;
  const coverage = subQuestions.length > 0 ? answeredQuestions / subQuestions.length : 0;
  const avgConfidence = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
    : 0;
  const overallConfidence = Math.round((coverage * 0.4 + avgConfidence * 0.6) * 100) / 100;

  // Check for contradictions
  const contradictions: string[] = [];
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      if (findings[i].question === findings[j].question &&
          findings[i].source !== findings[j].source) {
        // Same question, different sources — potential contradiction
        contradictions.push(
          `"${findings[i].answer.substring(0, 50)}" vs "${findings[j].answer.substring(0, 50)}" (${findings[i].source} vs ${findings[j].source})`
        );
      }
    }
  }

  rawDb.prepare(
    `UPDATE soul_deep_research SET synthesis = ?, confidence = ?, status = 'completed', completed_at = datetime('now') WHERE id = ?`
  ).run(synthesis, overallConfidence, projectId);

  // Build report
  let report = `=== Deep Research Report: "${existing.topic}" ===\n\n`;
  report += `Confidence: ${Math.round(overallConfidence * 100)}%\n`;
  report += `Coverage: ${answeredQuestions}/${subQuestions.length} questions answered\n`;
  report += `Sources: ${sources.length}\n`;
  report += `Findings: ${findings.length}\n\n`;

  report += `--- Synthesis ---\n${synthesis}\n\n`;

  if (contradictions.length > 0) {
    report += `--- Contradictions Found ---\n`;
    contradictions.forEach(c => { report += `  ! ${c}\n`; });
    report += `\n`;
  }

  report += `--- Sources ---\n`;
  sources.forEach((s, i) => { report += `  ${i + 1}. ${s}\n`; });

  // Store as permanent knowledge
  await remember({
    content: `[Deep Research] ${existing.topic}\n\n${synthesis}\n\nSources: ${sources.join(", ")}`,
    type: "knowledge",
    tags: ["deep-research", ...existing.topic.toLowerCase().split(/\s+/).slice(0, 5)],
    source: "deep-research",
  });

  await addLearning(
    `research:${existing.topic.substring(0, 80)}`,
    synthesis.substring(0, 500),
    []
  );

  const project = mapProject(
    rawDb.prepare("SELECT * FROM soul_deep_research WHERE id = ?").get(projectId) as any
  );

  return { project, report };
}

/**
 * Get research project status
 
 
 */
export function getResearchProject(projectId: number): ResearchProject | null {
  ensureResearchTable();
  const rawDb = getRawDb();
  const row = rawDb.prepare(
    "SELECT * FROM soul_deep_research WHERE id = ?"
  ).get(projectId) as any;
  return row ? mapProject(row) : null;
}

/**
 * List research projects
 
 
 */
export function listResearchProjects(limit = 20): ResearchProject[] {
  ensureResearchTable();
  const rawDb = getRawDb();
  const rows = rawDb.prepare(
    "SELECT * FROM soul_deep_research ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as any[];
  return rows.map(mapProject);
}

// Auto-generate sub-questions for a topic
function generateSubQuestions(topic: string): string[] {
  return [
    `What is ${topic}? (definition and overview)`,
    `Why is ${topic} important? (significance and impact)`,
    `How does ${topic} work? (mechanics and process)`,
    `What are the key components/aspects of ${topic}?`,
    `What are the advantages and disadvantages of ${topic}?`,
    `What is the current state of ${topic}? (latest developments)`,
    `What are the common misconceptions about ${topic}?`,
    `What are the best resources to learn more about ${topic}?`,
  ];
}

function mapProject(row: any): ResearchProject {
  return {
    id: row.id,
    topic: row.topic,
    status: row.status,
    subQuestions: JSON.parse(row.sub_questions || "[]"),
    findings: JSON.parse(row.findings || "[]"),
    synthesis: row.synthesis || "",
    sources: JSON.parse(row.sources || "[]"),
    confidence: row.confidence || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
