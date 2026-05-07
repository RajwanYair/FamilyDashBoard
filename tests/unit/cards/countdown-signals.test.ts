/**
 * Countdown × X12/X15 integration tests.
 *
 * Verifies that ticking the countdown card publishes a
 * `card-signal-protocol` value on (`countdown`, `next`) and that
 * the X15 semantic producer returns a context-rich payload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tick, initCountdownCard } from "../../../src/cards/countdown/countdown";
import {
  getCardSignal,
  _resetCardSignals,
} from "../../../src/core/card-signal-protocol";
import {
  getSemanticPayload,
  _resetSemanticProducers,
} from "../../../src/core/semantic-clipboard";

interface CountdownNext {
  targetMs: number;
  title: string;
  days: number;
  hours: number;
  minutes: number;
}

const FUTURE_DATE = "2030-01-01";

function setupDom(): void {
  document.body.innerHTML = `
    <div class="countdown-body">
      <div id="cd-wedding-title"></div>
      <div id="cd-days" class="cd-num"></div>
      <div id="cd-hours"></div>
      <div id="cd-mins"></div>
      <div id="cd-secs"></div>
      <div id="cd-msg"></div>
      <div id="cd-progress-wrap"><div id="cd-progress-bar"></div></div>
    </div>`;
}

describe("Countdown × X12 ", () => {
  beforeEach(() => {
    _resetCardSignals();
    _resetSemanticProducers();
    setupDom();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownCardDate: "2030-01-01",
        countdownCardTime: "18:00",
        countdownCardTitle: "Wedding",
        countdownCardDoneMsg: "Mazel Tov",
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("tick publishes a CardSignal under (countdown, next) with future targetMs", () => {
    expect(getCardSignal("countdown", "next")).toBeNull();
    tick();
    const sig = getCardSignal<CountdownNext>("countdown", "next");
    expect(sig).not.toBeNull();
    expect(sig!.value.targetMs).toBeGreaterThan(Date.now());
    expect(sig!.value.title).toBe("Wedding");
    expect(sig!.value.days).toBeGreaterThan(0);
  });

  it("publishes an updated signal on each tick", () => {
    tick();
    const first = getCardSignal<CountdownNext>("countdown", "next")!;
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
    tick();
    const second = getCardSignal<CountdownNext>("countdown", "next")!;
    expect(second.ts).toBeGreaterThanOrEqual(first.ts);
    expect(second.value.days).toBeLessThan(first.value.days);
  });

  it("signal payload is deep-frozen (X12 invariant)", () => {
    tick();
    const sig = getCardSignal<CountdownNext>("countdown", "next")!;
    expect(Object.isFrozen(sig.value)).toBe(true);
  });
});

describe("Countdown × X15 semantic producer ", () => {
  beforeEach(() => {
    _resetCardSignals();
    _resetSemanticProducers();
    setupDom();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownCardDate: "2030-01-01",
        countdownCardTime: "18:00",
        countdownCardTitle: "Wedding",
        countdownCardDoneMsg: "Mazel Tov",
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    document.body.innerHTML = "";
    delete (globalThis as unknown as { __cdLast?: unknown }).__cdLast;
  });

  it("getSemanticPayload returns null before init/tick", () => {
    initCountdownCard();
    delete (globalThis as unknown as { __cdLast?: unknown }).__cdLast;
    expect(getSemanticPayload("countdown")).toBeNull();
  });

  it("returns a SemanticPayload with text + JSON-LD Event after a tick", () => {
    initCountdownCard(); // registers producer + ticks once
    const payload = getSemanticPayload("countdown");
    expect(payload).not.toBeNull();
    expect(payload!.cardId).toBe("countdown");
    expect(payload!.text).toContain("Wedding");
    expect(payload!.jsonLd["@type"]).toBe("Event");
    expect(payload!.jsonLd.name).toBe("Wedding");
    expect(typeof payload!.jsonLd.startDate).toBe("string");
  });
});
