import { assertImportSize } from './importSanitizer';

export interface FileSystemFileHandleLike {
  name?: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FileSystemFileHandleLike): Promise<boolean>;
}

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandleLike>;
};

export const BOARD_FILE_PICKER_TYPES = [
  {
    description: 'DiagramTool board',
    accept: { 'application/json': ['.json'] },
  },
];

const handles = new Map<string, FileSystemFileHandleLike>();

export const boardFileHandles = {
  get(boardId: string): FileSystemFileHandleLike | undefined {
    return handles.get(boardId);
  },
  has(boardId: string): boolean {
    return handles.has(boardId);
  },
  set(boardId: string, handle: FileSystemFileHandleLike): void {
    handles.set(boardId, handle);
  },
  clear(): void {
    handles.clear();
  },
  async findBoardId(handle: FileSystemFileHandleLike): Promise<string | undefined> {
    for (const [id, existing] of handles) {
      if (typeof existing.isSameEntry === 'function' && await existing.isSameEntry(handle)) return id;
    }
    return undefined;
  },
};

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
  const [handle] = await picker({ multiple: false, types: BOARD_FILE_PICKER_TYPES });
  return { handle, text: await readHandleText(handle) };
}

export async function pickBoardFileToSave(suggestedName: string): Promise<FileSystemFileHandleLike | null> {
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) return null;
  return picker({ suggestedName, types: BOARD_FILE_PICKER_TYPES });
}
