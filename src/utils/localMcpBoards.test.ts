import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalMcpError,
  createBoard,
  getBoard,
  listBoards,
  resolveBoardsDir,
  setSource,
} from './localMcpBoards';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../mcp/fixtures');
const PAYMENTS = join(fixtures, 'payments.json');
const WORKSPACE = join(fixtures, 'workspace-backup.json');

const VALID_FLOW = `diagram: flow
title: Intake
start FNOL
FNOL -> Review
end Review
`;

const INVALID_ARCH = `diagram: architecture
service Gateway {
`;

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-tool-mcp-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  // Leave temp dirs for the OS; tests never write back to fixtures/.
});

describe('list_boards', () => {
  it('lists version 3.x kind:board JSON and ignores workspace backups and unknown files', () => {
    const dir = tempDir();
    copyFileSync(PAYMENTS, join(dir, 'payments.json'));
    copyFileSync(WORKSPACE, join(dir, 'workspace-backup.json'));
    writeFileSync(join(dir, 'notes.txt'), 'not a board', 'utf8');
    writeFileSync(join(dir, 'random.json'), JSON.stringify({ hello: 'world' }), 'utf8');
    writeFileSync(join(dir, 'legacy.json'), JSON.stringify({
      version: '2.0',
      kind: 'board',
      board: {
        title: 'Legacy',
        mode: 'architecture',
        source: { kind: 'dsl', text: 'diagram: architecture\nservice Old' },
        dslText: 'diagram: architecture\nservice Old',
      },
    }), 'utf8');
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'hidden.json'), readFileSync(PAYMENTS, 'utf8'), 'utf8');

    const listed = listBoards(dir);
    expect(listed.map(item => item.filename)).toEqual(['payments.json']);
    expect(listed[0]).toMatchObject({
      filename: 'payments.json',
      title: 'Payments API',
      mode: 'architecture',
    });
    expect(listed[0].mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('get_board', () => {
  it('returns title, mode, source text, and a short node/edge summary without presentation rasters', () => {
    const dir = tempDir();
    copyFileSync(PAYMENTS, join(dir, 'payments.json'));

    const board = getBoard('payments.json', dir);
    expect(board.title).toBe('Payments API');
    expect(board.mode).toBe('architecture');
    expect(board.source).toContain('service Gateway');
    expect(board.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['Gateway', 'Ledger']));
    expect(board.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'gateway', to: 'ledger' }),
    ]));

    const serialized = JSON.stringify(board);
    expect(serialized).not.toMatch(/data:image/);
    expect(serialized).not.toContain('thumbnail');
    expect(serialized).not.toContain('presentation');
    expect(board).not.toHaveProperty('thumbnail');
    expect(board).not.toHaveProperty('presentation');
  });
});

describe('set_source', () => {
  it('replaces source.text and dslText and leaves nodes/edges untouched', () => {
    const dir = tempDir();
    copyFileSync(PAYMENTS, join(dir, 'payments.json'));
    const before = JSON.parse(readFileSync(join(dir, 'payments.json'), 'utf8')) as {
      board: { nodes: unknown; edges: unknown; thumbnail: string };
    };

    const next = `diagram: architecture
title: Payments API
service Gateway {
  connects: Ledger
}
service Ledger {
}
service Audit {
}
`;
    const view = setSource('payments.json', next, dir);
    expect(view.source).toBe(next);
    expect(view.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['Gateway', 'Ledger', 'Audit']));

    const after = JSON.parse(readFileSync(join(dir, 'payments.json'), 'utf8')) as {
      board: {
        source: { text: string };
        dslText: string;
        nodes: unknown;
        edges: unknown;
        thumbnail: string;
      };
    };
    expect(after.board.source.text).toBe(next);
    expect(after.board.dslText).toBe(next);
    expect(after.board.nodes).toEqual(before.board.nodes);
    expect(after.board.edges).toEqual(before.board.edges);
    expect(after.board.thumbnail).toBe(before.board.thumbnail);
  });

  it('rejects invalid source and leaves the file unchanged', () => {
    const dir = tempDir();
    copyFileSync(PAYMENTS, join(dir, 'payments.json'));
    const before = readFileSync(join(dir, 'payments.json'), 'utf8');

    expect(() => setSource('payments.json', INVALID_ARCH, dir)).toThrow(LocalMcpError);
    expect(() => setSource('payments.json', INVALID_ARCH, dir)).toThrow(/Expected/i);
    expect(readFileSync(join(dir, 'payments.json'), 'utf8')).toBe(before);
  });
});

describe('create_board', () => {
  it('writes a version 3.0 kind:board file with source only (empty nodes/edges)', () => {
    const dir = tempDir();
    const created = createBoard({ title: 'Intake', mode: 'flow', source: VALID_FLOW }, dir);

    expect(created.filename).toBe('intake.json');
    expect(created.title).toBe('Intake');
    expect(created.mode).toBe('flow');
    expect(created.source).toBe(VALID_FLOW);
    expect(created.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['FNOL', 'Review']));

    const document = JSON.parse(readFileSync(join(dir, 'intake.json'), 'utf8')) as {
      version: string;
      kind: string;
      board: { source: { text: string }; dslText: string; nodes: unknown[]; edges: unknown[] };
    };
    expect(document).toMatchObject({ version: '3.0', kind: 'board' });
    expect(document.board.source.text).toBe(VALID_FLOW);
    expect(document.board.dslText).toBe(VALID_FLOW);
    expect(document.board.nodes).toEqual([]);
    expect(document.board.edges).toEqual([]);
    expect(listBoards(dir).map(item => item.filename)).toEqual(['intake.json']);
  });

  it('rejects invalid source and does not write a file', () => {
    const dir = tempDir();
    expect(() => createBoard({
      title: 'Broken',
      mode: 'architecture',
      source: INVALID_ARCH,
    }, dir)).toThrow(/Expected/i);
    expect(listBoards(dir)).toEqual([]);
  });
});

describe('resolveBoardsDir', () => {
  it('requires DIAGRAM_TOOL_DIR to be an existing folder', () => {
    expect(() => resolveBoardsDir({})).toThrow(/DIAGRAM_TOOL_DIR is not set/);
    expect(() => resolveBoardsDir({ DIAGRAM_TOOL_DIR: join(tempDir(), 'missing') })).toThrow(/does not exist/);
  });
});
