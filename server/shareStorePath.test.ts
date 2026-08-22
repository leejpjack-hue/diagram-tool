import { describe, expect, it } from 'vitest';
import { PRODUCTION_SHARE_STORE_DIR, resolveShareStoreDirectory } from './shareStorePath';

describe('resolveShareStoreDirectory', () => {
  it('uses a pinned absolute production path that is never under dist/', () => {
    expect(PRODUCTION_SHARE_STORE_DIR).toBe('/var/lib/diagram-tool/share-store');
    expect(PRODUCTION_SHARE_STORE_DIR.startsWith('/')).toBe(true);
    expect(PRODUCTION_SHARE_STORE_DIR.includes('/dist')).toBe(false);
  });

  it('prefers an absolute SHARE_STORE_DIR over the production default', () => {
    expect(resolveShareStoreDirectory(
      { SHARE_STORE_DIR: '/srv/diagram-tool/share-store', NODE_ENV: 'production' },
      { cwd: '/srv/diagram-tool/dist' },
    )).toBe('/srv/diagram-tool/share-store');
  });

  it('ignores a relative SHARE_STORE_DIR in production so cwd cannot place the store in dist/', () => {
    expect(resolveShareStoreDirectory(
      { SHARE_STORE_DIR: '.share-store', NODE_ENV: 'production' },
      { cwd: '/srv/diagram-tool/dist' },
    )).toBe(PRODUCTION_SHARE_STORE_DIR);
  });

  it('does not consult cwd when NODE_ENV is production', () => {
    expect(resolveShareStoreDirectory({ NODE_ENV: 'production' }, { cwd: '/srv/diagram-tool/dist' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(resolveShareStoreDirectory({ NODE_ENV: 'production' }, { cwd: '/tmp/not-the-app' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(resolveShareStoreDirectory({}, { production: true, cwd: '/workspace' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
  });

  it('resolves a relative SHARE_STORE_DIR only for local/e2e', () => {
    expect(resolveShareStoreDirectory(
      { SHARE_STORE_DIR: '.share-store-e2e', NODE_ENV: 'development' },
      { production: false, cwd: '/tmp/work' },
    )).toBe('/tmp/work/.share-store-e2e');
  });

  it('uses a local project folder only for non-production checkouts', () => {
    expect(resolveShareStoreDirectory({ NODE_ENV: 'development' }, { production: false, cwd: '/workspace' }))
      .toBe('/workspace/.share-store');
  });
});
