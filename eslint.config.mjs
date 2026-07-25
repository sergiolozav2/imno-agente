import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Framework-neutral packages that must not import UI/runtime frameworks.
 * Lightweight stand-in for full Nx module-boundary tags: it keeps
 * domain/contracts/use-case/config code portable and testable.
 */
const frameworkNeutralGlobs = [
  'packages/contracts/**/*.ts',
  'packages/domain/**/*.ts',
  'packages/agent-core/**/*.ts',
  'packages/content-core/**/*.ts',
  'packages/runtime-config/**/*.ts',
]

const forbiddenFrameworkImports = [
  { name: 'next', message: 'Framework-neutral packages must not import Next.js.' },
  { name: 'react', message: 'Framework-neutral packages must not import React.' },
  { name: 'react-dom', message: 'Framework-neutral packages must not import react-dom.' },
  { name: 'payload', message: 'Framework-neutral packages must not import Payload.' },
]

const forbiddenFrameworkPatterns = [
  '@payloadcms/*',
  '@mastra/*',
  'next/*',
  'react/*',
  '@imno/integration-*',
  '@imno/data-access-*',
]

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/.nx/**',
      '**/coverage/**',
      'apps/**/next-env.d.ts',
      'apps/**/cloudflare-env.d.ts',
      '**/*.config.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },
  {
    files: frameworkNeutralGlobs,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbiddenFrameworkImports,
          patterns: forbiddenFrameworkPatterns,
        },
      ],
    },
  },
)
