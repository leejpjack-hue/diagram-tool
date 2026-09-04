type AnalyticsProps = Record<string, string | boolean | number | undefined>;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim();
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/$/, '');
const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();

const DISTINCT_KEY = 'diagramtool.anonymous_id';

function anonymousId(): string {
  try {
    const existing = localStorage.getItem(DISTINCT_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(DISTINCT_KEY, created);
    return created;
  } catch {
    return 'anonymous';
  }
}

function compact(props?: AnalyticsProps): Record<string, string | boolean | number> {
  const out: Record<string, string | boolean | number> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

async function capturePosthog(event: string, props?: AnalyticsProps): Promise<void> {
  if (!POSTHOG_KEY) return;
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        properties: {
          distinct_id: anonymousId(),
          $current_url: window.location.href,
          ...compact(props),
        },
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the landing UI.
  }
}

function gtag(...args: unknown[]): void {
  const w = window as Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = w.gtag ?? function gtagStub(...args: unknown[]) {
    w.dataLayer?.push(args);
  };
  w.gtag(...args);
}

function ensureGa4(): void {
  if (!GA4_ID || document.getElementById('ga4-gtag')) return;
  const script = document.createElement('script');
  script.id = 'ga4-gtag';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(script);
  gtag('js', new Date());
  gtag('config', GA4_ID, { send_page_view: false });
}

export function trackPageview(): void {
  if (POSTHOG_KEY) {
    void capturePosthog('$pageview');
    return;
  }
  if (GA4_ID) {
    ensureGa4();
    gtag('event', 'page_view', { page_location: window.location.href, page_path: '/' });
  }
}

export function track(event: string, props?: AnalyticsProps): void {
  if (POSTHOG_KEY) {
    void capturePosthog(event, props);
    return;
  }
  if (GA4_ID) {
    ensureGa4();
    gtag('event', event, compact(props));
  }
}

export function analyticsBackend(): 'posthog' | 'ga4' | 'noop' {
  if (POSTHOG_KEY) return 'posthog';
  if (GA4_ID) return 'ga4';
  return 'noop';
}
