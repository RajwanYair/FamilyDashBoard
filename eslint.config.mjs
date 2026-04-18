import js from "@eslint/js";
import tseslint from "typescript-eslint";

// ── Shared browser globals ──────────────────────────────────────────────────
const browserGlobals = {
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

// ── Shared JS quality rules (applied to both JS and TS) ─────────────────────
const sharedRules = {
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

export default tseslint.config(
  // ── Global ignores ───────────────────────────────────────────────────────
  {
    ignores: ["node_modules/**", "dist/**", "worker/**", "coverage/**"],
  },

  // ── TypeScript source files ──────────────────────────────────────────────
  {
    files: ["src/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: browserGlobals,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...sharedRules,
      // TypeScript-specific overrides
      "no-undef": "off", // TS handles this better
      "no-unused-vars": "off", // use @typescript-eslint/no-unused-vars
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
        { "checksVoidReturn": { "attributes": false } }
      ],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      // Sprint 7: stricter rules
      "no-console": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },

  // ── Vitest test files ────────────────────────────────────────────────────
  {
    files: ["tests/**/*.ts"],
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
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // ── Service Worker (vanilla JS) ──────────────────────────────────────────
  {
    files: ["sw.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        Response: "readonly",
        URL: "readonly",
        clients: "readonly",
        addEventListener: "readonly",
        skipWaiting: "readonly",
        console: "readonly",
      },
    },
    rules: {
      ...sharedRules,
      "no-undef": "error",
    },
  },
);
