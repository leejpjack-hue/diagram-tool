import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSkillCatalog, type SkillWorkspace } from 'agents/skills';
import {
  activateSkill,
  formatSkillCatalogStatus,
  getSkillCatalog,
  getSkillSourceKind,
  getSkillSourceLabel,
  runTypeToFlow,
  SKILLS_SECONDARY_PREFIX,
  SKILLS_WORKSPACE_ROOT,
} from './skillsHost';
import { SECONDARY_SKILL_BUNDLE } from '../../worker/generated-skill-seed';
import {
  SECONDARY_BUNDLE_SOURCE_ID,
  SECONDARY_R2_SOURCE_ID,
  buildDiagramSkillSources,
  computeSkillPackageChecksum,
  createVerifiedBundleSkillSource,
  createVerifiedR2SkillSource,
  verifySkillPackage,
  type R2BucketLike,
} from '../../worker/skill-sources';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createMemoryWorkspace(files: Record<string, string> = {}): SkillWorkspace {
  return {
    fs: {
      async find(directory: string) {
        const prefix = directory.replace(/\/+$/, '');
        return Object.keys(files)
          .filter(path => path.startsWith(`${prefix}/`))
          .map(path => ({ path, type: 'file' }));
      },
      async readFile(path: string) {
        const content = files[path];
        if (content === undefined) {
          const error = new Error(`ENOENT: no such file ${path}`) as Error & { code?: string };
          error.code = 'ENOENT';
          throw error;
        }
        const bytes = new TextEncoder().encode(content);
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });
      },
    },
  };
}

function createMemoryR2Bucket(objects: Record<string, string>): R2BucketLike {
  return {
    async list(options) {
      const prefix = options?.prefix ?? '';
      const matched = Object.entries(objects)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          size: new TextEncoder().encode(value).byteLength,
        }));
      return { objects: matched, truncated: false };
    },
    async get(key: string) {
      const value = objects[key];
      if (value === undefined) return null;
      return {
        size: new TextEncoder().encode(value).byteLength,
        async text() {
          return value;
        },
      };
    },
  };
}

describe('skills host client', () => {
  it('lists name and description from the catalog payload', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      skills: [{
        name: 'type-to-flow',
        description: ' Convert a workflow. ',
        location: `${SKILLS_WORKSPACE_ROOT}/type-to-flow`,
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSkillCatalog()).resolves.toEqual([{
      name: 'type-to-flow',
      description: 'Convert a workflow.',
      location: `${SKILLS_WORKSPACE_ROOT}/type-to-flow`,
    }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/skills', expect.objectContaining({ cache: 'no-store' }));
  });

  it('treats an empty skills array as an empty tree and skips entries without a description', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({
      skills: [
        { name: 'nameless', description: '   ' },
        { name: 'Not A Skill', description: 'Bad name' },
      ],
    }));
    await expect(getSkillCatalog()).resolves.toEqual([]);
    vi.stubGlobal('fetch', async () => jsonResponse({ skills: [] }));
    await expect(getSkillCatalog()).resolves.toEqual([]);
  });

  it('reloads with a cache-busting query and no-store', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ skills: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await getSkillCatalog({ reload: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/skills?reload=1', expect.objectContaining({ cache: 'no-store' }));
  });

  it('surfaces the host activate error', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'Skill not found.' }, 404));
    vi.stubGlobal('fetch', fetchMock);
    await expect(activateSkill('type-to-flow')).rejects.toThrow('Skill not found.');
    expect(fetchMock).toHaveBeenCalledWith('/api/skills/type-to-flow/activate', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects a failed type-to-flow run before returning a body', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ error: 'Skill unavailable.' }, 503));
    await expect(runTypeToFlow({ text: 'Receive request', title: 'Untitled' })).rejects.toThrow('Skill unavailable.');
  });

  it('preserves secondary package metadata and prefers Workspace over secondary duplicates', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({
      skills: [
        {
          name: 'type-to-flow',
          description: 'Secondary bundle description.',
          location: `${SKILLS_SECONDARY_PREFIX}/type-to-flow`,
          sourceId: SECONDARY_BUNDLE_SOURCE_ID,
          version: '1.0.0',
          checksum: SECONDARY_SKILL_BUNDLE.packages[0].checksum,
        },
        {
          name: 'type-to-flow',
          description: 'Workspace primary description.',
          location: `${SKILLS_WORKSPACE_ROOT}/type-to-flow`,
          sourceId: `workspace:${SKILLS_WORKSPACE_ROOT}`,
          version: '1.0.0-workspace',
        },
      ],
    }));

    await expect(getSkillCatalog()).resolves.toEqual([{
      name: 'type-to-flow',
      description: 'Workspace primary description.',
      location: `${SKILLS_WORKSPACE_ROOT}/type-to-flow`,
      sourceId: `workspace:${SKILLS_WORKSPACE_ROOT}`,
      version: '1.0.0-workspace',
    }]);
  });

  it('classifies Workspace, R2, and bundle sources and formats catalog status', async () => {
    const workspaceEntry = {
      name: 'type-to-flow',
      location: `${SKILLS_WORKSPACE_ROOT}/type-to-flow`,
      sourceId: `workspace:${SKILLS_WORKSPACE_ROOT}`,
    };
    const r2Entry = {
      name: 'type-to-flow',
      location: `${SKILLS_SECONDARY_PREFIX}/type-to-flow`,
      sourceId: SECONDARY_R2_SOURCE_ID,
    };
    const bundleEntry = {
      name: 'review-notes',
      location: `${SKILLS_SECONDARY_PREFIX}/review-notes`,
      sourceId: SECONDARY_BUNDLE_SOURCE_ID,
    };

    expect(getSkillSourceKind(workspaceEntry)).toBe('workspace');
    expect(getSkillSourceLabel(workspaceEntry)).toBe('Workspace');
    expect(getSkillSourceKind(r2Entry)).toBe('r2');
    expect(getSkillSourceLabel(r2Entry)).toBe('R2');
    expect(getSkillSourceKind(bundleEntry)).toBe('bundle');
    expect(getSkillSourceLabel(bundleEntry)).toBe('bundle');
    expect(formatSkillCatalogStatus([])).toBe('Loaded skills: none.');
    expect(formatSkillCatalogStatus([workspaceEntry, bundleEntry])).toBe(
      'Loaded 2 skills: type-to-flow (Workspace), review-notes (bundle).',
    );

    vi.stubGlobal('fetch', async () => jsonResponse({
      skills: [
        {
          name: 'type-to-flow',
          description: 'Bundle secondary description.',
          location: `${SKILLS_SECONDARY_PREFIX}/type-to-flow`,
          sourceId: SECONDARY_BUNDLE_SOURCE_ID,
          version: '1.0.0',
        },
        {
          name: 'type-to-flow',
          description: 'R2 secondary description.',
          sourceId: SECONDARY_R2_SOURCE_ID,
          version: '1.0.0-r2',
        },
      ],
    }));

    await expect(getSkillCatalog()).resolves.toEqual([{
      name: 'type-to-flow',
      description: 'R2 secondary description.',
      location: `${SKILLS_SECONDARY_PREFIX}/type-to-flow`,
      sourceId: SECONDARY_R2_SOURCE_ID,
      version: '1.0.0-r2',
    }]);
  });
});

describe('secondary skill package verification and Workspace precedence', () => {
  it('loads type-to-flow from the checked-in secondary bundle when Workspace is empty', async () => {
    const emptyWorkspace = createMemoryWorkspace();
    const catalog = await loadSkillCatalog(buildDiagramSkillSources(emptyWorkspace));

    expect(catalog.skills).toHaveLength(1);
    const entry = catalog.skills[0];
    expect(entry.skill.name).toBe('type-to-flow');
    expect(entry.sourceId).toBe(SECONDARY_BUNDLE_SOURCE_ID);
    expect(entry.location).toBe('agents:skills/type-to-flow');
    expect(entry.skill.metadata.version).toBe('1.0.0');
    expect(entry.skill.metadata.checksum).toBe(SECONDARY_SKILL_BUNDLE.packages[0].checksum);

    const activated = catalog.activate('type-to-flow');
    expect(activated.ok).toBe(true);
    if (activated.ok) {
      expect(activated.value).toContain('location="agents:skills/type-to-flow"');
      expect(activated.value).toContain('scripts/type-to-flow.js');
    }

    const resource = await catalog.readResource({ name: 'type-to-flow', path: 'references/flow-schema.md' });
    expect(resource.ok).toBe(true);
  });

  it('rejects a secondary package when checksum or version metadata is missing or tampered', async () => {
    const basePkg = SECONDARY_SKILL_BUNDLE.packages[0];
    const tamperedChecksum = await verifySkillPackage({
      ...basePkg,
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    });
    expect(tamperedChecksum.ok).toBe(false);

    const mismatchedVersion = await verifySkillPackage({
      ...basePkg,
      version: '9.9.9',
    });
    expect(mismatchedVersion.ok).toBe(false);

    const tamperedSource = createVerifiedBundleSkillSource({
      id: SECONDARY_BUNDLE_SOURCE_ID,
      prefix: SKILLS_SECONDARY_PREFIX,
      packages: [{
        ...basePkg,
        files: {
          ...basePkg.files,
          'SKILL.md': `${basePkg.files['SKILL.md']}\nTampered content.\n`,
        },
      }],
    });
    const catalog = await loadSkillCatalog([tamperedSource]);
    expect(catalog.skills).toHaveLength(0);
    expect(catalog.diagnostics.some(d => d._tag === 'InvalidSkill')).toBe(true);
  });

  it('verifies and loads a skill package from an R2 agents:skills prefix and prefers Workspace when both exist', async () => {
    const r2Files = {
      'SKILL.md': '---\nname: type-to-flow\ndescription: R2 secondary skill.\nmetadata:\n  version: "1.0.0-r2"\n---\n\n# R2 body\n',
      'scripts/type-to-flow.js': 'export default async function () {}\n',
    };
    const r2Checksum = await computeSkillPackageChecksum(r2Files);
    const bucket = createMemoryR2Bucket({
      'agents:skills/skills-bundle.json': JSON.stringify({
        packages: [{ name: 'type-to-flow', version: '1.0.0-r2', checksum: r2Checksum }],
      }),
      'agents:skills/type-to-flow/SKILL.md': r2Files['SKILL.md'],
      'agents:skills/type-to-flow/scripts/type-to-flow.js': r2Files['scripts/type-to-flow.js'],
    });

    const emptyWorkspace = createMemoryWorkspace();
    const r2Catalog = await loadSkillCatalog(buildDiagramSkillSources(emptyWorkspace, { r2Bucket: bucket }));
    expect(r2Catalog.skills).toHaveLength(1);
    expect(r2Catalog.skills[0].sourceId).toBe(SECONDARY_R2_SOURCE_ID);
    expect(r2Catalog.skills[0].location).toBe('agents:skills/type-to-flow');
    expect(r2Catalog.skills[0].skill.description).toBe('R2 secondary skill.');

    const seededWorkspace = createMemoryWorkspace({
      '/workspace/.agents/skills/type-to-flow/SKILL.md':
        '---\nname: type-to-flow\ndescription: Operator Workspace edit wins.\nmetadata:\n  version: "1.0.0-ws"\n---\n\n# Workspace body\n',
    });
    const mergedCatalog = await loadSkillCatalog(buildDiagramSkillSources(seededWorkspace, { r2Bucket: bucket }));
    expect(mergedCatalog.skills).toHaveLength(1);
    expect(mergedCatalog.skills[0].sourceId).toBe('workspace:/workspace/.agents/skills');
    expect(mergedCatalog.skills[0].location).toBe('/workspace/.agents/skills/type-to-flow');
    expect(mergedCatalog.skills[0].skill.description).toBe('Operator Workspace edit wins.');

    // Fail-closed: broken SKILL.md in Workspace is not silently masked by secondary R2 or bundle.
    const brokenWorkspace = createMemoryWorkspace({
      '/workspace/.agents/skills/type-to-flow/SKILL.md': 'not valid frontmatter',
    });
    const brokenCatalog = await loadSkillCatalog(buildDiagramSkillSources(brokenWorkspace, { r2Bucket: bucket }));
    expect(brokenCatalog.skills).toHaveLength(0);
    expect(brokenCatalog.diagnostics.some(d => d._tag === 'InvalidSkill' && d.sourceId === 'workspace:/workspace/.agents/skills')).toBe(true);
  });

  it('rejects an unverified R2 skill package when its checksum mismatches', async () => {
    const bucket = createMemoryR2Bucket({
      'agents:skills/skills-bundle.json': JSON.stringify({
        packages: [{
          name: 'type-to-flow',
          version: '1.0.0',
          checksum: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        }],
      }),
      'agents:skills/type-to-flow/SKILL.md': '---\nname: type-to-flow\ndescription: Bad R2 skill.\nmetadata:\n  version: "1.0.0"\n---\n\nBody.\n',
    });
    const r2Source = createVerifiedR2SkillSource(bucket);
    const catalog = await loadSkillCatalog([r2Source]);
    expect(catalog.skills).toHaveLength(0);
    expect(catalog.diagnostics.some(d => d._tag === 'InvalidSkill' && d.sourceId === SECONDARY_R2_SOURCE_ID)).toBe(true);
  });
});
