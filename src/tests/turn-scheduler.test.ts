/**
 * Turn Scheduler 单元测试
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createSchedulerState,
  getOrCreateSchedulerState,
  scheduleTurn,
  strictRoundRobin,
  priorityRoundRobin,
  freeForm,
  calculatePersonaDesire,
  getSchedulerStats,
  resetSchedulerState,
  type SchedulerState,
} from "../core/persona/turn-scheduler.js";
import { initDatabase, getRawDb } from "../db/index.js";

describe("Turn Scheduler", () => {
  const testSessionId = "test-session-123";
  let _uidSeq = 0;
  const uid = (prefix: string) => `${prefix}-${Date.now()}-${++_uidSeq}-${Math.random().toString(16).slice(2)}`;

  beforeAll(() => {
    // 初始化测试数据库
    initDatabase(":memory:");
  });

  describe("createSchedulerState", () => {
    it("should create new scheduler state", () => {
      // 先创建 persona
      const personaId = uid("test-persona");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(personaId, personaId + "-name", "Test Persona");

      const state = createSchedulerState(testSessionId, personaId);

      expect(state.sessionId).toBe(testSessionId);
      expect(state.activePersonaId).toBe(personaId);
      expect(state.turnHistory).toEqual([]);
      expect(state.consecutiveCounts.size).toBe(0);
    });
  });

  describe("getOrCreateSchedulerState", () => {
    it("should create new state if not exists", () => {
      const sessionId = uid("new-session");
      const personaId = uid("test-persona");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(personaId, personaId + "-name", "Test Persona");

      const state = getOrCreateSchedulerState(sessionId, personaId);

      expect(state.sessionId).toBe(sessionId);
      expect(state.activePersonaId).toBe(personaId);
    });

    it("should return existing state if exists", () => {
      const sessionId = uid("existing-session");
      const personaId = uid("test-persona");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(personaId, personaId + "-name", "Test Persona");

      createSchedulerState(sessionId, personaId);

      const state = getOrCreateSchedulerState(sessionId, "persona-2");

      expect(state.activePersonaId).toBe(personaId); // Should keep original
    });
  });

  describe("strictRoundRobin", () => {
    it("should select first persona on first turn", () => {
      const personas = [
        { id: "p1", name: "Persona 1" },
        { id: "p2", name: "Persona 2" },
        { id: "p3", name: "Persona 3" },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "",
        turnHistory: [],
        consecutiveCounts: new Map(),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = strictRoundRobin(personas, state, );

      expect(result.selectedPersonaId).toBe("p1");
      expect(result.reason).toBe("first_turn");
      expect(result.isConsecutive).toBe(false);
    });

    it("should rotate to next persona", () => {
      const personas = [
        { id: "p1", name: "Persona 1" },
        { id: "p2", name: "Persona 2" },
        { id: "p3", name: "Persona 3" },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "p2",
        turnHistory: [{ personaId: "p2", turnNumber: 1, timestamp: "" }],
        consecutiveCounts: new Map([["p2", 1]]),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = strictRoundRobin(personas, state, );

      expect(result.selectedPersonaId).toBe("p3");
      expect(result.reason).toBe("strict_round_robin");
      expect(result.isConsecutive).toBe(false);
    });

    it("should wrap around to first persona", () => {
      const personas = [
        { id: "p1", name: "Persona 1" },
        { id: "p2", name: "Persona 2" },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "p2",
        turnHistory: [{ personaId: "p2", turnNumber: 1, timestamp: "" }],
        consecutiveCounts: new Map([["p2", 1]]),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = strictRoundRobin(personas, state, );

      expect(result.selectedPersonaId).toBe("p1");
    });

    it("should handle single persona", () => {
      const personas = [{ id: "p1", name: "Persona 1" }];
      const state = {
        sessionId: "test",
        activePersonaId: "p1",
        turnHistory: [],
        consecutiveCounts: new Map(),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = strictRoundRobin(personas, state, );

      expect(result.selectedPersonaId).toBe("p1");
      expect(result.isConsecutive).toBe(true);
    });
  });

  describe("priorityRoundRobin", () => {
    it("should select based on priority score", () => {
      const personas = [
        { id: "p1", name: "Persona 1", desire: 0.9 },
        { id: "p2", name: "Persona 2", desire: 0.3 },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "",
        turnHistory: [],
        consecutiveCounts: new Map(),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = priorityRoundRobin(personas, state);

      expect(result.selectedPersonaId).toBe("p1");
      expect(result.reason).toBe("priority_score");
    });

    it("should enforce anti-monopoly", () => {
      const personas = [
        { id: "p1", name: "Persona 1", desire: 0.9 },
        { id: "p2", name: "Persona 2", desire: 0.3 },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "p1",
        turnHistory: [
          { personaId: "p1", turnNumber: 1, timestamp: "" },
          { personaId: "p1", turnNumber: 2, timestamp: "" },
          { personaId: "p1", turnNumber: 3, timestamp: "" },
        ],
        consecutiveCounts: new Map([["p1", 3]]),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = priorityRoundRobin(personas, state);

      expect(result.selectedPersonaId).toBe("p2");
      expect(result.reason).toBe("anti_monopoly");
    });
  });

  describe("freeForm", () => {
    it("should select persona with highest desire", () => {
      const personas = [
        { id: "p1", name: "Persona 1", desire: 0.5 },
        { id: "p2", name: "Persona 2", desire: 0.9 },
        { id: "p3", name: "Persona 3", desire: 0.3 },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "",
        turnHistory: [],
        consecutiveCounts: new Map(),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = freeForm(personas, state, );

      expect(result.selectedPersonaId).toBe("p2");
      expect(result.reason).toBe("highest_desire");
    });

    it("should enforce anti-monopoly in free form", () => {
      const personas = [
        { id: "p1", name: "Persona 1", desire: 0.9 },
        { id: "p2", name: "Persona 2", desire: 0.8 },
      ];
      const state = {
        sessionId: "test",
        activePersonaId: "p1",
        turnHistory: [
          { personaId: "p1", turnNumber: 1, timestamp: "" },
          { personaId: "p1", turnNumber: 2, timestamp: "" },
          { personaId: "p1", turnNumber: 3, timestamp: "" },
        ],
        consecutiveCounts: new Map([["p1", 3]]),
        lastTurnAt: "",
        createdAt: "",
      } as SchedulerState;

      const result = freeForm(personas, state);

      expect(result.selectedPersonaId).toBe("p2");
      expect(result.reason).toBe("anti_monopoly_free_form");
    });
  });

  describe("calculatePersonaDesire", () => {
    it("should calculate base desire", () => {
      const desire = calculatePersonaDesire("p1", "你好");

      expect(desire).toBe(0.5);
    });

    it("should increase desire for topic match", () => {
      const desire = calculatePersonaDesire("p1", "聊天聊天", {
        topicsOfInterest: ["聊天"],
      });

      expect(desire).toBeGreaterThan(0.5);
    });

    it("should increase desire for personality match", () => {
      const desire = calculatePersonaDesire("p1", "哈哈有趣", {
        personalityCore: ["幽默"],
      });

      expect(desire).toBeGreaterThan(0.5);
    });

    it("should cap desire at 1.0", () => {
      const desire = calculatePersonaDesire("p1", "哈哈聊天什么怎么", {
        topicsOfInterest: ["聊天", "什么", "怎么"],
        personalityCore: ["幽默", "好奇"],
      });

      expect(desire).toBeLessThanOrEqual(1.0);
    });
  });

  describe("scheduleTurn", () => {
    it("should schedule turn and update state", () => {
      const sessionId = uid("schedule-test");
      const p1Id = uid("p1");
      const p2Id = uid("p2");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(p1Id, p1Id + "-name", "Persona 1");
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(p2Id, p2Id + "-name", "Persona 2");

      const personas = [
        { id: p1Id, name: p1Id + "-name" },
        { id: p2Id, name: p2Id + "-name" },
      ];

      const result1 = scheduleTurn(personas, sessionId, { mode: "strict_rr" });
      const result2 = scheduleTurn(personas, sessionId, { mode: "strict_rr" });

      expect(result1.selectedPersonaId).toBe(p1Id);
      expect(result2.selectedPersonaId).toBe(p2Id);
      expect(result2.turnNumber).toBe(2);
    });
  });

  describe("getSchedulerStats", () => {
    it("should return correct stats", () => {
      const sessionId = uid("stats-test");
      const p1Id = uid("p1");
      const p2Id = uid("p2");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(p1Id, p1Id + "-name", "Persona 1");
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(p2Id, p2Id + "-name", "Persona 2");

      const personas = [
        { id: p1Id, name: p1Id + "-name" },
        { id: p2Id, name: p2Id + "-name" },
      ];

      // Schedule some turns
      scheduleTurn(personas, sessionId, { mode: "strict_rr" });
      scheduleTurn(personas, sessionId, { mode: "strict_rr" });
      scheduleTurn(personas, sessionId, { mode: "strict_rr" });
      scheduleTurn(personas, sessionId, { mode: "strict_rr" });

      const stats = getSchedulerStats(sessionId);

      expect(stats.totalTurns).toBe(4);
      expect(stats.personaTurnDistribution[p1Id]).toBe(2);
      expect(stats.personaTurnDistribution[p2Id]).toBe(2);
      expect(stats.averageTurnsPerPersona).toBe(2);
    });
  });

  describe("resetSchedulerState", () => {
    it("should reset scheduler state", () => {
      const sessionId = uid("reset-test");
      const p1Id = uid("p1");
      const rawDb = getRawDb();
      rawDb.prepare(
        `INSERT INTO personas (id, name, display_name) VALUES (?, ?, ?)`
      ).run(p1Id, p1Id + "-name", "Persona 1");

      const personas = [{ id: p1Id, name: p1Id + "-name" }];

      scheduleTurn(personas, sessionId, { mode: "strict_rr" });
      resetSchedulerState(sessionId);

      const stats = getSchedulerStats(sessionId);
      expect(stats.totalTurns).toBe(0);
    });
  });
});
