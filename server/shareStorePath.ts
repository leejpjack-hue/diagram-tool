import { isAbsolute, resolve } from 'node:path';

/** Stable VPS data dir. Never derived from process.cwd() — a store under dist/ dies on every release. */
export const PRODUCTION_SHARE_STORE_DIR = '/var/lib/diagram-tool/share-store';

export function resolveShareStoreDirectory(
  env: NodeJS.ProcessEnv = process.env,
  options: { production?: boolean; cwd?: string } = {},
): string {
  const cwd = options.cwd ?? process.cwd();
  const override = env.SHARE_STORE_DIR?.trim();
  if (override) {
    return isAbsolute(override) ? override : resolve(cwd, override);
  }

  const production = options.production ?? env.NODE_ENV === 'production';
  if (production) return PRODUCTION_SHARE_STORE_DIR;
  return resolve(cwd, '.share-store');
}
