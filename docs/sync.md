# Encrypted Config Sync — FamilyDashBoard

> \*\*\*\* — Share your dashboard settings securely across devices using AES-GCM encrypted URL fragments. No server, no account, no plaintext.

## Overview

FamilyDashBoard lets you export your full configuration as an **encrypted URL fragment** (`#ecfg=…`) that you can share or save. Anyone who receives the URL must enter the correct passphrase to apply the settings. The encryption happens entirely in the browser using the Web Crypto API.

## How to Export (Share) Settings

1. Open the **Settings** panel (press `S` or click the gear icon).
2. Click **🔐 שתף מוצפן** ("Share encrypted").
3. In the passphrase dialog, enter a strong passphrase and click **אישור** (OK).
4. The encrypted URL is automatically copied to your clipboard.
5. Share the URL by any channel — email, chat, QR code, etc.

> **Keep the passphrase safe.** It is never stored or transmitted. Without it, the settings cannot be recovered.

## How to Import Settings

1. Navigate to the encrypted URL (e.g. paste it in the browser address bar).
2. FamilyDashBoard detects the `#ecfg=` hash on startup and opens the passphrase dialog automatically.
3. Enter the passphrase used during export and click **אישור**.
4. If the passphrase is correct, settings are applied immediately and the hash is removed from the URL.
5. If the passphrase is wrong or the URL is corrupt, an error toast is shown and no settings are changed.

## Security Model

| Property           | Detail                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Algorithm          | AES-GCM 256-bit                                                                                                           |
| Key derivation     | PBKDF2 · SHA-256 · 200000 iterations                                                                                     |
| Salt               | 16 random bytes, prepended to ciphertext                                                                                  |
| IV                 | 12 random bytes, prepended after salt                                                                                     |
| Encoding           | Base64url (URL-safe, no padding issues)                                                                                   |
| Passphrase storage | **Never stored** — not in localStorage, not in memory after use                                                           |
| Server involvement | **None** — purely client-side Web Crypto API                                                                              |
| Hash stripping     | After successful import, `history.replaceState` removes `#ecfg=` from the URL so the dialog does not re-appear on refresh |

### Threat Model

- **Eavesdropping**: The URL fragment is **not** sent to servers in HTTP requests (browsers do not include `#…` in the `Referer` header or server-side logs). However, it may appear in browser history, clipboard history, or forwarded chat previews.
- **Brute-force**: PBKDF2 with 200000 iterations makes offline dictionary attacks costly. Use a passphrase that is hard to guess.
- **Tampering**: AES-GCM provides authenticated encryption — any bit flip in the ciphertext causes decryption to fail with a clear error.
- **Replay**: The salt and IV are randomly generated each export, so two exports of identical settings produce different ciphertexts.

## Fragment Format

```text
#ecfg=<base64url(salt[16] || iv[12] || ciphertext)>
```

- `salt`: 16 random bytes used for PBKDF2 key derivation.
- `iv`: 12 random bytes used as the AES-GCM initialization vector.
- `ciphertext`: AES-GCM encrypted JSON of the full `DashboardConfig` object.

## Related Files

| File                        | Role                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `src/core/config-crypto.ts` | `encryptConfig()`, `decryptConfig()`, `ECFG_PREFIX`            |
| `src/ui/config-panel.ts`    | `encryptedShareSettings()`, `openEcfgImportDialog()`           |
| `src/main.ts`               | Startup `#ecfg=` detection → `openEcfgImportDialog()`          |
| `src/index.html`            | `#ecfg-dialog` passphrase `<dialog>`, `#cfg-encrypt-share-btn` |
| `src/styles/components.css` | Passphrase dialog styles                                       |

## ADR Reference

See [ADR-013 — KV Stale Cache](adr/ADR-013-kv-stale-cache.md) for the broader data-persistence strategy and [ADR-009 — Config Schema Evolution](adr/ADR-009-config-schema-evolution.md) for how imported configs are validated and migrated.
