import { describe, expect, it } from 'vitest';
import { normalizeWaitlist, readUtmsFromSearch } from './validate';

describe('normalizeWaitlist', () => {
  it('requires a valid email', () => {
    expect(normalizeWaitlist({ email: 'not-an-email' })).toEqual({
      ok: false,
      error: 'Valid email required.',
    });
  });

  it('keeps optional note and UTMs', () => {
    expect(normalizeWaitlist({
      email: ' Jack@Company.com ',
      note: ' AWS architecture ',
      utm_source: 'twitter',
      utm_campaign: 'p0',
    })).toEqual({
      ok: true,
      value: {
        email: 'jack@company.com',
        note: 'AWS architecture',
        utm_source: 'twitter',
        utm_campaign: 'p0',
      },
    });
  });
});

describe('readUtmsFromSearch', () => {
  it('reads utm_* query params', () => {
    expect(readUtmsFromSearch('?utm_source=li&utm_medium=social&other=1')).toEqual({
      utm_source: 'li',
      utm_medium: 'social',
    });
  });
});
