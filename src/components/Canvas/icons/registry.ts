// Vite glob imports - load every .svg in each subfolder as a raw string at
// build time. Eager so we don't pay an async cost per render.
const providerModules = import.meta.glob('./providers/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const kindModules = import.meta.glob('./kinds/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const nodeModules = import.meta.glob('./nodes/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function buildRegistry(modules: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, raw] of Object.entries(modules)) {
    const name = path.split('/').pop()!.replace(/\.svg$/, '').toLowerCase();
    out[name] = raw;
  }
  return out;
}

export const PROVIDER_ICONS = buildRegistry(providerModules);
export const KIND_ICONS = buildRegistry(kindModules);
export const NODE_ICONS = buildRegistry(nodeModules);

export const hasProviderIcon = (name: string) => Boolean(PROVIDER_ICONS[name?.toLowerCase()]);
export const hasKindIcon = (name: string) => Boolean(KIND_ICONS[name?.toLowerCase()]);
export const hasNodeIcon = (name: string) => Boolean(NODE_ICONS[name?.toLowerCase()]);
