import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const e2eStore = resolve(process.cwd(), '.share-store-e2e');
const e2ePreviewStore = resolve(process.cwd(), '.share-store-e2e-preview');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `SHARE_STORE_DIR=${e2eStore} npm run dev -- --port 5173`,
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: `SHARE_STORE_DIR=${e2ePreviewStore} npm run build && SHARE_STORE_DIR=${e2ePreviewStore} npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`,
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 180000,
    },
  ],
});
