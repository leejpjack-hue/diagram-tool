import { track, trackPageview } from './analytics';
import { normalizeWaitlist, readUtmsFromSearch, WAITLIST_UTM_KEYS } from './waitlist/validate';

const SUCCESS_COPY = 'You’re on the list. We’ll email when accounts/sync ship.';

function utmProperties() {
  return readUtmsFromSearch(window.location.search);
}

function showSuccess(root: HTMLElement): void {
  root.innerHTML = `
    <div class="success">
      <p>${SUCCESS_COPY}</p>
      <a class="muted-link js-open-app" href="/app">Open the workspace →</a>
    </div>
  `;
  bindOpenAppClicks(root);
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

async function submitWaitlist(form: HTMLFormElement, errorEl: HTMLElement): Promise<void> {
  const data = new FormData(form);
  const payload = {
    email: String(data.get('email') ?? ''),
    note: String(data.get('note') ?? ''),
    ...utmProperties(),
  };
  const parsed = normalizeWaitlist(payload);
  if (!parsed.ok) {
    errorEl.hidden = false;
    errorEl.textContent = parsed.error;
    return;
  }

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  errorEl.hidden = true;

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.value),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Could not join the waitlist.' }));
      throw new Error(typeof body.error === 'string' ? body.error : 'Could not join the waitlist.');
    }

    const notePresent = Boolean(parsed.value.note);
    const utmProps = Object.fromEntries(
      WAITLIST_UTM_KEYS.filter(key => parsed.value[key]).map(key => [key, parsed.value[key]]),
    );
    track('waitlist_submit_success', {
      ...utmProps,
      optional_note_present: notePresent,
    });
    showSuccess(form.parentElement ?? form);
  } catch (error) {
    errorEl.hidden = false;
    errorEl.textContent = error instanceof Error ? error.message : 'Could not join the waitlist.';
    if (submit) submit.disabled = false;
  }
}

function boot(): void {
  trackPageview();
  bindOpenAppClicks();

  const form = document.getElementById('waitlist-form');
  const errorEl = document.getElementById('waitlist-error');
  if (!(form instanceof HTMLFormElement) || !errorEl) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    void submitWaitlist(form, errorEl);
  });
}

boot();
