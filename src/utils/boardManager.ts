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
  createdAt: string;
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

  create(input: { title: string; description?: string; mode: BoardMode; dslText: string }): Board {
    const now = new Date().toISOString();
    const board: Board = {
      id: generateId(),
      title: input.title || 'Untitled board',
      description: input.description ?? '',
      mode: input.mode,
      dslText: input.dslText,
      createdAt: now,
      updatedAt: now,
    };
    writeAll([...readAll(), board]);
    return board;
  }

  update(id: string, patch: Partial<Pick<Board, 'title' | 'description' | 'mode' | 'dslText'>>): Board | undefined {
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

  duplicate(id: string): Board | undefined {
    const src = this.get(id);
    if (!src) return undefined;
    return this.create({
      title: `${src.title} (copy)`,
      description: src.description,
      mode: src.mode,
      dslText: src.dslText,
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
