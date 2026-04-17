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
