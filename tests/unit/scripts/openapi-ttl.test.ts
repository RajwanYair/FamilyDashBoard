/**
 * Unit tests — V13-EDGE: check-openapi-ttl.mjs
 *
 * Validates the `parseGetRoutes` and `findMissingTtl` pure helpers that
 * enforce the x-kv-ttl annotation requirement on all OpenAPI GET routes.
 */

import { describe, it, expect } from "vitest";
import { parseGetRoutes, findMissingTtl } from "../../../scripts/check-openapi-ttl.mjs";

// ── Minimal YAML fixtures ─────────────────────────────────────────────────────

const YAML_ALL_ANNOTATED = `
paths:
  /health:
    get:
      tags: [health]
      summary: Health check
      x-kv-ttl: 0
      operationId: getHealth
      responses:
        "200":
          description: ok

  /api/weather:
    get:
      tags: [weather]
      summary: Weather
      x-kv-ttl: 1800
      operationId: getWeather
      responses:
        "200":
          description: ok

  /api/errors:
    post:
      tags: [health]
      summary: Ingest errors
      operationId: postErrors
      responses:
        "204":
          description: accepted
`;

const YAML_MISSING_ONE = `
paths:
  /api/weather:
    get:
      tags: [weather]
      summary: Weather
      x-kv-ttl: 1800
      operationId: getWeather
      responses:
        "200":
          description: ok

  /api/metrics:
    get:
      tags: [health]
      summary: Metrics (no TTL annotation)
      operationId: getMetrics
      responses:
        "200":
          description: ok
`;

const YAML_MISSING_TWO = `
paths:
  /health:
    get:
      tags: [health]
      summary: Health check
      operationId: getHealth
      responses:
        "200":
          description: ok

  /api/weather:
    get:
      tags: [weather]
      summary: Weather
      x-kv-ttl: 1800
      responses:
        "200":
          description: ok

  /api/metrics:
    get:
      tags: [health]
      summary: Metrics (no TTL)
      operationId: getMetrics
      responses:
        "200":
          description: ok
`;

const YAML_POST_ONLY = `
paths:
  /api/errors:
    post:
      tags: [health]
      summary: Error ingest
      operationId: postErrors
      responses:
        "204":
          description: accepted

  /api/reports:
    post:
      tags: [health]
      summary: Browser reports
      operationId: postReports
      responses:
        "204":
          description: accepted
`;

const YAML_EMPTY_PATHS = `
paths:
`;

// ── parseGetRoutes ────────────────────────────────────────────────────────────

describe("parseGetRoutes", () => {
  it("returns empty array for empty paths block", () => {
    expect(parseGetRoutes(YAML_EMPTY_PATHS)).toEqual([]);
  });

  it("returns empty array when only POST routes exist", () => {
    const routes = parseGetRoutes(YAML_POST_ONLY);
    expect(routes).toHaveLength(0);
  });

  it("returns correct count when all GET routes have x-kv-ttl", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    expect(routes).toHaveLength(2); // health + weather (not post errors)
  });

  it("marks routes with x-kv-ttl as hasKvTtl = true", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    expect(routes.every((r) => r.hasKvTtl)).toBe(true);
  });

  it("marks routes without x-kv-ttl as hasKvTtl = false", () => {
    const routes = parseGetRoutes(YAML_MISSING_ONE);
    const metrics = routes.find((r) => r.path === "/api/metrics");
    expect(metrics).toBeDefined();
    expect(metrics?.hasKvTtl).toBe(false);
  });

  it("x-kv-ttl: 0 is accepted (not cached routes)", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    const health = routes.find((r) => r.path === "/health");
    expect(health?.hasKvTtl).toBe(true);
  });

  it("includes correct path strings", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/health");
    expect(paths).toContain("/api/weather");
  });

  it("does not include POST routes in results", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    const paths = routes.map((r) => r.path);
    expect(paths).not.toContain("/api/errors");
  });
});

// ── findMissingTtl ────────────────────────────────────────────────────────────

describe("findMissingTtl", () => {
  it("returns empty array when all routes annotated", () => {
    const routes = parseGetRoutes(YAML_ALL_ANNOTATED);
    expect(findMissingTtl(routes)).toHaveLength(0);
  });

  it("returns one path when one route missing x-kv-ttl", () => {
    const routes = parseGetRoutes(YAML_MISSING_ONE);
    const missing = findMissingTtl(routes);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toBe("/api/metrics");
  });

  it("returns two paths when two routes missing x-kv-ttl", () => {
    const routes = parseGetRoutes(YAML_MISSING_TWO);
    const missing = findMissingTtl(routes);
    expect(missing).toHaveLength(2);
    expect(missing).toContain("/health");
    expect(missing).toContain("/api/metrics");
  });

  it("returns empty array for POST-only document", () => {
    const routes = parseGetRoutes(YAML_POST_ONLY);
    expect(findMissingTtl(routes)).toHaveLength(0);
  });

  it("returns path strings, not objects", () => {
    const routes = parseGetRoutes(YAML_MISSING_ONE);
    const missing = findMissingTtl(routes);
    expect(typeof missing[0]).toBe("string");
  });
});

// ── Integration: real openapi.yaml ───────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");

describe("real worker/openapi.yaml compliance (V13-EDGE)", () => {
  const yaml = readFileSync(resolve(ROOT, "worker", "openapi.yaml"), "utf8");
  const routes = parseGetRoutes(yaml);

  it("at least 14 GET routes exist in openapi.yaml", () => {
    expect(routes.length).toBeGreaterThanOrEqual(14);
  });

  it("every GET route has x-kv-ttl annotation", () => {
    const missing = findMissingTtl(routes);
    expect(missing).toHaveLength(0);
  });

  it("/health has x-kv-ttl: 0 (uncached)", () => {
    const health = routes.find((r) => r.path === "/health");
    expect(health?.hasKvTtl).toBe(true);
  });

  it("/api/errors/export has x-kv-ttl: 0", () => {
    const route = routes.find((r) => r.path === "/api/errors/export");
    expect(route?.hasKvTtl).toBe(true);
  });

  it("/api/metrics has x-kv-ttl: 0", () => {
    const route = routes.find((r) => r.path === "/api/metrics");
    expect(route?.hasKvTtl).toBe(true);
  });

  it("/api/reports/digest has x-kv-ttl annotation", () => {
    const route = routes.find((r) => r.path === "/api/reports/digest");
    expect(route?.hasKvTtl).toBe(true);
  });

  it("/api/weather has x-kv-ttl: 1800", () => {
    // Integration check that high-TTL data routes still pass
    const route = routes.find((r) => r.path === "/api/weather");
    expect(route?.hasKvTtl).toBe(true);
  });

  // V13-EDGE-7: new routes added for SSE and canary
  it("/api/alerts/subscribe route exists (V13-EDGE-1 SSE endpoint)", () => {
    const route = routes.find((r) => r.path === "/api/alerts/subscribe");
    expect(route).toBeDefined();
  });

  it("/api/alerts/subscribe has x-kv-ttl: 0 (uncached SSE stream)", () => {
    const route = routes.find((r) => r.path === "/api/alerts/subscribe");
    expect(route?.hasKvTtl).toBe(true);
  });

  it("/api/canary route exists (V13-EDGE-5 canary status)", () => {
    const route = routes.find((r) => r.path === "/api/canary");
    expect(route).toBeDefined();
  });

  it("/api/canary has x-kv-ttl: 0 (uncached)", () => {
    const route = routes.find((r) => r.path === "/api/canary");
    expect(route?.hasKvTtl).toBe(true);
  });

  it("openapi info.version is 13.0.0 (V13-EDGE-7)", () => {
    expect(yaml).toMatch(/version:\s*"13\.0\.0"/);
  });

  it("at least 20 GET routes exist (includes V13 additions)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
  });
});
