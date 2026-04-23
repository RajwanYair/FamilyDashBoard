/**
 * FamilyDashBoard — Encrypted Config URL (AES-GCM)
 *
 * Allows users to export their dashboard config as an opaque, passphrase-
 * protected URL fragment and re-import it on another device/browser.
 *
 * Security:
 *  - Key derivation: PBKDF2 (SHA-256, 200 000 iterations) → AES-GCM 256-bit key.
 *  - Each export generates a fresh 96-bit (12-byte) IV.
 *  - Salt (16 bytes) and IV are stored unencrypted at the start of the payload
 *    (they are not secrets — only the passphrase must be kept private).
 *  - Ciphertext + auth tag from AES-GCM are appended.
 *  - The whole blob is base64url-encoded and embedded as a URL hash fragment:
 *      #ecfg=<base64url>
 *
 * The passphrase is NEVER stored — it lives only in memory during the call.
 *
 * All crypto via `window.crypto.subtle` (WebCrypto API — available in all
 * supported browsers without external dependencies).
 */

/** URL hash prefix for encrypted config fragments. */
export const ECFG_PREFIX = "#ecfg=";

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM standard IV size

// ── Internal helpers ──────────────────────────────────────────────────────────

function bufToBase64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBuf(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt a config object with a user-supplied passphrase.
 *
 * @param config      Any JSON-serialisable object (e.g. DashboardConfig).
 * @param passphrase  User-supplied password (not stored, min 1 char enforced).
 * @returns           URL hash fragment: `#ecfg=<base64url>`.
 */
export async function encryptConfig(config: unknown, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length === 0) throw new Error("Passphrase must not be empty");

  const salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(config));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  // Layout: [salt (16)] [iv (12)] [ciphertext + tag (rest)]
  const payload = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
  payload.set(salt, 0);
  payload.set(iv, SALT_BYTES);
  payload.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);

  return ECFG_PREFIX + bufToBase64url(payload.buffer);
}

/**
 * Decrypt a config URL fragment produced by `encryptConfig()`.
 *
 * @param fragment    URL hash fragment starting with `#ecfg=`.
 * @param passphrase  The same passphrase used during encryption.
 * @returns           The original config object (untyped — caller must validate).
 * @throws            If the passphrase is wrong or the payload is corrupt.
 */
export async function decryptConfig(fragment: string, passphrase: string): Promise<unknown> {
  if (!fragment.startsWith(ECFG_PREFIX)) {
    throw new Error("Fragment does not contain an encrypted config");
  }
  const b64 = fragment.slice(ECFG_PREFIX.length);
  const payload = new Uint8Array(base64urlToBuf(b64));

  if (payload.byteLength <= SALT_BYTES + IV_BYTES) {
    throw new Error("Payload too short — corrupt or truncated");
  }

  const salt = payload.slice(0, SALT_BYTES);
  const iv = payload.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = payload.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(passphrase, salt);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupt data");
  }

  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as unknown;
}
