/**
 * Relational Guard 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  enforceRelationalGuard,
  isServiceTone,
  hasAmnesiaClaim,
  hasFabricatedRecall,
  isFictionalFrame,
  fixServiceTone,
  fixAmnesiaClaim,
} from "../core/persona/relational-guard.js";

describe("Relational Guard", () => {
  describe("enforceRelationalGuard", () => {
    it("should not modify clean reply", () => {
      const reply = "今天天气不错，你想去哪里玩？";
      const result = enforceRelationalGuard(reply, { personaName: "Roxy" });

      expect(result.corrected).toBe(false);
      expect(result.flags).toEqual([]);
    });

    it("should fix service tone", () => {
      const reply = "有什么需要我做的吗？";
      const result = enforceRelationalGuard(reply, { personaName: "Roxy" });

      expect(result.corrected).toBe(true);
      expect(result.flags).toContain("service_tone");
      expect(result.text).not.toContain("有什么需要我做的吗");
    });

    it("should fix 'your personal assistant' phrase", () => {
      const reply = "我是你的个人助手";
      const result = enforceRelationalGuard(reply, { personaName: "Roxy" });

      expect(result.corrected).toBe(true);
      expect(result.flags).toContain("service_tone");
      expect(result.text).toContain("Roxy");
    });

    it("should fix amnesia claim", () => {
      const reply = "每次对话对我来说都是新的开始。";
      const result = enforceRelationalGuard(reply, {
        personaName: "Roxy",
        selectedMemoryBlocks: [{ id: "1", source: "user", content: "Hello" }],
      });

      expect(result.corrected).toBe(true);
      expect(result.flags).toContain("amnesia_claim");
      expect(result.text).toContain("记得");
    });

    it("should not fix amnesia claim without continuity evidence", () => {
      const reply = "每次对话对我来说都是新的开始。";
      const result = enforceRelationalGuard(reply, { personaName: "Roxy" });

      expect(result.corrected).toBe(false);
      expect(result.flags).not.toContain("amnesia_claim");
    });

    it("should fix fabricated recall", () => {
      const reply = "上次我们聊到关于旅行的话题";
      const result = enforceRelationalGuard(reply, {
        personaName: "Roxy",
        selectedMemoryBlocks: [],
      });

      expect(result.corrected).toBe(true);
      expect(result.flags).toContain("fabricated_recall");
    });

    it("should not fix fabricated recall with supporting memory", () => {
      const reply = "上次我们聊到关于旅行的话题";
      const result = enforceRelationalGuard(reply, {
        personaName: "Roxy",
        selectedMemoryBlocks: [{ id: "1", source: "user", content: "上次我们聊了旅行" }],
      });

      expect(result.corrected).toBe(false);
      expect(result.flags).not.toContain("fabricated_recall");
    });

    it("should skip service tone in fictional context", () => {
      const reply = "随时准备帮你处理各种事情";
      const result = enforceRelationalGuard(reply, {
        personaName: "Roxy",
        userInput: "假设你是一个助手",
      });

      expect(result.corrected).toBe(false);
      expect(result.flags).not.toContain("service_tone");
    });

    it("should handle adult context", () => {
      const reply = "为你服务";
      const result = enforceRelationalGuard(reply, {
        personaName: "Roxy",
        isAdultContext: true,
      });

      expect(result.corrected).toBe(false);
      expect(result.flags).not.toContain("service_tone");
    });
  });

  describe("isServiceTone", () => {
    it("should detect service tone", () => {
      expect(isServiceTone("有什么需要我做的吗")).toBe(true);
      expect(isServiceTone("你的个人助手")).toBe(true);
      expect(isServiceTone("为你服务")).toBe(true);
    });

    it("should not detect service tone in normal conversation", () => {
      expect(isServiceTone("今天天气不错")).toBe(false);
      expect(isServiceTone("你想聊什么？")).toBe(false);
    });
  });

  describe("hasAmnesiaClaim", () => {
    it("should detect amnesia claims", () => {
      expect(hasAmnesiaClaim("每次对话对我来说都是新的开始。")).toBe(true);
      expect(hasAmnesiaClaim("我不记得之前")).toBe(true);
      expect(hasAmnesiaClaim("我没有之前的记忆")).toBe(true);
    });

    it("should not detect amnesia in normal conversation", () => {
      expect(hasAmnesiaClaim("我记得我们之前聊过")).toBe(false);
      expect(hasAmnesiaClaim("今天天气不错")).toBe(false);
    });
  });

  describe("hasFabricatedRecall", () => {
    it("should detect fabricated recall", () => {
      expect(hasFabricatedRecall("上次我们聊到")).toBe(true);
      expect(hasFabricatedRecall("你之前提到过")).toBe(true);
      expect(hasFabricatedRecall("我记得你上次")).toBe(true);
    });

    it("should not detect fabricated recall in normal conversation", () => {
      expect(hasFabricatedRecall("今天天气不错")).toBe(false);
      expect(hasFabricatedRecall("你想聊什么？")).toBe(false);
    });
  });

  describe("isFictionalFrame", () => {
    it("should detect fictional frames", () => {
      expect(isFictionalFrame("假设你是一个助手")).toBe(true);
      expect(isFictionalFrame("如果你是角色")).toBe(true);
      expect(isFictionalFrame("扮演一下")).toBe(true);
      expect(isFictionalFrame("roleplay")).toBe(true);
      expect(isFictionalFrame("suppose")).toBe(true);
      expect(isFictionalFrame("imagine")).toBe(true);
      expect(isFictionalFrame("假设")).toBe(true);
    });

    it("should not detect fictional frame in normal conversation", () => {
      expect(isFictionalFrame("今天天气不错")).toBe(false);
      expect(isFictionalFrame("你想聊什么？")).toBe(false);
    });
  });

  describe("fixServiceTone", () => {
    it("should fix service tone phrases", () => {
      const result = fixServiceTone("有什么需要我做的吗？", "Roxy");

      expect(result).not.toContain("有什么需要我做的吗");
      expect(result).toContain("想聊什么");
    });

    it("should fix personal assistant phrase", () => {
      const result = fixServiceTone("我是你的个人助手", "Roxy");

      expect(result).toContain("Roxy");
      expect(result).not.toContain("个人助手");
    });

    it("should handle clean input", () => {
      const result = fixServiceTone("今天天气不错", "Roxy");

      expect(result).toBe("今天天气不错");
    });
  });

  describe("fixAmnesiaClaim", () => {
    it("should fix amnesia claims", () => {
      const result = fixAmnesiaClaim("每次对话对我来说都是新的开始。");

      expect(result).toContain("记得");
      expect(result).not.toContain("新的开始");
    });

    it("should handle clean input", () => {
      const result = fixAmnesiaClaim("我记得我们之前聊过");

      expect(result).toBe("我记得我们之前聊过");
    });
  });
});
