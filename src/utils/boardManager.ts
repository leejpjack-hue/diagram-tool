// Board manager — the Miro-style dashboard's storage layer. Boards live in
// localStorage (browser-only, no backend), each holding one diagram of any
// mode plus a title/description. File import/export gives portable backups.

import { saveManager } from './saveManager';

export type BoardMode = 'architecture' | 'flow' | 'sequence' | 'gantt';

export interface Board {
  id: string;
  title: string;
  description: string;
  mode: BoardMode;
  dslText: string;
  /** Small captured preview shown on the dashboard card. */
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  /** Optional presentation canvas — a list of draggable/resizable images and
   *  notes the user has composed for publication. Persisted with the board
   *  so a "deck" lives next to the diagram that produced it. */
  presentation?: Presentation;
}

/**
 * One item on a board's presentation canvas. `image` items are a rendered
 * PNG of a diagram (captured via html-to-image). `note`, `text`, and `arrow`
 * items are annotation components the user adds directly.
 */
export interface PresentationItem {
  id: string;
  type: 'image' | 'note' | 'text' | 'arrow';
  /** Free-form title shown above the item in the editor and on the card. */
  title?: string;
  /** For images: a PNG data URL. For notes/text: editable body. For arrows: stroke color. */
  content: string;
  /** Pixel position of the top-left corner on the presentation canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Presentation {
  items: PresentationItem[];
  updatedAt: string;
}

/** Single-board file: { version, exportedAt, board } → <title>.board */
export interface BoardFile {
  version: string;
  exportedAt: string;
  board: Board;
}

/** Whole-dashboard file: { version, exportedAt, boards } → boards backup */
export interface BoardsFile {
  version: string;
  exportedAt: string;
  boards: Board[];
}

const STORAGE_KEY = 'diagram-tool-boards';
const MIGRATED_KEY = 'diagram-tool-boards-migrated';

function generateId(): string {
  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): Board[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Board[]) : [];
  } catch {
    return [];
  }
}

function writeAll(boards: Board[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

class BoardManager {
  /** All boards, most recently updated first. Seeds a board from the legacy
   *  single-slot save the first time the dashboard runs. */
  list(): Board[] {
    this.migrateOnce();
    return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id: string): Board | undefined {
    return readAll().find(b => b.id === id);
  }

  create(input: { title: string; description?: string; mode: BoardMode; dslText: string; thumbnail?: string }): Board {
    const now = new Date().toISOString();
    const board: Board = {
      id: generateId(),
      title: input.title || 'Untitled board',
      description: input.description ?? '',
      mode: input.mode,
      dslText: input.dslText,
      thumbnail: input.thumbnail,
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...readAll(), board]);
    return board;
  }

  update(id: string, patch: Partial<Pick<Board, 'title' | 'description' | 'mode' | 'dslText' | 'thumbnail'>>): Board | undefined {
    const boards = readAll();
    const idx = boards.findIndex(b => b.id === id);
    if (idx === -1) return undefined;
    boards[idx] = { ...boards[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(boards);
    return boards[idx];
  }

  remove(id: string): void {
    writeAll(readAll().filter(b => b.id !== id));
  }

  /**
   * Save the presentation canvas for a board. Pass an empty `items` array
   * to clear it. No-op if the board doesn't exist.
   */
  setPresentation(boardId: string, items: PresentationItem[]): void {
    const boards = readAll();
    const idx = boards.findIndex(b => b.id === boardId);
    if (idx === -1) return;
    boards[idx] = {
      ...boards[idx],
      presentation: { items, updatedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    };
    writeAll(boards);
  }

  /**
   * Convenience: append (or replace if same id) one item on a board's
   * presentation. Returns the new full items list, or null if the board
   * doesn't exist.
   */
  upsertPresentationItem(boardId: string, item: PresentationItem): PresentationItem[] | null {
    const boards = readAll();
    const board = boards.find(b => b.id === boardId);
    if (!board) return null;
    const existing = board.presentation?.items ?? [];
    const idx = existing.findIndex(i => i.id === item.id);
    const items = idx >= 0
      ? existing.map((i, n) => n === idx ? item : i)
      : [...existing, item];
    this.setPresentation(boardId, items);
    return items;
  }

  duplicate(id: string): Board | undefined {
    const src = this.get(id);
    if (!src) return undefined;
    // Don't copy the publication canvas — it's a per-board asset, not part
    // of the diagram itself.
    return this.create({
      title: `${src.title} (copy)`,
      description: src.description,
      mode: src.mode,
      dslText: src.dslText,
      thumbnail: src.thumbnail,
    });
  }

  // ---- file save / open ----

  exportBoard(board: Board): void {
    const file: BoardFile = { version: '1.0', exportedAt: new Date().toISOString(), board };
    downloadJson(file, `${slug(board.title)}.board`);
  }

  exportAll(): void {
    const file: BoardsFile = { version: '1.0', exportedAt: new Date().toISOString(), boards: readAll() };
    downloadJson(file, `boards-backup-${new Date().toISOString().split('T')[0]}.boards`);
  }

  /**
   * Import boards from a file. Accepts a whole-dashboard `.boards` file, a
   * single `.board` file, or a legacy `.diagram` file (from the File menu).
   * Imported boards get fresh ids so they never clobber existing ones.
   */
  async importFromFile(file: File): Promise<Board[]> {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("That file isn't a valid board file.");
    }

    const obj = data as Record<string, unknown>;
    const candidates: Array<Partial<Board>> = [];

    if (Array.isArray(obj.boards)) {
      candidates.push(...(obj.boards as Partial<Board>[]));
    } else if (obj.board && typeof obj.board === 'object') {
      candidates.push(obj.board as Partial<Board>);
    } else if (obj.diagram && typeof obj.diagram === 'object') {
      // Legacy .diagram export from the File menu
      const d = obj.diagram as { title?: string; dslText?: string; mode?: BoardMode };
      candidates.push({ title: d.title, dslText: d.dslText, mode: d.mode });
    } else {
      throw new Error("That file isn't a valid board file.");
    }

    const imported: Board[] = [];
    for (const c of candidates) {
      if (!c.dslText || !c.mode) continue;
      imported.push(this.create({
        title: c.title || 'Imported board',
        description: c.description ?? '',
        mode: c.mode,
        dslText: c.dslText,
        thumbnail: typeof c.thumbnail === 'string' ? c.thumbnail : undefined,
      }));
    }
    if (imported.length === 0) throw new Error('No boards found in that file.');
    return imported;
  }

  /** One-time seed: turn the legacy single-slot save into the first board. */
  private migrateOnce(): void {
    if (localStorage.getItem(MIGRATED_KEY)) return;
    localStorage.setItem(MIGRATED_KEY, '1');
    if (readAll().length > 0) return;
    const legacy = saveManager.getCurrentDiagram();
    if (legacy?.dslText) {
      this.create({
        title: legacy.title || 'My first board',
        description: '',
        mode: legacy.mode,
        dslText: legacy.dslText,
      });
    }
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export const boardManager = new BoardManager();
