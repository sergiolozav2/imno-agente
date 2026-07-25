import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

/**
 * Shared vitest configuration for every package/app.
 * `tsconfigPaths` resolves the `@imno/*` aliases from tsconfig.base.json so
 * packages import each other's source directly without a build step.
 */
export const sharedVitestConfig = defineConfig({
  plugins: [tsconfigPaths({ projects: [resolve(workspaceRoot, 'tsconfig.base.json')] })],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
  },
})

export default sharedVitestConfig
