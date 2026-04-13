import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow empty catch clauses
      '@typescript-eslint/no-empty-function': 'off',
      // Allow floating promises (common in fire-and-forget card loaders)
      '@typescript-eslint/no-floating-promises': 'warn',
      // Prefer nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    },
  },
  {
    // Only lint src/ and tests/
    ignores: ['dist/**', 'node_modules/**', 'src/_*.js', 'src/_*.html', 'src/_*.css', '*.cjs', '*.mjs', 'tests/dashboard.test.mjs', 'check*.mjs', 'eslint.config.mjs', 'sw.js'],
  },
);
