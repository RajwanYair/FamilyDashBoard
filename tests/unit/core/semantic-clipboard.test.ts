/**
 * semantic-clipboard unit tests.
 * Spec: docs/adr/ADR-070-x15-semantic-clipboard.md
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerSemanticProducer,
  getSemanticPayload,
  findFocusedCardId,
  writeSemanticPayload,
  copyFocusedCardPayload,
  _resetSemanticProducers,
  type SemanticPayload,
} from "../../../src/core/semantic-clipboard";

function makePayload(cardId: string, text = "hello"): SemanticPayload {
  return {
    cardId,
    text,
    jsonLd: { "@context": "https://schema.org", "@type": "Event", name: text },
    ts: Date.now(),
  };
}

describe("semantic-clipboard (X15 / )", () => {
  beforeEach(() => {
    _resetSemanticProducers();
    vi.restoreAllMocks();
  });

  describe("findFocusedCardId", () => {
    it("returns null for null input", () => {
      expect(findFocusedCardId(null)).toBeNull();
    });

    it("finds nearest [data-card-id] ancestor", () => {
      document.body.innerHTML = `
        <section data-card-id="weather">
          <div><button id="btn">x</button></div>
        </section>`;
      const btn = document.getElementById("btn")!;
      expect(findFocusedCardId(btn)).toBe("weather");
    });

    it("returns null when no card ancestor", () => {
      document.body.innerHTML = `<div><span id="x">y</span></div>`;
      expect(findFocusedCardId(document.getElementById("x"))).toBeNull();
    });
  });

  describe("registerSemanticProducer / getSemanticPayload", () => {
    it("returns null for unregistered card", () => {
      expect(getSemanticPayload("ghost")).toBeNull();
    });

    it("returns the producer's payload", () => {
      registerSemanticProducer("weather", () => makePayload("weather", "22°C"));
      expect(getSemanticPayload("weather")?.text).toBe("22°C");
    });

    it("re-registration replaces previous", () => {
      registerSemanticProducer("weather", () => makePayload("weather", "a"));
      registerSemanticProducer("weather", () => makePayload("weather", "b"));
      expect(getSemanticPayload("weather")?.text).toBe("b");
    });

    it("swallows producer errors and returns null", () => {
      registerSemanticProducer("weather", () => {
        throw new Error("nope");
      });
      expect(getSemanticPayload("weather")).toBeNull();
    });

    it("respects null payload (producer-side opt-out)", () => {
      registerSemanticProducer("weather", () => null);
      expect(getSemanticPayload("weather")).toBeNull();
    });
  });

  describe("writeSemanticPayload", () => {
    it("writes ClipboardItem with both MIME types when supported", async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      const writeText = vi.fn();
      class MockItem {
        public types: string[];
        constructor(public data: Record<string, unknown>) {
          this.types = Object.keys(data);
        }
      }
      vi.stubGlobal("ClipboardItem", MockItem);
      Object.defineProperty(navigator, "clipboard", {
        value: { write, writeText },
        configurable: true,
      });

      const ok = await writeSemanticPayload(makePayload("weather"));
      expect(ok).toBe(true);
      expect(write).toHaveBeenCalledTimes(1);
      const item = write.mock.calls[0]![0][0] as MockItem;
      expect(item.types).toContain("text/plain");
      expect(item.types).toContain("application/ld+json");
      expect(writeText).not.toHaveBeenCalled();
    });

    it("falls back to writeText when ClipboardItem missing", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("ClipboardItem", undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      const ok = await writeSemanticPayload(makePayload("weather", "fallback"));
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith("fallback");
    });

    it("returns false when navigator.clipboard absent", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      });
      expect(await writeSemanticPayload(makePayload("weather"))).toBe(false);
    });

    it("returns false on clipboard rejection", async () => {
      vi.stubGlobal("ClipboardItem", undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
        configurable: true,
      });
      expect(await writeSemanticPayload(makePayload("weather"))).toBe(false);
    });
  });

  describe("copyFocusedCardPayload", () => {
    it("returns null when no card focused", async () => {
      document.body.innerHTML = `<div id="x"></div>`;
      expect(await copyFocusedCardPayload(document.getElementById("x"))).toBeNull();
    });

    it("returns null when card has no producer", async () => {
      document.body.innerHTML = `<section data-card-id="weather"><b id="t">x</b></section>`;
      expect(await copyFocusedCardPayload(document.getElementById("t"))).toBeNull();
    });

    it("returns cardId on successful copy", async () => {
      document.body.innerHTML = `<section data-card-id="weather"><b id="t">x</b></section>`;
      registerSemanticProducer("weather", () => makePayload("weather"));
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("ClipboardItem", undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      expect(await copyFocusedCardPayload(document.getElementById("t"))).toBe("weather");
    });
  });
});
