import { beforeEach, describe, expect, it } from 'vitest';
import { buildBoardDocument, buildWorkspaceDocument } from './boardFormat';
import {
  createMemoryBoardManager,
  type Board,
  type BoardManager,
} from './boardManager';
import {
  OPEN_BOARD_FILE_ERRORS,
  parseOpenedBoardText,
  serializeBoardFile,
  upsertOpenedBoard,
} from './boardFile';

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

const ARCH_DSL = `diagram: architecture
title: Keep Me
service API {}`;

const OPENED_DSL = `diagram: architecture
title: From Disk
service Gateway {}`;

function boardDoc(overrides: Record<string, unknown> = {}) {
  return {
    version: '3.0',
    kind: 'board',
    exportedAt: '2026-08-24T00:00:00.000Z',
    board: {
      title: 'From Disk',
      mode: 'architecture',
      source: { kind: 'dsl', text: OPENED_DSL },
      dslText: OPENED_DSL,
      nodes: [],
      edges: [],
      frames: [],
      comments: [],
      layout: { pins: {} },
      ...overrides,
    },
  };
}

let manager: BoardManager;

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.setItem('diagram-tool-indexeddb-migrated-v2', '1');
  manager = createMemoryBoardManager();
});

async function seedLibrary() {
  const current = await manager.create({ title: 'Keep Me', mode: 'architecture', dslText: ARCH_DSL });
  const other = await manager.create({ title: 'Other Board', mode: 'flow', dslText: 'diagram: flow\nstart A' });
  return { current, other };
}

describe('parseOpenedBoardText', () => {
  it('accepts version 3.x kind:board', () => {
    const portable = parseOpenedBoardText(JSON.stringify(boardDoc()));
    expect(portable.title).toBe('From Disk');
    expect(portable.mode).toBe('architecture');
    expect(portable.dslText).toBe(OPENED_DSL);
  });

  it('rejects invalid JSON, wrong kind, and workspace backups', () => {
    expect(() => parseOpenedBoardText('{not json')).toThrow(OPEN_BOARD_FILE_ERRORS.invalid);
    expect(() => parseOpenedBoardText(JSON.stringify({ version: '3.0', kind: 'deck', board: boardDoc().board })))
      .toThrow(OPEN_BOARD_FILE_ERRORS.wrongKind);
    expect(() => parseOpenedBoardText(JSON.stringify({
      version: '3.0',
      kind: 'workspace',
      boards: [boardDoc().board],
    }))).toThrow(OPEN_BOARD_FILE_ERRORS.workspace);
    expect(() => parseOpenedBoardText(JSON.stringify({ version: '1.0', kind: 'board', board: boardDoc().board })))
      .toThrow(OPEN_BOARD_FILE_ERRORS.notVersion3);
  });
});

describe('open board file into the workspace', () => {
  it('invalid Open does not clobber the current board or library', async () => {
    const { current, other } = await seedLibrary();
    const snapshot = (board: Board) => ({ id: board.id, title: board.title, dslText: board.dslText, mode: board.mode });
    const beforeCurrent = snapshot(current);
    const beforeOther = snapshot(other);

    const attempts = [
      '{not json',
      JSON.stringify({ version: '3.0', kind: 'workspace', boards: [boardDoc().board], spaces: [], templates: [], versions: [] }),
      JSON.stringify({ version: '3.0', kind: 'notes', board: boardDoc().board }),
      JSON.stringify({ version: '2.0', kind: 'board', board: boardDoc().board }),
    ];

    for (const text of attempts) {
      expect(() => parseOpenedBoardText(text)).toThrow();
      const boards = await manager.list();
      expect(boards).toHaveLength(2);
      expect(snapshot((await manager.get(current.id))!)).toEqual(beforeCurrent);
      expect(snapshot((await manager.get(other.id))!)).toEqual(beforeOther);
    }
  });

  it('opens a kind:board file as the current board and keeps other workspace boards', async () => {
    const { current, other } = await seedLibrary();
    const portable = parseOpenedBoardText(JSON.stringify(boardDoc({ id: current.id })));
    const opened = await upsertOpenedBoard(manager, portable);
    expect(opened.id).toBe(current.id);
    expect(opened.title).toBe('From Disk');
    expect(opened.dslText).toBe(OPENED_DSL);
    const boards = await manager.list();
    expect(boards.map(board => board.id).sort()).toEqual([current.id, other.id].sort());
    expect((await manager.get(other.id))?.title).toBe('Other Board');
  });
});

describe('serializeBoardFile', () => {
  it('Save serializes kind:board 3.0', async () => {
    const board = await manager.create({ title: 'Payments API', mode: 'architecture', dslText: ARCH_DSL });
    const text = serializeBoardFile(board, '2026-08-24T12:00:00.000Z');
    const document = JSON.parse(text) as ReturnType<typeof buildBoardDocument>;
    expect(document).toMatchObject({ version: '3.0', kind: 'board' });
    expect(document.board.title).toBe('Payments API');
    expect(document.board.source.text).toBe(ARCH_DSL);
    expect(document.board.dslText).toBe(ARCH_DSL);
    expect(document.board.frames).toEqual([]);
    expect(document.board.comments).toEqual([]);
    expect(text.endsWith('\n')).toBe(true);

    const workspace = buildWorkspaceDocument({ boards: [board], spaces: [], templates: [], versions: [] });
    expect(workspace.kind).toBe('workspace');
    expect(() => parseOpenedBoardText(JSON.stringify(workspace))).toThrow(OPEN_BOARD_FILE_ERRORS.workspace);
  });
});
