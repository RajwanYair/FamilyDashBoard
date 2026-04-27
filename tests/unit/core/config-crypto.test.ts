import { describe, it, expect } from "vitest";
import { encryptConfig, decryptConfig, ECFG_PREFIX } from "../../../src/core/config-crypto";

const PASSPHRASE = "test-passphrase-123!";

describe("encryptConfig", () => {
  it("returns a string starting with ECFG_PREFIX", async () => {
    const result = await encryptConfig({ theme: "blue" }, PASSPHRASE);
    expect(result).toMatch(/^#ecfg=/);
  });

  it("throws when passphrase is empty", async () => {
    await expect(encryptConfig({ theme: "blue" }, "")).rejects.toThrow(
      "Passphrase must not be empty",
    );
  });

  it("produces different ciphertexts for the same input (fresh IV each time)", async () => {
    const a = await encryptConfig({ theme: "blue" }, PASSPHRASE);
    const b = await encryptConfig({ theme: "blue" }, PASSPHRASE);
    // Different IVs mean different ciphertexts
    expect(a).not.toBe(b);
  });

  it("can encrypt complex nested config objects", async () => {
    const config = {
      theme: "matrix",
      city: "Tel Aviv",
      tempUnit: "C",
      cards: { stocks: { visible: true, size: "lg" } },
      version: 12,
    };
    const result = await encryptConfig(config, PASSPHRASE);
    expect(typeof result).toBe("string");
    expect(result.startsWith(ECFG_PREFIX)).toBe(true);
  });
});

describe("decryptConfig", () => {
  it("round-trips a config object correctly", async () => {
    const original = { theme: "blue", city: "ירושלים", tempUnit: "C" };
    const encrypted = await encryptConfig(original, PASSPHRASE);
    const decrypted = await decryptConfig(encrypted, PASSPHRASE);
    expect(decrypted).toEqual(original);
  });

  it("throws when passphrase is wrong", async () => {
    const encrypted = await encryptConfig({ theme: "amber" }, PASSPHRASE);
    await expect(decryptConfig(encrypted, "wrong-password")).rejects.toThrow("Decryption failed");
  });

  it("throws when fragment has wrong prefix", async () => {
    await expect(decryptConfig("#cfg=abc123", PASSPHRASE)).rejects.toThrow(
      "Fragment does not contain an encrypted config",
    );
  });

  it("throws on truncated payload", async () => {
    // Only the prefix + a few bytes — too short to contain salt + iv + ciphertext
    await expect(decryptConfig("#ecfg=dGVzdA", PASSPHRASE)).rejects.toThrow("Payload too short");
  });

  it("round-trips Hebrew and multilingual strings faithfully", async () => {
    const config = { ticker: "שלום עולם — Hello World — مرحبا بالعالم" };
    const encrypted = await encryptConfig(config, "מסיסמה-מורכבת-1234");
    const decrypted = await decryptConfig(encrypted, "מסיסמה-מורכבת-1234");
    expect(decrypted).toEqual(config);
  });

  it("round-trips a large config object (stress test)", async () => {
    const config = {
      theme: "rose",
      cards: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [`card-${i}`, { visible: true, size: "md" }]),
      ),
      payload: "x".repeat(4096),
    };
    const encrypted = await encryptConfig(config, PASSPHRASE);
    const decrypted = await decryptConfig(encrypted, PASSPHRASE);
    expect(decrypted).toEqual(config);
  });
});

describe("ECFG_PREFIX", () => {
  it("is the expected string constant", () => {
    expect(ECFG_PREFIX).toBe("#ecfg=");
  });
});
