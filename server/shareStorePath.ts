import { isAbsolute, resolve } from 'node:path';

/**
 * Pinned production data dir. Never derived from process.cwd().
 * A store under dist/ dies when deploy swaps the artifact.
 */
export const PRODUCTION_SHARE_STORE_DIR = '/var/lib/diagram-tool/share-store';

export function resolveShareStoreDirectory(
  env: NodeJS.ProcessEnv = process.env,
  options: { cwd?: string } = {},
): string {
  const override = env.SHARE_STORE_DIR?.trim();
  if (override) {
    return isAbsolute(override) ? override : resolve(options.cwd ?? process.cwd(), override);
  }
  return PRODUCTION_SHARE_STORE_DIR;
}
