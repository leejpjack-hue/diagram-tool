import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOARD_FORMAT_VERSION,
  EXPORT_REQUIRES_ACCOUNT,
  EXPORT_WATERMARK,
  buildBoardDocument,
  buildWorkspaceDocument,
  computeTypedLayout,
  containsWatermark,
  layoutDelta,
  isAllowedPresentationContent,
  parsePortableImport,
  projectBoardGraph,
  validatePortableDocument,
} from './boardFormat';
import type { Board, BoardVersion, PersonalTemplate, Space } from './boardManager';

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, '../../docs/board-format.schema.json'), 'utf8')) as {
  $defs: { portableBoard: { required: string[] } };
};

const ARCH_DSL = `diagram: architecture
title: Portable Roundtrip
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

const FLOW_DSL = `diagram: flow
title: Portable Flow
start Intake
Intake -> Review
end Review
node Intake { at: 80, 40 }
node Review { at: 80, 200 }`;

const SEQUENCE_DSL = `sequenceDiagram
title Portable Sequence
participant A as Alice
participant B as Bob
A->>B: ping`;

const GANTT_DSL = `diagram: gantt
title: Portable Plan
task Design {
  start: 2026-08-01
  end: 2026-08-05
}
task Build {
  start: 2026-08-06
  end: 2026-08-12
  depends: Design
}`;

function board(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-arch',
    title: 'Portable Roundtrip',
    description: '',
    mode: 'architecture',
    dslText: ARCH_DSL,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    tags: [],
    starred: false,
    schemaVersion: 2,
    ...overrides,
  };
}

describe('public portable board format', () => {
  it('emits version 3.0 documents that satisfy the documented required fields', () => {
    const document = buildBoardDocument(board());
    expect(document.version).toBe(BOARD_FORMAT_VERSION);
    expect(document.kind).toBe('board');
    expect(validatePortableDocument(document)).toEqual({ ok: true, errors: [] });
    for (const field of schema.$defs.portableBoard.required) {
      expect(document.board).toHaveProperty(field);
    }
    expect(document.board.frames).toEqual([]);
    expect(document.board.comments).toEqual([]);
    expect(document.board.source).toEqual({ kind: 'dsl', text: ARCH_DSL });
    expect(document.board.nodes.map(node => node.id)).toEqual(['gateway', 'api']);
    expect(containsWatermark(JSON.stringify(document))).toBe(false);
  });

  it('round-trips architecture, flow, sequence, and gantt layout within ±2px', () => {
    const samples: Array<{ mode: Board['mode']; dsl: string }> = [
      { mode: 'architecture', dsl: ARCH_DSL },
      { mode: 'flow', dsl: FLOW_DSL },
      { mode: 'sequence', dsl: SEQUENCE_DSL },
      { mode: 'gantt', dsl: GANTT_DSL },
    ];
    for (const sample of samples) {
      const exported = buildBoardDocument(board({ mode: sample.mode, dslText: sample.dsl, title: sample.mode }));
      const plan = parsePortableImport(exported);
      expect(plan.boards).toHaveLength(1);
      expect(plan.boards[0].dslText).toBe(sample.dsl);
      const before = computeTypedLayout(sample.mode, sample.dsl);
      const after = computeTypedLayout(plan.boards[0].mode, plan.boards[0].dslText);
      expect(layoutDelta(before, after)).toBeLessThanOrEqual(2);
      expect(plan.boards[0].nodes.length).toBe(projectBoardGraph(sample.mode, sample.dsl).nodes.length);
    }
  });

  it('complete backup includes spaces, personal templates, and version checkpoint metadata', () => {
    const space: Space = { id: 'space-1', name: 'Platform', color: '#6366f1', order: 0, createdAt: 't', updatedAt: 't' };
    const template: PersonalTemplate = {
      id: 'template-1', name: 'API starter', description: '', mode: 'architecture', dslText: ARCH_DSL,
      createdAt: 't', updatedAt: 't', useCount: 1,
    };
    const version: BoardVersion = {
      id: 'version-1', boardId: 'board-arch', name: 'Before redesign', dslText: ARCH_DSL,
      mode: 'architecture', createdAt: 't', automatic: false,
    };
    const backup = buildWorkspaceDocument({
      boards: [board({ spaceId: 'space-1' })],
      spaces: [space],
      templates: [template],
      versions: [version],
    });
    expect(backup.kind).toBe('workspace');
    expect(backup.spaces.map(item => item.name)).toEqual(['Platform']);
    expect(backup.templates.map(item => item.name)).toEqual(['API starter']);
    expect(backup.versions).toEqual([version]);
    expect(validatePortableDocument(backup).ok).toBe(true);

    const plan = parsePortableImport(backup);
    expect(plan.spaces[0].name).toBe('Platform');
    expect(plan.templates[0].name).toBe('API starter');
    expect(plan.versions[0].name).toBe('Before redesign');
  });

  it('lists unknown deck types and reserved payloads as skipped', () => {
    const plan = parsePortableImport({
      version: '3.0',
      board: {
        title: 'Deck',
        mode: 'architecture',
        source: { kind: 'dsl', text: ARCH_DSL },
        comments: [{ id: 'c1', body: 'later' }],
        frames: [{ id: 'f1' }],
        presentation: {
          items: [
            { id: 'note', type: 'note', content: 'keep', x: 10, y: 20, width: 80, height: 40 },
            { id: 'sticker', type: 'sticky', content: 'nope', x: 0, y: 0, width: 10, height: 10 },
          ],
        },
      },
    });
    expect(plan.boards[0].presentation?.items).toHaveLength(1);
    expect(plan.skipped.map(item => item.kind)).toEqual(expect.arrayContaining(['comments', 'frames', 'sticky']));
  });

  it('round-trips presentation frames with title, color, lockChildren, and hidden', () => {
    const plan = parsePortableImport({
      version: '3.0',
      board: {
        title: 'Deck frames',
        mode: 'architecture',
        source: { kind: 'dsl', text: ARCH_DSL },
        frames: [],
        comments: [],
        presentation: {
          items: [
            {
              id: 'intro', type: 'frame', title: 'Intro', content: '', x: 10, y: 20, width: 200, height: 140,
              lockChildren: true, hidden: false, style: { strokeColor: '#7c3aed' },
            },
            {
              id: 'secret', type: 'frame', title: 'Secret', content: '', x: 400, y: 20, width: 200, height: 140,
              hidden: true, style: { strokeColor: '#e11d48' },
            },
            { id: 'note', type: 'note', content: 'inside intro', x: 30, y: 40, width: 80, height: 40 },
          ],
        },
      },
    });
    expect(plan.boards[0].frames).toEqual([]);
    const items = plan.boards[0].presentation?.items ?? [];
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ type: 'frame', title: 'Intro', lockChildren: true, style: { strokeColor: '#7c3aed' } });
    expect(items[1]).toMatchObject({ type: 'frame', title: 'Secret', hidden: true });
  });

  it('rejects remote and SVG presentation content and accepts raster data URLs', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJ0hREFU';
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const webp = 'data:image/webp;base64,UklGRg==';
    const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    expect(isAllowedPresentationContent('image', png)).toBe(true);
    expect(isAllowedPresentationContent('image', jpeg)).toBe(true);
    expect(isAllowedPresentationContent('image', webp)).toBe(true);
    expect(isAllowedPresentationContent('image', gif)).toBe(true);
    expect(isAllowedPresentationContent('image', 'https://evil.example/x.png')).toBe(false);
    expect(isAllowedPresentationContent('image', 'http://evil.example/x.png')).toBe(false);
    expect(isAllowedPresentationContent('image', 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+')).toBe(false);
    expect(isAllowedPresentationContent('image', 'data:image/svg+xml,<svg onload="alert(1)"></svg>')).toBe(false);
    expect(isAllowedPresentationContent('note', 'https://evil.example')).toBe(false);

    const plan = parsePortableImport({
      version: '3.0',
      board: {
        title: 'Deck',
        mode: 'architecture',
        source: { kind: 'dsl', text: ARCH_DSL },
        presentation: {
          items: [
            { id: 'ok', type: 'image', content: png, x: 0, y: 0, width: 10, height: 10 },
            { id: 'remote', type: 'image', content: 'https://evil.example/x.png', x: 0, y: 0, width: 10, height: 10 },
            { id: 'svg', type: 'image', content: 'data:image/svg+xml;base64,PHN2Zc+', x: 0, y: 0, width: 10, height: 10 },
            { id: 'note', type: 'note', content: 'keep', x: 10, y: 20, width: 80, height: 40 },
          ],
        },
      },
    });
    expect(plan.boards[0].presentation?.items.map(item => item.id)).toEqual(['ok', 'note']);
    expect(plan.skipped.map(item => item.id)).toEqual(expect.arrayContaining(['remote', 'svg']));
  });

  it('PNG/SVG/PDF export stays free and unwatermarked', () => {
    expect(EXPORT_WATERMARK).toBeNull();
    expect(EXPORT_REQUIRES_ACCOUNT).toBe(false);
    expect(containsWatermark('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(false);
    expect(containsWatermark('DiagramTool watermark preview')).toBe(true);
  });
});
