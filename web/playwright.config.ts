import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000',
      cwd: '..',
      env: { API_KEYS: 'local-dev-placeholder-key' },
      port: 8000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
