import { track, trackPageview } from './analytics';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

function utmProperties(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const props: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) props[key] = value.slice(0, 200);
  }
  return props;
}

function bindOpenAppClicks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('a.js-open-app').forEach(link => {
    if (link.dataset.bound === '1') return;
    link.dataset.bound = '1';
    link.addEventListener('click', () => {
      track('cta_open_app_click', utmProperties());
    });
  });
}

function boot(): void {
  trackPageview();
  bindOpenAppClicks();
}

boot();
