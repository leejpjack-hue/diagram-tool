import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryBoardManager, filterAndSortBoards, normalizeBoard, type Board, type BoardManager } from './boardManager';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

let manager: BoardManager;

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.setItem('diagram-tool-indexeddb-migrated-v2', '1');
  manager = createMemoryBoardManager();
});

const create = (title = 'Board A') => manager.create({ title, mode: 'architecture', dslText: `diagram: architecture\ntitle: ${title}` });

describe('board normalization and queries', () => {
  const base = (overrides: Partial<Board> = {}) => normalizeBoard({
    id: 'board-1', title: 'Payments API', description: 'Production architecture', mode: 'architecture',
    dslText: 'service Gateway', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
    tags: ['payments', 'prod'], ...overrides,
  });

  it('normalizes legacy boards with v2 metadata defaults', () => {
    const board = normalizeBoard({ id: 'legacy', title: 'Legacy', mode: 'flow', dslText: 'start A', createdAt: 'x', updatedAt: 'x' });
    expect(board.schemaVersion).toBe(2);
    expect(board.tags).toEqual([]);
    expect(board.starred).toBe(false);
  });

  it('searches title, description, tags, and DSL', () => {
    const boards = [base(), base({ id: '2', title: 'Delivery plan', description: 'Roadmap', mode: 'gantt', tags: ['roadmap'], dslText: 'task Release' })];
    expect(filterAndSortBoards(boards, { search: 'payments' })).toHaveLength(1);
    expect(filterAndSortBoards(boards, { search: 'production' })).toHaveLength(1);
    expect(filterAndSortBoards(boards, { search: 'release' })[0].id).toBe('2');
    expect(filterAndSortBoards(boards, { mode: 'gantt' })[0].id).toBe('2');
  });

  it('filters Spaces, favorites, tags, and trash while sorting by name', () => {
    const boards = [base({ title: 'Zeta', starred: true, spaceId: 's1' }), base({ id: '2', title: 'Alpha', deletedAt: '2026-01-03T00:00:00.000Z' })];
    expect(filterAndSortBoards(boards, { starred: true, spaceId: 's1' })).toHaveLength(1);
    expect(filterAndSortBoards(boards, { tag: 'prod' })).toHaveLength(1);
    expect(filterAndSortBoards(boards, { deleted: true })[0].title).toBe('Alpha');
    expect(filterAndSortBoards(boards, { sort: 'name' })[0].title).toBe('Zeta');
  });

  it('filters 500 boards well within the dashboard interaction budget', () => {
    const boards = Array.from({ length: 500 }, (_, index) => base({ id: `board-${index}`, title: `Service ${index}`, tags: index % 2 ? ['odd'] : ['even'] }));
    const started = performance.now();
    const result = filterAndSortBoards(boards, { search: 'Service 49', tag: 'odd', sort: 'name' });
    expect(performance.now() - started).toBeLessThan(100);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('board repository workflows', () => {
  it('creates, updates, lists, duplicates, and permanently removes boards', async () => {
    const board = await create('Original');
    await manager.update(board.id, { description: 'Updated', tags: ['core'] });
    const copy = await manager.duplicate(board.id);
    expect(copy?.title).toBe('Original (copy)');
    expect(copy?.tags).toEqual(['core']);
    expect((await manager.list())).toHaveLength(2);
    await manager.remove(board.id);
    expect((await manager.list()).map(item => item.id)).toEqual([copy?.id]);
  });

  it('soft deletes, restores, and separates Trash from active boards', async () => {
    const board = await create();
    await manager.trash(board.id);
    expect(await manager.list()).toHaveLength(0);
    expect(await manager.list({ deleted: true })).toHaveLength(1);
    await manager.restore(board.id);
    expect(await manager.list()).toHaveLength(1);
  });

  it('moves and stars multiple boards in one operation', async () => {
    const first = await create('First');
    const second = await create('Second');
    const space = await manager.createSpace('Platform', '#6366f1');
    await manager.bulkUpdate([first.id, second.id], { spaceId: space.id, starred: true });
    expect(await manager.list({ spaceId: space.id, starred: true })).toHaveLength(2);
    await manager.trash(second.id);
    await manager.removeSpace(space.id);
    expect((await manager.list()).every(board => !board.spaceId)).toBe(true);
    expect((await manager.list({ deleted: true })).every(board => !board.spaceId)).toBe(true);
  });

  it('persists presentation items but does not copy them during duplication', async () => {
    const board = await create();
    await manager.setPresentation(board.id, [{ id: 'note', type: 'note', content: 'hello', x: 0, y: 0, width: 100, height: 100 }]);
    expect((await manager.get(board.id))?.presentation?.items).toHaveLength(1);
    const copy = await manager.duplicate(board.id);
    expect(copy?.presentation).toBeUndefined();
  });

  it('creates personal templates and tracks usage', async () => {
    const board = await create('Reusable');
    const template = await manager.saveAsTemplate(board.id);
    expect((await manager.listTemplates())[0].name).toBe('Reusable');
    const used = await manager.useTemplate(template!.id);
    expect(used?.useCount).toBe(1);
    await manager.removeTemplate(template!.id);
    expect(await manager.listTemplates()).toHaveLength(0);
  });

  it('keeps named versions and only the latest 20 automatic versions', async () => {
    const board = await create();
    await manager.createVersion(board.id, 'Before redesign');
    for (let index = 0; index < 24; index += 1) {
      await manager.update(board.id, { dslText: `diagram: architecture\n# change ${index}` });
      await manager.createVersion(board.id, 'Automatic save', true);
    }
    const versions = await manager.listVersions(board.id);
    expect(versions.filter(version => version.automatic)).toHaveLength(20);
    expect(versions.some(version => version.name === 'Before redesign')).toBe(true);
  });

  it('records activity and dashboard preferences', async () => {
    const board = await create('Activity board');
    const opened = await manager.markOpened(board.id);
    expect(opened?.updatedAt).toBe(board.updatedAt);
    await manager.trash(board.id);
    expect((await manager.listActivity()).map(entry => entry.type)).toEqual(expect.arrayContaining(['created', 'opened', 'trashed']));
    const prefs = await manager.updatePreferences({ layout: 'list', sort: 'name', sidebarCollapsed: true });
    expect(prefs).toMatchObject({ layout: 'list', sort: 'name', sidebarCollapsed: true });
  });
});

describe('migration and import compatibility', () => {
  const asFile = (data: unknown, name: string) => new File([JSON.stringify(data)], name, { type: 'application/json' });

  it('migrates legacy localStorage without deleting the original backup', async () => {
    localStorageMock.clear();
    localStorageMock.setItem('diagram-tool-boards', JSON.stringify([{ id: 'legacy-id', title: 'Legacy', description: '', mode: 'flow', dslText: 'start A', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]));
    manager = createMemoryBoardManager();
    expect((await manager.list())[0].id).toBe('legacy-id');
    expect(localStorageMock.getItem('diagram-tool-boards')).not.toBeNull();
  });

  it('imports v1 single-board, v2 backup, and legacy diagram files with fresh ids', async () => {
    const single = await manager.importFromFile(asFile({ version: '1.0', board: { id: 'old', title: 'Solo', mode: 'sequence', dslText: 'sequenceDiagram' } }, 'solo.board'));
    const backup = await manager.importFromFile(asFile({ version: '2.0', boards: [{ id: 'old-2', title: 'Backup', mode: 'gantt', dslText: 'diagram: gantt', starred: true, deletedAt: '2026-02-01T00:00:00.000Z' }] }, 'backup.boards'));
    const legacy = await manager.importFromFile(asFile({ diagram: { title: 'Diagram', mode: 'flow', dslText: 'start A' } }, 'legacy.diagram'));
    expect(single[0].id).not.toBe('old');
    expect(backup[0].title).toBe('Backup');
    expect(backup[0]).toMatchObject({ starred: true, deletedAt: '2026-02-01T00:00:00.000Z' });
    expect(legacy[0].mode).toBe('flow');
  });

  it('rejects invalid files', async () => {
    await expect(manager.importFromFile(asFile({ nope: true }, 'bad.json'))).rejects.toThrow('valid board file');
  });
});
