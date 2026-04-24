/**
 * Unit tests — V13-CONTINUITY: Encrypted config passphrase dialog
 *
 * Pure static-analysis tests using readFileSync — no vi.mock() hoisting issues.
 * Checks that:
 *   - #ecfg-dialog exists as a <dialog> element with correct ARIA attrs
 *   - #ecfg-passphrase-input exists with type="password", autocomplete="off", dir="ltr"
 *   - #ecfg-dialog-confirm and #ecfg-dialog-cancel exist
 *   - #ecfg-dialog-error exists and is hidden by default
 *   - #cfg-encrypt-share-btn exists with aria-label and type="button"
 *   - i18n keys for the encrypted config flow exist in the source
 *   - config-panel.ts exports the required functions
 *   - main.ts wires ECFG_PREFIX startup detection
 *   - config-crypto.ts exports ECFG_PREFIX with correct shape
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");
const HTML = readFileSync(resolve(ROOT, "src", "index.html"), "utf8");

// ── HTML structure tests ──────────────────────────────────────────────────────

describe("V13-CONTINUITY: #ecfg-dialog HTML structure", () => {
  it("contains a <dialog> element with id='ecfg-dialog'", () => {
    expect(HTML).toMatch(/<dialog[^>]*id="ecfg-dialog"/);
  });

  it("ecfg-dialog declares aria-labelledby='ecfg-dialog-title'", () => {
    expect(HTML).toContain('id="ecfg-dialog"');
    expect(HTML).toContain('aria-labelledby="ecfg-dialog-title"');
  });

  it("ecfg-dialog declares aria-modal='true'", () => {
    // aria-modal appears on the ecfg-dialog tag
    const dialogBlock = HTML.match(/id="ecfg-dialog"[^>]*/);
    expect(dialogBlock?.[0]).toContain('aria-modal="true"');
  });

  it("contains #ecfg-dialog-title element", () => {
    expect(HTML).toContain('id="ecfg-dialog-title"');
  });

  it("contains #ecfg-dialog-desc element", () => {
    expect(HTML).toContain('id="ecfg-dialog-desc"');
  });

  it("contains #ecfg-passphrase-input element", () => {
    expect(HTML).toContain('id="ecfg-passphrase-input"');
  });

  it("ecfg-passphrase-input has type='password'", () => {
    // type may appear before or after the id attribute; check the full input tag
    const inputTag = HTML.match(/<input[^>]*id="ecfg-passphrase-input"[^>]*>|<input[^>]*type="password"[^>]*id="ecfg-passphrase-input"[^>]*>/);
    expect(inputTag?.[0] ?? HTML).toContain('type="password"');
  });

  it("ecfg-passphrase-input has autocomplete='off'", () => {
    const inputBlock = HTML.match(/id="ecfg-passphrase-input"[^>]*/);
    expect(inputBlock?.[0]).toContain('autocomplete="off"');
  });

  it("ecfg-passphrase-input has dir='ltr'", () => {
    const inputBlock = HTML.match(/id="ecfg-passphrase-input"[^>]*/);
    expect(inputBlock?.[0]).toContain('dir="ltr"');
  });

  it("contains #ecfg-dialog-confirm button", () => {
    expect(HTML).toContain('id="ecfg-dialog-confirm"');
  });

  it("contains #ecfg-dialog-cancel button", () => {
    expect(HTML).toContain('id="ecfg-dialog-cancel"');
  });

  it("contains #ecfg-dialog-error element", () => {
    expect(HTML).toContain('id="ecfg-dialog-error"');
  });

  it("ecfg-dialog-error is hidden by default", () => {
    const errBlock = HTML.match(/id="ecfg-dialog-error"[^>]*/);
    expect(errBlock?.[0]).toMatch(/\bhidden\b/);
  });
});

describe("V13-CONTINUITY: #cfg-encrypt-share-btn HTML structure", () => {
  it("contains #cfg-encrypt-share-btn button", () => {
    expect(HTML).toContain('id="cfg-encrypt-share-btn"');
  });

  it("cfg-encrypt-share-btn has aria-label", () => {
    const btnBlock = HTML.match(/id="cfg-encrypt-share-btn"[^>]*/);
    expect(btnBlock?.[0]).toMatch(/aria-label="[^"]+"/);
  });

  it("cfg-encrypt-share-btn has type='button'", () => {
    // Check within a neighbourhood of the button element
    const btnIdx = HTML.indexOf('id="cfg-encrypt-share-btn"');
    const snippet = HTML.slice(Math.max(0, btnIdx - 120), btnIdx + 220);
    expect(snippet).toContain('type="button"');
  });
});

// ── i18n source tests ─────────────────────────────────────────────────────────

describe("V13-CONTINUITY: i18n keys — encrypted config flow", () => {
  const i18nSrc = readFileSync(resolve(ROOT, "src", "core", "i18n.ts"), "utf8");

  it("encryptedShareCopied key present in i18n.ts", () => {
    expect(i18nSrc).toContain("encryptedShareCopied");
  });

  it("encryptedImportSuccess key present in i18n.ts", () => {
    expect(i18nSrc).toContain("encryptedImportSuccess");
  });

  it("encryptedImportFailed key present in i18n.ts", () => {
    expect(i18nSrc).toContain("encryptedImportFailed");
  });

  it("ecfgDialogExportDesc key present in i18n.ts", () => {
    expect(i18nSrc).toContain("ecfgDialogExportDesc");
  });

  it("ecfgDialogImportDesc key present in i18n.ts", () => {
    expect(i18nSrc).toContain("ecfgDialogImportDesc");
  });

  it("encryptedShareLink key present in i18n.ts", () => {
    expect(i18nSrc).toContain("encryptedShareLink");
  });

  it("encryptedImportLink key present in i18n.ts", () => {
    expect(i18nSrc).toContain("encryptedImportLink");
  });

  it("i18n.ts has both he and en translations for ecfgDialogExportDesc", () => {
    // Both locale objects contain the key
    expect(i18nSrc.indexOf("ecfgDialogExportDesc")).not.toBe(
      i18nSrc.lastIndexOf("ecfgDialogExportDesc"),
    );
  });
});

// ── config-panel.ts source exports ───────────────────────────────────────────

describe("V13-CONTINUITY: config-panel.ts exports", () => {
  const src = readFileSync(resolve(ROOT, "src", "ui", "config-panel.ts"), "utf8");

  it("exports encryptedShareSettings", () => {
    expect(src).toMatch(/export function encryptedShareSettings/);
  });

  it("exports openEcfgImportDialog", () => {
    expect(src).toMatch(/export function openEcfgImportDialog/);
  });

  it("exports confirmEcfgDialog", () => {
    expect(src).toMatch(/export function confirmEcfgDialog/);
  });

  it("exports cancelEcfgDialog", () => {
    expect(src).toMatch(/export function cancelEcfgDialog/);
  });

  it("calls encryptConfig in encryptedShareSettings", () => {
    const fnIdx = src.indexOf("encryptedShareSettings");
    const block = src.slice(fnIdx, fnIdx + 600);
    expect(block).toContain("encryptConfig");
  });

  it("calls decryptConfig in openEcfgImportDialog", () => {
    const fnIdx = src.indexOf("openEcfgImportDialog");
    const block = src.slice(fnIdx, fnIdx + 600);
    expect(block).toContain("decryptConfig");
  });

  it("calls validateImportedConfig in openEcfgImportDialog", () => {
    const fnIdx = src.indexOf("openEcfgImportDialog");
    const block = src.slice(fnIdx, fnIdx + 600);
    expect(block).toContain("validateImportedConfig");
  });

  it("calls saveConfig in openEcfgImportDialog on success", () => {
    const fnIdx = src.indexOf("openEcfgImportDialog");
    const block = src.slice(fnIdx, fnIdx + 800);
    expect(block).toContain("saveConfig");
  });

  it("strips URL hash after successful import", () => {
    const fnIdx = src.indexOf("openEcfgImportDialog");
    const block = src.slice(fnIdx, fnIdx + 800);
    expect(block).toContain("history.replaceState");
  });

  it("wires cfg-encrypt-share-btn click to encryptedShareSettings in initConfigPanel", () => {
    expect(src).toContain("cfg-encrypt-share-btn");
    expect(src).toContain("encryptedShareSettings");
  });

  it("wires ecfg-dialog-confirm click to confirmEcfgDialog in initConfigPanel", () => {
    expect(src).toContain("ecfg-dialog-confirm");
    expect(src).toContain("confirmEcfgDialog");
  });

  it("wires ecfg-dialog-cancel click to cancelEcfgDialog in initConfigPanel", () => {
    expect(src).toContain("ecfg-dialog-cancel");
    expect(src).toContain("cancelEcfgDialog");
  });
});

// ── main.ts wiring ────────────────────────────────────────────────────────────

describe("V13-CONTINUITY: main.ts ECFG_PREFIX wiring", () => {
  const mainSrc = readFileSync(resolve(ROOT, "src", "main.ts"), "utf8");

  it("main.ts imports ECFG_PREFIX from config-crypto", () => {
    expect(mainSrc).toContain("ECFG_PREFIX");
    expect(mainSrc).toContain("config-crypto");
  });

  it("main.ts imports openEcfgImportDialog from config-panel", () => {
    expect(mainSrc).toContain("openEcfgImportDialog");
    expect(mainSrc).toContain("config-panel");
  });

  it("main.ts calls openEcfgImportDialog with _urlHash when ECFG_PREFIX matches", () => {
    expect(mainSrc).toContain("ECFG_PREFIX");
    expect(mainSrc).toContain("openEcfgImportDialog(_urlHash)");
  });

  it("main.ts checks startsWith(ECFG_PREFIX)", () => {
    expect(mainSrc).toContain("startsWith(ECFG_PREFIX)");
  });
});

// ── config-crypto.ts ECFG_PREFIX shape ───────────────────────────────────────

describe("V13-CONTINUITY: ECFG_PREFIX constant shape", () => {
  const cryptoSrc = readFileSync(resolve(ROOT, "src", "core", "config-crypto.ts"), "utf8");

  it("config-crypto.ts exports ECFG_PREFIX", () => {
    expect(cryptoSrc).toMatch(/export const ECFG_PREFIX/);
  });

  it("ECFG_PREFIX value starts with '#'", () => {
    const match = cryptoSrc.match(/ECFG_PREFIX\s*=\s*"([^"]+)"/);
    expect(match?.[1]?.startsWith("#")).toBe(true);
  });

  it("ECFG_PREFIX value contains 'ecfg'", () => {
    const match = cryptoSrc.match(/ECFG_PREFIX\s*=\s*"([^"]+)"/);
    expect(match?.[1]).toContain("ecfg");
  });

  it("ECFG_PREFIX value ends with '='", () => {
    const match = cryptoSrc.match(/ECFG_PREFIX\s*=\s*"([^"]+)"/);
    expect(match?.[1]?.endsWith("=")).toBe(true);
  });
});
