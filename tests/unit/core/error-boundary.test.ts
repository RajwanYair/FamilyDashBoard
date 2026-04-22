/**
 * Tests for src/core/error-boundary.ts
 *
 * Covers: withErrorBoundary wrapping sync/async functions, error UI rendering,
 * diagLog recording, error buffer recording.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));
vi.mock("@/core/error-tracker", () => ({
  recordError: vi.fn(),
}));

import { withErrorBoundary } from "@/core/error-boundary";
import { diagLog } from "@/core/diag";
import { recordError } from "@/core/error-tracker";

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ── withErrorBoundary — success path ──

describe("withErrorBoundary — success path", () => {
  it("returns the value from a sync function", async () => {
    const fn = withErrorBoundary("test-card", () => 42);
    const result = await fn();
    expect(result).toBe(42);
  });

  it("returns the resolved value from an async function", async () => {
    const fn = withErrorBoundary("test-card", async () => "hello");
    const result = await fn();
    expect(result).toBe("hello");
  });

  it("does not call diagLog on success", async () => {
    const fn = withErrorBoundary("test-card", () => true);
    await fn();
    expect(diagLog).not.toHaveBeenCalled();
  });

  it("does not call recordError on success", async () => {
    const fn = withErrorBoundary("test-card", () => true);
    await fn();
    expect(recordError).not.toHaveBeenCalled();
  });

  it("returns undefined from a void function without error", async () => {
    const fn = withErrorBoundary("test-card", () => {});
    const result = await fn();
    expect(result).toBeUndefined();
  });
});

// ── withErrorBoundary — error path ──

describe("withErrorBoundary — sync error", () => {
  it("catches a thrown Error and returns undefined", async () => {
    const fn = withErrorBoundary("test-card", () => {
      throw new Error("boom");
    });
    const result = await fn();
    expect(result).toBeUndefined();
  });

  it("logs the error via diagLog", async () => {
    const fn = withErrorBoundary("test-card", () => {
      throw new Error("boom");
    });
    await fn();
    expect(diagLog).toHaveBeenCalledWith(
      expect.stringContaining("test-card"),
    );
    expect(diagLog).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  it("records the error in the error buffer", async () => {
    const fn = withErrorBoundary("test-card", () => {
      throw new Error("kaboom");
    });
    await fn();
    expect(recordError).toHaveBeenCalledWith("kaboom", "card:test-card");
  });

  it("renders a .card-error element in the card body", async () => {
    document.body.innerHTML = `
      <section data-card-id="test-card">
        <div class="card__body"></div>
      </section>`;
    const fn = withErrorBoundary("test-card", () => {
      throw new Error("render fail");
    });
    await fn();
    const errorEl = document.querySelector(".card-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl?.getAttribute("role")).toBe("alert");
    expect(errorEl?.textContent).toContain("render fail");
  });

  it("does not add duplicate error elements if called twice", async () => {
    document.body.innerHTML = `
      <section data-card-id="test-card">
        <div class="card__body"></div>
      </section>`;
    const fn = withErrorBoundary("test-card", () => {
      throw new Error("dup error");
    });
    await fn();
    await fn();
    const errors = document.querySelectorAll(".card-error");
    expect(errors).toHaveLength(1);
  });

  it("does not throw when no card body in DOM", async () => {
    const fn = withErrorBoundary("missing-card", () => {
      throw new Error("no dom");
    });
    await expect(fn()).resolves.toBeUndefined();
  });
});

describe("withErrorBoundary — async error", () => {
  it("catches a rejected promise and returns undefined", async () => {
    const fn = withErrorBoundary("async-card", async () => {
      throw new Error("async boom");
    });
    const result = await fn();
    expect(result).toBeUndefined();
  });

  it("logs the async error via diagLog", async () => {
    const fn = withErrorBoundary("async-card", async () => {
      throw new Error("async error message");
    });
    await fn();
    expect(diagLog).toHaveBeenCalledWith(
      expect.stringContaining("async-card"),
    );
  });

  it("handles non-Error thrown values (string)", async () => {
    const fn = withErrorBoundary("str-card", async () => {
      throw "string error"; // intentional non-Error throw to test boundary robustness
    });
    const result = await fn();
    expect(result).toBeUndefined();
    expect(recordError).toHaveBeenCalledWith("string error", "card:str-card");
  });
});
