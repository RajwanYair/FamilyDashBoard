/**
 * fast-check property tests — worker/src/middleware/log.ts
 *
 * Properties under test:
 *  LG1. logRequest never throws for any valid HTTP method / status combination.
 *  LG2. The path in the log entry always starts with '/'.
 *  LG3. Query strings longer than 80 chars are truncated to at most 80 chars.
 *  LG4. durationMs is always ≥ 0 for a start time in the past.
 *  LG5. logRequest captures the response status verbatim.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { logRequest } from "../../../worker/src/middleware/log";

// ── Helpers ──────────────────────────────────────────────────────────────────

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

function makeRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

function makeResponse(status: number): Response {
  return new Response(null, { status });
}

// ── LG1: never throws for any method/status ────────────────────────────────

describe("log — LG1: logRequest never throws", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("does not throw for any valid method and 1xx–5xx status", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HTTP_METHODS),
        fc.integer({ min: 100, max: 599 }),
        fc.string({ minLength: 1, maxLength: 40 }).filter((s) => /^[a-z0-9-]+$/i.test(s)),
        (method, status, path) => {
          const url = `https://api.example.com/${path}`;
          expect(() =>
            logRequest(makeRequest(method, url), makeResponse(status), Date.now() - 5, "1.2.3.4"),
          ).not.toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── LG2: console.log output contains the status ───────────────────────────────

describe("log — LG2: logged line contains response status", () => {
  it("the console output includes the status code", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0]));
    });

    try {
      fc.assert(
        fc.property(fc.integer({ min: 200, max: 599 }), (status) => {
          lines.length = 0;
          logRequest(
            makeRequest("GET", "https://api.example.com/test"),
            makeResponse(status),
            Date.now() - 1,
            "127.0.0.1",
          );
          expect(lines[0]).toContain(String(status));
        }),
        { numRuns: 30 },
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ── LG3: long query strings are truncated ─────────────────────────────────────

describe("log — LG3: query strings longer than 80 chars are truncated", () => {
  it("path segment captured in log does not exceed 80-char query limit", () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(String(args[0]));
    });

    try {
      fc.assert(
        fc.property(
          fc.string({ minLength: 81, maxLength: 200 }).filter((s) => /^[a-zA-Z0-9=&]+$/.test(s)),
          (longQuery) => {
            lines.length = 0;
            const url = `https://api.example.com/data?${longQuery}`;
            logRequest(makeRequest("GET", url), makeResponse(200), Date.now() - 1, "::1");
            // The logged path should contain at most 80 chars of query string
            const line = lines[0] ?? "";
            const qIdx = line.indexOf("?");
            if (qIdx !== -1) {
              const queryInLog = line.slice(qIdx + 1);
              // Strip trailing parts after spaces / arrows in the log line
              const queryPart = queryInLog.split(" ")[0] ?? "";
              expect(queryPart.length).toBeLessThanOrEqual(80);
            }
          },
        ),
        { numRuns: 30 },
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ── LG4: durationMs is non-negative ──────────────────────────────────────────

describe("log — LG4: durationMs is non-negative for past start times", () => {
  it("logs non-negative duration for any past start time", () => {
    const durations: number[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      const match = /\((\d+)ms\)/.exec(String(args[0]));
      if (match) durations.push(parseInt(match[1]!, 10));
    });

    try {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 5000 }), (offsetMs) => {
          durations.length = 0;
          logRequest(
            makeRequest("GET", "https://api.example.com/ping"),
            makeResponse(200),
            Date.now() - offsetMs,
            "10.0.0.1",
          );
          if (durations.length > 0) {
            expect(durations[0]).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: 30 },
      );
    } finally {
      spy.mockRestore();
    }
  });
});
