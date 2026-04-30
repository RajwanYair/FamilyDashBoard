/**
 * fast-check property tests for src/core/provider.ts (Sprint 320 / PRP1-PRP6)
 *
 * Verifies invariants of the provider-health model and backoff policy
 * across arbitrary success/failure sequences.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  _resetProviderHealth,
  getBackoffMs,
  getProviderHealth,
  recordProviderFailure,
  recordProviderLatency,
  recordProviderSuccess,
  shouldBackoff,
  getProviderLatency,
} from "@/core/provider";

describe("provider — fast-check properties (PRP1-PRP6, Sprint 320)", () => {
  beforeEach(() => {
    _resetProviderHealth();
  });

  it("PRP1: a single success after any failure streak resets consecutiveFails to 0 and status to 'ok'", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: 10 }),
        (id, fails) => {
          _resetProviderHealth();
          for (let i = 0; i < fails; i++) recordProviderFailure(id);
          recordProviderSuccess(id);
          const h = getProviderHealth(id);
          expect(h.consecutiveFails).toBe(0);
          expect(h.status).toBe("ok");
          expect(h.successCount).toBe(1);
          expect(h.failureCount).toBe(fails);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("PRP2: status transitions follow the consecutiveFails buckets (0 → ok, 1-2 → degraded, 3+ → down)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        _resetProviderHealth();
        const id = "p";
        for (let i = 0; i < n; i++) recordProviderFailure(id);
        const h = getProviderHealth(id);
        if (n === 0) expect(h.status).toBe("ok");
        else if (n <= 2) expect(h.status).toBe("degraded");
        else expect(h.status).toBe("down");
      }),
      { numRuns: 25 },
    );
  });

  it("PRP3: getBackoffMs is 0 when no fails, and otherwise capped at maxMs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 100, max: 5_000 }),
        fc.integer({ min: 5_000, max: 120_000 }),
        (n, base, max) => {
          _resetProviderHealth();
          const id = "p";
          for (let i = 0; i < n; i++) recordProviderFailure(id);
          const ms = getBackoffMs(id, base, max);
          if (n === 0) {
            expect(ms).toBe(0);
          } else {
            expect(ms).toBeGreaterThan(0);
            expect(ms).toBeLessThanOrEqual(max);
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it("PRP4: shouldBackoff is false immediately after a success, regardless of past failure count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
        _resetProviderHealth();
        const id = "p";
        for (let i = 0; i < n; i++) recordProviderFailure(id);
        recordProviderSuccess(id);
        expect(shouldBackoff(id, Date.now())).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it("PRP5: latency ring buffer never exceeds 20 samples and preserves arrival order", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5_000 }), { maxLength: 50 }), (samples) => {
        _resetProviderHealth();
        const id = "p";
        for (const s of samples) recordProviderLatency(id, s);
        const stored = getProviderLatency(id);
        expect(stored.length).toBeLessThanOrEqual(20);
        // Stored values are the LAST 20 samples (in arrival order, rounded to 0.1)
        const expected = samples.slice(-20).map((v) => Math.round(v * 10) / 10);
        expect([...stored]).toEqual(expected);
      }),
      { numRuns: 30 },
    );
  });

  it("PRP6: success and failure counters are commutative-additive (sum is invariant under interleaving)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 30 }),
        (events) => {
          _resetProviderHealth();
          const id = "p";
          for (const ok of events) {
            if (ok) recordProviderSuccess(id);
            else recordProviderFailure(id);
          }
          const h = getProviderHealth(id);
          const successes = events.filter(Boolean).length;
          const failures = events.length - successes;
          expect(h.successCount).toBe(successes);
          expect(h.failureCount).toBe(failures);
        },
      ),
      { numRuns: 30 },
    );
  });
});
