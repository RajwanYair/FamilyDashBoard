/**
 * Shared ESLint config factory for Node.js / Cloudflare Worker TypeScript apps.
 * Source of truth: MyScripts/tooling/eslint/node-ts-app.mjs
 * Keep in sync when upgrading ESLint / typescript-eslint.
 *
 * Usage:
 *   import { createNodeTsAppEslintConfig } from "./tooling/eslint/node-ts-app.mjs";
 *   export default createNodeTsAppEslintConfig({ tsconfigRootDir: import.meta.dirname });
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { sharedRules } from "./web-ts-app.mjs";

/** Globals available in a Node.js or Cloudflare Worker environment. */
export const nodeGlobals = {
  // Node.js built-ins
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "writable",
  global: "readonly",
  // Common async primitives
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  queueMicrotask: "readonly",
  Promise: "readonly",
  Map: "readonly",
  Set: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  structuredClone: "readonly",
  crypto: "readonly",
  console: "readonly",
};

/** Additional globals for Cloudflare Workers (KV, Durable Objects, etc.) */
export const cloudflareGlobals = {
  ...nodeGlobals,
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  FormData: "readonly",
  ReadableStream: "readonly",
  WritableStream: "readonly",
  TransformStream: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  Blob: "readonly",
  File: "readonly",
  caches: "readonly",
  self: "readonly",
};

export function createNodeTsAppEslintConfig({
  ignores = ["node_modules/**", "dist/**", "coverage/**"],
  sourceFiles = ["src/**/*.ts"],
  sourceProject = "./tsconfig.json",
  tsconfigRootDir,
  testFiles = ["tests/**/*.ts", "**/*.test.ts"],
  useCloudflareGlobals = false,
  sourceGlobals = {},
  testGlobals = {},
  sourceRules = {},
  testRules = {},
} = {}) {
  const baseGlobals = useCloudflareGlobals ? cloudflareGlobals : nodeGlobals;

  return [
    { ignores },
    {
      files: sourceFiles,
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      languageOptions: {
        globals: {
          ...baseGlobals,
          ...sourceGlobals,
        },
        parserOptions: {
          project: sourceProject,
          tsconfigRootDir,
        },
      },
      rules: {
        ...sharedRules,
        "no-undef": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_|^e$",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } },
        ],
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/no-import-type-side-effects": "error",
        // Node context — console is intentional
        "no-console": "off",
        ...sourceRules,
      },
    },
    {
      files: testFiles,
      extends: [...tseslint.configs.recommended],
      languageOptions: {
        globals: {
          ...baseGlobals,
          vi: "readonly",
          describe: "readonly",
          it: "readonly",
          test: "readonly",
          expect: "readonly",
          beforeEach: "readonly",
          afterEach: "readonly",
          beforeAll: "readonly",
          afterAll: "readonly",
          ...testGlobals,
        },
      },
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "no-empty": ["error", { allowEmptyCatch: true }],
        "no-console": "off",
        ...testRules,
      },
    },
  ];
}
