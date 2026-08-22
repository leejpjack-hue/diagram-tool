import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_SHARE_STORE_DIR, resolveShareStoreDirectory } from './shareStorePath';

describe('resolveShareStoreDirectory', () => {
  it('prefers SHARE_STORE_DIR, including a stable absolute path', () => {
    expect(resolveShareStoreDirectory({ SHARE_STORE_DIR: '/var/lib/diagram-tool/shares' }, { cwd: '/srv/app/dist' }))
      .toBe('/var/lib/diagram-tool/shares');
    expect(resolveShareStoreDirectory({ SHARE_STORE_DIR: '.share-store-e2e' }, { cwd: '/tmp/work' }))
      .toBe('/tmp/work/.share-store-e2e');
  });

  it('keeps production and dist-cwd stores outside the deploy artifact', () => {
    expect(resolveShareStoreDirectory({}, { production: true, cwd: '/srv/diagram-tool/dist' }))
      .toBe(join(homedir(), '.local/share/diagram-tool/shares'));
    expect(resolveShareStoreDirectory({ NODE_ENV: 'production' }, { cwd: '/srv/diagram-tool' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(resolveShareStoreDirectory({}, { production: false, cwd: '/srv/diagram-tool/dist' }))
      .toBe(PRODUCTION_SHARE_STORE_DIR);
    expect(PRODUCTION_SHARE_STORE_DIR).not.toContain('/dist');
    expect(PRODUCTION_SHARE_STORE_DIR.startsWith(homedir())).toBe(true);
  });

  it('uses a local project folder only for non-production checkouts', () => {
    expect(resolveShareStoreDirectory({ NODE_ENV: 'development' }, { production: false, cwd: '/workspace' }))
      .toBe('/workspace/.share-store');
  });
});
