/**
 * Tests for src/core/links.ts — Sprint 216 / X3 semantic-link service.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerLink, getLinks, clearLinks } from "@/core/links";

vi.mock("@/core/config", () => ({
  loadConfig: vi.fn(() => ({ semanticLinksEnabled: true })),
}));
import { loadConfig } from "@/core/config";

describe("Semantic links — registerLink / getLinks (Sprint 216 / X3)", () => {
  beforeEach(() => {
    clearLinks();
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: true } as never);
  });

  it("getLinks returns empty array when no links registered", () => {
    expect(getLinks("stocks")).toEqual([]);
  });

  it("registerLink + getLinks returns the registered link", () => {
    const resolver = () => "stocks→weather";
    registerLink("stocks", "weather", resolver);
    const links = getLinks("stocks");
    expect(links).toHaveLength(1);
    expect(links[0]?.fromCardId).toBe("stocks");
    expect(links[0]?.toCardId).toBe("weather");
    expect(links[0]?.resolver).toBe(resolver);
  });

  it("getLinks only returns links from the requested cardId", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("news", "weather", () => null);
    expect(getLinks("stocks")).toHaveLength(1);
    expect(getLinks("news")).toHaveLength(1);
    expect(getLinks("weather")).toHaveLength(0);
  });

  it("re-registering same direction replaces the resolver", () => {
    const res1 = () => "v1";
    const res2 = () => "v2";
    registerLink("stocks", "weather", res1);
    registerLink("stocks", "weather", res2);
    const links = getLinks("stocks");
    expect(links).toHaveLength(1);
    expect(links[0]?.resolver).toBe(res2);
  });

  it("clearLinks removes all registered links", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("news", "calendar", () => null);
    clearLinks();
    expect(getLinks("stocks")).toEqual([]);
    expect(getLinks("news")).toEqual([]);
  });

  it("getLinks returns empty array when semanticLinksEnabled is false", () => {
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: false } as never);
    registerLink("stocks", "weather", () => "data");
    expect(getLinks("stocks")).toEqual([]);
  });

  it("resolver is callable and returns expected value", () => {
    registerLink("stocks", "weather", () => "sunny");
    const links = getLinks("stocks");
    expect(links[0]?.resolver()).toBe("sunny");
  });

  it("multiple links from the same card are all returned", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("stocks", "calendar", () => null);
    registerLink("stocks", "news", () => null);
    expect(getLinks("stocks")).toHaveLength(3);
  });
});
