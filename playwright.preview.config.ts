import base from './playwright.config';

// Exercise an already-running build (Vite preview or the DT Worker).
export default {
  ...base,
  testMatch: ['**/type-to-flow-skill.spec.ts', '**/live-smoke.spec.ts'],
  use: { ...base.use, baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173' },
  webServer: [],
};
