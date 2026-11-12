// Browser client for the DiagramTool skills host (GET /api/skills, activate, type-to-flow run).
// The Worker loads the Workspace catalog on every request. `reload=1` plus `cache: 'no-store'`
// is the in-app reattach: a new skill folder shows up without a Worker redeploy.
// type-to-flow execution stays on the statically imported converter (#127).

export const SKILLS_WORKSPACE_ROOT = '/workspace/.agents/skills';
export const SKILLS_SECONDARY_PREFIX = 'agents:skills';

export const SKILL_CATALOG_RELOAD_NOTE =
  'Reload skills reads the Workspace again, so a new skill folder under /workspace/.agents/skills appears without a Worker redeploy. type-to-flow still runs the converter shipped with this Worker. Editing scripts/type-to-flow.js in the Workspace does not change that runner until a Worker redeploy.';

export const SKILL_CATALOG_SOURCE_NOTE =
  'Source order: Workspace (/workspace/.agents/skills) first, then verified R2 (r2:agents:skills) and bundle (bundle:agents:skills). Workspace wins when both exist; invalid checksums do not merge.';

export const SKILL_CATALOG_EMPTY_HINT =
  'No skills yet. Add a folder under /workspace/.agents/skills/ with a SKILL.md whose frontmatter includes name and description, then choose Reload skills.';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SkillCatalogSourceKind = 'workspace' | 'r2' | 'bundle';
export type SkillCatalogSourceLabel = 'Workspace' | 'R2' | 'bundle';

export interface SkillCatalogEntry {
  name: string;
  description: string;
  location: string;
  sourceId?: string;
  version?: string;
  checksum?: string;
}

export function getSkillSourceKind(entry: Pick<SkillCatalogEntry, 'location' | 'sourceId'>): SkillCatalogSourceKind {
  const sourceId = typeof entry.sourceId === 'string' ? entry.sourceId.trim() : '';
  if (sourceId.startsWith('workspace:')) return 'workspace';
  if (sourceId.startsWith('r2:')) return 'r2';
  if (sourceId.startsWith('bundle:')) return 'bundle';
  if (entry.location === SKILLS_WORKSPACE_ROOT || entry.location.startsWith(`${SKILLS_WORKSPACE_ROOT}/`)) {
    return 'workspace';
  }
  return 'bundle';
}

export function getSkillSourceLabel(entry: Pick<SkillCatalogEntry, 'location' | 'sourceId'>): SkillCatalogSourceLabel {
  const kind = getSkillSourceKind(entry);
  if (kind === 'workspace') return 'Workspace';
  if (kind === 'r2') return 'R2';
  return 'bundle';
}

export function formatSkillCatalogStatus(skills: readonly Pick<SkillCatalogEntry, 'name' | 'location' | 'sourceId'>[]): string {
  if (skills.length === 0) return 'Loaded skills: none.';
  const items = skills.map(skill => `${skill.name} (${getSkillSourceLabel(skill)})`).join(', ');
  return `Loaded ${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}: ${items}.`;
}

export function isWorkspaceSkillEntry(entry: Pick<SkillCatalogEntry, 'location' | 'sourceId'>): boolean {
  return getSkillSourceKind(entry) === 'workspace';
}

function skillSourcePrecedenceRank(entry: Pick<SkillCatalogEntry, 'location' | 'sourceId'>): number {
  const kind = getSkillSourceKind(entry);
  if (kind === 'workspace') return 0;
  if (kind === 'r2') return 1;
  return 2;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function hostError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }
  return fallback;
}

async function readJson(response: Response, fallback: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error(fallback);
  }
}

export async function getSkillCatalog(options?: { reload?: boolean; signal?: AbortSignal }): Promise<SkillCatalogEntry[]> {
  const path = options?.reload ? '/api/skills?reload=1' : '/api/skills';
  let response: Response;
  try {
    response = await fetch(path, { cache: 'no-store', signal: options?.signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('The skills host is unavailable.');
  }
  const data = await readJson(response, 'The skills host is unavailable.');
  if (!response.ok) throw new Error(hostError(data, 'The skills catalog could not be loaded.'));
  if (!data || typeof data !== 'object' || !('skills' in data) || !Array.isArray(data.skills)) {
    throw new Error('The skills catalog could not be loaded.');
  }
  const byName = new Map<string, SkillCatalogEntry>();
  for (const item of data.skills) {
    if (!item || typeof item !== 'object') continue;
    const { name, description, location, sourceId, version, checksum } = item as {
      name?: unknown;
      description?: unknown;
      location?: unknown;
      sourceId?: unknown;
      version?: unknown;
      checksum?: unknown;
    };
    if (typeof name !== 'string' || !SKILL_NAME.test(name)) continue;
    if (typeof description !== 'string' || !description.trim()) continue;
    const resolvedSourceId = typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : undefined;
    const isSecondarySource = resolvedSourceId?.startsWith('r2:') || resolvedSourceId?.startsWith('bundle:');
    const defaultLocation = isSecondarySource
      ? `${SKILLS_SECONDARY_PREFIX}/${name}`
      : `${SKILLS_WORKSPACE_ROOT}/${name}`;
    const resolvedLocation = typeof location === 'string' && location.trim() ? location.trim() : defaultLocation;
    const nextEntry: SkillCatalogEntry = {
      name,
      description: description.trim(),
      location: resolvedLocation,
      ...(resolvedSourceId ? { sourceId: resolvedSourceId } : {}),
      ...(typeof version === 'string' && version.trim() ? { version: version.trim() } : {}),
      ...(typeof checksum === 'string' && checksum.trim() ? { checksum: checksum.trim() } : {}),
    };
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, nextEntry);
    } else if (skillSourcePrecedenceRank(nextEntry) < skillSourcePrecedenceRank(existing)) {
      // Fail-closed precedence: Workspace always wins over secondary sources, and R2 wins over bundle.
      byName.set(name, nextEntry);
    }
  }
  return [...byName.values()];
}

export async function activateSkill(name: string, signal?: AbortSignal): Promise<string> {
  if (!SKILL_NAME.test(name)) throw new Error('Skill not found.');
  let response: Response;
  try {
    response = await fetch(`/api/skills/${name}/activate`, { method: 'POST', cache: 'no-store', signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('The skills host is unavailable.');
  }
  const data = await readJson(response, 'The skills host is unavailable.');
  if (!response.ok) throw new Error(hostError(data, 'The skill could not be activated.'));
  if (!data || typeof data !== 'object' || typeof (data as { content?: unknown }).content !== 'string') {
    throw new Error('The skill could not be activated.');
  }
  return (data as { content: string }).content;
}

export async function runTypeToFlow(input: { text: string; title?: string }, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch('/api/skills/type-to-flow/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error('The skills host is unavailable.');
  }
  const data = await readJson(response, 'The skills host is unavailable.');
  if (!response.ok) throw new Error(hostError(data, 'The skill could not run.'));
  return data;
}
