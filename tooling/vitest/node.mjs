/**
 * Vitest Node.js preset — for server-side / Worker / pure-TS unit tests.
 * Source of truth: MyScripts/tooling/vitest/node.mjs
 * Keep in sync when upgrading Vitest.
 *
 * Usage in vitest.config.ts:
 *   import { sharedNodeTestConfig } from "./tooling/vitest/node.mjs";
 *   test: { ...sharedNodeTestConfig, ... }
 */
import { sharedVitestTestConfig } from "./base.mjs";

export const sharedNodeTestConfig = {
  ...sharedVitestTestConfig,
  environment: "node",
};
