# ADR-069: X14 — Phone-as-Remote (WebRTC, Gated, No Auth)

- **Status**: Gated (multi-condition gate; revisit at v15)
- **Date**: 2026-05-04 (v13.37.0 patch series)
- **Sprints**: 358
- **Related**: ROADMAP §4.4 X14, ADR-049 (WebRTC mirror), ADR-066 (X11 MCP)

## Context

A TV-mounted dashboard is operated either via the connected keyboard
(`docs/keyboard.md`) or — for guests — by walking up to a small QR
code on screen. ROADMAP §4.4 X14 proposes letting a phone temporarily
join the dashboard's WebRTC mesh for **5 minutes** after QR pairing,
then tap a card to reorder, dismiss, or snooze.

Constraints (non-negotiable):

- **No accounts, no relay** — pairing must be 1:1 over WebRTC; ICE
  STUN-only.
- **No persistent permission** — 5-minute session, then re-pair.
- **No tracking** — pairing tokens are random per-session, never
  persisted on the dashboard.

## Decision

**Gate** X14 behind three conditions. Do **not** adopt in v14.x.

### Gate conditions (all required)

1. **WebRTC mirror lands** — stream (Tasks T-WebRTC,
   ADR-049) ships first. X14 reuses its mesh, signaling, and
   ICE config. Building X14 before the mirror duplicates effort.
2. **≥ 3 user requests** for phone control — current operators have
   not asked. The keyboard remains the primary input.
3. **Threat-model ADR** — a dedicated ADR enumerating attacker
   scenarios (QR code shoulder-surf, ICE candidate spoofing,
   replay of pairing token, malicious card payload) and the
   mitigations. Without this ADR, no implementation.

### Why all three

X14 is the first feature where an external device can mutate dashboard
state. That is a meaningful escalation of the threat model. Each gate
exists to ensure we don't ship it for a phantom user need or before
the underlying mirror is hardened.

## Sketch (when adopted)

### File plan

```text
src/core/
  remote-pairing.ts       # ~200 LoC, gated by ?remote=1
  remote-pairing.types.ts
src/ui/
  remote-pairing-overlay.ts  # QR + countdown
src/ui/styles/
  remote-pairing.css      # @layer components
tests/unit/core/
  remote-pairing.test.ts
docs/
  remote-pairing.md       # operator + threat-model summary
docs/adr/
  ADR-XXX-x14-threat-model.md  # the gate-3 ADR
```

### Pairing flow

1. Dashboard opens `?remote=1`. Generates a 128-bit pairing token,
   renders a QR encoding `https://dashboard/?join=<token>`.
2. Phone scans, navigates to URL. Phone opens its own page that
   establishes a WebRTC `RTCPeerConnection` over STUN.
3. SDP offer/answer exchanged via the dashboard's existing mirror
   signaling channel .
4. Once the data channel opens, the dashboard's pairing overlay
   closes. The phone shows a tile-grid mirror.
5. After **5 minutes** the data channel is closed by the dashboard.
   Re-pair to extend.

### Allowed remote actions

- Reorder cards (drag).
- Dismiss a single tile (e.g. one news headline).
- Snooze a card for 60 minutes.
- **Not** allowed: change config, change theme, dismiss alerts,
  open/close any overlay. Hard list — denylist by default.

### Privacy + Security

- Pairing token is single-use; consumed on first peer connection.
- After pairing, the token is discarded from dashboard memory.
- WebRTC mesh uses ICE STUN-only (no TURN relay), so traffic is
  device-to-device on LAN.
- Threat-model ADR (gate condition 3) covers: QR shoulder-surf
  (mitigated by 5-min token + visible "paired" indicator), ICE
  spoofing (mitigated by short-lived offer), card-payload abuse
  (mitigated by allow-list above).

## Consequences

- **Pro (when adopted):** Guest operators don't need keyboard
  access. QR pairing is intuitive.
- **Pro (when adopted):** Reuses WebRTC mirror infrastructure —
  marginal cost low.
- **Con (today):** Triple-gated. Likely not v14.x. May not be v15.
- **Con (when adopted):** First mutating external surface. Threat
  model is the highest-stakes review the project has had.

## References

- ROADMAP §4.4 X14
- ADR-049 (WebRTC mirror — prerequisite via T-WebRTC, A-DO)
- ADR-066 (X11 MCP — analogous opt-in side-channel pattern)
- WebRTC specs: <https://w3c.github.io/webrtc-pc/>
