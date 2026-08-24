import { assertImportSize } from './importSanitizer';

export interface FileSystemFileHandleLike {
  name?: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FileSystemFileHandleLike): Promise<boolean>;
}

type FilePickerAcceptType = { description?: string; accept: Record<string, string[]> };

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
  }) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }) => Promise<FileSystemFileHandleLike>;
};

export type LinkedFileFormat = 'board-json' | 'source';

/** Hidden <input type="file"> accept for File → Open… */
export const OPEN_FILE_ACCEPT = '.json,.board.json,.mmd,.mermaid,.txt,.dsl,.drawio,.xml';

export const OPEN_FILE_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'DiagramTool board',
    accept: { 'application/json': ['.json'] },
  },
  {
    description: 'Mermaid',
    accept: { 'text/plain': ['.mmd', '.mermaid'] },
  },
  {
    description: 'Native DSL',
    accept: { 'text/plain': ['.txt', '.dsl'] },
  },
  {
    description: 'draw.io',
    accept: { 'application/xml': ['.drawio', '.xml'] },
  },
];

/** File → Save / Save As: kind:board JSON 3.0 only. */
export const BOARD_FILE_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'DiagramTool board',
    accept: { 'application/json': ['.json'] },
  },
];

interface HandleEntry {
  handle: FileSystemFileHandleLike;
  format: LinkedFileFormat;
}

const handles = new Map<string, HandleEntry>();

export const boardFileHandles = {
  get(boardId: string): FileSystemFileHandleLike | undefined {
    return handles.get(boardId)?.handle;
  },
  getFormat(boardId: string): LinkedFileFormat | undefined {
    return handles.get(boardId)?.format;
  },
  has(boardId: string): boolean {
    return handles.has(boardId);
  },
  set(boardId: string, handle: FileSystemFileHandleLike, format: LinkedFileFormat = 'board-json'): void {
    handles.set(boardId, { handle, format });
  },
  clear(): void {
    handles.clear();
  },
  async findBoardId(handle: FileSystemFileHandleLike): Promise<string | undefined> {
    for (const [id, existing] of handles) {
      if (typeof existing.handle.isSameEntry === 'function' && await existing.handle.isSameEntry(handle)) return id;
    }
    return undefined;
  },
};

export function isBoardJsonFilename(name?: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (/\.(mmd|mermaid|drawio)(\.|$)/.test(lower)) return false;
  return /\.(?:board\.)?json$/.test(lower) || /\.board$/.test(lower);
}

/** Save writes JSON. Never overwrite a Mermaid / DSL / draw.io handle. */
export function mustSaveBoardJsonAsNewFile(
  handle: FileSystemFileHandleLike | undefined,
  format?: LinkedFileFormat,
): boolean {
  if (!handle) return true;
  if (format === 'source') return true;
  if (format === 'board-json') return false;
  return !isBoardJsonFilename(handle.name);
}

export function canUseFileSystemAccess(): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  const host = window as FilePickerWindow;
  return typeof host.showOpenFilePicker === 'function' && typeof host.showSaveFilePicker === 'function';
}

export function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}

export function suggestedBoardFilename(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
  return `${slug}.json`;
}

export function downloadBoardJson(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export async function ensureHandlePermission(
  handle: FileSystemFileHandleLike,
  mode: 'read' | 'readwrite',
): Promise<void> {
  if (handle.queryPermission) {
    const current = await handle.queryPermission({ mode });
    if (current === 'granted') return;
  }
  if (handle.requestPermission) {
    const next = await handle.requestPermission({ mode });
    if (next !== 'granted') throw new Error('Permission to use that file was denied.');
  }
}

export async function readHandleText(handle: FileSystemFileHandleLike): Promise<string> {
  await ensureHandlePermission(handle, 'read');
  const file = await handle.getFile();
  assertImportSize(file);
  const text = await file.text();
  assertImportSize(file, text);
  return text;
}

export async function writeHandleText(handle: FileSystemFileHandleLike, text: string): Promise<void> {
  await ensureHandlePermission(handle, 'readwrite');
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function pickBoardFileToOpen(): Promise<{ handle: FileSystemFileHandleLike; text: string } | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  if (!picker) return null;
  const [handle] = await picker({ multiple: false, types: OPEN_FILE_PICKER_TYPES });
  return { handle, text: await readHandleText(handle) };
}

export async function pickBoardFileToSave(suggestedName: string): Promise<FileSystemFileHandleLike | null> {
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) return null;
  return picker({ suggestedName, types: BOARD_FILE_PICKER_TYPES });
}
