import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/predictive-ml-lab/',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Exercises the real production build (base path, asset hashing,
    // single-wasm dedup) - not the dev server - since that's what ships.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
