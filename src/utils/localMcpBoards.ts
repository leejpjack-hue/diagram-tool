/** Node-only folder adapter for the local stdio MCP. Do not import from the web app bundle. */
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import { applyBoardSource, extractBoardTitle } from './sourceText';
import { projectBoardGraph, sourceKindFor } from './boardFormat';
import type { BoardMode } from './boardManager';

export const BOARD_MODES = ['architecture', 'flow', 'sequence', 'gantt'] as const;
export type LocalMcpMode = (typeof BOARD_MODES)[number];

export const DIAGRAM_TOOL_DIR_ENV = 'DIAGRAM_TOOL_DIR';

export class LocalMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalMcpError';
  }
}

export interface ListedBoard {
  filename: string;
  title: string;
  mode: LocalMcpMode;
  mtime: string;
}

export interface BoardView {
  filename: string;
  title: string;
  mode: LocalMcpMode;
  source: string;
  nodes: Array<{ id: string; name?: string; type?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

export type CreatedBoard = BoardView;

interface ParsedBoardFile {
  document: Record<string, unknown>;
  board: Record<string, unknown>;
  title: string;
  mode: LocalMcpMode;
  source: string;
}

const MODE_SET = new Set<string>(BOARD_MODES);

export function resolveBoardsDir(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[DIAGRAM_TOOL_DIR_ENV]?.trim();
  if (!raw) {
    throw new LocalMcpError(
      'DIAGRAM_TOOL_DIR is not set. Point it at a folder of DiagramTool board JSON (version 3.x, kind: "board").',
    );
  }
  const dir = resolve(raw);
  try {
    if (!statSync(dir).isDirectory()) {
      throw new LocalMcpError(`DIAGRAM_TOOL_DIR is not a folder: ${dir}`);
    }
  } catch (error) {
    if (error instanceof LocalMcpError) throw error;
    throw new LocalMcpError(`DIAGRAM_TOOL_DIR does not exist: ${dir}`);
  }
  return dir;
}

export function listBoards(dir: string): ListedBoard[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const boards: ListedBoard[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (extname(entry.name).toLowerCase() !== '.json') continue;
    const full = join(dir, entry.name);
    const parsed = readBoardFile(full);
    if (!parsed) continue;
    boards.push({
      filename: entry.name,
      title: parsed.title,
      mode: parsed.mode,
      mtime: statSync(full).mtime.toISOString(),
    });
  }
  return boards.sort((a, b) => a.filename.localeCompare(b.filename));
}

export function getBoard(filename: string, dir: string): BoardView {
  const full = resolveBoardPath(dir, filename);
  const parsed = readBoardFile(full);
  if (!parsed) {
    throw new LocalMcpError(
      `"${basename(full)}" is not a version 3.x single-board JSON file (kind: "board").`,
    );
  }
  return toBoardView(basename(full), parsed);
}

export function setSource(filename: string, source: string, dir: string): BoardView {
  const full = resolveBoardPath(dir, filename);
  const before = readFileSync(full, 'utf8');
  const parsed = readBoardFile(full);
  if (!parsed) {
    throw new LocalMcpError(
      `"${basename(full)}" is not a version 3.x single-board JSON file (kind: "board").`,
    );
  }
  assertValidSource(source, parsed.mode);
  const nextBoard = {
    ...parsed.board,
    dslText: source,
    source: { kind: sourceKindFor(parsed.mode, source), text: source },
  };
  const nextDocument = {
    ...parsed.document,
    board: nextBoard,
  };
  writeJsonAtomic(full, nextDocument);
  const written = readFileSync(full, 'utf8');
  if (before === written) {
    // Source was already identical; still return the view.
  }
  return getBoard(basename(full), dir);
}

export function createBoard(
  input: { title: string; mode: LocalMcpMode; source: string },
  dir: string,
): CreatedBoard {
  const title = input.title.trim();
  if (!title) throw new LocalMcpError('title is required.');
  if (!MODE_SET.has(input.mode)) {
    throw new LocalMcpError('mode must be architecture, flow, sequence, or gantt.');
  }
  assertValidSource(input.source, input.mode);

  const filename = uniqueFilename(dir, title);
  const document = {
    version: '3.0',
    kind: 'board',
    exportedAt: new Date().toISOString(),
    board: {
      title,
      mode: input.mode,
      source: { kind: sourceKindFor(input.mode, input.source), text: input.source },
      dslText: input.source,
      nodes: [],
      edges: [],
      frames: [],
      comments: [],
      layout: { pins: {} },
    },
  };
  writeJsonAtomic(join(dir, filename), document);
  return getBoard(filename, dir);
}

export function assertValidSource(source: string, mode: LocalMcpMode): void {
  if (typeof source !== 'string' || !source.trim()) {
    throw new LocalMcpError('source is required.');
  }
  const result = applyBoardSource(source, mode as BoardMode);
  if (!result.ok) {
    throw new LocalMcpError(result.error);
  }
}

function toBoardView(filename: string, parsed: ParsedBoardFile): BoardView {
  const graph = projectBoardGraph(parsed.mode as BoardMode, parsed.source);
  return {
    filename,
    title: parsed.title,
    mode: parsed.mode,
    source: parsed.source,
    nodes: graph.nodes.map(node => ({ id: node.id, name: node.name, type: node.type })),
    edges: graph.edges.map(edge => ({ from: edge.from, to: edge.to, label: edge.label })),
  };
}

function readBoardFile(fullPath: string): ParsedBoardFile | null {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const document = data as Record<string, unknown>;
  if (!isVersion3(document.version)) return null;
  if (document.kind !== 'board') return null;
  const board = document.board;
  if (!board || typeof board !== 'object') return null;
  const record = board as Record<string, unknown>;
  const mode = record.mode;
  if (typeof mode !== 'string' || !MODE_SET.has(mode)) return null;
  const source = readSourceText(record);
  if (!source) return null;
  const titled = typeof record.title === 'string' && record.title.trim()
    ? record.title.trim()
    : extractBoardTitle(source, mode as BoardMode) ?? basename(fullPath, '.json');
  return {
    document,
    board: record,
    title: titled,
    mode: mode as LocalMcpMode,
    source,
  };
}

function readSourceText(board: Record<string, unknown>): string {
  const source = board.source;
  if (source && typeof source === 'object' && typeof (source as { text?: unknown }).text === 'string') {
    const text = (source as { text: string }).text;
    if (text.trim()) return text;
  }
  if (typeof board.dslText === 'string' && board.dslText.trim()) return board.dslText;
  return '';
}

function isVersion3(value: unknown): boolean {
  return typeof value === 'string' && /^3(\.|$)/.test(value.trim());
}

function resolveBoardPath(dir: string, filename: string): string {
  if (!filename || filename !== basename(filename) || filename === '.' || filename === '..') {
    throw new LocalMcpError('filename must be a file name inside DIAGRAM_TOOL_DIR, not a path.');
  }
  if (extname(filename).toLowerCase() !== '.json') {
    throw new LocalMcpError('filename must be a .json file.');
  }
  const root = resolve(dir);
  const full = resolve(root, filename);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new LocalMcpError('filename is outside DIAGRAM_TOOL_DIR.');
  }
  try {
    if (!statSync(full).isFile()) {
      throw new LocalMcpError(`Board file not found: ${filename}`);
    }
  } catch (error) {
    if (error instanceof LocalMcpError) throw error;
    throw new LocalMcpError(`Board file not found: ${filename}`);
  }
  return full;
}

function uniqueFilename(dir: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'board';
  let candidate = `${slug}.json`;
  let n = 2;
  const names = new Set(readdirSync(dir));
  while (names.has(candidate)) {
    candidate = `${slug}-${n}.json`;
    n += 1;
  }
  return candidate;
}

function writeJsonAtomic(fullPath: string, value: unknown): void {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const temp = `${fullPath}.${process.pid}.tmp`;
  writeFileSync(temp, payload, 'utf8');
  renameSync(temp, fullPath);
}
