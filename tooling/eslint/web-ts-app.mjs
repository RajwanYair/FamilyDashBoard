/**
 * Shared ESLint config factory for TypeScript web apps — vendored into this
 * repo for CI self-sufficiency.
 * Source of truth: MyScripts/tooling/eslint/web-ts-app.mjs
 * Keep in sync when upgrading ESLint / typescript-eslint.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  fetch: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  requestIdleCallback: "readonly",
  console: "readonly",
  getComputedStyle: "readonly",
  Map: "readonly",
  Set: "readonly",
  Promise: "readonly",
  URLSearchParams: "readonly",
  URL: "readonly",
  Intl: "readonly",
  performance: "readonly",
  HTMLElement: "readonly",
  HTMLSelectElement: "readonly",
  KeyboardEvent: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  DOMParser: "readonly",
  location: "readonly",
  history: "readonly",
  Blob: "readonly",
  alert: "readonly",
  prompt: "readonly",
  Notification: "readonly",
  CSS: "readonly",
  MutationObserver: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  PushManager: "readonly",
  ServiceWorkerRegistration: "readonly",
  structuredClone: "readonly",
  queueMicrotask: "readonly",
  crypto: "readonly",
};

export const sharedRules = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-dupe-args": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-unreachable": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
  eqeqeq: ["error", "smart"],
  "no-var": "error",
  "no-redeclare": "error",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-debugger": "error",
  "no-sparse-arrays": "error",
  "no-template-curly-in-string": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-loss-of-precision": "error",
  "no-useless-escape": "error",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-throw-literal": "error",
  "no-useless-catch": "error",
  "no-useless-concat": "error",
  "no-useless-return": "error",
  "no-with": "error",
  "no-shadow-restricted-names": "error",
  "no-delete-var": "error",
  "no-label-var": "error",
  "no-global-assign": "error",
  "no-octal": "error",
  "no-fallthrough": "error",
  "no-case-declarations": "error",
  "prefer-const": "error",
  "no-prototype-builtins": "off",
  "no-inner-declarations": "off",
};

export function createWebTsAppEslintConfig({
  ignores = ["node_modules/**", "dist/**", "coverage/**"],
  sourceFiles = ["src/**/*.ts"],
  sourceProject = "./tsconfig.json",
  tsconfigRootDir,
  testFiles = ["tests/**/*.ts"],
  swFiles = ["sw.js"],
  sourceGlobals = {},
  testGlobals = {},
  swGlobals = {},
  sourceRules = {},
  testRules = {},
  swRules = {},
} = {}) {
  const config = [
    {
      ignores,
    },
    {
      files: sourceFiles,
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      languageOptions: {
        globals: {
          ...browserGlobals,
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
            varsIgnorePattern:
              "^_|^load|^render|^init|^toggle|^update|^stamp|^build|^check|^accept|^copy|^export|^import|^share|^sw|^request|^apply|^schedule|^card|^save|^trigger|^show|^hide|^reset|^filter|^play|^inject|^set[A-Z]|^cycle|^random",
            argsIgnorePattern: "^_|^e$|^k$",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/no-misused-promises": [
          "error",
          { checksVoidReturn: { attributes: false } },
        ],
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "no-console": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/no-import-type-side-effects": "error",
        ...sourceRules,
      },
    },
    {
      files: testFiles,
      extends: [...tseslint.configs.recommended],
      languageOptions: {
        globals: {
          ...browserGlobals,
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
        // ADR-073: forbid focused/skipped tests in committed test files.
        // Defence in depth alongside scripts/check-test-focus-skip.mjs.
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "CallExpression[callee.object.name=/^(it|test|describe)$/][callee.property.name=/^(only|skip)$/]",
            message:
              "Forbidden focused/skipped test (ADR-073). Remove .only / .skip before committing.",
          },
        ],
        ...testRules,
      },
    },
  ];

  if (Array.isArray(swFiles) && swFiles.length > 0) {
    config.push({
      files: swFiles,
      ...js.configs.recommended,
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "script",
        globals: {
          self: "readonly",
          caches: "readonly",
          fetch: "readonly",
          Response: "readonly",
          Headers: "readonly",
          Request: "readonly",
          URL: "readonly",
          clients: "readonly",
          addEventListener: "readonly",
          skipWaiting: "readonly",
          console: "readonly",
          ...swGlobals,
        },
      },
      rules: {
        ...sharedRules,
        "no-undef": "error",
        ...swRules,
      },
    });
  }

  return tseslint.config(...config);
}
