export const WAITLIST_UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

export type WaitlistUtmKey = (typeof WAITLIST_UTM_KEYS)[number];

export type WaitlistPayload = {
  email: string;
  note?: string;
} & Partial<Record<WaitlistUtmKey, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX = 500;
const UTM_MAX = 200;

function asTrimmedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export function readUtmsFromSearch(search: string): Partial<Record<WaitlistUtmKey, string>> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const utms: Partial<Record<WaitlistUtmKey, string>> = {};
  for (const key of WAITLIST_UTM_KEYS) {
    const value = asTrimmedString(params.get(key), UTM_MAX);
    if (value) utms[key] = value;
  }
  return utms;
}

export function normalizeWaitlist(input: unknown):
  { ok: true; value: WaitlistPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Valid email required.' };
  }

  const record = input as Record<string, unknown>;
  const email = asTrimmedString(record.email, 320)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Valid email required.' };
  }

  const payload: WaitlistPayload = { email };
  const note = asTrimmedString(record.note, NOTE_MAX);
  if (note) payload.note = note;

  for (const key of WAITLIST_UTM_KEYS) {
    const value = asTrimmedString(record[key], UTM_MAX);
    if (value) payload[key] = value;
  }

  return { ok: true, value: payload };
}
