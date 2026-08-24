import { buildBoardDocument, parsePortableImport, type PortableBoard } from './boardFormat';
import type { Board, BoardManager } from './boardManager';

export const OPEN_BOARD_FILE_ERRORS = {
  invalid: "That file isn't a valid board file.",
  notVersion3: "That file isn't a version 3.x board file.",
  workspace: 'That file is a workspace backup, not a single board.',
  wrongKind: 'That file isn\'t a single-board JSON file (kind: "board").',
} as const;

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
