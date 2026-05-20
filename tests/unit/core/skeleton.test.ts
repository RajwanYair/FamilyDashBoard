/**
 * Tests for src/core/skeleton.ts — Skeleton Loading Utility (S61)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { showSkeleton, hideSkeleton, hasActiveSkeleton } from "@/core/skeleton";

describe("Skeleton loading utility (S61)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("injects skeleton with shimmer spans", () => {
    showSkeleton(container, 3);
    const skel = container.querySelector(".card-skeleton");
    expect(skel).not.toBeNull();
    expect(skel!.children).toHaveLength(3);
    expect(skel!.getAttribute("aria-busy")).toBe("true");
  });

  it("does not duplicate skeleton on repeated calls", () => {
    showSkeleton(container);
    showSkeleton(container);
    const skeletons = container.querySelectorAll(".card-skeleton");
    expect(skeletons).toHaveLength(1);
  });

  it("hideSkeleton removes the skeleton element", () => {
    showSkeleton(container);
    expect(hasActiveSkeleton(container)).toBe(true);
    hideSkeleton(container);
    expect(hasActiveSkeleton(container)).toBe(false);
    expect(container.querySelector(".card-skeleton")).toBeNull();
  });

  it("hideSkeleton is no-op when no skeleton present", () => {
    expect(() => hideSkeleton(container)).not.toThrow();
  });

  it("hasActiveSkeleton returns false initially", () => {
    expect(hasActiveSkeleton(container)).toBe(false);
  });

  it("defaults to 4 lines", () => {
    showSkeleton(container);
    const skel = container.querySelector(".card-skeleton")!;
    expect(skel.children).toHaveLength(4);
  });
});
