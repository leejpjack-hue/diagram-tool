import { describe, it, expect, beforeEach } from 'vitest';
import { boardManager } from './boardManager';

// Same in-memory localStorage mock the saveManager tests use.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  // Skip the legacy-migration path in unit tests.
  localStorageMock.setItem('diagram-tool-boards-migrated', '1');
});

const make = (title = 'Board A') =>
  boardManager.create({ title, mode: 'architecture', dslText: 'diagram: architecture\ntitle: X' });

describe('boardManager CRUD', () => {
  it('creates and lists boards, newest updated first', async () => {
    const a = make('A');
    const b = make('B');
    await new Promise(r => setTimeout(r, 5)); // ensure a later timestamp
    boardManager.update(a.id, { description: 'bumped' });
    const list = boardManager.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a.id); // updated last → first
    expect(list[1].id).toBe(b.id);
  });

  it('updates title/description/dsl and bumps updatedAt', () => {
    const a = make();
    const before = a.updatedAt;
    const out = boardManager.update(a.id, { title: 'Renamed', description: 'desc', thumbnail: 'data:image/jpeg;base64,abc' })!;
    expect(out.title).toBe('Renamed');
    expect(out.description).toBe('desc');
    expect(out.thumbnail).toBe('data:image/jpeg;base64,abc');
    expect(out.updatedAt >= before).toBe(true);
  });

  it('duplicates with a (copy) title and fresh id', () => {
    const a = make('Orig');
    boardManager.update(a.id, { thumbnail: 'data:image/jpeg;base64,abc' });
    const copy = boardManager.duplicate(a.id)!;
    expect(copy.id).not.toBe(a.id);
    expect(copy.title).toBe('Orig (copy)');
    expect(copy.dslText).toBe(a.dslText);
    expect(copy.thumbnail).toBe('data:image/jpeg;base64,abc');
    expect(boardManager.list()).toHaveLength(2);
  });

  it('removes boards', () => {
    const a = make();
    boardManager.remove(a.id);
    expect(boardManager.list()).toHaveLength(0);
  });
});

describe('boardManager import', () => {
  const asFile = (data: unknown, name = 'x.boards') =>
    new File([JSON.stringify(data)], name, { type: 'application/json' });

  it('imports a whole-dashboard .boards file with fresh ids', async () => {
    const src = make('Original');
    const payload = { version: '1.0', exportedAt: 'now', boards: [{ ...src, id: 'stale-id', thumbnail: 'data:image/jpeg;base64,abc' }] };
    const imported = await boardManager.importFromFile(asFile(payload));
    expect(imported).toHaveLength(1);
    expect(imported[0].id).not.toBe('stale-id');
    expect(imported[0].thumbnail).toBe('data:image/jpeg;base64,abc');
    expect(boardManager.list()).toHaveLength(2);
  });

  it('imports a single .board file', async () => {
    const payload = {
      version: '1.0', exportedAt: 'now',
      board: { title: 'Solo', description: 'd', mode: 'sequence', dslText: 'sequenceDiagram\nA->>B: hi' },
    };
    const [b] = await boardManager.importFromFile(asFile(payload, 'solo.board'));
    expect(b.title).toBe('Solo');
    expect(b.mode).toBe('sequence');
  });

  it('imports a legacy .diagram file', async () => {
    const payload = {
      version: '1.0', exportedAt: 'now',
      diagram: { title: 'Legacy', mode: 'flow', dslText: 'diagram: flow\nstart A' },
    };
    const [b] = await boardManager.importFromFile(asFile(payload, 'legacy.diagram'));
    expect(b.title).toBe('Legacy');
    expect(b.mode).toBe('flow');
  });

  it('rejects garbage files', async () => {
    await expect(boardManager.importFromFile(asFile({ nope: true }))).rejects.toThrow();
    await expect(boardManager.importFromFile(new File(['not json'], 'x.board'))).rejects.toThrow();
  });
});

describe('boardManager presentation', () => {
  it('persists items on a board and survives a re-list', () => {
    const a = make();
    const items = [
      { id: 'i1', type: 'image' as const, title: 'slide 1', content: 'data:png;base64,...', x: 50, y: 80, width: 480, height: 320 },
      { id: 'i2', type: 'note' as const, title: 'Speaker note', content: 'open with the pain point', x: 600, y: 80, width: 220, height: 140 },
    ];
    boardManager.setPresentation(a.id, items);
    const after = boardManager.get(a.id);
    expect(after?.presentation?.items).toHaveLength(2);
    expect(after?.presentation?.items[0].title).toBe('slide 1');
    expect(after?.presentation?.items[1].type).toBe('note');
  });

  it('upserts an item by id (replace) or appends if new', () => {
    const a = make();
    boardManager.upsertPresentationItem(a.id, {
      id: 'i1', type: 'image', title: 'first', content: 'a', x: 0, y: 0, width: 100, height: 100,
    });
    boardManager.upsertPresentationItem(a.id, {
      id: 'i1', type: 'image', title: 'first (edited)', content: 'a', x: 0, y: 0, width: 100, height: 100,
    });
    boardManager.upsertPresentationItem(a.id, {
      id: 'i2', type: 'note', title: 'n', content: '', x: 0, y: 0, width: 100, height: 100,
    });
    const list = boardManager.get(a.id)?.presentation?.items ?? [];
    expect(list).toHaveLength(2);
    expect(list.find(i => i.id === 'i1')!.title).toBe('first (edited)');
    expect(list.find(i => i.id === 'i2')!.type).toBe('note');
  });

  it('returns null when upserting on a missing board', () => {
    expect(boardManager.upsertPresentationItem('no-such-id', {
      id: 'x', type: 'image', content: '', x: 0, y: 0, width: 1, height: 1,
    })).toBeNull();
  });

  it('does not carry the presentation over when duplicating a board', () => {
    const a = make('Source');
    boardManager.setPresentation(a.id, [
      { id: 'i1', type: 'image', content: '', x: 0, y: 0, width: 100, height: 100 },
    ]);
    const copy = boardManager.duplicate(a.id)!;
    expect(copy.presentation).toBeUndefined();
  });
});
