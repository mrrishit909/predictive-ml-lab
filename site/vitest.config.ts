import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // tests/e2e/* are Playwright specs, run via `npm run test:e2e`, not Vitest.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
})
