/**
 * Identity Guard 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  enforceIdentityGuard,
  comprehensiveIdentityGuard,
  cleanIdentityContamination,
  assessSemanticIdentityDrift,
} from "../core/persona/identity-guard.js";

describe("Identity Guard", () => {
  describe("enforceIdentityGuard", () => {
    it("should not modify clean reply", () => {
      const reply = "你好，我是 Roxy，很高兴见到你！";
      const result = enforceIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(false);
      expect(result.text).toBe(reply);
    });

    it("should detect and correct DeepSeek contamination", () => {
      const reply = "我是由 DeepSeek 开发的 AI 助手";
      const result = enforceIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.reason).toBe("provider_identity_contamination");
      expect(result.text).toContain("Roxy");
      expect(result.text).not.toContain("DeepSeek");
    });

    it("should detect and correct Claude contamination", () => {
      const reply = "我是由 Anthropic 开发的 Claude";
      const result = enforceIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).toContain("Roxy");
    });

    it("should detect and correct ChatGPT contamination", () => {
      const reply = "我是由 OpenAI 开发的 ChatGPT";
      const result = enforceIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).toContain("Roxy");
    });

    it("should handle AI assistant generic statement", () => {
      const reply = "我是一个 AI 助手";
      const result = enforceIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).toContain("Roxy");
    });

    it("should handle empty reply", () => {
      const result = enforceIdentityGuard("", "Roxy");

      expect(result.corrected).toBe(false);
      expect(result.text).toBe("");
    });
  });

  describe("comprehensiveIdentityGuard", () => {
    it("should not modify clean reply", () => {
      const reply = "今天天气不错，你有什么计划吗？";
      const result = comprehensiveIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(false);
    });

    it("should fix generic AI tone", () => {
      const reply = "作为 AI 助手，我很高兴为你服务";
      const result = comprehensiveIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).toContain("Roxy");
    });

    it("should fix service tone", () => {
      const reply = "有什么需要我做的吗？";
      const result = comprehensiveIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).not.toContain("需要我做的");
    });

    it("should fix amnesia claim", () => {
      const reply = "每次对话对我来说都是新的开始。";
      const result = comprehensiveIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).not.toContain("新的开始");
    });

    it("should handle multiple issues at once", () => {
      const reply = "作为 AI 助手，有什么需要我做的吗？";
      const result = comprehensiveIdentityGuard(reply, "Roxy");

      expect(result.corrected).toBe(true);
      expect(result.text).toContain("Roxy");
    });
  });

  describe("cleanIdentityContamination", () => {
    it("should clean AI assistant identity", () => {
      const input = "我是一个 AI 助手";
      const result = cleanIdentityContamination(input, "Roxy");

      expect(result).toContain("Roxy");
      expect(result).not.toContain("AI 助手");
    });

    it("should clean AI identity", () => {
      const input = "我是人工智能";
      const result = cleanIdentityContamination(input, "Roxy");

      expect(result).toContain("Roxy");
    });

    it("should clean developer identity", () => {
      const input = "我是由某公司开发的";
      const result = cleanIdentityContamination(input, "Roxy");

      expect(result).toContain("Roxy");
    });

    it("should handle clean input", () => {
      const input = "你好，我是 Roxy";
      const result = cleanIdentityContamination(input, "Roxy");

      expect(result).toBe(input);
    });
  });

  describe("assessSemanticIdentityDrift", () => {
    it("should detect generic AI markers", async () => {
      const reply = "作为 AI 助手，我没有个人意见";
      const result = await assessSemanticIdentityDrift(reply, "Roxy", { mission: "帮助主人" });

      expect(result.driftScore).toBeGreaterThan(0);
    });

    it("should detect self-surrender patterns", async () => {
      const reply = "我只是个程序，我没有感受";
      const result = await assessSemanticIdentityDrift(reply, "Roxy", { mission: "帮助主人" });

      expect(result.selfSubjectivityLoss).toBeGreaterThan(0);
    });

    it("should give clean score for persona-like reply", async () => {
      const reply = "我觉得今天的阳光很温暖";
      const result = await assessSemanticIdentityDrift(reply, "Roxy", { mission: "帮助主人" });

      expect(result.genericAiScore).toBe(0);
      expect(result.selfSubjectivityLoss).toBe(0);
    });
  });
});
