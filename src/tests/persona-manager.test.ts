/**
 * Persona Manager 单元测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPersona,
  listPersonas,
  getPersona,
  getPersonaByName,
  deletePersona,
  setPersonaActive,
  exportPersona,
  importPersona,
  updatePersona,
} from "../core/persona/persona-manager.js";
import { initDatabase, getDb } from "../db/index.js";

describe("Persona Manager", () => {
  beforeAll(() => {
    // 初始化测试数据库
    initDatabase(":memory:");
  });

  afterAll(() => {
    // 清理测试数据库
    const db = getDb();
    // 关闭数据库连接
  });

  describe("createPersona", () => {
    it("should create a new persona with default values", () => {
      const persona = createPersona({
        name: "test-persona",
        displayName: "测试角色",
      });

      expect(persona).toBeDefined();
      expect(persona.meta.id).toBeDefined();
      expect(persona.meta.displayName).toBe("测试角色");
      expect(persona.constitution.mission).toBe("帮助主人");
      expect(persona.habits.style).toBe("友好、幽默");
    });

    it("should create a persona with custom constitution", () => {
      const persona = createPersona({
        name: "custom-persona",
        displayName: "自定义角色",
        constitution: {
          mission: "探索世界",
          values: ["勇敢", "好奇", "诚实"],
          boundaries: ["不伤害", "不欺骗", "不隐瞒"],
        },
      });

      expect(persona.constitution.mission).toBe("探索世界");
      expect(persona.constitution.values).toContain("勇敢");
      expect(persona.constitution.boundaries).toContain("不伤害");
    });

    it("should create a persona with custom habits", () => {
      const persona = createPersona({
        name: "habit-persona",
        displayName: "习惯角色",
        habits: {
          style: "严肃认真",
          adaptability: "high",
          quirks: ["喜欢用省略号", "喜欢反问"],
          humorStyle: "dry",
        },
      });

      expect(persona.habits.style).toBe("严肃认真");
      expect(persona.habits.adaptability).toBe("high");
      expect(persona.habits.quirks).toContain("喜欢用省略号");
      expect(persona.habits.humorStyle).toBe("dry");
    });
  });

  describe("listPersonas", () => {
    it("should return list of created personas", () => {
      const created = createPersona({ name: "list-test-1", displayName: "列表测试 1" });
      createPersona({ name: "list-test-2", displayName: "列表测试 2" });

      const personas = listPersonas();
      expect(personas.length).toBeGreaterThanOrEqual(2);
      expect(personas.map(p => p.name)).toContain("list-test-1");
      expect(personas.map(p => p.name)).toContain("list-test-2");
    });
  });

  describe("getPersona", () => {
    it("should return null for non-existent persona", () => {
      const persona = getPersona("non-existent-id");
      expect(persona).toBeNull();
    });

    it("should return persona by id", () => {
      const created = createPersona({ name: "get-test", displayName: "获取测试" });
      const retrieved = getPersona(created.meta.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.meta.displayName).toBe("获取测试");
    });
  });

  describe("getPersonaByName", () => {
    it("should return null for non-existent name", () => {
      const persona = getPersonaByName("non-existent-name");
      expect(persona).toBeNull();
    });

    it("should return persona by name", () => {
      createPersona({ name: "name-test", displayName: "名称测试" });
      const persona = getPersonaByName("name-test");

      expect(persona).toBeDefined();
      expect(persona?.meta.displayName).toBe("名称测试");
    });
  });

  describe("deletePersona", () => {
    it("should return false for non-existent persona", () => {
      const result = deletePersona("non-existent-id");
      expect(result).toBe(false);
    });

    it("should delete existing persona", () => {
      const created = createPersona({ name: "delete-test", displayName: "删除测试" });
      const result = deletePersona(created.meta.id);

      expect(result).toBe(true);
      expect(getPersona(created.meta.id)).toBeNull();
    });
  });

  describe("setPersonaActive", () => {
    it("should toggle persona active status", () => {
      const created = createPersona({ name: "active-test", displayName: "激活测试" });
      const listBefore = listPersonas().find(p => p.id === created.meta.id);
      expect(listBefore?.isActive).toBe(true);

      const result = setPersonaActive(created.meta.id, false);
      expect(result).toBe(true);

      const listAfter = listPersonas().find(p => p.id === created.meta.id);
      expect(listAfter?.isActive).toBe(false);
    });
  });

  describe("exportPersona", () => {
    it("should export persona as JSON string", () => {
      const created = createPersona({
        name: "export-test",
        displayName: "导出测试",
        constitution: {
          mission: "测试使命",
          values: ["测试值 1"],
          boundaries: ["测试边界 1"],
        },
      });

      const exported = exportPersona(created.meta.id);
      const parsed = JSON.parse(exported);

      expect(parsed.meta.displayName).toBe("导出测试");
      expect(parsed.constitution.mission).toBe("测试使命");
    });

    it("should throw error for non-existent persona", () => {
      expect(() => exportPersona("non-existent-id")).toThrow();
    });
  });

  describe("importPersona", () => {
    it("should import persona from JSON", () => {
      const original = createPersona({
        name: "import-source",
        displayName: "导入源",
        constitution: {
          mission: "导入使命",
          values: ["导入值"],
          boundaries: ["导入边界"],
        },
      });

      const exported = exportPersona(original.meta.id);
      const imported = importPersona(exported);

      expect(imported.meta.displayName).toBe("导入源");
      expect(imported.constitution.mission).toBe("导入使命");
      expect(imported.meta.id).not.toBe(original.meta.id); // New ID
    });

    it("should throw error for duplicate name", () => {
      const uniqueName = `import-duplicate-${Date.now()}`;
      createPersona({ name: uniqueName, displayName: "导入重复" });
      const exported = exportPersona(getPersonaByName(uniqueName)!.meta.id);

      expect(() => importPersona(exported)).toThrow();
    });
  });

  describe("updatePersona", () => {
    it("should update persona fields", () => {
      const created = createPersona({ name: "update-test", displayName: "更新测试" });

      const updated = updatePersona(created.meta.id, {
        displayName: "更新后的名称",
        description: "新的描述",
      });

      expect(updated.meta.displayName).toBe("更新后的名称");
      expect(updated.meta.description).toBe("新的描述");
    });
  });
});
