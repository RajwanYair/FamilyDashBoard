import { createWebTsAppEslintConfig } from "./tooling/eslint/web-ts-app.mjs";

export default createWebTsAppEslintConfig({
  ignores: ["node_modules/**", "dist/**", "worker/**", "coverage/**"],
  sourceFiles: ["src/**/*.ts"],
  sourceProject: "./tsconfig.json",
  tsconfigRootDir: import.meta.dirname,
  testFiles: ["tests/**/*.ts"],
  swFiles: ["sw.js"],
});
