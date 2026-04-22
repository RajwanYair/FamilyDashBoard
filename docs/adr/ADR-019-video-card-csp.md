# ADR-019: Video-Card CSP Strategy & Integration Mode Decision Tree

**Date:** 2026-07-01  
**Status:** Accepted  
**Deciders:** Project maintainer  
**Relates to:** ADR-018 (CSP + COOP/COEP), ADR-002 (zero client deps)

---

## Context

Stream V11-CARD-VIDEO introduces the first video-content card to FamilyDashBoard.
A live news channel renders inside a `<video>` or `<iframe>` element.  Unlike the
existing data cards, a live stream:

1. Loads media bytes from third-party origins (HLS manifest + `.ts` segments)
2. May require relaxing `media-src`, `connect-src`, or `frame-src` in the CSP
3. May conflict with ADR-002 (zero runtime dependencies) if an HLS JS player is needed
4. Introduces a new autoplay/mute lifecycle that must not crash the rest of the dashboard

---

## Decision

### Integration Mode Preference

```
Mode A (native <video> + HLS) ──preferred──► Mode B (worker-proxied HLS)
                                               │
                                               └──► Mode D (vendored hls.js)
                                                       │
                                                       └──► Mode C (<iframe>)  ← last resort
```

| Mode | Condition                                            |
|------|------------------------------------------------------|
| A    | Provider stream is CORS-open for our GitHub Pages origin |
| B    | CORS blocked; stream is HLS and worker can proxy it  |
| D    | Mode A+B insufficient on Chromium (HLS not native)   |
| C    | Only if the provider only offers an official embed   |

The Cloudflare Worker free tier provides 10 GB/day egress — adequate for a
family home display watching a few hours per day at 3–5 Mb/s HLS quality.

### ADR-002 Exception (if Mode D is required)

If native `<video>` + HLS cannot work on Chromium (and Mode B worker-proxied
manifest still fails without a JS HLS client), `hls.js` may be vendored into
`src/vendor/hls.min.js`.

**This is an explicitly justified exception to ADR-002:**

- The library is vendored (committed to the repo), not fetched from npm or a CDN
- It is loaded only when `isWorkerEnabled() && hasNativeHls() === false`
- The bundle must remain under 35 KB gzip
- A unit test must assert the file is present and the SHA-256 hash matches

### CSP Policy Extensions

Each `StreamDescriptor` carries a `cspHosts` field that lists the hosts required
for that channel.  The video-news card must contribute these hosts to the
Content-Security-Policy **only when the card is enabled**.

Planned CSP additions when video-news is enabled (exact hosts TBD after research):

```
connect-src: 'self'  <worker-base>  <manifest-host>
media-src:   'self'  blob:          <segment-host>
frame-src:   'none'                 (stays 'none' unless Mode C)
```

Until the research sprint (v11.1-sprint-1) confirms the actual stream URLs,
the CSP is **not modified** — the video card remains `hidden: true` in the
default registry slot (opt-in only).

### Autoplay Policy

- `<video muted autoplay playsinline>` satisfies Chromium/Firefox/Safari autoplay policies
- If the browser blocks autoplay, the card shows a play-prompt overlay (single click to start)
- User preference (`defaultMuted: true`) is persisted in `DashboardConfig.cards["video-news"]`
- `prefers-reduced-motion: reduce` pauses the video and shows the poster

### Night Dimmer Integration

When the night dimmer activates (`nightDimmerActive` event), the video is paused
if `VideoNewsCardConfig.settings.pauseAtNight === true` (default).
The video resumes when the dimmer is dismissed.

### Service Worker

- HLS manifests: `Cache-Control: no-store` (always fresh)
- HLS segments: `Cache-Control: no-store` (expire in seconds; must not pollute SW cache)
- Poster images: `stale-while-revalidate`, 24 h TTL
- Worker route `/api/video/*`: `Cache-Control: no-store` for manifest/segments; KV only stores health metadata

---

## Consequences

1. The `video-news` card is **disabled by default** (`hidden: true` in registry)
2. Research sprint must confirm actual stream URLs before the card is usable
3. If Mode D is chosen, the repo gains a vendored `src/vendor/hls.min.js` file
   and a dedicated test asserting its SHA-256 hash
4. `docs/security.md` gains a "Video streams" section documenting the CSP allow-list
5. `docs/keyboard.md` gains `M` (mute toggle) and `V` (cycle channel) entries
6. VR baselines must be updated when the card reaches a renderable state
