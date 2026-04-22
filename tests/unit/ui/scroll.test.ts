/**
 * Tests for src/ui/scroll.ts
 *
 * Covers: injectScrollKeyframes, startCloneScroll, startSimpleScroll, stopScroll,
 *         initScrollShadows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  injectScrollKeyframes,
  startCloneScroll,
  startSimpleScroll,
  stopScroll,
  initScrollShadows,
} from "@/ui/scroll";

// ── injectScrollKeyframes ──

describe("Scroll — injectScrollKeyframes", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("creates a style element in document.head", () => {
    injectScrollKeyframes("test-style-id", "testScroll", 200);
    expect(document.getElementById("test-style-id")).toBeTruthy();
  });

  it("the style element tag is STYLE", () => {
    injectScrollKeyframes("kf-test", "kfAnim", 300);
    const el = document.getElementById("kf-test");
    expect(el?.tagName.toLowerCase()).toBe("style");
  });

  it("textContent contains the keyframe name", () => {
    injectScrollKeyframes("kf-name-test", "myScrollAnim", 150);
    const el = document.getElementById("kf-name-test");
    expect(el?.textContent).toContain("myScrollAnim");
  });

  it("textContent contains the distance", () => {
    injectScrollKeyframes("kf-dist-test", "distScroll", 420);
    const el = document.getElementById("kf-dist-test");
    expect(el?.textContent).toContain("420");
  });

  it("reuses existing style element on second call", () => {
    injectScrollKeyframes("reuse-style", "reusedAnim", 100);
    injectScrollKeyframes("reuse-style", "reusedAnim", 200);
    const all = document.querySelectorAll("#reuse-style");
    expect(all).toHaveLength(1);
  });

  it("updates textContent on reuse", () => {
    injectScrollKeyframes("update-style", "updateAnim", 100);
    injectScrollKeyframes("update-style", "updateAnim", 999);
    const el = document.getElementById("update-style");
    expect(el?.textContent).toContain("999");
  });
});

// ── startCloneScroll ──

describe("Scroll — startCloneScroll", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.head.innerHTML = "";
    container = document.createElement("div");
    container.id = "scroll-container";

    // Add child items with real content so scrollHeight > 0
    for (let i = 0; i < 5; i++) {
      const item = document.createElement("div");
      item.className = "scroll-item";
      item.textContent = `Item ${i}`;
      item.style.height = "50px";
      container.appendChild(item);
    }
    document.body.appendChild(container);

    // Stub scrollHeight for happy-dom (layout engine doesn't compute it)
    Object.defineProperty(container, "scrollHeight", {
      value: 250,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.head.innerHTML = "";
  });

  it("appends a clone child to container", () => {
    const before = container.children.length;
    startCloneScroll(container, "cloneAnim", 10);
    expect(container.children.length).toBeGreaterThan(before);
  });

  it("the clone has aria-hidden=true", () => {
    startCloneScroll(container, "cloneAriaAnim", 10);
    const clone = container.querySelector(".clone");
    expect(clone?.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets animation on container", () => {
    startCloneScroll(container, "containerAnim", 10);
    expect(container.style.animation).toContain("containerAnim");
  });

  it("injects a keyframe style into head", () => {
    startCloneScroll(container, "kfCloneAnim", 5);
    const style = document.getElementById("kfCloneAnim-style");
    expect(style).toBeTruthy();
  });

  it("removes existing clones before adding new ones", () => {
    startCloneScroll(container, "cleanAnim", 10);
    startCloneScroll(container, "cleanAnim", 10);
    const clones = container.querySelectorAll(".clone");
    // Only one set of clones should exist
    expect(clones.length).toBeLessThanOrEqual(5);
  });

  it("does nothing when scrollHeight < 10", () => {
    Object.defineProperty(container, "scrollHeight", {
      value: 5,
      configurable: true,
    });
    const before = container.children.length;
    startCloneScroll(container, "noopAnim", 10);
    expect(container.children.length).toBe(before);
  });
});

// ── startSimpleScroll ──

describe("Scroll — startSimpleScroll", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.head.innerHTML = "";
    container = document.createElement("div");
    container.style.height = "100px";
    container.style.overflow = "hidden";
    document.body.appendChild(container);

    for (let i = 0; i < 10; i++) {
      const item = document.createElement("div");
      item.style.height = "30px";
      item.textContent = `Row ${i}`;
      container.appendChild(item);
    }

    // Stub layout values
    Object.defineProperty(container, "scrollHeight", {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 100,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.head.innerHTML = "";
  });

  it("sets animation on container", () => {
    startSimpleScroll(container, "simpleAnim", 8);
    expect(container.style.animation).toContain("simpleAnim");
  });

  it("animation contains alternate keyword", () => {
    startSimpleScroll(container, "altAnim", 8);
    expect(container.style.animation).toContain("alternate");
  });

  it("injects a keyframe style into head", () => {
    startSimpleScroll(container, "simpleKfAnim", 5);
    expect(document.getElementById("simpleKfAnim-style")).toBeTruthy();
  });

  it("does nothing when scrollDistance < 10", () => {
    Object.defineProperty(container, "scrollHeight", {
      value: 105,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      value: 100,
      configurable: true,
    });
    startSimpleScroll(container, "noSimpleAnim", 8);
    expect(container.style.animation).toBeFalsy();
  });
});

// ── stopScroll ──

describe("Scroll — stopScroll", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.head.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);

    // Pre-add clone and animation
    const clone = document.createElement("div");
    clone.className = "clone";
    container.appendChild(clone);
    container.style.animation = "someAnim 5s linear infinite";

    Object.defineProperty(container, "scrollHeight", {
      value: 200,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("clears animation style", () => {
    stopScroll(container);
    expect(container.style.animation).toBe("none");
  });

  it("removes clone elements", () => {
    stopScroll(container);
    expect(container.querySelectorAll(".clone").length).toBe(0);
  });

  it("does not throw on empty container", () => {
    container.innerHTML = "";
    container.style.animation = "";
    expect(() => stopScroll(container)).not.toThrow();
  });
});

// ── initScrollShadows ──

describe("Scroll — initScrollShadows", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw with no card bodies in DOM", () => {
    expect(() => initScrollShadows()).not.toThrow();
  });

  it("attaches scroll listener to .card__body elements", () => {
    const body = document.createElement("div");
    body.className = "card__body";
    body.style.overflow = "auto";
    document.body.appendChild(body);
    expect(() => initScrollShadows()).not.toThrow();
  });

  it("sets scroll-top class when scrollTop > 4", () => {
    const body = document.createElement("div");
    body.className = "card__body";
    Object.defineProperty(body, "scrollTop", { value: 10, configurable: true });
    Object.defineProperty(body, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(body, "clientHeight", { value: 200, configurable: true });
    document.body.appendChild(body);
    initScrollShadows();
    expect(body.classList.contains("scroll-top")).toBe(true);
  });

  it("does not set scroll-top class when scrollTop <= 4", () => {
    const body = document.createElement("div");
    body.className = "card__body";
    Object.defineProperty(body, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(body, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(body, "clientHeight", { value: 200, configurable: true });
    document.body.appendChild(body);
    initScrollShadows();
    expect(body.classList.contains("scroll-top")).toBe(false);
  });

  it("sets scroll-bottom class when content overflows below", () => {
    const body = document.createElement("div");
    body.className = "card__body";
    Object.defineProperty(body, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(body, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(body, "clientHeight", { value: 200, configurable: true });
    document.body.appendChild(body);
    initScrollShadows();
    expect(body.classList.contains("scroll-bottom")).toBe(true);
  });

  it("handles multiple card bodies without error", () => {
    for (let i = 0; i < 5; i++) {
      const body = document.createElement("div");
      body.className = "card__body";
      document.body.appendChild(body);
    }
    expect(() => initScrollShadows()).not.toThrow();
  });
});
