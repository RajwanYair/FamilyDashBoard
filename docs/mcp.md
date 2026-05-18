# 🤖 FamilyDashBoard — MCP Server Bridge (X11 / D1)

![MCP Server Bridge](../.github/assets/mcp.svg)

> **Status**: Shipped v14.0 · ADR-058 (design) · ADR-066 (impl plan)
>
> **Privacy guarantee**: zero network egress from the dashboard. The bridge
> uses `BroadcastChannel` — same-origin, in-browser only. No data ever leaves
> the device. CSP is unchanged.

---

## 📋 What it is

The MCP bridge exposes a read-only view of today's dashboard state so that
users' AI assistants (Claude, ChatGPT, etc.) can answer "what's on today"
without scraping the page or requiring any server-side session.

Architecture:

```text
AI assistant ──► Companion process (localhost:7411/mcp)
                         │
                BroadcastChannel("fdb-mcp")
                         │
                FamilyDashBoard tab (mcp-bridge.ts)
                         │
               CardSignalProtocol (read-only, frozen)
```

The **companion** (a separate, out-of-repo process) acts as the bridge between
the MCP HTTP interface and the dashboard's `BroadcastChannel`. The dashboard
itself never binds any TCP port.

---

## ⚡ How to enable

Append `?mcp=1` to the dashboard URL on initial page load:

```text
https://rajwanyair.github.io/FamilyDashBoard/?mcp=1
```

The `?mcp=1` flag is read **once** at page load. Removing or adding it after
load has no effect until the next reload. When absent, `mcp-bridge.ts` is
never imported — zero bytes, zero cost.

---

## 🧰 Available tools

| Tool               | Description                                          | Source card    |
| ------------------ | ---------------------------------------------------- | -------------- |
| `today.calendar`   | Next 5 calendar events (title, start, end, location) | `calendar`     |
| `today.hebrew_cal` | Active zmanim + next chag / Shabbat                  | `hebrew-cal`   |
| `today.alerts`     | Active security alerts (severity ≥ orange)           | `alerts`       |
| `today.weather`    | Current temperature + 24 h max/min + condition       | `weather`      |
| `today.countdown`  | Countdowns expiring within 24 h                      | `countdown`    |
| `today.synthesis`  | Daily AI synthesis tile text (X9)                    | `ai-synthesis` |

---

## 🔌 Wire protocol

The bridge listens on `BroadcastChannel("fdb-mcp")` for **request** messages
and posts **response** messages. Types are defined in
[`src/types/mcp.ts`](../src/types/mcp.ts).

### Request

```jsonc
{
  "type": "fdb-mcp/request",
  "id": "550e8400-e29b-41d4-a716-446655440000", // companion-generated UUID
  "tool": "today.weather",
  "args": {}, // optional
  "ts": 1746350400000, // companion clock (informational)
}
```

### Response — success

```jsonc
{
  "type": "fdb-mcp/response",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ok": true,
  "data": { "temp": 24, "condition": "Partly Cloudy", "maxTemp": 27, "minTemp": 18 },
  "ts": 1746350400123,
}
```

### Response — card not yet loaded

```jsonc
{
  "type": "fdb-mcp/response",
  "id": "...",
  "ok": false,
  "error": { "code": "NOT_READY", "message": "Card signal not yet available for today.weather" },
}
```

### Response — unknown tool

```jsonc
{
  "type": "fdb-mcp/response",
  "id": "...",
  "ok": false,
  "error": { "code": "UNKNOWN_TOOL", "message": "unknown tool: today.bogus" },
}
```

### Response — replay protection

Requests with a `id` already seen within the last 60 seconds are rejected:

```jsonc
{
  "type": "fdb-mcp/response",
  "id": "...",
  "ok": false,
  "error": { "code": "REPLAY", "message": "Duplicate request ID rejected." },
}
```

---

## 🔒 Security model

| Property                 | Detail                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Same-origin only**     | `BroadcastChannel` is scoped to the page's origin. A remote page cannot reach it.                                                           |
| **Read-only**            | The bridge only posts data snapshots. No dashboard state can be mutated.                                                                    |
| **Deep-frozen payloads** | All `data` objects are JSON-round-tripped and frozen (`Object.freeze`). The companion cannot mutate dashboard state via a shared reference. |
| **Replay protection**    | Seen request IDs are tracked for 60 s. A companion cannot replay a stale response.                                                          |
| **No telemetry**         | Tool invocations are **not** written to `diagLog()`. The diagnostic overlay never reveals that a companion is running.                      |
| **Zero network egress**  | The dashboard never opens a socket. All communication is in-process via the Channel API.                                                    |
| **Opt-in**               | `mcp-bridge.ts` is never imported unless `?mcp=1` was present on the initial URL.                                                           |

---

## 🔧 Building a companion

A reference companion is maintained as a separate project. It:

1. Subscribes to `BroadcastChannel("fdb-mcp")` via a shared-worker or
   `BroadcastChannel` in a Service Worker.
2. Exposes a local HTTP server on `localhost:7411` implementing the
   [MCP protocol](https://modelcontextprotocol.io/).
3. Translates each MCP tool call into a `fdb-mcp/request` message and
   returns the `fdb-mcp/response` payload to the AI assistant.

Until the companion is published, you can test the bridge directly from the
browser DevTools console:

```js
// Open two tabs of the dashboard with ?mcp=1
const ch = new BroadcastChannel("fdb-mcp");
ch.onmessage = (e) => console.log("response:", e.data);
ch.postMessage({
  type: "fdb-mcp/request",
  id: crypto.randomUUID(),
  tool: "today.weather",
  args: {},
  ts: Date.now(),
});
```

---

## 📝 Changelog

| Version | Notes                                                                   |
| ------- | ----------------------------------------------------------------------- |
| v14.0   | `mcp-bridge.ts` shipped; 6-tool surface; replay protection; deep-freeze |
| ADR-066 | Implementation plan; channel protocol; bundle-delta budget              |
| ADR-058 | Design decision; privacy model; companion architecture                  |
