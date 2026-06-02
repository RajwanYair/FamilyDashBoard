---
description: "Audit workspace for generated files, enforce $TEMP output paths, and clean intermediate artifacts."
mode: "agent"
---

# Clean Generated Files

Audit the workspace and enforce the rule that all generated/intermediate files go to `$env:TEMP/FamilyDashBoard/`, never into the workspace tree.

## Steps

1. **Scan** — Find any generated files in the workspace root or src/ that should not be committed:
   - `*.log`, `*.bak`, `*.tmp`, `*.old`
   - `vitest-*.txt`, `vitest-*.json`, `*_output.txt`
   - `coverage/`, `test-results/`, `playwright-report/`
   - `dist/`, `tsconfig.tsbuildinfo`, `.eslintcache`

2. **Clean** — Remove them:
   ```powershell
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue dist, coverage, test-results, playwright-report, blob-report, .playwright, .eslintcache, tsconfig.tsbuildinfo
   Get-ChildItem -Recurse -Include *.tmp,*.bak,*.log,*_output.txt | Remove-Item -Force
   ```

3. **Verify** — Confirm `.gitignore` covers all patterns found.

4. **Report** — List what was cleaned and confirm the workspace is production-ready.
