/**
 * Tests for Sprint 399 / SI-RTT: Connection-API path also feeds the RTT
 * sparkline ring buffer (previously only navigation-timing path did).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appendRttHistory,
  getRttHistory,
  _resetRttHistory,
} from "@/cards/system-info/system-info";

describe("SI-RTT ring buffer (Sprint 399)", () => {
  beforeEach(() => {
    _resetRttHistory();
  });

  afterEach(() => {
    _resetRttHistory();
  });

  it("appends positive RTT values in insertion order", () => {
    appendRttHistory(20);
    appendRttHistory(35);
    appendRttHistory(48);
    expect(getRttHistory()).toEqual([20, 35, 48]);
  });

  it("ignores non-positive and non-finite values", () => {
    appendRttHistory(0);
    appendRttHistory(-5);
    appendRttHistory(Number.NaN);
    appendRttHistory(Number.POSITIVE_INFINITY);
    appendRttHistory(25);
    expect(getRttHistory()).toEqual([25]);
  });

  it("caps the ring at 10 entries (FIFO eviction)", () => {
    for (let i = 1; i <= 12; i++) appendRttHistory(i * 10);
    const ring = getRttHistory();
    expect(ring.length).toBe(10);
    // First two pushes (10, 20) should have been evicted.
    expect(ring[0]).toBe(30);
    expect(ring[ring.length - 1]).toBe(120);
  });

  it("returns an immutable copy from getRttHistory", () => {
    appendRttHistory(15);
    const copy = getRttHistory();
    // Mutating the returned slice does not affect the internal ring.
    (copy as number[]).push(999);
    expect(getRttHistory()).toEqual([15]);
  });
});
