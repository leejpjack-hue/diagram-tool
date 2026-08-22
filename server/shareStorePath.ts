import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

export const PRODUCTION_SHARE_STORE_DIR = join(homedir(), '.local/share/diagram-tool/shares');

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
  if (production || cwdLooksLikeDeployArtifact(cwd)) {
    return PRODUCTION_SHARE_STORE_DIR;
  }
  return resolve(cwd, '.share-store');
}

function cwdLooksLikeDeployArtifact(cwd: string): boolean {
  const normalized = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.endsWith('/dist') || /\/dist\//.test(normalized);
}
