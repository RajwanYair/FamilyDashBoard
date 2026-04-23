/**
 * Commitlint configuration — FamilyDashBoard
 *
 * Enforces Conventional Commits format:
 *   <type>(<scope>): <subject>
 *
 * Install (in parent MyScripts/):
 *   npm install --save-dev @commitlint/cli @commitlint/config-conventional
 *
 * Activate (in package.json scripts):
 *   "commitlint": "commitlint --from=HEAD~1 --to=HEAD"
 *
 * Or wire as a git hook via husky:
 *   npx husky add .husky/commit-msg 'npx commitlint --edit $1'
 *
 * Reference: https://www.conventionalcommits.org/
 */

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow common scopes used in this repo
    "scope-enum": [
      2,
      "always",
      [
        // Source areas
        "core",
        "ui",
        "cards",
        "worker",
        "sw",
        "styles",
        "types",
        // Card names (for card-specific changes)
        "weather",
        "stocks",
        "currency",
        "calendar",
        "hebrew-cal",
        "alerts",
        "motivation",
        "tasks",
        "system-info",
        "countdown",
        "news",
        // Infrastructure
        "ci",
        "build",
        "deps",
        "tests",
        "docs",
        "config",
        "release",
      ],
    ],
    // Subject line max length: 100 chars is reasonable for a TV dashboard
    "header-max-length": [2, "always", 100],
    // Allow empty body (most commits don't need a detailed body)
    "body-max-line-length": [1, "always", 200],
    // No trailing period on subject
    "subject-full-stop": [2, "never", "."],
    // Enforce lowercase type
    "type-case": [2, "always", "lower-case"],
    // Standard types + "sprint" for sprint commits
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "test", "refactor", "perf", "style", "ci", "build", "revert"],
    ],
  },
  // Ignore merge commits, Renovate bumps, and GitHub release commits
  ignores: [
    (msg) => msg.startsWith("Merge "),
    (msg) => /^chore\(deps(-dev)?\): bump/.test(msg),
    (msg) => msg.startsWith("Release v"),
  ],
};
