# ADR-066: X11 — MCP Server Implementation Plan (Refinement of ADR-058)

- **Status**: Proposed (refines ADR-058 with concrete v14.x file plan)
- **Date**: 2026-05-04 (v13.37.0 patch series)
- **Sprints**: 355
- **Related**: ADR-058 (D1 design), ROADMAP §4.1 X11

## Context

ADR-058 defined the **what** and **why** of D1 / X11: a localhost MCP
read-only bridge with zero egress, opt-in via `?mcp=1`, hosted by an
out-of-repo companion, communicating over `BroadcastChannel`. This
ADR refines the **how** — the concrete file plan, channel protocol,
and bundle delta budget — so v14.x implementation can begin without
re-litigating the design.

## Decision

### File plan (in-repo)

```text
src/core/
  mcp-bridge.ts            # ~120 LoC, gated by ?mcp=1
  mcp-bridge.types.ts      # exported envelope + tool schemas
src/types/
  mcp.ts                   # public contract (re-exports)
tests/unit/core/
  mcp-bridge.test.ts       # ≥ 8 tests (init, opt-out, request/response, tool dispatch, error envelope, deep-freeze, replay attack, channel close)
docs/
  mcp.md                   # operator guide; companion sample link
```

### Channel protocol

Single `BroadcastChannel` named `fdb-mcp`. Messages are JSON objects
with discriminated unions:

```ts
type McpRequest = {
  type: "fdb-mcp/request";
  id: string; // companion-generated UUID
  tool: McpToolName; // see Tool surface below
  args?: Record<string, unknown>;
  ts: number; // companion clock; informational
};

type McpResponse = {
  type: "fdb-mcp/response";
  id: string; // mirrors request.id
  ok: boolean;
  data?: unknown; // deep-frozen JSON copy of card state
  error?: { code: string; message: string };
  ts: number; // dashboard clock
};
```

The dashboard listens for `fdb-mcp/request` only when `?mcp=1` was
present **on the initial page load**. Toggling at runtime is not
supported (avoids a config-panel surface).

### Tool surface (v14.x initial)

| Tool               | Returns                                     | Source card    |
| ------------------ | ------------------------------------------- | -------------- |
| `today.calendar`   | next 5 events (title, start, end, location) | `calendar`     |
| `today.hebrew_cal` | active zmanim + next chag/Shabbat           | `hebrew-cal`   |
| `today.alerts`     | active alerts (severity ≥ orange)           | `alerts`       |
| `today.weather`    | current temp + 24h max/min + condition      | `weather`      |
| `today.countdown`  | countdowns < 24h                            | `countdown`    |
| `today.synthesis`  | the daily AI synthesis (X9 shipped)         | `ai-synthesis` |

### Privacy + Security

- **Deep-freeze** every response payload via
  `Object.freeze(JSON.parse(JSON.stringify(state)))`. Companion cannot
  mutate dashboard state through the bridge.
- **No request logging**. Tool calls do not appear in `diagLog()`
  output. (Diag overlay would otherwise leak that an MCP companion
  is running.)
- **Origin guard**: `BroadcastChannel` is same-origin by definition.
  Reject any request whose `id` looks like a UUID we issued (replay
  protection — companion-only IDs).
- **CSP unchanged**: `BroadcastChannel` does not use any
  `connect-src`-policed transport.

### Bundle delta budget

- `mcp-bridge.ts` ≤ **1 KB gzip** when active.
- When `?mcp=1` is absent, **zero bytes** are loaded — `main.ts`
  uses `if (params.has("mcp")) { import("./core/mcp-bridge.ts") }`.
- Bundle CI gate: per-card hard-cap unaffected (mcp-bridge is core,
  not a card).

### Testing

- ≥ 8 unit tests covering init / opt-out / request roundtrip /
  unknown tool / malformed request / deep-freeze / channel close /
  duplicate request ID.
- One integration test that simulates a companion via a worker stub
  and asserts the envelope shape end-to-end.

## Consequences

- **Pro:** A v14.x contributor can open ADR-066 + ADR-058 and start
  implementing without further design work.
- **Pro:** The `?mcp=1` lazy-load means the dashboard pays zero cost
  by default — the privacy-conscious posture is enforced by the
  build, not by discipline.
- **Con:** Companion is still out-of-scope for this repo. Without a
  reference companion, X11 is a partial feature. Tracked as a
  sibling-repo bootstrap in v14.x planning.

## Open Questions

- Whether `today.synthesis` should be cached for N seconds to avoid
  re-running the synthesizer on every assistant query. Default: yes,
  60 s TTL. Confirm at implementation.

## References

- ADR-058 (D1 design, the **what**)
- ROADMAP §4.1 X11
- MCP spec: <https://modelcontextprotocol.io/>
- `src/core/snapshot.ts` (X8 — analogous opt-in side-channel pattern)
