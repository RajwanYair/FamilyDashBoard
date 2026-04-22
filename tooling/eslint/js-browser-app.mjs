/**
 * Shared ESLint config factory for vanilla JavaScript browser apps.
 * Source of truth: MyScripts/tooling/eslint/js-browser-app.mjs
 * Keep in sync when upgrading ESLint.
 *
 * Usage:
 *   import { createJsBrowserAppEslintConfig } from "./tooling/eslint/js-browser-app.mjs";
 *   export default createJsBrowserAppEslintConfig({ tsconfigRootDir: import.meta.dirname });
 */
import js from "@eslint/js";
import { browserGlobals, sharedRules } from "./web-ts-app.mjs";

export function createJsBrowserAppEslintConfig({
  ignores = ["node_modules/**", "dist/**", "coverage/**"],
  sourceFiles = ["src/**/*.js", "*.js"],
  testFiles = ["tests/**/*.js"],
  sourceGlobals = {},
  testGlobals = {},
  sourceRules = {},
  testRules = {},
} = {}) {
  return [
    { ignores },
    {
      files: sourceFiles,
      ...js.configs.recommended,
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: {
          ...browserGlobals,
          ...sourceGlobals,
        },
      },
      rules: {
        ...sharedRules,
        // JS-only: allow console in non-TypeScript projects
        "no-console": "warn",
        ...sourceRules,
      },
    },
    {
      files: testFiles,
      ...js.configs.recommended,
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
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
        "no-unused-vars": "off",
        "no-empty": ["error", { allowEmptyCatch: true }],
        ...testRules,
      },
    },
  ];
}
