// Browser client for the DiagramTool skills host (GET /api/skills, activate, type-to-flow run).
// The Worker loads the Workspace catalog on every request. `reload=1` plus `cache: 'no-store'`
// is the in-app reattach: a new skill folder shows up without a Worker redeploy.
// type-to-flow execution stays on the statically imported converter (#127).

export const SKILLS_WORKSPACE_ROOT = '/workspace/.agents/skills';
export const SKILLS_SECONDARY_PREFIX = 'agents:skills';

export const SKILL_CATALOG_RELOAD_NOTE =
  'Reload skills reads the Workspace again, so a new skill folder under /workspace/.agents/skills appears without a Worker redeploy. type-to-flow still runs the converter shipped with this Worker. Editing scripts/type-to-flow.js in the Workspace does not change that runner until a Worker redeploy.';

export const SKILL_CATALOG_EMPTY_HINT =
  'No skills yet. Add a folder under /workspace/.agents/skills/ with a SKILL.md whose frontmatter includes name and description, then choose Reload skills.';

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SkillCatalogEntry {
  name: string;
  description: string;
  location: string;
  sourceId?: string;
  version?: string;
  checksum?: string;
}

export function isWorkspaceSkillEntry(entry: Pick<SkillCatalogEntry, 'location' | 'sourceId'>): boolean {
  if (typeof entry.sourceId === 'string' && entry.sourceId.startsWith('workspace:')) return true;
  return entry.location === SKILLS_WORKSPACE_ROOT || entry.location.startsWith(`${SKILLS_WORKSPACE_ROOT}/`);
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
    const resolvedLocation = typeof location === 'string' && location.trim() ? location.trim() : `${SKILLS_WORKSPACE_ROOT}/${name}`;
    const resolvedSourceId = typeof sourceId === 'string' && sourceId.trim() ? sourceId.trim() : undefined;
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
    } else if (!isWorkspaceSkillEntry(existing) && isWorkspaceSkillEntry(nextEntry)) {
      // Fail-closed precedence: Workspace always wins over secondary sources.
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
