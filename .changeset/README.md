# Changesets

This directory contains **pending changeset files** that describe unreleased changes.

## Workflow

1. **After each feature branch**, create a changeset:

   ```sh
   npm run changeset:add
   ```

   This creates a new `.md` file in this directory describing the change type (major / minor / patch) and a summary.

2. **On release**, bump versions and update CHANGELOG.md:

   ```sh
   npm run changeset:version
   ```

3. **After tagging**, publish (no-op for a static PWA — the step just confirms version bumps are applied):

   ```sh
   npm run changeset:publish
   ```

## Static PWA Notes

FamilyDashBoard is a static PWA with no npm package publication. The `access: "restricted"` config disables registry publishing. Changesets are used solely to:

- Maintain `CHANGELOG.md` automatically from feature descriptions
- Enforce a consistent commit-to-release paper trail
- Support semver bump decisions (major / minor / patch)

## Setup

`@changesets/cli` is installed in the **parent** `MyScripts/` workspace. Run `npm install` from there if the `changeset` command is missing.
