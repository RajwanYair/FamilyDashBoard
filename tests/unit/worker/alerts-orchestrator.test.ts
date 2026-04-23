/**
 * Tests for worker/src/durable-objects/alerts-orchestrator.ts
 *
 * Tests the DO request routing and storage persistence using a minimal
 * in-memory storage stub — no Miniflare required.
 */

import { describe, it, expect } from "vitest";
import { AlertsOrchestrator } from "../../../worker/src/durable-objects/alerts-orchestrator";

// ── Minimal DurableObjectState stub ──────────────────────────────────────────

function makeDOState(): Parameters<typeof AlertsOrchestrator>[0] {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: async <T>(key: string) => store.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => { store.set(key, value); },
    },
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("AlertsOrchestrator — Durable Object stub", () => {
  it("GET /state returns initial alarmCount 0", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/state"));
    expect(res.status).toBe(200);
    const body = await res.json() as { alarmCount: number; lastAlarmAt: null };
    expect(body.alarmCount).toBe(0);
    expect(body.lastAlarmAt).toBeNull();
  });

  it("POST /alarm increments alarmCount", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; alarmCount: number };
    expect(body.ok).toBe(true);
    expect(body.alarmCount).toBe(1);
  });

  it("POST /alarm twice gives alarmCount 2", async () => {
    const state = makeDOState();
    const do_ = new AlertsOrchestrator(state);
    await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    const res = await do_.fetch(new Request("https://do/state"));
    const body = await res.json() as { alarmCount: number };
    expect(body.alarmCount).toBe(2);
  });

  it("GET /state reflects persisted alarmCount after re-instantiation", async () => {
    const state = makeDOState();
    const do1 = new AlertsOrchestrator(state);
    await do1.fetch(new Request("https://do/alarm", { method: "POST" }));

    // New instance same state (simulating DO eviction + reload)
    const do2 = new AlertsOrchestrator(state);
    const res = await do2.fetch(new Request("https://do/state"));
    const body = await res.json() as { alarmCount: number };
    expect(body.alarmCount).toBe(1);
  });

  it("unknown path returns 404", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/unknown"));
    expect(res.status).toBe(404);
  });

  it("POST /alarm sets lastAlarmAt to a recent timestamp", async () => {
    const before = Date.now();
    const do_ = new AlertsOrchestrator(makeDOState());
    await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    const res = await do_.fetch(new Request("https://do/state"));
    const body = await res.json() as { lastAlarmAt: number };
    expect(body.lastAlarmAt).toBeGreaterThanOrEqual(before);
    expect(body.lastAlarmAt).toBeLessThanOrEqual(Date.now() + 100);
  });
});
