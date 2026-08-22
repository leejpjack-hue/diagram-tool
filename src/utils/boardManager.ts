import { saveManager } from './saveManager';
import {
  buildBoardDocument,
  buildWorkspaceDocument,
  parsePortableImport,
  type ImportReport,
} from './boardFormat';
import { detectRawDiagramImport } from './sourceText';
import { importDrawio, looksLikeDrawio } from './drawioImport';
import { assertImportSize, sanitizeImportPlainText } from './importSanitizer';

export type BoardMode = 'architecture' | 'flow' | 'sequence' | 'gantt';
export type BoardSort = 'lastOpened' | 'updated' | 'created' | 'name';
export type DashboardDensity = 'comfortable' | 'compact';
export type DashboardLayout = 'grid' | 'list';

export interface PresentationItem {
  id: string;
  type: 'image' | 'note' | 'text' | 'arrow' | 'shape' | 'drawing' | 'frame';
  title?: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  /** Frame-only: hide from Present and from PNG/PDF export. */
  hidden?: boolean;
  /** Frame-only: children inside the frame cannot be moved independently. */
  lockChildren?: boolean;
  zIndex?: number;
  style?: PresentationItemStyle;
  /** Deck arrow only: attach start to this shape/note/text/frame. */
  startId?: string;
  /** Deck arrow only: attach end to this shape/note/text/frame. */
  endId?: string;
  /** Deck arrow only: magnet on the start object. */
  startSide?: 'left' | 'right' | 'top' | 'bottom';
  /** Deck arrow only: magnet on the end object. */
  endSide?: 'left' | 'right' | 'top' | 'bottom';
}

export interface PresentationItemStyle {
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontWeight?: 'normal' | 'semibold' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  connectorType?: 'straight' | 'curved' | 'elbow';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  shape?: 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'triangle';
}

export interface Presentation {
  items: PresentationItem[];
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  mode: BoardMode;
  dslText: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  presentation?: Presentation;
  spaceId?: string;
  tags: string[];
  starred: boolean;
  lastOpenedAt?: string;
  deletedAt?: string;
  templateSourceId?: string;
  schemaVersion: 2;
}

export interface Space {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTemplate {
  id: string;
  name: string;
  description: string;
  mode: BoardMode;
  dslText: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  useCount: number;
  lastUsedAt?: string;
}

export interface BoardVersion {
  id: string;
  boardId: string;
  name: string;
  dslText: string;
  mode: BoardMode;
  createdAt: string;
  automatic: boolean;
}

export type ActivityType = 'created' | 'opened' | 'updated' | 'renamed' | 'duplicated' | 'exported' | 'trashed' | 'restored' | 'deleted' | 'templated';

export interface ActivityEntry {
  id: string;
  boardId?: string;
  boardTitle: string;
  type: ActivityType;
  createdAt: string;
  detail?: string;
}

export interface DashboardPreferences {
  id: 'dashboard';
  layout: DashboardLayout;
  density: DashboardDensity;
  sort: BoardSort;
  sidebarCollapsed: boolean;
  defaultSpaceId?: string;
}

export interface BoardQuery {
  search?: string;
  mode?: BoardMode | 'all';
  spaceId?: string | 'all' | 'unfiled';
  tag?: string;
  starred?: boolean;
  deleted?: boolean;
  sort?: BoardSort;
}

export interface BoardFile {
  version: string;
  exportedAt: string;
  board: Board;
}

export interface BoardsFile {
  version: string;
  exportedAt: string;
  boards: Board[];
  spaces: Space[];
  templates: PersonalTemplate[];
  versions?: BoardVersion[];
}

interface StoredPresentationItem extends Omit<PresentationItem, 'content'> {
  content: string | Blob;
}

interface StoredBoard extends Omit<Board, 'thumbnail' | 'presentation'> {
  thumbnail?: string | Blob;
  presentation?: Omit<Presentation, 'items'> & { items: StoredPresentationItem[] };
}

interface StoredTemplate extends Omit<PersonalTemplate, 'thumbnail'> {
  thumbnail?: string | Blob;
}

export const WORKSPACE_DB_NAME = 'diagram-tool-workspace';
export const WORKSPACE_DB_VERSION = 1;
export const WORKSPACE_STORES = ['boards', 'spaces', 'templates', 'versions', 'activity', 'preferences'] as const;
export const MAX_AUTO_VERSIONS = 20;
const DB_NAME = WORKSPACE_DB_NAME;
const DB_VERSION = WORKSPACE_DB_VERSION;
const LEGACY_STORAGE_KEY = 'diagram-tool-boards';
const MIGRATION_KEY = 'diagram-tool-indexeddb-migrated-v2';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PREFERENCES: DashboardPreferences = {
  id: 'dashboard',
  layout: 'grid',
  density: 'comfortable',
  sort: 'lastOpened',
  sidebarCollapsed: false,
};

type StoreName = typeof WORKSPACE_STORES[number];

export function toWorkspaceError(error: unknown): Error {
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(message)) {
    return new Error('This browser is out of storage for local boards. Export a backup or clear old automatic saves, then try again.');
  }
  if (error instanceof Error && error.message) return error;
  return new Error('Local workspace storage could not be opened.');
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toWorkspaceError(request.error ?? new Error('IndexedDB request failed.')));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(toWorkspaceError(transaction.error ?? new Error('IndexedDB transaction failed.')));
    transaction.onabort = () => reject(toWorkspaceError(transaction.error ?? new Error('IndexedDB transaction aborted.')));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('boards')) db.createObjectStore('boards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('spaces')) db.createObjectStore('spaces', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('versions')) {
        const versions = db.createObjectStore('versions', { keyPath: 'id' });
        versions.createIndex('boardId', 'boardId');
      }
      if (!db.objectStoreNames.contains('activity')) {
        const activity = db.createObjectStore('activity', { keyPath: 'id' });
        activity.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toWorkspaceError(request.error ?? new Error('Unable to open local workspace storage.')));
  });
}

async function dataUrlToBlob(value: string): Promise<string | Blob> {
  if (!value.startsWith('data:')) return value;
  try {
    return await (await fetch(value)).blob();
  } catch {
    return value;
  }
}

function blobToDataUrl(value: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read stored image.'));
    reader.readAsDataURL(value);
  });
}

export function normalizeBoard(input: Partial<Board> & Pick<Board, 'id' | 'title' | 'mode' | 'dslText' | 'createdAt' | 'updatedAt'>): Board {
  return {
    ...input,
    description: input.description ?? '',
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
    starred: Boolean(input.starred),
    schemaVersion: 2,
  } as Board;
}

async function storeBoard(board: Board): Promise<StoredBoard> {
  const thumbnail = board.thumbnail ? await dataUrlToBlob(board.thumbnail) : undefined;
  const presentation = board.presentation
    ? {
        ...board.presentation,
        items: await Promise.all(board.presentation.items.map(async item => ({
          ...item,
          content: item.type === 'image' ? await dataUrlToBlob(item.content) : item.content,
        }))),
      }
    : undefined;
  return { ...board, thumbnail, presentation };
}

async function hydrateBoard(board: StoredBoard): Promise<Board> {
  const thumbnail = board.thumbnail instanceof Blob ? await blobToDataUrl(board.thumbnail) : board.thumbnail;
  const presentation = board.presentation
    ? {
        ...board.presentation,
        items: await Promise.all(board.presentation.items.map(async item => ({
          ...item,
          content: item.content instanceof Blob ? await blobToDataUrl(item.content) : item.content,
        }))),
      }
    : undefined;
  return normalizeBoard({ ...board, thumbnail, presentation });
}

async function storeTemplate(template: PersonalTemplate): Promise<StoredTemplate> {
  return {
    ...template,
    thumbnail: template.thumbnail ? await dataUrlToBlob(template.thumbnail) : undefined,
  };
}

async function hydrateTemplate(template: StoredTemplate): Promise<PersonalTemplate> {
  return {
    ...template,
    thumbnail: template.thumbnail instanceof Blob ? await blobToDataUrl(template.thumbnail) : template.thumbnail,
  };
}

export function filterAndSortBoards(boards: Board[], query: BoardQuery = {}): Board[] {
  const search = query.search?.trim().toLowerCase();
  const filtered = boards.filter(board => {
    if (Boolean(board.deletedAt) !== Boolean(query.deleted)) return false;
    if (query.mode && query.mode !== 'all' && board.mode !== query.mode) return false;
    if (query.spaceId && query.spaceId !== 'all') {
      if (query.spaceId === 'unfiled' ? Boolean(board.spaceId) : board.spaceId !== query.spaceId) return false;
    }
    if (query.starred && !board.starred) return false;
    if (query.tag && !board.tags.includes(query.tag)) return false;
    if (search) {
      const haystack = [board.title, board.description, board.dslText, ...board.tags].join('\n').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const sort = query.sort ?? 'lastOpened';
  return filtered.sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title);
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
    if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt);
    return (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt);
  });
}

interface WorkspaceRepository {
  getAll<T>(storeName: StoreName): Promise<T[]>;
  get<T>(storeName: StoreName, id: string): Promise<T | undefined>;
  put<T>(storeName: StoreName, value: T): Promise<void>;
  delete(storeName: StoreName, id: string): Promise<void>;
  clear(storeName: StoreName): Promise<void>;
}

class IndexedDbBoardRepository implements WorkspaceRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDatabase();
    return this.dbPromise;
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.db();
    const transaction = db.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).getAll()) as Promise<T[]>;
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const db = await this.db();
    const transaction = db.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).get(id)) as Promise<T | undefined>;
  }

  async put<T>(storeName: StoreName, value: T): Promise<void> {
    const db = await this.db();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const db = await this.db();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    await transactionDone(transaction);
  }

  async clear(storeName: StoreName): Promise<void> {
    const db = await this.db();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).clear();
    await transactionDone(transaction);
  }
}

export class BoardManager {
  private initialized: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private repository: WorkspaceRepository;
  private boardWrites = new Map<string, Promise<unknown>>();
  private lastOpenedMs = 0;

  constructor(repository: WorkspaceRepository = new IndexedDbBoardRepository()) {
    this.repository = repository;
  }

  private enqueueBoardWrite<T>(boardId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.boardWrites.get(boardId) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.boardWrites.set(boardId, next.then(() => undefined, () => undefined));
    return next;
  }

  private nextOpenedClock(): string {
    const now = Date.now();
    this.lastOpenedMs = Math.max(now, this.lastOpenedMs + 1);
    return new Date(this.lastOpenedMs).toISOString();
  }

  private async applyBoardPatch(
    id: string,
    patch: Partial<Omit<Board, 'id' | 'createdAt' | 'schemaVersion'>>,
    activity?: ActivityType,
  ): Promise<Board | undefined> {
    const board = await this.get(id);
    if (!board) return undefined;
    // Local writes omit updatedAt and always advance the clock. A future
    // sync layer can pass updatedAt to apply last-write-wins per object
    // without silently overwriting a newer local or remote revision.
    if (patch.updatedAt && patch.updatedAt < board.updatedAt) return board;
    const { updatedAt: incomingClock, ...fields } = patch;
    const updated = normalizeBoard({
      ...board,
      ...fields,
      updatedAt: incomingClock && incomingClock > board.updatedAt ? incomingClock : new Date().toISOString(),
    });
    await this.repository.put('boards', await storeBoard(updated));
    if (activity) await this.addActivity(updated, activity);
    this.emit();
    return updated;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach(listener => listener());
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.runInitialization().catch(error => {
        this.initialized = null;
        throw toWorkspaceError(error);
      });
    }
    return this.initialized;
  }

  private async runInitialization(): Promise<void> {
    const existing = await this.repository.getAll<StoredBoard>('boards');
    if (!localStorage.getItem(MIGRATION_KEY)) {
      if (existing.length === 0) await this.migrateLegacyBoards();
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    }
    await this.purgeExpiredTrash();
    const preferences = await this.repository.get<DashboardPreferences>('preferences', 'dashboard');
    if (!preferences) await this.repository.put('preferences', DEFAULT_PREFERENCES);
  }

  private async migrateLegacyBoards(): Promise<void> {
    let legacyBoards: Array<Partial<Board>> = [];
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) legacyBoards = JSON.parse(raw) as Array<Partial<Board>>;
    } catch {
      legacyBoards = [];
    }

    for (const legacy of legacyBoards) {
      if (!legacy.id || !legacy.title || !legacy.mode || !legacy.dslText || !legacy.createdAt || !legacy.updatedAt) continue;
      await this.repository.put('boards', await storeBoard(normalizeBoard(legacy as Board)));
    }

    if (legacyBoards.length === 0) {
      const saved = saveManager.getCurrentDiagram();
      if (saved?.dslText) {
        await this.create({ title: saved.title || 'My first board', mode: saved.mode, dslText: saved.dslText }, false);
      }
    }
  }

  async list(query: BoardQuery = {}): Promise<Board[]> {
    await this.initialize();
    const stored = await this.repository.getAll<StoredBoard>('boards');
    return filterAndSortBoards(await Promise.all(stored.map(hydrateBoard)), query);
  }

  async get(id: string): Promise<Board | undefined> {
    await this.initialize();
    const stored = await this.repository.get<StoredBoard>('boards', id);
    return stored ? hydrateBoard(stored) : undefined;
  }

  async create(
    input: { title: string; description?: string; mode: BoardMode; dslText: string; thumbnail?: string; spaceId?: string; tags?: string[]; templateSourceId?: string; presentation?: PresentationItem[] },
    recordActivity = true,
  ): Promise<Board> {
    if (recordActivity) await this.initialize();
    const now = new Date().toISOString();
    const board: Board = {
      id: generateId('board'),
      title: input.title.trim() || 'Untitled board',
      description: input.description ?? '',
      mode: input.mode,
      dslText: input.dslText,
      thumbnail: input.thumbnail,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: this.nextOpenedClock(),
      spaceId: input.spaceId,
      tags: input.tags ?? [],
      starred: false,
      templateSourceId: input.templateSourceId,
      presentation: input.presentation?.length
        ? { items: input.presentation, updatedAt: now }
        : undefined,
      schemaVersion: 2,
    };
    return this.enqueueBoardWrite(board.id, async () => {
      await this.repository.put('boards', await storeBoard(board));
      if (recordActivity) await this.addActivity(board, 'created');
      this.emit();
      return board;
    });
  }

  async update(id: string, patch: Partial<Omit<Board, 'id' | 'createdAt' | 'schemaVersion'>>, activity?: ActivityType): Promise<Board | undefined> {
    await this.initialize();
    return this.enqueueBoardWrite(id, () => this.applyBoardPatch(id, patch, activity));
  }

  async markOpened(id: string): Promise<Board | undefined> {
    await this.initialize();
    return this.enqueueBoardWrite(id, async () => {
      const board = await this.get(id);
      if (!board) return undefined;
      const opened = normalizeBoard({ ...board, lastOpenedAt: this.nextOpenedClock() });
      await this.repository.put('boards', await storeBoard(opened));
      await this.addActivity(opened, 'opened');
      this.emit();
      return opened;
    });
  }

  async trash(id: string): Promise<void> {
    await this.initialize();
    await this.enqueueBoardWrite(id, async () => {
      const board = await this.applyBoardPatch(id, { deletedAt: new Date().toISOString() });
      if (board) await this.addActivity(board, 'trashed');
      if (board) this.emit();
    });
  }

  async restore(id: string): Promise<void> {
    await this.initialize();
    await this.enqueueBoardWrite(id, async () => {
      const board = await this.applyBoardPatch(id, { deletedAt: undefined });
      if (board) await this.addActivity(board, 'restored');
      if (board) this.emit();
    });
  }

  async remove(id: string): Promise<void> {
    await this.initialize();
    await this.enqueueBoardWrite(id, async () => {
      const board = await this.get(id);
      await this.repository.delete('boards', id);
      const versions = await this.listVersions(id);
      await Promise.all(versions.map(version => this.repository.delete('versions', version.id)));
      if (board) await this.addActivity(board, 'deleted');
      this.emit();
    });
  }

  async bulkUpdate(ids: string[], patch: Partial<Pick<Board, 'spaceId' | 'tags' | 'starred' | 'deletedAt'>>): Promise<void> {
    await this.initialize();
    for (const id of ids) {
      await this.enqueueBoardWrite(id, () => this.applyBoardPatch(id, patch));
    }
    this.emit();
  }

  async duplicate(id: string): Promise<Board | undefined> {
    const source = await this.get(id);
    if (!source) return undefined;
    const copy = await this.create({
      title: `${source.title} (copy)`,
      description: source.description,
      mode: source.mode,
      dslText: source.dslText,
      thumbnail: source.thumbnail,
      spaceId: source.spaceId,
      tags: source.tags,
    });
    await this.addActivity(copy, 'duplicated', `Copied from ${source.title}`);
    return copy;
  }

  async setPresentation(boardId: string, items: PresentationItem[]): Promise<void> {
    await this.initialize();
    await this.enqueueBoardWrite(boardId, async () => {
      const board = await this.get(boardId);
      if (!board) return;
      await this.applyBoardPatch(boardId, { presentation: { items, updatedAt: new Date().toISOString() } });
    });
  }

  async upsertPresentationItem(boardId: string, item: PresentationItem): Promise<PresentationItem[] | null> {
    await this.initialize();
    return this.enqueueBoardWrite(boardId, async () => {
      const board = await this.get(boardId);
      if (!board) return null;
      const existing = board.presentation?.items ?? [];
      const index = existing.findIndex(candidate => candidate.id === item.id);
      const items = index >= 0
        ? existing.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate)
        : [...existing, item];
      await this.applyBoardPatch(boardId, { presentation: { items, updatedAt: new Date().toISOString() } });
      return items;
    });
  }

  async listSpaces(): Promise<Space[]> {
    await this.initialize();
    return (await this.repository.getAll<Space>('spaces')).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async createSpace(name: string, color = '#6366f1'): Promise<Space> {
    await this.initialize();
    const now = new Date().toISOString();
    const spaces = await this.listSpaces();
    const space: Space = { id: generateId('space'), name: name.trim() || 'Untitled space', color, order: spaces.length, createdAt: now, updatedAt: now };
    await this.repository.put('spaces', space);
    this.emit();
    return space;
  }

  async updateSpace(id: string, patch: Partial<Pick<Space, 'name' | 'color' | 'order'>>): Promise<Space | undefined> {
    const space = await this.repository.get<Space>('spaces', id);
    if (!space) return undefined;
    const updated = { ...space, ...patch, updatedAt: new Date().toISOString() };
    await this.repository.put('spaces', updated);
    this.emit();
    return updated;
  }

  async removeSpace(id: string): Promise<void> {
    const boards = [
      ...(await this.list({ spaceId: id })),
      ...(await this.list({ spaceId: id, deleted: true })),
    ];
    await this.bulkUpdate(boards.map(board => board.id), { spaceId: undefined });
    await this.repository.delete('spaces', id);
    this.emit();
  }

  async listTemplates(): Promise<PersonalTemplate[]> {
    await this.initialize();
    const templates = await this.repository.getAll<StoredTemplate>('templates');
    return (await Promise.all(templates.map(hydrateTemplate))).sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt));
  }

  async saveAsTemplate(boardId: string, name?: string): Promise<PersonalTemplate | undefined> {
    const board = await this.get(boardId);
    if (!board) return undefined;
    const now = new Date().toISOString();
    const template: PersonalTemplate = {
      id: generateId('template'),
      name: name?.trim() || board.title,
      description: board.description,
      mode: board.mode,
      dslText: board.dslText,
      thumbnail: board.thumbnail,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };
    await this.repository.put('templates', await storeTemplate(template));
    await this.addActivity(board, 'templated');
    this.emit();
    return template;
  }

  async useTemplate(id: string): Promise<PersonalTemplate | undefined> {
    const stored = await this.repository.get<StoredTemplate>('templates', id);
    if (!stored) return undefined;
    const template = await hydrateTemplate(stored);
    const updated = { ...template, useCount: template.useCount + 1, lastUsedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.repository.put('templates', await storeTemplate(updated));
    this.emit();
    return updated;
  }

  async removeTemplate(id: string): Promise<void> {
    await this.repository.delete('templates', id);
    this.emit();
  }

  async createVersion(boardId: string, name: string, automatic = false): Promise<BoardVersion | undefined> {
    await this.initialize();
    return this.enqueueBoardWrite(boardId, async () => {
      const board = await this.get(boardId);
      if (!board) return undefined;
      if (automatic) {
        const latestAutomatic = (await this.listVersions(boardId)).find(version => version.automatic);
        if (latestAutomatic?.dslText === board.dslText && latestAutomatic.mode === board.mode) return latestAutomatic;
      }
      const version: BoardVersion = {
        id: generateId('version'),
        boardId,
        name: name.trim() || (automatic ? 'Automatic save' : 'Checkpoint'),
        dslText: board.dslText,
        mode: board.mode,
        createdAt: new Date().toISOString(),
        automatic,
      };
      await this.repository.put('versions', version);
      if (automatic) await this.trimAutomaticVersions(boardId);
      this.emit();
      return version;
    });
  }

  async listVersions(boardId: string): Promise<BoardVersion[]> {
    await this.initialize();
    return (await this.repository.getAll<BoardVersion>('versions'))
      .filter(version => version.boardId === boardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restoreVersion(versionId: string): Promise<Board | undefined> {
    const version = await this.repository.get<BoardVersion>('versions', versionId);
    if (!version) return undefined;
    return this.update(version.boardId, { dslText: version.dslText, mode: version.mode }, 'updated');
  }

  private async trimAutomaticVersions(boardId: string): Promise<void> {
    const versions = (await this.listVersions(boardId)).filter(version => version.automatic);
    await Promise.all(versions.slice(MAX_AUTO_VERSIONS).map(version => this.repository.delete('versions', version.id)));
  }

  async clearOldVersions(): Promise<number> {
    const all = await this.repository.getAll<BoardVersion>('versions');
    const grouped = new Map<string, BoardVersion[]>();
    all.filter(version => version.automatic).forEach(version => {
      const versions = grouped.get(version.boardId) ?? [];
      versions.push(version);
      grouped.set(version.boardId, versions);
    });
    const remove = [...grouped.values()].flatMap(versions => versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(MAX_AUTO_VERSIONS));
    await Promise.all(remove.map(version => this.repository.delete('versions', version.id)));
    this.emit();
    return remove.length;
  }

  async listActivity(limit = 100): Promise<ActivityEntry[]> {
    await this.initialize();
    return (await this.repository.getAll<ActivityEntry>('activity'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  private async addActivity(board: Pick<Board, 'id' | 'title'>, type: ActivityType, detail?: string): Promise<void> {
    const entry: ActivityEntry = {
      id: generateId('activity'),
      boardId: board.id,
      boardTitle: board.title,
      type,
      createdAt: new Date().toISOString(),
      detail,
    };
    await this.repository.put('activity', entry);
  }

  async getPreferences(): Promise<DashboardPreferences> {
    await this.initialize();
    return { ...DEFAULT_PREFERENCES, ...(await this.repository.get<DashboardPreferences>('preferences', 'dashboard')) };
  }

  async updatePreferences(patch: Partial<Omit<DashboardPreferences, 'id'>>): Promise<DashboardPreferences> {
    const preferences = { ...(await this.getPreferences()), ...patch, id: 'dashboard' as const };
    await this.repository.put('preferences', preferences);
    this.emit();
    return preferences;
  }

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
    }
    return { usage: 0, quota: 0 };
  }

  async listAllVersions(): Promise<BoardVersion[]> {
    await this.initialize();
    return this.repository.getAll<BoardVersion>('versions');
  }

  async buildCompleteBackup() {
    const boards = [...(await this.list()), ...(await this.list({ deleted: true }))];
    return buildWorkspaceDocument({
      boards,
      spaces: await this.listSpaces(),
      templates: await this.listTemplates(),
      versions: await this.listAllVersions(),
    });
  }

  async exportBoard(board: Board): Promise<void> {
    downloadJson(buildBoardDocument(board), `${slug(board.title)}.board.json`);
    await this.addActivity(board, 'exported');
    this.emit();
  }

  async exportBoards(boards: Board[], filename = `boards-selection-${new Date().toISOString().split('T')[0]}.boards.json`): Promise<void> {
    const boardIds = new Set(boards.map(board => board.id));
    downloadJson(buildWorkspaceDocument({
      boards,
      spaces: await this.listSpaces(),
      templates: await this.listTemplates(),
      versions: (await this.listAllVersions()).filter(version => boardIds.has(version.boardId)),
    }), filename);
  }

  async exportAll(): Promise<void> {
    downloadJson(await this.buildCompleteBackup(), `boards-backup-${new Date().toISOString().split('T')[0]}.boards.json`);
  }

  async importFromFile(file: File): Promise<ImportReport> {
    await this.initialize();
    assertImportSize(file);
    const text = await file.text();
    assertImportSize(file, text);
    const mermaid = detectRawDiagramImport(file.name, text);
    if (mermaid) {
      const board = await this.create({
        title: sanitizeImportPlainText(mermaid.title, 'Imported diagram'),
        mode: mermaid.mode,
        dslText: mermaid.dslText,
      });
      return { boards: [board], spaces: 0, templates: 0, versions: 0, skipped: [] };
    }

    if (looksLikeDrawio(file.name, text)) {
      const drawio = await importDrawio(file.name, text);
      const board = await this.create({
        title: sanitizeImportPlainText(drawio.title, 'Imported diagram'),
        mode: drawio.mode,
        dslText: drawio.dslText,
      });
      return {
        boards: [board],
        spaces: 0,
        templates: 0,
        versions: 0,
        skipped: drawio.skipped,
        mapped: drawio.mapped,
      };
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("That file isn't a valid board file.");
    }

    const plan = parsePortableImport(data);
    const spaceMap = new Map<string, string>();
    for (const candidate of plan.spaces) {
      const space = await this.createSpace(candidate.name, candidate.color);
      if (candidate.id) spaceMap.set(candidate.id, space.id);
    }

    const boardIdMap = new Map<string, string>();
    const imported: Board[] = [];
    for (const candidate of plan.boards) {
      const board = await this.create({
        title: candidate.title || 'Imported board',
        description: candidate.description ?? '',
        mode: candidate.mode,
        dslText: candidate.dslText,
        thumbnail: typeof candidate.thumbnail === 'string' ? candidate.thumbnail : undefined,
        tags: candidate.tags,
        spaceId: candidate.spaceId ? spaceMap.get(candidate.spaceId) : undefined,
      });
      if (candidate.id) boardIdMap.set(candidate.id, board.id);
      if (candidate.presentation?.items.length) await this.setPresentation(board.id, candidate.presentation.items);
      const restored = await this.update(board.id, {
        starred: candidate.starred ?? false,
        lastOpenedAt: candidate.lastOpenedAt ?? board.lastOpenedAt,
        deletedAt: candidate.deletedAt,
        templateSourceId: candidate.templateSourceId,
      });
      imported.push(restored ?? board);
    }

    let templates = 0;
    for (const candidate of plan.templates) {
      const now = new Date().toISOString();
      await this.repository.put('templates', await storeTemplate({
        id: generateId('template'),
        name: candidate.name,
        description: candidate.description ?? '',
        mode: candidate.mode,
        dslText: candidate.dslText,
        thumbnail: typeof candidate.thumbnail === 'string' ? candidate.thumbnail : undefined,
        createdAt: now,
        updatedAt: now,
        useCount: 0,
      }));
      templates += 1;
    }

    let versions = 0;
    const skipped = [...plan.skipped];
    for (const candidate of plan.versions) {
      const boardId = boardIdMap.get(candidate.boardId);
      if (!boardId) {
        skipped.push({ kind: 'version', id: candidate.id, reason: 'Checkpoint board was not imported.' });
        continue;
      }
      await this.repository.put('versions', {
        id: generateId('version'),
        boardId,
        name: candidate.name,
        dslText: candidate.dslText,
        mode: candidate.mode,
        createdAt: candidate.createdAt,
        automatic: Boolean(candidate.automatic),
      });
      versions += 1;
    }

    if (imported.length === 0) throw new Error('No boards found in that file.');
    this.emit();
    return { boards: imported, spaces: plan.spaces.length, templates, versions, skipped };
  }

  private async purgeExpiredTrash(): Promise<void> {
    const stored = await this.repository.getAll<StoredBoard>('boards');
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expired = stored.filter(board => board.deletedAt && new Date(board.deletedAt).getTime() < cutoff);
    await Promise.all(expired.map(board => this.repository.delete('boards', board.id)));
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
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

function createMemoryRepository(): WorkspaceRepository {
  const stores = new Map<StoreName, Map<string, unknown>>();
  const store = (name: StoreName) => {
    let values = stores.get(name);
    if (!values) { values = new Map(); stores.set(name, values); }
    return values;
  };
  return {
    async getAll<T>(name: StoreName): Promise<T[]> { return [...store(name).values()] as T[]; },
    async get<T>(name: StoreName, id: string): Promise<T | undefined> { return store(name).get(id) as T | undefined; },
    async put<T>(name: StoreName, value: T): Promise<void> {
      const record = value as { id?: string };
      if (!record.id) throw new Error('Memory repository records require an id.');
      store(name).set(record.id, value);
    },
    async delete(name: StoreName, id: string): Promise<void> { store(name).delete(id); },
    async clear(name: StoreName): Promise<void> { store(name).clear(); },
  };
}

export function createMemoryWorkspace(): { open: () => BoardManager } {
  const repository = createMemoryRepository();
  return { open: () => new BoardManager(repository) };
}

export function createMemoryBoardManager(): BoardManager {
  return createMemoryWorkspace().open();
}
