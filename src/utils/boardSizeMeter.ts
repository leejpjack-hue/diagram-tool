import type { PresentationItem } from './boardManager';

/** Miro-style soft warn: editing may start to feel slower. */
export const BOARD_SIZE_SOFT_WARN_AT = 1000;
/** Stronger copy — split the board before a workshop. */
export const BOARD_SIZE_STRONG_WARN_AT = 5000;
/** Image-heavy: 50+ deck images, or ~20MB estimated raster payload. */
export const BOARD_SIZE_IMAGE_HEAVY_COUNT = 50;
export const BOARD_SIZE_IMAGE_HEAVY_BYTES = 20 * 1024 * 1024;

export const BOARD_SIZE_STATE_SMOOTH = 'Smooth';
export const BOARD_SIZE_STATE_HEAVY = 'Heavy';
export const BOARD_SIZE_STATE_SPLIT_ME = 'Split me';

export const BOARD_SIZE_SOFT_WARN_COPY =
  'This board is getting heavy (1,000+ objects). Editing may feel slower.';
export const BOARD_SIZE_STRONG_WARN_COPY =
  'Split me — 5,000+ objects. Move work to another board before a workshop.';
export const BOARD_SIZE_IMAGE_HEAVY_COPY =
  'Heavy on images — this board may stutter.';

/** DEV-only Playwright fixture: `?boardSizeFixture=5000` sets the count without creating nodes. */
export const BOARD_SIZE_FIXTURE_PARAM = 'boardSizeFixture';

export type BoardSizeState =
  | typeof BOARD_SIZE_STATE_SMOOTH
  | typeof BOARD_SIZE_STATE_HEAVY
  | typeof BOARD_SIZE_STATE_SPLIT_ME;

export interface BoardSizeDeckItem {
  type: PresentationItem['type'] | string;
  content?: string;
}

export interface BoardSizeInputs {
  nodeCount: number;
  edgeCount: number;
  deckItems: readonly BoardSizeDeckItem[];
  /** DEV Playwright fixture only — ignored when not supplied. */
  objectCountOverride?: number | null;
}

export interface BoardSizeSnapshot {
  objectCount: number;
  nodeCount: number;
  edgeCount: number;
  deckCount: number;
  imageCount: number;
  estimatedImageBytes: number;
  imageHeavy: boolean;
  state: BoardSizeState;
  statusLine: string;
  warnCopy: string | null;
  imageHeavyCopy: string | null;
}

export function formatBoardSizeStatus(count: number, state: BoardSizeState): string {
  return `${count.toLocaleString('en-US')} objects · ${state}`;
}

/** Cheap decoded-size estimate from a data-URL (base64 payload × 3/4). */
export function estimateImageBytes(content: string | undefined): number {
  if (!content || !content.startsWith('data:')) return 0;
  const comma = content.indexOf(',');
  if (comma < 0) return 0;
  const payload = content.slice(comma + 1);
  return Math.floor((payload.length * 3) / 4);
}

export function countDeckImages(deckItems: readonly BoardSizeDeckItem[]): {
  imageCount: number;
  estimatedImageBytes: number;
} {
  let imageCount = 0;
  let estimatedImageBytes = 0;
  for (const item of deckItems) {
    if (item.type !== 'image') continue;
    imageCount += 1;
    estimatedImageBytes += estimateImageBytes(item.content);
  }
  return { imageCount, estimatedImageBytes };
}

export function isImageHeavy(imageCount: number, estimatedImageBytes: number): boolean {
  return imageCount >= BOARD_SIZE_IMAGE_HEAVY_COUNT
    || estimatedImageBytes >= BOARD_SIZE_IMAGE_HEAVY_BYTES;
}

export function boardSizeState(objectCount: number, imageHeavy: boolean): BoardSizeState {
  if (objectCount >= BOARD_SIZE_STRONG_WARN_AT) return BOARD_SIZE_STATE_SPLIT_ME;
  if (objectCount >= BOARD_SIZE_SOFT_WARN_AT || imageHeavy) return BOARD_SIZE_STATE_HEAVY;
  return BOARD_SIZE_STATE_SMOOTH;
}

export function boardSizeWarnCopy(objectCount: number): string | null {
  if (objectCount >= BOARD_SIZE_STRONG_WARN_AT) return BOARD_SIZE_STRONG_WARN_COPY;
  if (objectCount >= BOARD_SIZE_SOFT_WARN_AT) return BOARD_SIZE_SOFT_WARN_COPY;
  return null;
}

export function measureBoardSize(input: BoardSizeInputs): BoardSizeSnapshot {
  const nodeCount = Math.max(0, input.nodeCount);
  const edgeCount = Math.max(0, input.edgeCount);
  const deckCount = input.deckItems.length;
  const rawCount = nodeCount + edgeCount + deckCount;
  const override = input.objectCountOverride;
  const objectCount = typeof override === 'number' && Number.isFinite(override)
    ? Math.max(0, Math.floor(override))
    : rawCount;
  const { imageCount, estimatedImageBytes } = countDeckImages(input.deckItems);
  const imageHeavy = isImageHeavy(imageCount, estimatedImageBytes);
  const state = boardSizeState(objectCount, imageHeavy);
  return {
    objectCount,
    nodeCount,
    edgeCount,
    deckCount,
    imageCount,
    estimatedImageBytes,
    imageHeavy,
    state,
    statusLine: formatBoardSizeStatus(objectCount, state),
    warnCopy: boardSizeWarnCopy(objectCount),
    imageHeavyCopy: imageHeavy ? BOARD_SIZE_IMAGE_HEAVY_COPY : null,
  };
}

export function readBoardSizeCountOverride(
  search = typeof window === 'undefined' ? '' : window.location.search,
  dev = import.meta.env.DEV,
): number | null {
  if (dev !== true) return null;
  const raw = new URLSearchParams(search).get(BOARD_SIZE_FIXTURE_PARAM);
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}
