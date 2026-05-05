/**
 * fast-check property tests — src/core/config-crypto.ts (Sprint 469)
 *
 * Properties under test:
 *  CC1. Round-trip identity: decrypt(encrypt(config, pass), pass) ≡ config
 *       for any JSON-serialisable object and any non-empty passphrase.
 *  CC2. IV uniqueness: two calls to encryptConfig with identical inputs
 *       produce distinct ciphertexts (fresh IV each call).
 *  CC3. Ciphertext opaqueness: the encoded payload does not contain a
 *       plain-text copy of any string value from the original config.
 *  CC4. Prefix invariant: every encrypted fragment starts with "#ecfg=".
 *  CC5. Wrong-passphrase rejection: decryptConfig with any passphrase ≠
 *       the original always rejects.
 *  CC6. Output is a non-empty string for any valid (config, passphrase) pair.
 *  CC7. Payload grows monotonically with plaintext length (overhead constant).
 *  CC8. Empty passphrase always throws synchronously-compatible rejection.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { encryptConfig, decryptConfig, ECFG_PREFIX } from "@/core/config-crypto";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Non-empty printable ASCII passphrase (avoids empty string). */
const passphraseArb = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

/** A passphrase guaranteed to differ from a given one. */
const wrongPassphraseArb = (correct: string) =>
  fc.string({ minLength: 1, maxLength: 64 }).filter((s) => s !== correct && s.trim().length > 0);

/** Simple flat JSON-serialisable config object with string values. */
const flatConfigArb = fc.record({
  theme: fc.constantFrom("black", "blue", "matrix", "amber", "purple", "rose"),
  city: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !/[^\x20-\x7E]/.test(s) || s.length > 0),
  tempUnit: fc.constantFrom("C", "F"),
  note: fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !s.includes("#ecfg=")),
});

/** Nested config including numeric and boolean fields. */
const richConfigArb = fc.record({
  version: fc.integer({ min: 1, max: 99 }),
  theme: fc.constantFrom("black", "blue", "matrix"),
  visible: fc.boolean(),
  count: fc.integer({ min: 0, max: 1000 }),
});

// Shared timeout helper for async property — long due to PBKDF2 200k iterations
const NUM_RUNS = 3; // WebCrypto PBKDF2 is intentionally expensive; keep small

// ── CC1: Round-trip identity ──────────────────────────────────────────────────

describe("config-crypto — CC1: encrypt→decrypt is identity for any config+passphrase", () => {
  it("flat config round-trips correctly", async () => {
    await fc.assert(
      fc.asyncProperty(flatConfigArb, passphraseArb, async (config, pass) => {
        const enc = await encryptConfig(config, pass);
        const dec = await decryptConfig(enc, pass);
        expect(dec).toEqual(config);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rich (nested) config round-trips correctly", async () => {
    await fc.assert(
      fc.asyncProperty(richConfigArb, passphraseArb, async (config, pass) => {
        const enc = await encryptConfig(config, pass);
        const dec = await decryptConfig(enc, pass);
        expect(dec).toEqual(config);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC2: IV uniqueness — same inputs produce different ciphertexts ────────────

describe("config-crypto — CC2: fresh IV means distinct ciphertexts for same inputs", () => {
  it("two encryptions of the same config+pass differ", async () => {
    await fc.assert(
      fc.asyncProperty(flatConfigArb, passphraseArb, async (config, pass) => {
        const a = await encryptConfig(config, pass);
        const b = await encryptConfig(config, pass);
        expect(a).not.toBe(b);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC3: Ciphertext opaqueness ────────────────────────────────────────────────

describe("config-crypto — CC3: encoded payload does not expose plaintext values", () => {
  it("theme string not visible in the raw encoded output", async () => {
    await fc.assert(
      fc.asyncProperty(passphraseArb, async (pass) => {
        const config = { theme: "supersecret-theme-value", tempUnit: "C" };
        const enc = await encryptConfig(config, pass);
        // The base64url-encoded blob must not literally contain the plaintext theme
        expect(enc).not.toContain("supersecret-theme-value");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC4: Prefix invariant ─────────────────────────────────────────────────────

describe(`config-crypto — CC4: output always starts with "${ECFG_PREFIX}"`, () => {
  it("fragment prefix is invariant for any valid input", async () => {
    await fc.assert(
      fc.asyncProperty(flatConfigArb, passphraseArb, async (config, pass) => {
        const enc = await encryptConfig(config, pass);
        expect(enc.startsWith(ECFG_PREFIX)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC5: Wrong-passphrase rejection ──────────────────────────────────────────

describe("config-crypto — CC5: decryption rejects any passphrase ≠ original", () => {
  it("wrong passphrase always throws", async () => {
    await fc.assert(
      fc.asyncProperty(flatConfigArb, passphraseArb, async (config, pass) => {
        const enc = await encryptConfig(config, pass);
        // Use a passphrase guaranteed to be different
        const bad = pass + "_WRONG";
        await expect(decryptConfig(enc, bad)).rejects.toThrow();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC6: Output is a non-empty string ────────────────────────────────────────

describe("config-crypto — CC6: output is always a non-empty string", () => {
  it("encrypted result is a non-empty string", async () => {
    await fc.assert(
      fc.asyncProperty(richConfigArb, passphraseArb, async (config, pass) => {
        const enc = await encryptConfig(config, pass);
        expect(typeof enc).toBe("string");
        expect(enc.length).toBeGreaterThan(ECFG_PREFIX.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── CC7: Payload grows with plaintext length ──────────────────────────────────

describe("config-crypto — CC7: longer plaintext → longer encoded payload", () => {
  it("small config produces shorter payload than large config", async () => {
    const pass = "constant-passphrase";
    const small = { a: "x" };
    const large = { a: "x".repeat(500), b: "y".repeat(500) };
    const encSmall = await encryptConfig(small, pass);
    const encLarge = await encryptConfig(large, pass);
    expect(encLarge.length).toBeGreaterThan(encSmall.length);
  });
});

// ── CC8: Empty passphrase always rejects ─────────────────────────────────────

describe("config-crypto — CC8: empty passphrase always throws", () => {
  it("encryptConfig rejects any empty-string passphrase for any config", async () => {
    await fc.assert(
      fc.asyncProperty(flatConfigArb, async (config) => {
        await expect(encryptConfig(config, "")).rejects.toThrow("Passphrase must not be empty");
      }),
      { numRuns: 5 },
    );
  });
});
