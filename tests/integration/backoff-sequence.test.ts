/**
 * Integration: Backoff + recordFailure / recordSuccess across modules
 *
 * Tests that recordFailure / recordSuccess / getBackoffDelay work as
 * expected through a realistic sequence: fresh → fail × N → success → reset.
 */

import { describe, it, expect } from "vitest";
import { recordFailure, recordSuccess, getBackoffDelay } from "@/core/sync";

describe("Backoff — failure/success sequence", () => {
  it("fresh key has 1x delay (2^0 = 1)", () => {
    expect(getBackoffDelay("bp:fresh")).toBe(1);
  });

  it("after 1 failure: delay = 2x (2^1)", () => {
    recordFailure("bp:seq");
    expect(getBackoffDelay("bp:seq")).toBe(2);
    recordSuccess("bp:seq"); // cleanup
  });

  it("after 3 failures: delay = 8x (2^3)", () => {
    recordFailure("bp:triple");
    recordFailure("bp:triple");
    recordFailure("bp:triple");
    expect(getBackoffDelay("bp:triple")).toBe(8);
    recordSuccess("bp:triple"); // cleanup
  });

  it("backoff caps at 32x (2^5) after 6+ failures", () => {
    for (let i = 0; i < 6; i++) recordFailure("bp:cap");
    expect(getBackoffDelay("bp:cap")).toBe(32);
    recordSuccess("bp:cap"); // cleanup
  });

  it("recordSuccess resets delay to 1x", () => {
    recordFailure("bp:reset");
    recordFailure("bp:reset");
    expect(getBackoffDelay("bp:reset")).toBe(4);
    recordSuccess("bp:reset");
    expect(getBackoffDelay("bp:reset")).toBe(1);
  });

  it("independent keys do not interfere", () => {
    recordFailure("bp:a");
    recordFailure("bp:a");
    expect(getBackoffDelay("bp:b")).toBe(1);
    recordSuccess("bp:a");
  });
});
