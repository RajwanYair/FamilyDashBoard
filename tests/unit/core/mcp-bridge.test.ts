/**
 * Tests for MCP bridge — D1/X11 (ADR-066, v14.0)
 *
 * Uses happy-dom's BroadcastChannel implementation (present in happy-dom ≥ 3).
 * Each test calls closeMcpBridge() in beforeEach to reset module state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initMcpBridge,
  closeMcpBridge,
  isMcpActive,
  dispatchTool,
  deepFreezeJson,
} from "@/core/mcp-bridge";
import type { McpRequest, McpResponse } from "@/types/mcp";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/card-signal-protocol", () => ({
  getCardSignal: vi.fn(),
}));

import { getCardSignal } from "@/core/card-signal-protocol";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<McpRequest> = {}): McpRequest {
  return {
    type: "fdb-mcp/request",
    id: crypto.randomUUID(),
    tool: "today.weather",
    ts: Date.now(),
    ...overrides,
  };
}

function sendRequest(req: McpRequest): void {
  const channel = new BroadcastChannel("fdb-mcp");
  channel.postMessage(req);
  channel.close();
}

async function collectResponse(timeoutMs = 200): Promise<McpResponse | null> {
  return new Promise((resolve) => {
    const ch = new BroadcastChannel("fdb-mcp");
    const timer = setTimeout(() => {
      ch.close();
      resolve(null);
    }, timeoutMs);
    ch.onmessage = (e: MessageEvent<McpResponse>) => {
      clearTimeout(timer);
      ch.close();
      resolve(e.data);
    };
  });
}

// ── deepFreezeJson ────────────────────────────────────────────────────────────

describe("deepFreezeJson", () => {
  it("returns a frozen object", () => {
    const obj = { a: 1, b: { c: 2 } };
    const frozen = deepFreezeJson(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("deep-freezes nested objects", () => {
    const obj = { nested: { value: 42 } };
    const frozen = deepFreezeJson(obj);
    expect(Object.isFrozen(frozen.nested)).toBe(true);
  });

  it("strips non-JSON-serialisable values (functions)", () => {
    const obj = { fn: () => 1, val: 2 };
    const frozen = deepFreezeJson(obj as unknown as Record<string, unknown>);
    expect((frozen as Record<string, unknown>).fn).toBeUndefined();
    expect((frozen as Record<string, unknown>).val).toBe(2);
  });

  // cover line 53 — array path in deepFreezeAll
  it("deep-freezes arrays and array elements (line 53 coverage)", () => {
    const arr = [{ x: 1 }, { y: 2 }];
    const frozen = deepFreezeJson(arr);
    expect(Array.isArray(frozen)).toBe(true);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen[0])).toBe(true);
  });
});

// ── dispatchTool ──────────────────────────────────────────────────────────────

describe("dispatchTool", () => {
  beforeEach(() => {
    vi.mocked(getCardSignal).mockReturnValue(null);
  });

  it("returns null when signal not yet set", () => {
    expect(dispatchTool("today.weather")).toBeNull();
  });

  it("returns frozen payload when signal exists", () => {
    vi.mocked(getCardSignal).mockReturnValue({
      v: 1,
      cardId: "weather",
      key: "current",
      value: { temperature: 22 },
      ts: Date.now(),
    });
    const result = dispatchTool("today.weather");
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("throws for an unknown tool name", () => {
    expect(() => dispatchTool("today.unknown" as Parameters<typeof dispatchTool>[0])).toThrow(
      "unknown tool",
    );
  });

  it("dispatches all 6 known tools without throwing (null signals)", () => {
    const tools = [
      "today.calendar",
      "today.hebrew_cal",
      "today.alerts",
      "today.weather",
      "today.countdown",
      "today.synthesis",
    ] as Parameters<typeof dispatchTool>[0][];

    for (const tool of tools) {
      expect(() => dispatchTool(tool)).not.toThrow();
    }
  });

  // cover signal-available path for alerts, countdown, synthesis (lines 97, 107, 112)
  it.each([
    ["today.alerts", "alerts", "active"],
    ["today.countdown", "countdown", "items"],
    ["today.synthesis", "ai-synthesis", "synthesis"],
    ["today.calendar", "calendar", "events"],
    ["today.hebrew_cal", "hebrew-cal", "zmanim"],
  ] as const)("%s returns frozen payload when card signal is set", (tool, cardId, key) => {
    vi.mocked(getCardSignal).mockReturnValue({
      v: 1,
      cardId,
      key,
      value: { data: "test" },
      ts: Date.now(),
    });
    const result = dispatchTool(tool);
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ── initMcpBridge / closeMcpBridge / isMcpActive ─────────────────────────────

describe("bridge lifecycle", () => {
  beforeEach(() => {
    closeMcpBridge();
  });
  afterEach(() => {
    closeMcpBridge();
  });

  it("isMcpActive() is false before init", () => {
    expect(isMcpActive()).toBe(false);
  });

  it("isMcpActive() is true after init", () => {
    initMcpBridge();
    expect(isMcpActive()).toBe(true);
  });

  it("returns the same channel on repeated init calls", () => {
    const ch1 = initMcpBridge();
    const ch2 = initMcpBridge();
    expect(ch1).toBe(ch2);
  });

  it("isMcpActive() is false after close", () => {
    initMcpBridge();
    closeMcpBridge();
    expect(isMcpActive()).toBe(false);
  });
});

// ── Request/response roundtrip ───────────────────────────────────────────────

describe("request roundtrip", () => {
  beforeEach(() => {
    closeMcpBridge();
    vi.mocked(getCardSignal).mockReturnValue(null);
  });
  afterEach(() => {
    closeMcpBridge();
  });

  it("responds with NOT_READY when card signal is null", async () => {
    initMcpBridge();
    sendRequest(makeRequest({ tool: "today.weather" }));
    const resp = await collectResponse();
    expect(resp).not.toBeNull();
    expect(resp!.ok).toBe(false);
    expect(resp!.error?.code).toBe("NOT_READY");
  });

  it("responds with ok:true and frozen data when card signal is set", async () => {
    vi.mocked(getCardSignal).mockReturnValue({
      v: 1,
      cardId: "weather",
      key: "current",
      value: { temp: 24 },
      ts: Date.now(),
    });
    initMcpBridge();
    const req = makeRequest({ tool: "today.weather" });
    sendRequest(req);
    const resp = await collectResponse();
    expect(resp?.ok).toBe(true);
    expect(resp?.id).toBe(req.id);
    // Note: structured clone via BroadcastChannel creates a new plain object,
    // so Object.isFrozen is always false on the receiver side. Verify data shape instead.
    expect(resp?.data).toMatchObject({ temp: 24 });
  });

  it("responds with UNKNOWN_TOOL for an unrecognized tool", async () => {
    initMcpBridge();
    sendRequest(makeRequest({ tool: "today.bogus" as Parameters<typeof dispatchTool>[0] }));
    const resp = await collectResponse();
    expect(resp?.ok).toBe(false);
    expect(resp?.error?.code).toBe("UNKNOWN_TOOL");
  });

  it("ignores malformed messages (no type field)", async () => {
    initMcpBridge();
    const ch = new BroadcastChannel("fdb-mcp");
    ch.postMessage({ foo: "bar" });
    ch.close();
    const resp = await collectResponse(120);
    expect(resp).toBeNull();
  });

  // cover line 138 — handleMessage early-return when id/tool fields are invalid
  it("ignores request with empty string id (line 138 coverage)", async () => {
    initMcpBridge();
    const ch = new BroadcastChannel("fdb-mcp");
    ch.postMessage({ type: "fdb-mcp/request", id: "", tool: "today.weather", ts: Date.now() });
    ch.close();
    const resp = await collectResponse(120);
    expect(resp).toBeNull();
  });

  it("ignores request with non-string tool (line 138 coverage)", async () => {
    initMcpBridge();
    const ch = new BroadcastChannel("fdb-mcp");
    ch.postMessage({ type: "fdb-mcp/request", id: "abc-123", tool: 42, ts: Date.now() });
    ch.close();
    const resp = await collectResponse(120);
    expect(resp).toBeNull();
  });

  it("rejects a replayed request ID (REPLAY error)", async () => {
    initMcpBridge();
    const req = makeRequest({ tool: "today.weather" });
    // Send once
    sendRequest(req);
    await collectResponse(); // drain first response
    // Send again with same ID
    sendRequest(req);
    const resp2 = await collectResponse();
    expect(resp2?.ok).toBe(false);
    expect(resp2?.error?.code).toBe("REPLAY");
  });
});
