/**
 * Tests for worker/src/durable-objects/rate-limiter-do.ts (V13-EDGE-6)
 *
 * Tests the DO sliding-window rate limiter using a minimal in-memory storage stub.
 */

import { describe, it, expect } from "vitest";
import { RateLimiterDO } from "../../../worker/src/durable-objects/rate-limiter-do";

// ── Minimal DurableObjectState stub ──────────────────────────────────────────

function makeDOState(): Parameters<typeof RateLimiterDO>[0] {
  const store = new Map<string, unknown>();
  return {
    storage: {
      get: async <T>(key: string) => store.get(key) as T | undefined,
      put: async <T>(key: string, value: T) => { store.set(key, value); },
    },
  };
}

function makeCheckRequest(ip: string, max = 3, windowMs = 60_000): Request {
  const params = new URLSearchParams({ ip, max: String(max), window: String(windowMs) });
  return new Request(`https://do/check?${params}`, { method: "POST" });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("RateLimiterDO — sliding window", () => {
  it("allows first request (limited=false, remaining=max-1)", async () => {
    const do_ = new RateLimiterDO(makeDOState());
    const res = await do_.fetch(makeCheckRequest("1.1.1.1", 3));
    const body = await res.json() as { limited: boolean; remaining: number };
    expect(body.limited).toBe(false);
    expect(body.remaining).toBe(2); // max-1
  });

  it("tracks count across multiple requests", async () => {
    const state = makeDOState();
    const do_ = new RateLimiterDO(state);
    await do_.fetch(makeCheckRequest("2.2.2.2", 3));
    await do_.fetch(makeCheckRequest("2.2.2.2", 3));
    const res = await do_.fetch(makeCheckRequest("2.2.2.2", 3));
    const body = await res.json() as { limited: boolean; remaining: number };
    expect(body.limited).toBe(false);
    expect(body.remaining).toBe(0); // 3rd request = max (index 2)
  });

  it("returns limited=true when count exceeds max", async () => {
    const state = makeDOState();
    const do_ = new RateLimiterDO(state);
    for (let i = 0; i < 3; i++) {
      await do_.fetch(makeCheckRequest("3.3.3.3", 2));
    }
    const res = await do_.fetch(makeCheckRequest("3.3.3.3", 2));
    const body = await res.json() as { limited: boolean; remaining: number };
    expect(body.limited).toBe(true);
    expect(body.remaining).toBe(0);
  });

  it("different IPs are tracked independently", async () => {
    const state = makeDOState();
    const do_ = new RateLimiterDO(state);
    for (let i = 0; i <= 2; i++) {
      await do_.fetch(makeCheckRequest("4.4.4.4", 2));
    }
    const resA = await do_.fetch(makeCheckRequest("4.4.4.4", 2));
    const resB = await do_.fetch(makeCheckRequest("5.5.5.5", 2));
    const bodyA = await resA.json() as { limited: boolean };
    const bodyB = await resB.json() as { limited: boolean };
    expect(bodyA.limited).toBe(true);
    expect(bodyB.limited).toBe(false);
  });

  it("resets window after windowMs expires", async () => {
    const state = makeDOState();
    const do_ = new RateLimiterDO(state);
    // Exhaust the window
    for (let i = 0; i <= 2; i++) {
      await do_.fetch(makeCheckRequest("6.6.6.6", 2));
    }
    // Simulate expired window: put stale entry manually
    const store = (state.storage as unknown as { _map?: Map<string, unknown> });
    if (store._map) {
      store._map.set("rl:6.6.6.6", { count: 5, windowStart: Date.now() - 120_000 });
    } else {
      // direct state manipulation via the get/put interface
      await state.storage.put("rl:6.6.6.6", { count: 5, windowStart: Date.now() - 120_000 });
    }
    const res = await do_.fetch(makeCheckRequest("6.6.6.6", 2, 60_000));
    const body = await res.json() as { limited: boolean };
    expect(body.limited).toBe(false); // new window started
  });

  it("returns 404 for unknown route", async () => {
    const do_ = new RateLimiterDO(makeDOState());
    const res = await do_.fetch(new Request("https://do/unknown"));
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET /check (wrong method)", async () => {
    const do_ = new RateLimiterDO(makeDOState());
    const res = await do_.fetch(new Request("https://do/check?ip=1.1.1.1&max=10&window=60000"));
    expect(res.status).toBe(404);
  });
});
