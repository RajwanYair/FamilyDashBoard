/**
 * Vitest happy-dom preset — for DOM-heavy browser unit tests.
 * Source of truth: MyScripts/tooling/vitest/happy-dom.mjs
 * Keep in sync when upgrading Vitest or happy-dom.
 *
 * Usage in vitest.config.ts:
 *   import { sharedHappyDomTestConfig } from "./tooling/vitest/happy-dom.mjs";
 *   test: { ...sharedHappyDomTestConfig, ... }
 */
import { sharedVitestTestConfig } from "./base.mjs";

export const sharedHappyDomTestConfig = {
  ...sharedVitestTestConfig,
  environment: "happy-dom",
};
