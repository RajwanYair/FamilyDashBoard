# ADR-036 — WebRTC Config Mirror (QR-Code Pairing)

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| **Date**     | 2026-04-24                                                    |
| **Status**   | Proposed                                                      |
| **Deciders** | @RajwanYair                                                   |
| **Tags**     | config, webrtc, mobile, qr-code, v13-continuity, zero-server |

---

## Context

FamilyDashBoard is a static PWA with no backend — all configuration is persisted in
`localStorage` on the TV browser. When a user wants to tweak settings (card order, city,
theme) they must either use the keyboard overlay (`S` key) directly on the TV, or physically
walk to the TV. On a 1920×1080 always-on display this is awkward; a phone-based config editor
is the natural alternative.

The constraint from ADR-002 (zero client-side runtime dependencies) and the no-auth requirement
(copilot-instructions §26) rule out any cloud relay that would require sign-in or a CF Workers
subscription increase. WebRTC data channels offer a **zero-server**, **peer-to-peer** path: a
QR code on the TV encodes the WebRTC offer SDP, the phone scans it, sends an answer SDP back
(also via QR or a short URL fragment), and a data channel is established. The entire handshake
uses the browser's built-in `RTCPeerConnection` API — no additional libraries.

---

## Decision

Design a **5-minute WebRTC mirror** feature under the `V13-CONTINUITY` roadmap label.

### Architecture

```text
TV browser                           Phone browser
────────────────────────────────     ────────────────────────────────
1. RTCPeerConnection.createOffer()
2. setLocalDescription(offer)
3. Encode offer SDP → QR code        ← user scans QR with phone
                                     4. Decode SDP from QR
                                     5. RTCPeerConnection.setRemoteDescription(offer)
                                     6. createAnswer() → setLocalDescription(answer)
                                     7. Encode answer SDP → QR / short URL fragment
8. User pastes answer fragment ──────────────────────────────────────
9. setRemoteDescription(answer)
10. ICE negotiation (STUN only — Google/Cloudflare public STUN)
11. Data channel open
──────────────────────────────────── ────────────────────────────────
12. Phone sends config delta (JSON)
13. TV applies config delta →
    localStorage + re-render cards
```

### Key design constraints

| Constraint | Decision |
| --- | --- |
| Zero CF resources | Use public STUN servers only (no TURN). Connection limited to same LAN or NAT-friendly networks. |
| No QR library dep | Encode offer SDP as a `data:` URI `<canvas>` QR using a tiny self-contained QR encoder (< 2 KB, vendored into `src/ui/`). |
| Session lifetime | Data channel auto-closes after 5 minutes (`setTimeout`) — prevents stale pairing. |
| Config delta only | Phone sends only changed keys, not the full config blob — reduces attack surface. |
| Input validation | All received JSON validated with Valibot schema before `localStorage` write. |
| Activation | Triggered via keyboard shortcut `M` (mirror) in the keyboard handler (`src/ui/keyboard.ts`). |
| Overlay | Rendered in a `<dialog>` modal (`showModal()`) — consistent with overlay architecture (Rule 17). |

### Non-goals

- No TURN server support (NAT traversal beyond STUN is out of scope).
- No persistent pairing / saved credentials.
- No remote view of the TV — data channel is write-only from phone to TV.
- No native mobile app — phone side is a plain HTTPS page (could be `preview.html` variant).

---

## Consequences

### Positive

- Users can edit dashboard config from their phone without walking to the TV.
- Zero infrastructure cost — no new CF resources, no auth, no database.
- Data channel is ephemeral and closes after 5 minutes — minimal attack surface.
- Consistent with ADR-002 (no runtime deps) and ADR-018 (CSP) — WebRTC is built into the browser.

### Negative / Trade-offs

- STUN-only means pairing fails on symmetric NAT (uncommon on home/office LANs but possible on
  restrictive corporate networks).
- Offer/answer SDP exchange via QR scan is slightly awkward UX — a future improvement could
  use a short numeric PIN instead of a second QR scan.
- Adds ~2 KB vendored QR encoder to the bundle (well within the 300 KB bundle limit from CI).
- Implementation is gated on user demand — this ADR documents the design; actual code lives
  in a future sprint when the feature is prioritised.

---

## Alternatives Considered

| Alternative | Reason rejected |
| --- | --- |
| Cloud relay (WebSocket via CF Worker) | Requires CF subscription, violates zero-server constraint |
| BLE (Web Bluetooth) | Not supported in all TV browsers (Samsung Tizen, LG webOS) |
| Local REST server (Node.js) | Requires running a server process — violates static PWA model |
| Shared `localStorage` via BroadcastChannel | Only works within same browser origin/tab — not cross-device |
