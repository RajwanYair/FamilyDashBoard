/**
 * fast-check property tests — src/core/provider.ts 
 *
 * Properties under test:
 *  PV1. recordProviderSuccess resets consecutiveFails to 0 and status to "ok".
 *  PV2. recordProviderFailure increments consecutiveFails and derives status.
 *  PV3. Status transitions: 0=ok, 1-2=degraded, 3+=down.
 *  PV4. getBackoffMs: returns 0 when ok, capped exponential otherwise.
 *  PV5. recordProviderLatency: ring buffer never exceeds LATENCY_MAX_SAMPLES (20).
 *  PV6. getProviderHealth returns a copy (mutation doesn't affect internal state).
 *  PV7. shouldBackoff returns false when status is ok.
 *  PV8. getAllProviderHealth includes every registered provider 
 *  PV9. recordProviderLatency: FIFO — latest sample is last in array 
 *  PV10. shouldBackoff returns true when down + recent attempt 
 *  PV11. recordProviderSuccess: successCount accumulates across calls 
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  recordProviderSuccess,
  recordProviderFailure,
  getProviderHealth,
  getAllProviderHealth,
  getBackoffMs,
  recordProviderLatency,
  getProviderLatency,
  shouldBackoff,
  _resetProviderHealth,
} from "@/core/provider";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const providerIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{1,19}$/);

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetProviderHealth();
});

// ── PV1: recordProviderSuccess always resets to ok ───────────────────────────

describe("provider — PV1: recordProviderSuccess resets to ok", () => {
  it("after any number of failures, success resets consecutiveFails and status", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 0, max: 20 }),
        (id, failCount) => {
          _resetProviderHealth();
          for (let i = 0; i < failCount; i++) recordProviderFailure(id);
          recordProviderSuccess(id);
          const h = getProviderHealth(id);
          expect(h.consecutiveFails).toBe(0);
          expect(h.status).toBe("ok");
          expect(h.successCount).toBe(1);
          expect(h.lastOkAt).not.toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── PV2: recordProviderFailure increments consecutiveFails ───────────────────

describe("provider — PV2: recordProviderFailure increments consecutiveFails", () => {
  it("n failures → consecutiveFails === n", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 1, max: 30 }),
        (id, n) => {
          _resetProviderHealth();
          for (let i = 0; i < n; i++) recordProviderFailure(id);
          const h = getProviderHealth(id);
          expect(h.consecutiveFails).toBe(n);
          expect(h.failureCount).toBe(n);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── PV3: status derivation from consecutiveFails ─────────────────────────────

describe("provider — PV3: status transitions", () => {
  it("0 fails → ok, 1-2 → degraded, 3+ → down", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 0, max: 50 }),
        (id, n) => {
          _resetProviderHealth();
          for (let i = 0; i < n; i++) recordProviderFailure(id);
          const h = getProviderHealth(id);
          if (n === 0) expect(h.status).toBe("ok");
          else if (n <= 2) expect(h.status).toBe("degraded");
          else expect(h.status).toBe("down");
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── PV4: getBackoffMs capped exponential ─────────────────────────────────────

describe("provider — PV4: getBackoffMs is capped exponential", () => {
  it("returns 0 when consecutiveFails === 0", () => {
    fc.assert(
      fc.property(providerIdArb, (id) => {
        _resetProviderHealth();
        expect(getBackoffMs(id)).toBe(0);
      }),
      { numRuns: 20 },
    );
  });

  it("never exceeds maxMs", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 5001, max: 120_000 }),
        (id, fails, base, max) => {
          _resetProviderHealth();
          for (let i = 0; i < fails; i++) recordProviderFailure(id);
          const delay = getBackoffMs(id, base, max);
          expect(delay).toBeLessThanOrEqual(max);
          expect(delay).toBeGreaterThan(0);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── PV5: latency ring buffer bounded ────────────────────────────────────────

describe("provider — PV5: latency ring buffer never exceeds 20", () => {
  it("after N recordings, length is min(N, 20)", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 1, max: 100 }),
        (id, n) => {
          _resetProviderHealth();
          for (let i = 0; i < n; i++) recordProviderLatency(id, i * 10);
          const samples = getProviderLatency(id);
          expect(samples.length).toBe(Math.min(n, 20));
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── PV6: getProviderHealth returns a copy ────────────────────────────────────

describe("provider — PV6: getProviderHealth returns defensive copy", () => {
  it("mutating the returned object does not affect internal state", () => {
    fc.assert(
      fc.property(providerIdArb, (id) => {
        _resetProviderHealth();
        recordProviderFailure(id);
        const h1 = getProviderHealth(id);
        h1.consecutiveFails = 999;
        h1.status = "ok";
        const h2 = getProviderHealth(id);
        expect(h2.consecutiveFails).toBe(1);
        expect(h2.status).toBe("degraded");
      }),
      { numRuns: 20 },
    );
  });
});

// ── PV7: shouldBackoff false when ok ─────────────────────────────────────────

describe("provider — PV7: shouldBackoff returns false when status is ok", () => {
  it("fresh provider never backs off", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 0, max: Date.now() }),
        (id, lastAttempt) => {
          _resetProviderHealth();
          expect(shouldBackoff(id, lastAttempt)).toBe(false);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── PV8: getAllProviderHealth includes registered providers ───────────────────

describe("provider — PV8: getAllProviderHealth includes registered", () => {
  it("each interacted provider appears in getAllProviderHealth", () => {
    fc.assert(
      fc.property(
        fc.array(providerIdArb, { minLength: 1, maxLength: 5 }),
        (ids) => {
          _resetProviderHealth();
          const uniqueIds = [...new Set(ids)];
          for (const id of uniqueIds) recordProviderFailure(id);
          const all = getAllProviderHealth();
          const allIds = all.map((h) => h.id);
          for (const id of uniqueIds) {
            expect(allIds).toContain(id);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── PV9: latency FIFO — latest sample is last ───────────────────────────────

describe("provider — PV9: latency FIFO ordering", () => {
  it("latest recorded latency is the last element", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 15 }),
        (id, samples) => {
          _resetProviderHealth();
          for (const ms of samples) recordProviderLatency(id, ms);
          const stored = getProviderLatency(id);
          expect(stored[stored.length - 1]).toBe(samples[samples.length - 1]);
        },
      ),
      { numRuns: 40 },
    );
  });
});

// ── PV10: shouldBackoff true when down + recent attempt ──────────────────────

describe("provider — PV10: shouldBackoff true when down", () => {
  it("returns true for down provider with very recent lastAttemptAt", () => {
    fc.assert(
      fc.property(providerIdArb, (id) => {
        _resetProviderHealth();
        // 5 failures → down
        for (let i = 0; i < 5; i++) recordProviderFailure(id);
        expect(getProviderHealth(id).status).toBe("down");
        // last attempt just now → backoff should be true
        expect(shouldBackoff(id, Date.now())).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});

// ── PV11: successCount accumulates ───────────────────────────────────────────

describe("provider — PV11: successCount accumulates", () => {
  it("N successes → successCount === N", () => {
    fc.assert(
      fc.property(
        providerIdArb,
        fc.integer({ min: 1, max: 30 }),
        (id, n) => {
          _resetProviderHealth();
          for (let i = 0; i < n; i++) recordProviderSuccess(id);
          expect(getProviderHealth(id).successCount).toBe(n);
        },
      ),
      { numRuns: 40 },
    );
  });
});
