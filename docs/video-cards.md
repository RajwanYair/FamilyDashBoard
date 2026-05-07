# Video News Card — FamilyDashBoard

> A live Israeli news stream embedded in the dashboard.
> Default state: **disabled** (opt-in via Settings → Cards).

---

## Overview

The **video-news** card renders a muted, auto-playing live news channel from a
configurable list of Israeli news channels:

| Channel  | Hebrew name | Default |
| -------- | ----------- | ------- |
| `c14`    | ערוץ 14     | ✅ Yes  |
| `i24`    | i24NEWS     | No      |
| `now14`  | NOW14       | No      |
| `arutz7` | ערוץ 7      | No      |

The card is hidden by default to avoid CSP/bandwidth overhead for users who
don't need it. Enable it from **Settings → Cards → ערוץ חדשות**.

---

## Keyboard Shortcuts

| Key | Action                     |
| --- | -------------------------- |
| `M` | Toggle mute / unmute audio |
| `V` | Cycle to next channel      |

The mute button (`🔇 / 🔊`) and channel-cycle button (`📡`) are also clickable
on-screen.

---

## Configuration

Open **Settings (S) → Cards** and enable the video-news card. Available settings
(accessible in the card's config section):

| Setting                | Type    | Default | Description                                           |
| ---------------------- | ------- | ------- | ----------------------------------------------------- |
| `channel`              | select  | `c14`   | Active channel                                        |
| `autoplay`             | boolean | `true`  | Start playing when the card initialises               |
| `defaultMuted`         | boolean | `true`  | Required by browser autoplay policy                   |
| `showOverlay`          | boolean | `true`  | RTL caption strip at the bottom of the video          |
| `pauseOnReducedMotion` | boolean | `true`  | Pause when `prefers-reduced-motion: reduce` is active |
| `pauseAtNight`         | boolean | `true`  | Pause during the night-dimmer schedule                |

---

## Stream Integration Status

> Stream URLs for all channels are **pending research** (deferred to v15).
> The card currently renders a "Stream URL pending research" state.
> Once actual `.m3u8` URLs and CORS policy are confirmed, the
> adapter file (`src/cards/video-news/video-news-adapter.ts`) must be updated.

### Research checklist per channel

1. Inspect the provider's `/live` page in DevTools → Network tab
2. Document the stream URL, its CORS headers, `Referer`/`Origin` requirements, and token expiry
3. Verify HLS (`Access-Control-Allow-Origin` permits `https://rajwanyair.github.io`)
4. If CORS blocks direct play, enable **worker proxy** (Mode B: `/api/video/<id>/manifest.m3u8`)
5. Record the stream manifest host and segment host in the `cspHosts` field of the descriptor
6. Test on Chromium (Chrome/Edge) — HLS is not native and may require a JS player (Mode D)
7. Check the provider's Terms of Service (personal/non-commercial embedding)

---

## Integration Modes

| Mode                  | Mechanism                                   | When used                         |
| --------------------- | ------------------------------------------- | --------------------------------- |
| A — `hls`             | Native `<video src=".m3u8">`                | CORS open, HLS native (Safari)    |
| B — `worker-hls`      | Worker proxy `/api/video/c14/manifest.m3u8` | CORS blocked                      |
| C — `iframe`          | Provider embed `<iframe>`                   | Only if no HLS available          |
| D — vendored `hls.js` | `src/vendor/hls.min.js`                     | Chromium + no CORS + Mode B fails |

See [ADR-019](adr/ADR-019-video-card-csp.md) for the full decision tree.

---

## Error States

| State                     | UI                                                        |
| ------------------------- | --------------------------------------------------------- |
| Stream unavailable        | Poster + "שידור לא זמין · נסיון חוזר בקרוב"               |
| Stream URL not configured | "שידור בבנייה · Stream URL pending research"              |
| Autoplay blocked          | Large ▶ overlay — single click starts playback            |
| Offline                   | Poster shown; no retry while `navigator.onLine === false` |

Retry schedule: 30 s → 2 min → 10 min (3 attempts total then gives up).

---

## Architecture

```text
src/cards/video-news/
├── fdb-video-news.ts      FdbCard custom element — DOM scaffold, connect/disconnect lifecycle
├── video-news.ts          Player wiring, channel/mute state, retry logic, reduced-motion
├── video-news.css         Aspect-ratio container, overlay, controls, error state
└── video-news-adapter.ts  StreamDescriptor per channel (URLs + CSP hosts)

src/types/stream.ts        StreamDescriptor + VideoChannelId types
tests/unit/cards/video-news.test.ts   Unit tests (adapter + headless state)
docs/adr/ADR-019-video-card-csp.md    Decision record
```

---

## See Also

- [ADR-019: Video-Card CSP Strategy](adr/ADR-019-video-card-csp.md)
- [ADR-045: Document PiP for video-news (Gated)](adr/ADR-045-document-pip-video-news.md)
- [ADR-002: Zero Client-Side Runtime Dependencies](adr/ADR-002-zero-client-deps.md)
- [docs/keyboard.md](keyboard.md) — M/V keyboard shortcuts
- [docs/security.md](security.md) — CSP policy

---

## Picture-in-Picture (Planned — Gated)

> **Status**: Gated on 3 user requests. See [ADR-045](adr/ADR-045-document-pip-video-news.md).

The [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)
would let the video-news card pop out into an always-on-top floating window while
the user continues to interact with the rest of the dashboard.

### What it would look like

- A **PiP button** appears in the video-news card header (Chrome 116+ only).
- Clicking it opens a floating mini-window with the live stream + RTL caption
  strip + mute/channel buttons — all using the active dashboard theme.
- The main layout resumes normally while the stream plays in PiP.

### Why it's gated

Document PiP is Chromium-only (Chrome/Edge 116+). Until 3+ distinct users
request it, the complexity trade-off (element-move lifecycle, keyboard
reassignment, CSP review) isn't justified. Standard video PiP (native browser
button on `<video>`) continues to work without any code changes.

### To request this feature

Open a GitHub issue with the title `[Feature Request] PiP for video-news` and
reference ADR-045. Once the gate is met, the ADR moves to Active and a sprint
is scheduled.
