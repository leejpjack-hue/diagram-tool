export const KNOWN_PRESENTATION_TYPES = ['image', 'note', 'text', 'arrow', 'shape', 'drawing', 'frame'] as const;

const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif)(?:;[\w.-]+=[\w.-]+)*;base64,[A-Za-z0-9+/]+={0,2}$/i;
const PRESENTATION_TYPE_SET = new Set<string>(KNOWN_PRESENTATION_TYPES);

export interface PresentationSkip {
  kind: string;
  id?: string;
  reason: string;
}

export interface SanitizedPresentationItem {
  id?: string;
  type: (typeof KNOWN_PRESENTATION_TYPES)[number];
  title?: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  hidden?: boolean;
  lockChildren?: boolean;
  zIndex?: number;
  style?: Record<string, unknown>;
  startId?: string;
  endId?: string;
  startSide?: 'left' | 'right' | 'top' | 'bottom';
  endSide?: 'left' | 'right' | 'top' | 'bottom';
}

export interface SanitizedPresentation {
  items: SanitizedPresentationItem[];
  updatedAt: string;
}

export function isAllowedPresentationContent(type: string, content: string): boolean {
  if (typeof content !== 'string') return false;
  const value = content.trim();
  if (/^https?:\/\//i.test(value) || /^data:image\/svg\+xml/i.test(value)) return false;
  if (type === 'image') return SAFE_IMAGE_DATA_URL.test(value);
  return true;
}

export function sanitizePresentation(
  value: unknown,
  boardId: string | undefined,
  skipped: PresentationSkip[],
): SanitizedPresentation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as { items?: unknown; updatedAt?: string };
  if (!Array.isArray(record.items)) return undefined;
  const items: SanitizedPresentationItem[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== 'object') {
      skipped.push({ kind: 'presentation', id: boardId, reason: 'Skipped an unreadable deck object.' });
      continue;
    }
    const candidate = item as SanitizedPresentationItem;
    if (!PRESENTATION_TYPE_SET.has(candidate.type)) {
      skipped.push({ kind: candidate.type || 'presentation', id: candidate.id, reason: 'Unknown deck object type.' });
      continue;
    }
    if ([candidate.x, candidate.y, candidate.width, candidate.height].some(n => typeof n !== 'number')) {
      skipped.push({ kind: candidate.type, id: candidate.id, reason: 'Deck object was missing geometry.' });
      continue;
    }
    if (typeof candidate.content !== 'string' || !isAllowedPresentationContent(candidate.type, candidate.content)) {
      skipped.push({ kind: candidate.type, id: candidate.id, reason: 'Presentation content must be local text or a png/jpeg/webp/gif data URL.' });
      continue;
    }
    items.push({
      ...candidate,
      content: candidate.content,
      hidden: candidate.hidden === true ? true : undefined,
      lockChildren: candidate.lockChildren === true ? true : undefined,
      startId: typeof candidate.startId === 'string' ? candidate.startId : undefined,
      endId: typeof candidate.endId === 'string' ? candidate.endId : undefined,
      startSide: candidate.startSide === 'left' || candidate.startSide === 'right' || candidate.startSide === 'top' || candidate.startSide === 'bottom' ? candidate.startSide : undefined,
      endSide: candidate.endSide === 'left' || candidate.endSide === 'right' || candidate.endSide === 'top' || candidate.endSide === 'bottom' ? candidate.endSide : undefined,
    });
  }
  return { items, updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString() };
}

export function sanitizePublishedSnapshot<T>(document: T): T {
  if (!document || typeof document !== 'object') return document;
  const board = (document as { board?: unknown }).board;
  if (!board || typeof board !== 'object') return document;
  const record = board as Record<string, unknown>;
  const skipped: PresentationSkip[] = [];
  const presentation = sanitizePresentation(record.presentation, typeof record.id === 'string' ? record.id : undefined, skipped);
  const thumbnail = typeof record.thumbnail === 'string' && isAllowedPresentationContent('image', record.thumbnail)
    ? record.thumbnail
    : undefined;
  return {
    ...document,
    board: {
      ...record,
      frames: [],
      comments: [],
      presentation,
      thumbnail,
    },
  } as T;
}
