/**
 * Tests for FdbCard base class (v8.0 Web Components foundation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FdbCard } from "@/core/fdb-card";

// ── Concrete subclass for testing ──────────────────────────────────────────
class TestCard extends FdbCard {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-test"];
  }

  connectedCount = 0;
  disconnectedCount = 0;
  lastAttrChange: { name: string; old: string | null; next: string | null } | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.connectedCount++;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disconnectedCount++;
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    this.lastAttrChange = { name, old: oldValue, next: newValue };
  }
}

// Register once globally for the test suite
if (!customElements.get("fdb-test-card")) {
  customElements.define("fdb-test-card", TestCard);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("FdbCard — base class", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("observedAttributes includes base attributes", () => {
    const attrs = FdbCard.observedAttributes;
    expect(attrs).toContain("data-card-id");
    expect(attrs).toContain("data-card-size");
    expect(attrs).toContain("hidden");
  });

  it("subclass observedAttributes includes base + own attributes", () => {
    const attrs = TestCard.observedAttributes;
    expect(attrs).toContain("data-card-id");
    expect(attrs).toContain("data-test");
  });

  it("connectedCallback fires on DOM insert", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    expect(el.connectedCount).toBe(0);
    document.body.appendChild(el);
    expect(el.connectedCount).toBe(1);
  });

  it("disconnectedCallback fires on DOM removal", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    expect(el.disconnectedCount).toBe(0);
    document.body.removeChild(el);
    expect(el.disconnectedCount).toBe(1);
  });

  it("cardId returns data-card-id attribute", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    el.setAttribute("data-card-id", "weather");
    expect(el.cardId).toBe("weather");
  });

  it("cardSize returns data-card-size attribute (defaults to md)", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    expect(el.cardSize).toBe("md");
    el.setAttribute("data-card-size", "lg");
    expect(el.cardSize).toBe("lg");
  });

  it("setLoading sets aria-busy true/false", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    el.setLoading(true);
    expect(el.getAttribute("aria-busy")).toBe("true");
    el.setLoading(false);
    expect(el.getAttribute("aria-busy")).toBe("false");
  });

  it("setError sets aria-label with Hebrew prefix", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    el.setError("network timeout");
    expect(el.getAttribute("aria-label")).toBe("שגיאה: network timeout");
  });

  it("setError(null) removes aria-label", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    el.setError("some error");
    el.setError(null);
    expect(el.getAttribute("aria-label")).toBeNull();
  });

  it("scheduleRefresh calls callback at interval", async () => {
    vi.useFakeTimers();
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    const cb = vi.fn().mockResolvedValue(undefined);
    el.scheduleRefresh(cb, 1000);
    expect(cb).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(2);
    document.body.removeChild(el);
    vi.useRealTimers();
  });

  it("disconnectedCallback clears refresh timer", async () => {
    vi.useFakeTimers();
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    const cb = vi.fn().mockResolvedValue(undefined);
    el.scheduleRefresh(cb, 1000);
    document.body.removeChild(el); // triggers disconnectedCallback
    await vi.advanceTimersByTimeAsync(3000);
    expect(cb).not.toHaveBeenCalled(); // timer cleared
    vi.useRealTimers();
  });

  it("attributeChangedCallback fires on attribute change", () => {
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    expect(el.lastAttrChange).toBeNull();
    el.setAttribute("data-card-id", "news");
    expect(el.lastAttrChange).toEqual({
      name: "data-card-id",
      old: null,
      next: "news",
    });
  });

  it("attributeChangedCallback fires even with same value (browser spec)", () => {
    // browsers call attributeChangedCallback on every setAttribute, even same value.
    // FdbCard's oldValue===newValue guard only skips diagLog, not the lifecycle hook.
    const el = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(el);
    el.setAttribute("data-card-id", "stocks");
    el.lastAttrChange = null;
    el.setAttribute("data-card-id", "stocks"); // same value — hook still fires
    expect(el.lastAttrChange).not.toBeNull();
    expect(el.lastAttrChange?.name).toBe("data-card-id");
  });
});
// ── Sprint 50: CardRuntime hooks ─────────────────────────────────────────────
describe("FdbCard CardRuntime hooks (Sprint 50)", () => {
  let el: FdbCard;

  beforeEach(() => {
    el = document.createElement("fdb-test-card") as FdbCard;
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (el.isConnected) document.body.removeChild(el);
  });

  it("onConfigChange is a no-op by default", () => {
    expect(() => el.onConfigChange("theme", "dark")).not.toThrow();
  });

  it("onStale is a no-op by default", () => {
    expect(() => el.onStale(60_000)).not.toThrow();
  });

  it("onError defaults to calling setError with the message", () => {
    const err = new Error("network failure");
    el.onError(err);
    expect(el.getAttribute("aria-label")).toBe("שגיאה: network failure");
  });

  it("onConfigChange can be overridden in subclass", () => {
    class ConfigTracker extends FdbCard {
      calls: Array<{ key: string; value: unknown }> = [];
      override onConfigChange(key: string, value: unknown): void {
        this.calls.push({ key, value });
      }
    }
    if (!customElements.get("fdb-config-tracker")) {
      customElements.define("fdb-config-tracker", ConfigTracker);
    }
    const card = document.createElement("fdb-config-tracker") as ConfigTracker;
    document.body.appendChild(card);
    card.onConfigChange("location", "Tel Aviv");
    expect(card.calls).toEqual([{ key: "location", value: "Tel Aviv" }]);
    document.body.removeChild(card);
  });

  it("onStale can be overridden in subclass", () => {
    class StaleTracker extends FdbCard {
      lastAge: number | null = null;
      override onStale(ageMs: number): void { this.lastAge = ageMs; }
    }
    if (!customElements.get("fdb-stale-tracker")) {
      customElements.define("fdb-stale-tracker", StaleTracker);
    }
    const card = document.createElement("fdb-stale-tracker") as StaleTracker;
    document.body.appendChild(card);
    card.onStale(120_000);
    expect(card.lastAge).toBe(120_000);
    document.body.removeChild(card);
  });
});

// ── Sprint 54: renderNodes ────────────────────────────────────────────────
describe("FdbCard.renderNodes (Sprint 54)", () => {
  let card: FdbCard;
  beforeEach(() => {
    card = document.createElement("fdb-test-card") as FdbCard;
    document.body.appendChild(card);
  });
  afterEach(() => { if (card.isConnected) document.body.removeChild(card); });

  it("clears target and appends Node children", () => {
    const target = document.createElement("div");
    target.textContent = "old";
    const span = document.createElement("span");
    span.textContent = "new";
    card.renderNodes(target, span);
    expect(target.querySelector("span")?.textContent).toBe("new");
    expect(target.childNodes.length).toBe(1);
  });

  it("wraps string arguments in a span", () => {
    const target = document.createElement("div");
    card.renderNodes(target, "hello world");
    expect(target.querySelector("span")?.textContent).toBe("hello world");
  });

  it("does not inject raw HTML from strings", () => {
    const target = document.createElement("div");
    card.renderNodes(target, "<script>evil()</script>");
    expect(target.querySelector("script")).toBeNull();
    expect(target.querySelector("span")?.textContent).toBe("<script>evil()</script>");
  });
});

// ── Sprint 55: withLoading ────────────────────────────────────────────────
describe("FdbCard.withLoading (Sprint 55)", () => {
  let card: FdbCard;
  beforeEach(() => {
    card = document.createElement("fdb-test-card") as FdbCard;
    document.body.appendChild(card);
  });
  afterEach(() => { if (card.isConnected) document.body.removeChild(card); });

  it("sets aria-busy=true during fn execution", async () => {
    let busyDuring = false;
    await card.withLoading(async () => {
      busyDuring = card.getAttribute("aria-busy") === "true";
    });
    expect(busyDuring).toBe(true);
  });

  it("clears aria-busy after fn resolves", async () => {
    await card.withLoading(async () => { /* noop */ });
    expect(card.getAttribute("aria-busy")).toBe("false");
  });

  it("calls onError and still clears loading on rejection", async () => {
    const errors: Error[] = [];
    card.onError = (e) => errors.push(e);
    await card.withLoading(async () => { throw new Error("boom"); });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe("boom");
    expect(card.getAttribute("aria-busy")).toBe("false");
  });
});