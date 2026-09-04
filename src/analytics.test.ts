import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAnalytics() {
  vi.resetModules();
  return import('./analytics');
}

describe('analytics backend', () => {
  afterEach(() => {
    document.getElementById('ga4-gtag')?.remove();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads gtag/GA4 when only VITE_GA4_MEASUREMENT_ID is set', async () => {
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-HLTGGMPREJ');
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { analyticsBackend, trackPageview } = await loadAnalytics();
    expect(analyticsBackend()).toBe('ga4');
    trackPageview();
    const script = document.getElementById('ga4-gtag') as HTMLScriptElement | null;
    expect(script).toBeTruthy();
    expect(script?.src).toContain('googletagmanager.com/gtag/js?id=G-HLTGGMPREJ');
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    expect(typeof gtag).toBe('function');
  });

  it('prefers PostHog only when the PostHog key is present', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-HLTGGMPREJ');
    const { analyticsBackend, trackPageview } = await loadAnalytics();
    expect(analyticsBackend()).toBe('posthog');
    trackPageview();
    expect(document.getElementById('ga4-gtag')).toBeNull();
  });

  it('is a no-op when neither key is set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', '');
    const { analyticsBackend, trackPageview } = await loadAnalytics();
    expect(analyticsBackend()).toBe('noop');
    trackPageview();
    expect(document.getElementById('ga4-gtag')).toBeNull();
  });
});
