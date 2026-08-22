import { isAbsolute, resolve } from 'node:path';

/** Stable VPS data dir. Never derived from process.cwd() — a store under dist/ dies on every release. */
export const PRODUCTION_SHARE_STORE_DIR = '/var/lib/diagram-tool/share-store';

export function resolveShareStoreDirectory(
  env: NodeJS.ProcessEnv = process.env,
  options: { production?: boolean; cwd?: string } = {},
): string {
  const production = options.production ?? env.NODE_ENV === 'production';
  const override = env.SHARE_STORE_DIR?.trim();
  if (override) {
    if (isAbsolute(override)) return override;
    // Relative overrides are local/e2e only. Production must not resolve against cwd
    // (vite preview often runs with cwd = …/dist).
    if (production) return PRODUCTION_SHARE_STORE_DIR;
    return resolve(options.cwd ?? process.cwd(), override);
  }

  if (production) return PRODUCTION_SHARE_STORE_DIR;
  return resolve(options.cwd ?? process.cwd(), '.share-store');
}
