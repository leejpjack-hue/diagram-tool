import { defineConfig, devices } from '@playwright/test';
import { testTimeout } from './e2e/testTimeout';

// A different port permits a fresh preview when 4173 is already in use.
const previewPort = Number(process.env.PW_PREVIEW_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: testTimeout(30_000),
  expect: { timeout: testTimeout(5_000) },
  use: {
    // Tests that use the development editor hook stay on Vite. Preview-only
    // cases use PW_BASE_URL so a separate production checkout is never reused.
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.PW_NO_VIDEO === '1' ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional for environments where font hosts cannot be reached.
        ...(process.env.PW_NO_EXTERNAL_FONTS === '1' ? {
          launchOptions: { args: ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND'] },
        } : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
      url: `http://127.0.0.1:${previewPort}`,
      reuseExistingServer: true,
      timeout: 180000,
    },
  ],
});
