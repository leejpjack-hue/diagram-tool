import { describe, expect, it } from 'vitest';
import { PRODUCTION_SHARE_STORE_DIR, resolveShareStoreDirectory } from './shareStorePath';

describe('resolveShareStoreDirectory', () => {
  it('defaults to a pinned absolute path outside dist/, never resolve(cwd, ".share-store")', () => {
    expect(PRODUCTION_SHARE_STORE_DIR).toBe('/var/lib/diagram-tool/share-store');
    expect(resolveShareStoreDirectory({}, { cwd: '/srv/diagram-tool/dist' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(resolveShareStoreDirectory({ NODE_ENV: 'development' }, { cwd: '/workspace' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(resolveShareStoreDirectory({ NODE_ENV: 'production' }, { cwd: '/tmp/not-the-app' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(PRODUCTION_SHARE_STORE_DIR.includes('/dist')).toBe(false);
  });

  it('prefers an absolute SHARE_STORE_DIR, including a sibling of dist/', () => {
    expect(resolveShareStoreDirectory(
      { SHARE_STORE_DIR: '/srv/diagram-tool/share-store', NODE_ENV: 'production' },
      { cwd: '/srv/diagram-tool/dist' },
    )).toBe('/srv/diagram-tool/share-store');
  });

  it('resolves an explicit relative SHARE_STORE_DIR only when the env is set', () => {
    expect(resolveShareStoreDirectory(
      { SHARE_STORE_DIR: '.share-store-e2e-preview' },
      { cwd: '/tmp/work' },
    )).toBe('/tmp/work/.share-store-e2e-preview');
  });
});
