import {
  InvalidSkillResourcePathError,
  SkillParseError,
  SkillResourceNotFoundError,
  SkillSourceError,
  parseSkill,
  parseSkillResourcePath,
  workspace as createWorkspaceSkillSource,
  type InvalidSkill,
  type ListedSkill,
  type SkillListing,
  type SkillName,
  type SkillResource,
  type SkillResourceInfo,
  type SkillResourceKind,
  type SkillResourcePath,
  type SkillResult,
  type SkillSource,
  type SkillWorkspace,
} from 'agents/skills';
import { SECONDARY_SKILL_BUNDLE } from './generated-skill-seed';

export const SECONDARY_SKILLS_PREFIX = 'agents:skills';
export const SECONDARY_BUNDLE_SOURCE_ID = 'bundle:agents:skills';
export const SECONDARY_R2_SOURCE_ID = 'r2:agents:skills';

const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/;

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mjs': 'text/javascript',
  '.py': 'text/x-python',
  '.sh': 'text/x-shellscript',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
};

export interface SkillPackageDefinition {
  readonly name: string;
  readonly version: string;
  readonly checksum: string;
  readonly location?: string;
  readonly files: Readonly<Record<string, string>>;
}

export interface SecondarySkillBundle {
  readonly id: string;
  readonly prefix: string;
  readonly packages: readonly SkillPackageDefinition[];
}

export interface R2ObjectBodyLike {
  readonly size: number;
  text(): Promise<string>;
}

export interface R2BucketLike {
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    readonly objects: ReadonlyArray<{ readonly key: string; readonly size: number }>;
    readonly truncated: boolean;
    readonly cursor?: string;
  }>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
}

function ok<T>(value: T): SkillResult<T, never> {
  return { ok: true, value };
}

function err<E extends Error>(error: E): SkillResult<never, E> {
  return { ok: false, error };
}

function describeResource(path: SkillResourcePath, content: string): SkillResource {
  const root = path.split('/', 1)[0];
  const kind: SkillResourceKind =
    root === 'scripts' ? 'script' : root === 'references' ? 'reference' : root === 'assets' ? 'asset' : 'file';
  const file = path.split('/').at(-1) ?? path;
  const dot = file.lastIndexOf('.');
  const ext = dot <= 0 ? '' : file.slice(dot).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  const size = new TextEncoder().encode(content).byteLength;
  return {
    path,
    kind,
    encoding: 'text',
    size,
    content,
    ...(mimeType ? { mimeType } : {}),
  };
}

/**
 * Compute the canonical SHA-256 digest (`sha256:<hex>`) over all files in a skill package.
 */
export async function computeSkillPackageChecksum(files: Readonly<Record<string, string>>): Promise<string> {
  const canonical = Object.entries(files)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([relPath, content]) => `${relPath}\0${content}\0`)
    .join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export type VerifiedSkillPackageResult =
  | {
      readonly ok: true;
      readonly listed: ListedSkill;
      readonly resources: ReadonlyMap<SkillResourcePath, SkillResource>;
    }
  | {
      readonly ok: false;
      readonly invalid: InvalidSkill;
    };

/**
 * Fail-closed verification of a secondary skill package before catalog merge.
 * Requires valid SKILL.md frontmatter, matching non-empty version metadata,
 * and a valid SHA-256 checksum over the package files.
 */
export async function verifySkillPackage(
  pkg: SkillPackageDefinition,
  prefix = SECONDARY_SKILLS_PREFIX,
): Promise<VerifiedSkillPackageResult> {
  const name = typeof pkg.name === 'string' ? pkg.name.trim() : '';
  const location = pkg.location?.trim() || `${prefix}/${name || 'unknown'}`;
  const skillLocation = `${location}/SKILL.md`;

  if (!name) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError('invalid-name', 'Secondary skill package is missing a skill name.'),
      },
    };
  }

  const version = typeof pkg.version === 'string' ? pkg.version.trim() : '';
  if (!version) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError('invalid-metadata', `Secondary skill package "${name}" is missing version metadata.`),
      },
    };
  }

  const checksum = typeof pkg.checksum === 'string' ? pkg.checksum.trim() : '';
  if (!CHECKSUM_PATTERN.test(checksum)) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError(
          'invalid-metadata',
          `Secondary skill package "${name}" is missing a valid sha256 checksum.`,
        ),
      },
    };
  }

  if (!pkg.files || typeof pkg.files !== 'object' || typeof pkg.files['SKILL.md'] !== 'string') {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError('missing-frontmatter', `Secondary skill package "${name}" is missing SKILL.md.`),
      },
    };
  }

  const parsed = parseSkill(pkg.files['SKILL.md'], { directory: name });
  if (!parsed.ok) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: parsed.error,
      },
    };
  }

  if (parsed.value.name !== name) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError(
          'name-mismatch',
          `Secondary skill package "${name}" does not match SKILL.md name "${parsed.value.name}".`,
        ),
      },
    };
  }

  const frontmatterVersion = parsed.value.metadata.version?.trim();
  if (!frontmatterVersion || frontmatterVersion !== version) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError(
          'invalid-metadata',
          `Secondary skill package "${name}" version "${version}" does not match SKILL.md metadata.version "${frontmatterVersion ?? ''}".`,
        ),
      },
    };
  }

  const actualChecksum = await computeSkillPackageChecksum(pkg.files);
  if (actualChecksum !== checksum) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError(
          'invalid-metadata',
          `Secondary skill package "${name}" checksum mismatch: expected ${checksum}, got ${actualChecksum}.`,
        ),
      },
    };
  }

  const frontmatterChecksum = parsed.value.metadata.checksum?.trim();
  if (frontmatterChecksum && frontmatterChecksum !== actualChecksum) {
    return {
      ok: false,
      invalid: {
        location: skillLocation,
        error: new SkillParseError(
          'invalid-metadata',
          `Secondary skill package "${name}" SKILL.md metadata.checksum does not match package checksum.`,
        ),
      },
    };
  }

  const resourceInfos: SkillResourceInfo[] = [];
  const resourceMap = new Map<SkillResourcePath, SkillResource>();
  for (const [relPath, content] of Object.entries(pkg.files)) {
    if (relPath === 'SKILL.md') continue;
    if (typeof content !== 'string') {
      return {
        ok: false,
        invalid: {
          location: `${location}/${relPath}`,
          error: new SkillParseError('invalid-metadata', `Secondary skill resource "${relPath}" must be text.`),
        },
      };
    }
    const parsedPath = parseSkillResourcePath(relPath);
    if (!parsedPath.ok) {
      return {
        ok: false,
        invalid: {
          location: `${location}/${relPath}`,
          error: new SkillParseError('invalid-metadata', parsedPath.error.message),
        },
      };
    }
    const described = describeResource(parsedPath.value, content);
    resourceInfos.push({
      path: described.path,
      kind: described.kind,
      encoding: described.encoding,
      size: described.size,
      ...(described.mimeType ? { mimeType: described.mimeType } : {}),
    });
    resourceMap.set(parsedPath.value, described);
  }
  resourceInfos.sort((a, b) => a.path.localeCompare(b.path));

  const listed: ListedSkill = {
    skill: {
      ...parsed.value,
      metadata: {
        ...parsed.value.metadata,
        version,
        checksum,
      },
    },
    resources: resourceInfos,
    location,
    ...(parsed.warnings.length > 0 ? { warnings: parsed.warnings } : {}),
  };

  return { ok: true, listed, resources: resourceMap };
}

/**
 * Secondary skill source backed by a verified checked-in bundle (`bundle:agents:skills`).
 */
export function createVerifiedBundleSkillSource(
  bundle: SecondarySkillBundle = SECONDARY_SKILL_BUNDLE,
  options?: { blockedByWorkspace?: () => Promise<ReadonlySet<string>> },
): SkillSource {
  const id = bundle.id || SECONDARY_BUNDLE_SOURCE_ID;
  const prefix = bundle.prefix || SECONDARY_SKILLS_PREFIX;
  let verifiedResources = new Map<string, ReadonlyMap<SkillResourcePath, SkillResource>>();

  return {
    id,
    async list(): Promise<SkillResult<SkillListing, SkillSourceError>> {
      try {
        const blocked = (await options?.blockedByWorkspace?.()) ?? new Set<string>();
        const skills: ListedSkill[] = [];
        const invalid: InvalidSkill[] = [];
        const nextResources = new Map<string, ReadonlyMap<SkillResourcePath, SkillResource>>();
        const seen = new Set<string>();

        for (const pkg of bundle.packages) {
          const verified = await verifySkillPackage(pkg, prefix);
          if (!verified.ok) {
            invalid.push(verified.invalid);
            continue;
          }
          const skillName = verified.listed.skill.name;
          if (blocked.has(skillName) || seen.has(skillName)) continue;
          seen.add(skillName);
          skills.push(verified.listed);
          nextResources.set(skillName, verified.resources);
        }

        verifiedResources = nextResources;
        return ok({ skills, invalid });
      } catch (cause) {
        return err(new SkillSourceError(id, 'list', cause));
      }
    },
    async readResource(
      skill: SkillName,
      path: SkillResourcePath,
    ): Promise<SkillResult<SkillResource, SkillResourceNotFoundError | SkillSourceError>> {
      const parsedPath = parseSkillResourcePath(path);
      if (!parsedPath.ok) return err(new SkillResourceNotFoundError(skill, path));
      const resource = verifiedResources.get(skill)?.get(parsedPath.value);
      if (!resource) return err(new SkillResourceNotFoundError(skill, path));
      return ok(resource);
    },
  };
}

function normalizeR2KeyPrefix(prefix = SECONDARY_SKILLS_PREFIX): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}

async function listAllR2Objects(bucket: R2BucketLike, prefix: string) {
  const objects: Array<{ readonly key: string; readonly size: number }> = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

interface ManifestPackageMeta {
  readonly version?: string;
  readonly checksum?: string;
}

/**
 * Secondary skill source backed by an R2 bucket under prefix `agents:skills`.
 * Every skill package is verified for version and SHA-256 checksum metadata before catalog merge.
 */
export function createVerifiedR2SkillSource(
  bucket: R2BucketLike,
  options?: {
    prefix?: string;
    id?: string;
    blockedByWorkspace?: () => Promise<ReadonlySet<string>>;
  },
): SkillSource {
  const rawPrefix = (options?.prefix ?? SECONDARY_SKILLS_PREFIX).trim().replace(/^\/+|\/+$/g, '') || SECONDARY_SKILLS_PREFIX;
  const keyPrefix = normalizeR2KeyPrefix(rawPrefix);
  const id = options?.id ?? `${SECONDARY_R2_SOURCE_ID}`;
  let verifiedResources = new Map<string, ReadonlyMap<SkillResourcePath, SkillResource>>();

  return {
    id,
    async list(): Promise<SkillResult<SkillListing, SkillSourceError>> {
      try {
        const [objects, blocked] = await Promise.all([
          listAllR2Objects(bucket, keyPrefix),
          options?.blockedByWorkspace?.() ?? Promise.resolve(new Set<string>()),
        ]);

        const manifestMeta = new Map<string, ManifestPackageMeta>();
        const manifestKey = `${keyPrefix}skills-bundle.json`;
        if (objects.some(obj => obj.key === manifestKey)) {
          const manifestObj = await bucket.get(manifestKey);
          if (manifestObj) {
            const parsedManifest = JSON.parse(await manifestObj.text()) as {
              packages?: Array<{ name?: unknown; version?: unknown; checksum?: unknown }>;
            };
            for (const entry of parsedManifest.packages ?? []) {
              if (entry && typeof entry.name === 'string') {
                manifestMeta.set(entry.name, {
                  ...(typeof entry.version === 'string' ? { version: entry.version } : {}),
                  ...(typeof entry.checksum === 'string' ? { checksum: entry.checksum } : {}),
                });
              }
            }
          }
        }

        const keysByDirectory = new Map<string, string[]>();
        for (const obj of objects) {
          const rel = obj.key.slice(keyPrefix.length);
          const slash = rel.indexOf('/');
          if (slash <= 0) continue;
          const dir = rel.slice(0, slash);
          const list = keysByDirectory.get(dir) ?? [];
          list.push(rel.slice(slash + 1));
          keysByDirectory.set(dir, list);
        }

        const skills: ListedSkill[] = [];
        const invalid: InvalidSkill[] = [];
        const nextResources = new Map<string, ReadonlyMap<SkillResourcePath, SkillResource>>();

        for (const dir of [...keysByDirectory.keys()].sort()) {
          if (blocked.has(dir)) continue;
          const relFiles = keysByDirectory.get(dir) ?? [];
          if (!relFiles.includes('SKILL.md')) continue;

          const files: Record<string, string> = {};
          for (const relPath of relFiles) {
            if (!relPath) continue;
            const body = await bucket.get(`${keyPrefix}${dir}/${relPath}`);
            if (body) files[relPath] = await body.text();
          }

          const parsedSkill = typeof files['SKILL.md'] === 'string' ? parseSkill(files['SKILL.md'], { directory: dir }) : null;
          const metaFromManifest = manifestMeta.get(dir);
          const version =
            metaFromManifest?.version ??
            (parsedSkill && parsedSkill.ok ? parsedSkill.value.metadata.version : undefined) ??
            '';
          const checksum =
            metaFromManifest?.checksum ??
            (parsedSkill && parsedSkill.ok ? parsedSkill.value.metadata.checksum : undefined) ??
            '';

          const verified = await verifySkillPackage(
            {
              name: dir,
              version,
              checksum,
              location: `${rawPrefix}/${dir}`,
              files,
            },
            rawPrefix,
          );

          if (!verified.ok) {
            invalid.push(verified.invalid);
            continue;
          }

          skills.push(verified.listed);
          nextResources.set(verified.listed.skill.name, verified.resources);
        }

        verifiedResources = nextResources;
        return ok({ skills, invalid });
      } catch (cause) {
        return err(new SkillSourceError(id, 'list', cause));
      }
    },
    async readResource(
      skill: SkillName,
      path: SkillResourcePath,
    ): Promise<SkillResult<SkillResource, SkillResourceNotFoundError | SkillSourceError>> {
      const parsedPath = parseSkillResourcePath(path);
      if (!parsedPath.ok) return err(new SkillResourceNotFoundError(skill, path));
      const resource = verifiedResources.get(skill)?.get(parsedPath.value);
      if (!resource) return err(new SkillResourceNotFoundError(skill, path));
      return ok(resource);
    },
  };
}

/**
 * Build the DiagramTool skill sources in strict precedence order:
 * 1. Primary: Durable Object Workspace (`/workspace/.agents/skills`)
 * 2. Secondary (when bound): R2 bucket prefix `agents:skills` (`r2:agents:skills`)
 * 3. Secondary: Verified checked-in skill bundle (`bundle:agents:skills`)
 *
 * Precedence is fail-closed: a valid Workspace skill wins, and an invalid
 * Workspace skill directory is never silently masked by a secondary source.
 */
export function buildDiagramSkillSources(
  targetWorkspace: SkillWorkspace,
  options?: {
    r2Bucket?: R2BucketLike;
    bundle?: SecondarySkillBundle;
  },
): SkillSource[] {
  const rawWorkspace = createWorkspaceSkillSource(targetWorkspace);
  let activeWorkspaceListing: Promise<SkillResult<SkillListing, SkillSourceError>> | null = null;

  const getWorkspaceListing = () => {
    if (!activeWorkspaceListing) {
      activeWorkspaceListing = rawWorkspace.list().finally(() => {
        activeWorkspaceListing = null;
      });
    }
    return activeWorkspaceListing;
  };

  const blockedByWorkspace = async (): Promise<ReadonlySet<string>> => {
    const listed = await getWorkspaceListing();
    if (!listed.ok) return new Set<string>();
    const blocked = new Set<string>();
    for (const item of listed.value.invalid) {
      const slash = item.location.indexOf('/');
      const dir = slash > 0 ? item.location.slice(0, slash) : item.location;
      if (dir) blocked.add(dir);
    }
    return blocked;
  };

  const primaryWorkspaceSource: SkillSource = {
    id: rawWorkspace.id,
    list: () => getWorkspaceListing(),
    readResource: (skill, path) => rawWorkspace.readResource(skill, path),
  };

  const sources: SkillSource[] = [primaryWorkspaceSource];
  if (options?.r2Bucket) {
    sources.push(
      createVerifiedR2SkillSource(options.r2Bucket, {
        prefix: SECONDARY_SKILLS_PREFIX,
        id: SECONDARY_R2_SOURCE_ID,
        blockedByWorkspace,
      }),
    );
  }
  sources.push(
    createVerifiedBundleSkillSource(options?.bundle ?? SECONDARY_SKILL_BUNDLE, {
      blockedByWorkspace,
    }),
  );
  return sources;
}

export { InvalidSkillResourcePathError };
