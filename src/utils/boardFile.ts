import { isMermaidFlow, isMermaidSequence } from '../parser/mermaidFlow';
import { isMermaidGantt, mermaidGanttToDSL } from '../parser/mermaidGantt';
import {
  buildBoardDocument,
  parsePortableImport,
  projectBoardGraph,
  sourceKindFor,
  type PortableBoard,
} from './boardFormat';
import type { Board, BoardManager, BoardMode } from './boardManager';
import { importDrawio, looksLikeDrawio } from './drawioImport';
import { type LinkedFileFormat } from './fileSystemAccess';
import { applyBoardSource, extractBoardTitle } from './sourceText';

export const OPEN_BOARD_FILE_ERRORS = {
  invalid: "That file isn't a valid board file.",
  notVersion3: "That file isn't a version 3.x board file.",
  workspace: 'That file is a workspace backup, not a single board.',
  wrongKind: 'That file isn\'t a single-board JSON file (kind: "board").',
  unsupported: "That diagram type isn't supported yet.",
  unreadable: "That file couldn't be opened.",
} as const;

const UNSUPPORTED_MERMAID = /^(erDiagram|classDiagram|mindmap|stateDiagram(?:-v2)?|pie|gitGraph|journey|quadrantChart|timeline|C4Context|C4Container|C4Component)\b/i;

export function firstSignificantLine(text: string): string {
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('%%') || /^#{1,3}\s/.test(line)) continue;
    return line;
  }
  return '';
}

export function isUnsupportedOpenedDiagram(text: string): boolean {
  return UNSUPPORTED_MERMAID.test(firstSignificantLine(text));
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function filenameStem(filename: string): string {
  return filename.replace(/\.[^./\\]+$/i, '').replace(/^.*[/\\]/, '').trim() || 'Imported diagram';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

export function portableBoardFromSource(input: {
  title: string;
  mode: BoardMode;
  dslText: string;
}): PortableBoard {
  return {
    title: input.title,
    mode: input.mode,
    dslText: input.dslText,
    source: { kind: sourceKindFor(input.mode, input.dslText), text: input.dslText },
    ...projectBoardGraph(input.mode, input.dslText),
    frames: [],
    comments: [],
  };
}

function sourceTitle(text: string, mode: BoardMode, filename: string): string {
  return extractBoardTitle(text, mode) ?? filenameStem(filename);
}

function requireReadable(text: string, mode: BoardMode): void {
  const result = applyBoardSource(text, mode);
  if (!result.ok) throw new Error(result.error || OPEN_BOARD_FILE_ERRORS.unreadable);
}

export async function interpretOpenedFile(
  filename: string,
  text: string,
): Promise<{ portable: PortableBoard; format: LinkedFileFormat }> {
  const raw = stripBom(text);
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(OPEN_BOARD_FILE_ERRORS.unreadable);

  if (looksLikeJson(trimmed)) {
    return { portable: parseOpenedBoardText(trimmed), format: 'board-json' };
  }

  if (looksLikeDrawio(filename, raw)) {
    const drawio = await importDrawio(filename, raw);
    return {
      portable: portableBoardFromSource({
        title: drawio.title || filenameStem(filename),
        mode: drawio.mode,
        dslText: drawio.dslText,
      }),
      format: 'source',
    };
  }

  if (isUnsupportedOpenedDiagram(raw)) {
    throw new Error(OPEN_BOARD_FILE_ERRORS.unsupported);
  }

  if (isMermaidSequence(raw)) {
    requireReadable(raw, 'sequence');
    return {
      portable: portableBoardFromSource({
        title: sourceTitle(raw, 'sequence', filename),
        mode: 'sequence',
        dslText: raw,
      }),
      format: 'source',
    };
  }

  if (isMermaidFlow(raw)) {
    requireReadable(raw, 'flow');
    return {
      portable: portableBoardFromSource({
        title: sourceTitle(raw, 'flow', filename),
        mode: 'flow',
        dslText: raw,
      }),
      format: 'source',
    };
  }

  if (isMermaidGantt(raw)) {
    const dsl = mermaidGanttToDSL(raw);
    requireReadable(dsl, 'gantt');
    return {
      portable: portableBoardFromSource({
        title: sourceTitle(dsl, 'gantt', filename),
        mode: 'gantt',
        dslText: dsl,
      }),
      format: 'source',
    };
  }

  const native = firstSignificantLine(raw).match(/^diagram:\s*(architecture|flow|gantt)\b/i);
  if (native) {
    const mode = native[1].toLowerCase() as 'architecture' | 'flow' | 'gantt';
    requireReadable(raw, mode);
    return {
      portable: portableBoardFromSource({
        title: sourceTitle(raw, mode, filename),
        mode,
        dslText: raw,
      }),
      format: 'source',
    };
  }

  throw new Error(OPEN_BOARD_FILE_ERRORS.unreadable);
}

export function isBoardFormatVersion3(value: unknown): boolean {
  return typeof value === 'string' && /^3(\.|$)/.test(value.trim());
}

/** File → Open / Reload: version 3.x kind:board only. Workspace backups and other kinds throw. */
export function parseOpenedBoardText(text: string): PortableBoard {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(OPEN_BOARD_FILE_ERRORS.invalid);
  }
  return parseOpenedBoardDocument(data);
}

export function parseOpenedBoardDocument(data: unknown): PortableBoard {
  if (!data || typeof data !== 'object') throw new Error(OPEN_BOARD_FILE_ERRORS.invalid);
  const object = data as Record<string, unknown>;
  if (!isBoardFormatVersion3(object.version)) throw new Error(OPEN_BOARD_FILE_ERRORS.notVersion3);
  if (object.kind === 'workspace' || (object.kind !== 'board' && Array.isArray(object.boards))) {
    throw new Error(OPEN_BOARD_FILE_ERRORS.workspace);
  }
  if (object.kind !== 'board') throw new Error(OPEN_BOARD_FILE_ERRORS.wrongKind);
  const plan = parsePortableImport(data);
  if (plan.boards.length !== 1) throw new Error(OPEN_BOARD_FILE_ERRORS.invalid);
  return plan.boards[0];
}

/** File → Save / Save As: same portable document MCP already writes. */
export function serializeBoardFile(
  board: Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>,
  exportedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify(buildBoardDocument(board, exportedAt), null, 2)}\n`;
}

export async function upsertOpenedBoard(
  manager: BoardManager,
  portable: PortableBoard,
  replaceId?: string,
): Promise<Board> {
  const targetId = replaceId || portable.id;
  const existing = targetId ? await manager.get(targetId) : undefined;
  if (existing) {
    const updated = await manager.update(existing.id, {
      title: portable.title,
      description: portable.description ?? '',
      mode: portable.mode,
      dslText: portable.dslText,
      thumbnail: portable.thumbnail,
      presentation: portable.presentation,
    }, 'updated');
    if (!updated) throw new Error(OPEN_BOARD_FILE_ERRORS.invalid);
    await manager.markOpened(updated.id);
    return (await manager.get(updated.id)) ?? updated;
  }

  const created = await manager.create({
    id: portable.id,
    title: portable.title,
    description: portable.description,
    mode: portable.mode,
    dslText: portable.dslText,
    thumbnail: portable.thumbnail,
    tags: portable.tags,
    presentation: portable.presentation?.items,
  });
  return created;
}
