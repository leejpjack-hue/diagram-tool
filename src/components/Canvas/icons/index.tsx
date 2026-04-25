/**
 * Icon registry for diagram nodes.
 *
 * HOW TO ADD / REPLACE AN ICON
 * ----------------------------
 * 1. Drop a `.svg` file into one of the folders below. Filename (without
 *    extension) becomes the lookup key, e.g. `providers/aws.svg` → `"aws"`.
 *      - providers/  → cloud-provider badge glyphs (aws, azure, gcp, k8s, ...)
 *      - kinds/      → cloud "kind" glyphs (lambda, s3, pod, service, ...)
 *      - nodes/      → built-in node-type glyphs (database, queue, service, ...)
 *
 * 2. SVG authoring rules (please follow):
 *      - Root: `<svg viewBox="0 0 16 16" width="100%" height="100%">`
 *        (use 0 0 24 24 if you prefer; just keep it square)
 *      - For monochrome shapes use `fill="currentColor"` /
 *        `stroke="currentColor"` so the parent badge controls the tint.
 *        Multi-color icons (e.g. GCP four dots) may hardcode hex.
 *      - Leave ~10% inner padding so the glyph doesn't touch the badge edge.
 *      - No <title>, <desc>, or text labels — labels are rendered separately.
 *      - No fixed pixel `width`/`height` on the root (use 100%).
 *
 * 3. That's it. `import.meta.glob` below picks it up automatically — no
 *    code change needed for a new file.
 */

// Vite glob imports — load every .svg in each subfolder as a raw string at
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

type IconProps = {
  name: string;
  size?: number;
  /** Optional fallback rendered when no SVG matches `name`. */
  fallback?: React.ReactNode;
  /** Forwarded to the wrapping <span>. Lets parents tweak color, etc. */
  style?: React.CSSProperties;
};

function renderIcon(
  registry: Record<string, string>,
  { name, size = 24, fallback = null, style }: IconProps,
) {
  const raw = registry[name?.toLowerCase()];
  if (!raw) return <>{fallback}</>;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        lineHeight: 0,
        ...style,
      }}
      // SVG content is authored by us / our designer and lives in this repo
      // as static assets — safe to inject directly.
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  );
}

export function ProviderIcon(props: IconProps) {
  return renderIcon(PROVIDER_ICONS, props);
}

export function KindIcon(props: IconProps) {
  return renderIcon(KIND_ICONS, props);
}

export function NodeIcon(props: IconProps) {
  return renderIcon(NODE_ICONS, props);
}

/** Lookup helpers — useful when you want to know if a custom icon exists. */
export const hasProviderIcon = (name: string) => Boolean(PROVIDER_ICONS[name?.toLowerCase()]);
export const hasKindIcon = (name: string) => Boolean(KIND_ICONS[name?.toLowerCase()]);
export const hasNodeIcon = (name: string) => Boolean(NODE_ICONS[name?.toLowerCase()]);
