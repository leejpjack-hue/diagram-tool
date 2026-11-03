import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateSkill, getSkillCatalog, runTypeToFlow, SKILLS_WORKSPACE_ROOT } from './skillsHost';

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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
});
