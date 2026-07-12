import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs'
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  // ── Temporal workflow determinism barrier ──────────────────────────────────
  // Workflow code must never import the @armageddon/shared barrel.  The barrel
  // re-exports gate.ts which pulls @supabase/supabase-js — a server-only dep
  // that inflates the workflow bundle from ~1.4 MB to ~4 MB and introduces
  // non-deterministic dynamic-require warnings at runtime.  Use subpaths such
  // as @armageddon/shared/types (pure functions, no server deps) instead.
  // Activities may use the barrel freely; this rule is scoped to workflow files.
  {
    files: ['src/temporal/workflows.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@armageddon/shared',
          message:
            'Temporal workflow code must import a deterministic subpath ' +
            '(e.g. @armageddon/shared/types), never the server-capable barrel. ' +
            'See omni-recall/2026-07-12-p0-rescue-docker-ssrf-temporal.md.',
        }],
      }],
    },
  }
);
