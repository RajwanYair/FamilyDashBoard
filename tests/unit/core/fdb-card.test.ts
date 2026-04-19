/**
 * Tests for FdbCard base class (v8.0 Web Components foundation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FdbCard } from "@/core/fdb-card";
import { setSync } from "@/core/sync";

vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
}));

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

// ── FdbCard.emit (Sprint 67) ───────────────────────────────────────────────

describe("FdbCard.emit", () => {
  let card: TestCard;

  beforeEach(() => {
    card = new TestCard();
    document.body.appendChild(card);
  });

  afterEach(() => {
    card.remove();
  });

  it("dispatches a CustomEvent with the given type", () => {
    const received: CustomEvent[] = [];
    card.addEventListener("fdb-test", (e) => received.push(e as CustomEvent));
    card.emit("fdb-test");
    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("fdb-test");
  });

  it("includes detail payload in the event", () => {
    const received: CustomEvent<{ value: number }>[] = [];
    card.addEventListener("fdb-value", (e) => received.push(e as CustomEvent<{ value: number }>));
    card.emit<{ value: number }>("fdb-value", { value: 42 });
    expect(received[0]?.detail).toEqual({ value: 42 });
  });

  it("events bubble up the DOM", () => {
    const bubbled: Event[] = [];
    document.body.addEventListener("fdb-bubble", (e) => bubbled.push(e));
    card.emit("fdb-bubble");
    expect(bubbled).toHaveLength(1);
  });
});

// ── FdbCard.setTitle (Sprint 72) ───────────────────────────────────────────

describe("FdbCard.setTitle", () => {
  let card: TestCard;

  beforeEach(() => {
    card = new TestCard();
    document.body.appendChild(card);
  });

  afterEach(() => { card.remove(); });

  it("sets textContent of [data-card-title] element", () => {
    const title = document.createElement("span");
    title.dataset["cardTitle"] = "";
    card.appendChild(title);
    card.setTitle("Weather");
    expect(title.textContent).toBe("Weather");
  });

  it("is a no-op when no [data-card-title] element exists", () => {
    expect(() => card.setTitle("Title")).not.toThrow();
  });
});

// ── FdbCard.setBadge (Sprint 73) ───────────────────────────────────────────

describe("FdbCard.setBadge", () => {
  let card: TestCard;

  beforeEach(() => {
    card = new TestCard();
    document.body.appendChild(card);
  });

  afterEach(() => { card.remove(); });

  it("sets badge text and removes aria-hidden when count > 0", () => {
    const badge = document.createElement("span");
    badge.dataset["cardBadge"] = "";
    card.appendChild(badge);
    card.setBadge(5);
    expect(badge.textContent).toBe("5");
    expect(badge.getAttribute("aria-hidden")).toBeNull();
  });

  it("clears badge and sets aria-hidden when count is 0", () => {
    const badge = document.createElement("span");
    badge.dataset["cardBadge"] = "";
    card.appendChild(badge);
    card.setBadge(0);
    expect(badge.textContent).toBe("");
    expect(badge.getAttribute("aria-hidden")).toBe("true");
  });

  it("is a no-op when no [data-card-badge] element exists", () => {
    expect(() => card.setBadge(3)).not.toThrow();
  });
});

// ── clearContent (Sprint 78) ────────────────────────────────────────────────

describe("FdbCard — clearContent", () => {
  let card: TestCard;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(card);
  });

  it("removes all child nodes from the card", () => {
    card.innerHTML = "<p>A</p><p>B</p><span>C</span>";
    expect(card.childNodes.length).toBe(3);
    card.clearContent();
    expect(card.childNodes.length).toBe(0);
  });

  it("removes children from a specified target element", () => {
    const div = document.createElement("div");
    div.innerHTML = "<span>X</span><span>Y</span>";
    card.appendChild(div);
    card.clearContent(div);
    expect(div.childNodes.length).toBe(0);
    expect(card.contains(div)).toBe(true);
  });

  it("is a no-op on an already empty element", () => {
    expect(() => card.clearContent()).not.toThrow();
    expect(card.childNodes.length).toBe(0);
  });
});

// ── qs (Sprint 79) ─────────────────────────────────────────────────────────

describe("FdbCard — qs", () => {
  let card: TestCard;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(card);
  });

  it("finds a child element by selector", () => {
    const span = document.createElement("span");
    span.className = "target";
    card.appendChild(span);
    expect(card.qs(".target")).toBe(span);
  });

  it("returns null when no match", () => {
    expect(card.qs(".nonexistent")).toBeNull();
  });

  it("returns typed element for specific selectors", () => {
    const input = document.createElement("input");
    card.appendChild(input);
    const result = card.qs<HTMLInputElement>("input");
    expect(result).toBe(input);
  });
});

// ── qs (Sprint 79) ─────────────────────────────────────────────────────────

describe("FdbCard — qs", () => {
  let card: TestCard;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(card);
  });

  it("finds a child element by selector", () => {
    const span = document.createElement("span");
    span.className = "target";
    card.appendChild(span);
    expect(card.qs(".target")).toBe(span);
  });

  it("returns null when no match", () => {
    expect(card.qs(".nonexistent")).toBeNull();
  });

  it("returns typed element for specific selectors", () => {
    const input = document.createElement("input");
    card.appendChild(input);
    const result = card.qs<HTMLInputElement>("input");
    expect(result).toBe(input);
  });
});

// ── createEl (Sprint 80) ───────────────────────────────────────────────────

describe("FdbCard — createEl", () => {
  it("creates an element with the specified tag", () => {
    const el = FdbCard.createEl("div");
    expect(el.tagName).toBe("DIV");
  });

  it("sets className when provided", () => {
    const el = FdbCard.createEl("span", "my-class");
    expect(el.className).toBe("my-class");
  });

  it("sets textContent when provided", () => {
    const el = FdbCard.createEl("p", "", "Hello");
    expect(el.textContent).toBe("Hello");
  });

  it("does not set className when undefined", () => {
    const el = FdbCard.createEl("div");
    expect(el.className).toBe("");
  });

  it("returns correctly typed element", () => {
    const input = FdbCard.createEl("input");
    expect(input).toBeInstanceOf(HTMLInputElement);
  });
});

// ── onVisible / onHidden (Sprint 84) ───────────────────────────────────────

describe("FdbCard — onVisible / onHidden (Sprint 84)", () => {
  let card: TestCard;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(card);
  });

  afterEach(() => {
    card.remove();
  });

  it("calls onVisible when page becomes visible", () => {
    const spy = vi.spyOn(card, "onVisible");
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("calls onHidden when page becomes hidden", () => {
    const spy = vi.spyOn(card, "onHidden");
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("stops listening after disconnectedCallback", () => {
    const spy = vi.spyOn(card, "onVisible");
    card.remove(); // triggers disconnectedCallback
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(spy).not.toHaveBeenCalled();
  });

  it("onVisible and onHidden are no-ops by default", () => {
    expect(() => card.onVisible()).not.toThrow();
    expect(() => card.onHidden()).not.toThrow();
  });
});

// ── staleChip (Sprint 85) ──────────────────────────────────────────────────

describe("FdbCard — staleChip (Sprint 85)", () => {
  let card: TestCard;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    document.body.appendChild(card);
  });

  it("inserts a stale chip when ageMs > 0", () => {
    card.staleChip(300_000); // 5 minutes
    const chip = card.querySelector(".stale-chip");
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("5 דק׳");
  });

  it("updates existing chip text on subsequent calls", () => {
    card.staleChip(300_000);
    card.staleChip(600_000); // 10 minutes
    const chips = card.querySelectorAll(".stale-chip");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.textContent).toContain("10 דק׳");
  });

  it("removes the chip when ageMs <= 0", () => {
    card.staleChip(300_000);
    card.staleChip(0);
    expect(card.querySelector(".stale-chip")).toBeNull();
  });

  it("shows hours for large stale ages", () => {
    card.staleChip(7_200_000); // 2 hours
    const chip = card.querySelector(".stale-chip");
    expect(chip!.textContent).toContain("2 שע׳");
  });

  it("shows '< 1 דק׳' for very short ages", () => {
    card.staleChip(30_000); // 30 seconds
    const chip = card.querySelector(".stale-chip");
    expect(chip!.textContent).toContain("1 דק׳");
  });

  it("is a no-op when clearing non-existent chip", () => {
    expect(() => card.staleChip(0)).not.toThrow();
    expect(card.querySelector(".stale-chip")).toBeNull();
  });
});

// ── setSyncState (Sprint 86) ────────────────────────────────────────────

describe("FdbCard — setSyncState (Sprint 86)", () => {
  let card: TestCard;

  beforeEach(() => {
    vi.mocked(setSync).mockClear();
    document.body.innerHTML = "";
    card = document.createElement("fdb-test-card") as TestCard;
    card.setAttribute("data-card-id", "test-card");
    document.body.appendChild(card);
  });

  it("delegates to setSync with the card ID", () => {
    card.setSyncState("ok");
    expect(setSync).toHaveBeenCalledWith("test-card", "ok");
  });

  it("passes loading state", () => {
    card.setSyncState("loading");
    expect(setSync).toHaveBeenCalledWith("test-card", "loading");
  });

  it("passes error state", () => {
    card.setSyncState("error");
    expect(setSync).toHaveBeenCalledWith("test-card", "error");
  });

  it("is a no-op when card has no ID", () => {
    card.removeAttribute("data-card-id");
    card.setSyncState("ok");
    expect(setSync).not.toHaveBeenCalled();
  });
});

// ── Sprint 130: renderMetricTile ──────────────────────────────────────────
describe("FdbCard.renderMetricTile (Sprint 130)", () => {
  it("creates a .metric-tile with label and value", () => {
    const tile = FdbCard.renderMetricTile("טמפרטורה", "25", "°C");
    expect(tile.className).toBe("metric-tile");
    const label = tile.querySelector(".metric-tile__label");
    expect(label?.textContent).toBe("טמפרטורה");
    const value = tile.querySelector(".metric-tile__value");
    expect(value?.textContent).toBe("25°C");
  });

  it("renders without unit suffix when unit omitted", () => {
    const tile = FdbCard.renderMetricTile("מחיר", "150.5");
    const value = tile.querySelector(".metric-tile__value");
    expect(value?.textContent).toBe("150.5");
  });

  it("accepts numeric values", () => {
    const tile = FdbCard.renderMetricTile("ערך", 42, "%");
    const value = tile.querySelector(".metric-tile__value");
    expect(value?.textContent).toBe("42%");
  });
});

// ── Sprint 131: renderEmpty ───────────────────────────────────────────────
describe("FdbCard.renderEmpty (Sprint 131)", () => {
  it("creates a .card-empty with default icon", () => {
    const el = FdbCard.renderEmpty("אין אירועים");
    expect(el.className).toBe("card-empty");
    expect(el.querySelector(".card-empty__icon")?.textContent).toBe("📭");
    expect(el.querySelector(".card-empty__msg")?.textContent).toBe("אין אירועים");
  });

  it("accepts custom icon", () => {
    const el = FdbCard.renderEmpty("אין משימות", "✅");
    expect(el.querySelector(".card-empty__icon")?.textContent).toBe("✅");
  });
});

// ── Sprint 132: renderError ───────────────────────────────────────────────
describe("FdbCard.renderError (Sprint 132)", () => {
  it("creates a .card-error with role=alert", () => {
    const el = FdbCard.renderError("שגיאת רשת");
    expect(el.className).toBe("card-error");
    expect(el.getAttribute("role")).toBe("alert");
    expect(el.querySelector(".card-error__icon")?.textContent).toBe("⚠️");
    expect(el.querySelector(".card-error__msg")?.textContent).toBe("שגיאת רשת");
  });

  it("accepts custom icon", () => {
    const el = FdbCard.renderError("תקלה", "🔴");
    expect(el.querySelector(".card-error__icon")?.textContent).toBe("🔴");
  });
});

// ── Sprint 133: renderSkeleton ────────────────────────────────────────────
describe("FdbCard.renderSkeleton (Sprint 133)", () => {
  it("creates a .card-skeleton with 3 lines by default", () => {
    const el = FdbCard.renderSkeleton();
    expect(el.className).toBe("card-skeleton");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelectorAll(".skeleton")).toHaveLength(3);
  });

  it("accepts custom line count", () => {
    const el = FdbCard.renderSkeleton(5);
    expect(el.querySelectorAll(".skeleton")).toHaveLength(5);
  });
});
