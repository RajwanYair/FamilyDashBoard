# ADR-049 — WebRTC QR-pair Cross-Device Mirror

**Status**: Proposed
**Deciders**: RajwanYair
**Date**: 2026-04-30
**Sprint**: 249
**Stream**: ---

## Context

FamilyDashBoard is a static PWA with no server-side auth or user DB (ADR-002, rule 26). The
AES-GCM config URL export (v13.9) and import flow handle one-shot config transfer, but two
TV screens in the same home currently cannot stay in sync without manual re-export.

**Gate trigger**: 3+ user requests for cross-device sync. Gate confirmed reached.

The core constraint: no server, no auth, no persistent relay. Only STUN-only WebRTC
(RFC 5245 ICE Lite) — no TURN relay (no server cost, no data intermediary).

---

## Decision

Implement a **short-lived (5-minute) WebRTC QR-pair mirror** for real-time config and
card-state synchronisation between up to 2 FamilyDashBoard instances on the same LAN.

### Pairing protocol

```text
  Device A (initiator)           Signalling                Device B (responder)
  ─────────────────────          (QR code)                 ──────────────────────
  1. Generate RTCPeerConnection
  2. createOffer() → SDP
  3. Encode SDP + ICE candidates
     as compressed QR (≤ 2 KB)
  4. Display QR for 5 min           ── QR scan ──>          5. Scan QR
                                                             6. Parse SDP/ICE
                                                             7. createAnswer()
                                                             8. setRemoteDescription
                                                             9. Encode answer + ICE as
                                                                second QR
  10. User scans answer QR <── QR scan ──
  11. setRemoteDescription
  12. Connection established
  13. DataChannel open
                           <─── sync events ───>           (bidirectional)
```

### Data channel protocol (JSON, max 4 KB per message)

```json
{
  "type": "fdb-mirror-v1",
  "event": "config-update" | "card-state-update" | "ping" | "ack",
  "payload": { … },
  "ts": 1714560000000
}
```

### Security model

| Property | Value |
|---|---|
| Transport | DTLS 1.3 (WebRTC built-in, mandatory) |
| Authentication | OOB via QR physical scan (attacker must be in the room) |
| Data encrypted in transit | Yes — DTLS 1.3 |
| Data at rest | No — config sent over DataChannel lives only in RAM |
| Session lifetime | 5 min auto-disconnect timer; re-pair required |
| Server involvement | None — STUN only (Google stun.l.google.com:19302) |
| PII | None — config values only (same as URL-export) |

STUN server is used only for candidate discovery (NAT traversal). No data is relayed.
Fallback: if STUN fails (enterprise firewall), connection fails; local-network pair works
without STUN (direct ICE candidate on LAN).

---

## Implementation plan

### New files

| File | Purpose |
|---|---|
| `src/core/webrtc-mirror.ts` | RTCPeerConnection lifecycle, QR generation, DataChannel |
| `src/ui/webrtc-pair-dialog.ts` | `<dialog>` overlay with QR display and scan steps |
| `src/ui/webrtc-pair-dialog.css` | Pair dialog styles |

### Integration points

- `src/ui/keyboard.ts`: `M` key (or `Shift+M`) opens pair dialog
- `src/core/config.ts`: on DataChannel `config-update` → merge received config into local
- `src/core/signals.ts`: broadcast `themeChanged` / `layoutChanged` signals when mirror update received
- `src/ui/config-panel.ts`: "Mirror device" button in config panel footer

### QR encoding

- Use [qrcodegen](https://github.com/nayuki/QR-Code-generator) (MIT, ≤ 15 KB minified) or a
  browser-native Canvas drawing of the QR matrix.
- QR payload: `fdb://mirror/v1/` + base64url(gzip(SDP JSON))
- Maximum payload: ~1 KB compressed (WebRTC offer SDP is typically 500-800 bytes)

### Bundle budget

- `webrtc-mirror.ts` target: ≤ 4 KB gzip
- `webrtc-pair-dialog.ts` target: ≤ 2 KB gzip
- **Gate**: bundle delta check must remain green (no new card group budget exceeded)
- **Zero new external deps**: qrcodegen inline (single-file, MIT), no npm add

---

## Consequences

| Positive | Negative |
|---|---|
| Real-time sync between home TVs without auth | Requires physical QR scan (intentional security feature) |
| Zero server cost | TURN-less: fails behind strict enterprise NAT (acceptable — home use) |
| In-browser DTLS encryption | 5-min session limit means no persistent shared state |
| No PII to server | Complexity added to `config.ts` merge logic |

---

## Alternatives rejected

| Alternative | Reason |
|---|---|
| Server-side relay (WebSocket) | Requires auth + server infra (ADR-002, rule 26) |
| CRDT (Yjs) | Track only; adopt only if WebRTC delta insufficient AND core ≤ 12 KB gzip (currently 25+ KB) |
| AES-GCM URL share (existing) | One-shot only; no live bidirectional sync |
| localStorage broadcast API | Same-origin, same-device only |
| BroadcastChannel | Same-origin, same-device only |

---

## Exit gate

- [ ] `webrtc-mirror.ts` passes unit tests for DataChannel encode/decode
- [ ] `check-bundle-size.mjs` and `check-card-bundle-delta.mjs` remain green
- [ ] Zero new external npm dependencies
- [ ] Manual test: two browser tabs on same machine successfully mirror a config change
- [ ] DTLS-only traffic confirmed (no plaintext data channel)
