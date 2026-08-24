import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBoardDocument, buildWorkspaceDocument } from './boardFormat';
import {
  createMemoryBoardManager,
  type Board,
  type BoardManager,
} from './boardManager';
import {
  OPEN_BOARD_FILE_ERRORS,
  interpretOpenedFile,
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

const FLOW_MERMAID = `flowchart LR
title: Checkout
  Intake[Intake] --> Review[Review]
  Review --> Done[Done]`;

const NATIVE_FLOW = `diagram: flow
title: Intake
start FNOL
FNOL -> Review
end Review`;

const MERMAID_GANTT = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
section Build
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d`;

const DRAWIO = `<mxfile host="app.diagrams.net">
  <diagram name="Two Boxes">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Intake" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="80" y="80" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Review" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="320" y="80" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" edge="1" parent="1" source="2" target="3"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

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

  it('opens a valid mermaid flow without wiping other boards', async () => {
    const { current, other } = await seedLibrary();
    const opened = await interpretOpenedFile('checkout.mmd', FLOW_MERMAID);
    expect(opened.format).toBe('source');
    expect(opened.portable.mode).toBe('flow');
    expect(opened.portable.title).toBe('Checkout');
    expect(opened.portable.dslText).toContain('flowchart LR');

    const board = await upsertOpenedBoard(manager, opened.portable);
    expect(board.id).not.toBe(current.id);
    expect(board.mode).toBe('flow');
    const boards = await manager.list();
    expect(boards).toHaveLength(3);
    expect((await manager.get(current.id))?.dslText).toBe(ARCH_DSL);
    expect((await manager.get(other.id))?.title).toBe('Other Board');
  });

  it('opens native DSL from content, not only the extension', async () => {
    const opened = await interpretOpenedFile('notes.txt', NATIVE_FLOW);
    expect(opened.format).toBe('source');
    expect(opened.portable).toMatchObject({ mode: 'flow', title: 'Intake' });
    expect(opened.portable.dslText).toContain('diagram: flow');
  });

  it('opens mermaid gantt as a native gantt board', async () => {
    const opened = await interpretOpenedFile('sprint.mmd', MERMAID_GANTT);
    expect(opened.portable.mode).toBe('gantt');
    expect(opened.portable.dslText).toMatch(/diagram:\s*gantt/);
    expect(opened.portable.title).toBe('Sprint Plan');
  });

  it('opens draw.io XML as a flow board', async () => {
    const opened = await interpretOpenedFile('two-boxes.drawio', DRAWIO);
    expect(opened.format).toBe('source');
    expect(opened.portable.mode).toBe('flow');
    expect(opened.portable.dslText).toContain('Intake -> Review');
  });

  it('Open erDiagram, classDiagram, and workspace backup does not clobber', async () => {
    const { current, other } = await seedLibrary();
    const snapshot = (board: Board) => ({ id: board.id, title: board.title, dslText: board.dslText, mode: board.mode });
    const beforeCurrent = snapshot(current);
    const beforeOther = snapshot(other);

    const attempts: Array<[string, string, string]> = [
      ['schema.mmd', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n', OPEN_BOARD_FILE_ERRORS.unsupported],
      ['model.mermaid', 'classDiagram\n  class Animal\n', OPEN_BOARD_FILE_ERRORS.unsupported],
      ['map.mmd', 'mindmap\n  root((ideas))\n', OPEN_BOARD_FILE_ERRORS.unsupported],
      ['backup.json', JSON.stringify({ version: '3.0', kind: 'workspace', boards: [boardDoc().board] }), OPEN_BOARD_FILE_ERRORS.workspace],
    ];

    for (const [filename, text, message] of attempts) {
      await expect(interpretOpenedFile(filename, text)).rejects.toThrow(message);
      const boards = await manager.list();
      expect(boards).toHaveLength(2);
      expect(snapshot((await manager.get(current.id))!)).toEqual(beforeCurrent);
      expect(snapshot((await manager.get(other.id))!)).toEqual(beforeOther);
    }
  });

  it('Open XXE draw.io reuses the existing sanitizer and does not clobber', async () => {
    const { current, other } = await seedLibrary();
    const snapshot = (board: Board) => ({ id: board.id, title: board.title, dslText: board.dslText, mode: board.mode });
    const beforeCurrent = snapshot(current);
    const beforeOther = snapshot(other);

    await expect(interpretOpenedFile(
      'xxe.drawio',
      '<!DOCTYPE foo [<!ENTITY x SYSTEM "http://evil">]><mxfile><diagram/></mxfile>',
    )).rejects.toThrow(/valid draw\.io/i);

    const boards = await manager.list();
    expect(boards).toHaveLength(2);
    expect(snapshot((await manager.get(current.id))!)).toEqual(beforeCurrent);
    expect(snapshot((await manager.get(other.id))!)).toEqual(beforeOther);
  });
});

describe('File → Open stays local-first', () => {
  it('reuses importDrawio and does not add a new XML parser, remote fetch, or window.__ hook', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const opener = readFileSync(join(here, 'boardFile.ts'), 'utf8');
    const menu = readFileSync(join(here, '../components/Panel/FileMenu.tsx'), 'utf8');
    const access = readFileSync(join(here, 'fileSystemAccess.ts'), 'utf8');
    expect(opener).toMatch(/importDrawio/);
    expect(`${opener}\n${menu}\n${access}`).not.toMatch(/DOMParser|parseFromString|\bfetch\s*\(/);
    expect(`${opener}\n${menu}\n${access}`).not.toMatch(/shareHost|\/api\/shares|window\.__|__setDiagramDsl/);
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
