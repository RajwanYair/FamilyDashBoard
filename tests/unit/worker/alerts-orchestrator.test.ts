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
      put: async <T>(key: string, value: T) => {
        store.set(key, value);
      },
    },
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("AlertsOrchestrator — Durable Object stub", () => {
  it("GET /state returns initial alarmCount 0", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/state"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { alarmCount: number; lastAlarmAt: null };
    expect(body.alarmCount).toBe(0);
    expect(body.lastAlarmAt).toBeNull();
  });

  it("POST /alarm increments alarmCount", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; alarmCount: number };
    expect(body.ok).toBe(true);
    expect(body.alarmCount).toBe(1);
  });

  it("POST /alarm twice gives alarmCount 2", async () => {
    const state = makeDOState();
    const do_ = new AlertsOrchestrator(state);
    await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    await do_.fetch(new Request("https://do/alarm", { method: "POST" }));
    const res = await do_.fetch(new Request("https://do/state"));
    const body = (await res.json()) as { alarmCount: number };
    expect(body.alarmCount).toBe(2);
  });

  it("GET /state reflects persisted alarmCount after re-instantiation", async () => {
    const state = makeDOState();
    const do1 = new AlertsOrchestrator(state);
    await do1.fetch(new Request("https://do/alarm", { method: "POST" }));

    // New instance same state (simulating DO eviction + reload)
    const do2 = new AlertsOrchestrator(state);
    const res = await do2.fetch(new Request("https://do/state"));
    const body = (await res.json()) as { alarmCount: number };
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
    const body = (await res.json()) as { lastAlarmAt: number };
    expect(body.lastAlarmAt).toBeGreaterThanOrEqual(before);
    expect(body.lastAlarmAt).toBeLessThanOrEqual(Date.now() + 100);
  });
});

// ── SSE + broadcast (V13-EDGE-1) ─────────────────────────────────────────────

describe("AlertsOrchestrator — SSE subscribe and broadcast", () => {
  it("GET /subscribe returns 200 with text/event-stream content-type", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const ac = new AbortController();
    const res = await do_.fetch(new Request("https://do/subscribe", { signal: ac.signal }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    // Clean up: abort to release writer
    ac.abort();
  });

  it("GET /subscribe sends initial 'event: ping' to the stream", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const ac = new AbortController();
    const res = await do_.fetch(new Request("https://do/subscribe", { signal: ac.signal }));
    expect(res.body).not.toBeNull();
    // Read at least the ping frame from the stream
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: ping");
    expect(text).toContain("data: {}");
    reader.cancel();
    ac.abort();
  });

  it("POST /broadcast returns ok:true with connections count", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    // No active subscribers — broadcast succeeds immediately with 0 connections
    const res = await do_.fetch(
      new Request("https://do/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: "alert", city: "Tel Aviv" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; connections: number };
    expect(body.ok).toBe(true);
    expect(body.connections).toBe(0);
  });

  it("GET /state includes connections count field", async () => {
    const do_ = new AlertsOrchestrator(makeDOState());
    const res = await do_.fetch(new Request("https://do/state"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      alarmCount: number;
      lastAlarmAt: null;
      connections: number;
    };
    expect(body).toHaveProperty("connections");
    expect(body.connections).toBe(0);
  });
});
