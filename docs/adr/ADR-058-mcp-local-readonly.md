# ADR-058: D1 / X11 — Local MCP Read-Only Server (Design Spike)

- **Status**: Proposed (design only — implementation deferred to v14.x)
- **Date**: 2026-05-02 (v13.35.0 patch series)
- **Sprints**: 338
- **Related**: ADR-018 (CSP), ADR-002 (zero deps), ROADMAP §1.11 D1, §6 X11

## Context

ROADMAP item **D1** (and capability stream **X11**) calls for a local,
read-only Model Context Protocol (MCP) server that surfaces "today's
signals" — calendar, hebrew-cal, alerts, weather, countdown — so that a
user's local AI assistant (Claude Desktop, GitHub Copilot, etc.) can
ask the dashboard for context without screen-scraping or hitting any
upstream provider directly.

The dashboard is a static PWA with no backend. There is no place to
host a long-lived HTTP server inside the browser tab itself. A standard
implementation would require a desktop companion process — exactly the
shape of dependency this project has avoided since v1.

## Decision

**Adopt** D1 in v14.x with the following constraints. Implementation is
**not** part of v13.x.

### Surface

- Single endpoint: `http://localhost:7411/mcp`
- Loopback-only bind. Never reachable from a remote origin.
- Opt-in via the URL parameter `?mcp=1` on the dashboard. No background
  startup, no persistent process.
- Tool surface: `today.calendar`, `today.hebrew_cal`, `today.alerts`,
  `today.weather`, `today.countdown`. Read-only; no write tools.

### Hosting

- The server is hosted by a **separate, optional companion** under
  `MyScripts/mcp-bridge/` (out of repo scope). The dashboard does
  **not** ship a server; it only exposes a same-tab `BroadcastChannel`
  bridge (`fdb-mcp`) that the companion subscribes to.
- When `?mcp=1` is absent, the BroadcastChannel listener is never
  installed. Bundle delta target: ≤ 1 KB gzip.

### Privacy

- Zero network egress beyond the existing card data fetches.
- No telemetry on tool calls.
- CSP unchanged. The bridge uses `BroadcastChannel`, which is exempt
  from CSP `connect-src`.
- Localhost binding enforced at OS level by the companion; the
  dashboard never opens a socket itself.

### Security

- The bridge schema is published as a typed contract in
  `src/types/mcp.ts` (deferred to v14.x).
- Tool replies are deep-frozen `JSON.parse(JSON.stringify(...))` copies
  of card state — never live references — to prevent the companion
  from mutating dashboard state.
- Trusted Types policy unchanged: MCP traffic never reaches `innerHTML`.

## Consequences

- **Pro:** Aligns with the Comet/Granola pattern of "ambient context for
  user-controlled AI" without giving away network-egress surface.
- **Pro:** Loopback + opt-in URL parameter means zero risk to users who
  don't enable it.
- **Pro:** No new client dependency. `BroadcastChannel` is a platform
  primitive.
- **Con:** Requires an external companion to actually expose the MCP
  endpoint; the dashboard alone cannot. Tracked as a sibling repo.
- **Con:** `BroadcastChannel` is same-origin; companion must run in a
  same-origin browser context (e.g., a tiny service worker or a
  parallel hidden tab). Acceptable.

## Open Questions

- Should the companion be implemented as a tiny Cloudflare Worker
  served from `localhost:7411` via `wrangler dev`? Decision deferred.
- Whether to publish the MCP schema as a public OpenAPI document
  (currently leaning yes, with rate-limit note that loopback skips RL).

## References

- ROADMAP §1.11 D1
- ROADMAP §6 X11 (`src/core/mcp-server.ts` placeholder)
- ADR-018 (security headers — unchanged by this design)
- MCP spec: <https://modelcontextprotocol.io/>
