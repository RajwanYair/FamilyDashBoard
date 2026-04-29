# ADR-045 — Document Picture-in-Picture for video-news (Gated)

| Field      | Value                                                  |
| ---------- | ------------------------------------------------------ |
| Date       | 2026-04-29                                             |
| Status     | Accepted (Plan — gated on 3 user requests)             |
| Sprint     | 165                                                    |
| Supersedes | n/a                                                    |
| Related    | Roadmap item #22, `docs/video-cards.md`, ADR-019       |

## Context

The [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)
(`window.documentPictureInPicture`) lets web apps float a full HTML document
(not just a `<video>`) into an always-on-top window. Unlike the older
`HTMLVideoElement.requestPictureInPicture()`, Document PiP:

- Supports arbitrary HTML (overlays, controls, RTL caption strip).
- Keeps the video element in a real, styleable, scriptable document.
- Lets the user position and resize the PiP window freely.
- Propagates theme tokens (`data-theme`, CSS custom properties) if the
  mirrored document is cloned from the parent.

### Browser support (as of 2026-04-29)

| Browser  | Version | Support          |
| -------- | ------- | ---------------- |
| Chrome   | 116+    | ✅ Full           |
| Edge     | 116+    | ✅ Full           |
| Safari   | 18+     | ✅ (via video PiP only — no Document PiP) |
| Firefox  | —       | ❌ Not yet       |

**Progressive enhancement only**: Document PiP is available exclusively on
Chromium-based browsers. The dashboard targets a dedicated TV/kiosk Chrome
install, making this a reasonable enhancement — but not a blocking feature.

## Decision

**Gate**: Do **not** implement until 3 or more distinct users request it
(consistent with the "gated: 3+ user requests" notation in Roadmap item #22).

Once the gate is met, implement as follows:

### Implementation plan

1. **API hook** — `src/cards/video-news/video-news.ts`
   - Add a `pipBtn` element to the card's header row (visible only if
     `window.documentPictureInPicture !== undefined`).
   - On click: call `window.documentPictureInPicture.requestWindow({ width, height })`.
   - Move the `<video>` + RTL caption strip + mute/channel controls into the
     PiP window document.
   - On PiP close: move elements back; resume normal layout.

2. **CSP** — `src/index.html` meta CSP:
   - No new origin required (Document PiP is same-origin content).
   - Permissions-Policy may need `picture-in-picture=(self)` if it is
     currently denied; verify `_headers` Permissions-Policy entry.

3. **Keyboard shortcut** — assign `P` (currently: Print) or a new key;
   avoid collision with existing map in `docs/keyboard.md`.

4. **Theme propagation** — copy `document.documentElement.dataset.theme`
   and root CSS custom properties into the PiP window document so all
   6 dashboard themes render correctly.

5. **ADR update** — change Status from `Plan` to `Accepted` and record the
   implementation sprint.

### Non-goals

- Standard `HTMLVideoElement.requestPictureInPicture()` — already available
  natively in Chrome for `<video>` elements; no extra code needed.
- Firefox / Safari Document PiP polyfill — not in scope.
- Multi-window sync — the PiP window is ephemeral; no state persistence.

## Consequences

### Positive

- Users can monitor a live news stream while interacting with other cards.
- Aligns with the "always-on" TV-dashboard philosophy — users lose nothing
  from the main layout when popping the stream to PiP.
- Zero additional bundle size until gate is met.

### Negative

- Chromium-only: Safari users get standard video PiP (not document PiP).
- `P` key reassignment (from Print) adds a potential UX conflict.
- PiP window lifetime management (move elements back on close) adds
  complexity to `video-news.ts` state machine.

### Neutral

- The Permissions-Policy change (`picture-in-picture=(self)`) is a security-
  neutral expansion within the same origin.
- No worker changes needed — all logic is client-side.

## Gate tracking

| Request # | Date       | Source          | Notes                |
| --------- | ---------- | --------------- | -------------------- |
| (pending) | —          | —               | 3 requests needed    |

> When this table reaches 3 rows, open a sprint issue referencing this ADR
> to move Status from `Plan` → `Active` and begin implementation.
