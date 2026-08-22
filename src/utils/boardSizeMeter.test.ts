import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE_FIXTURE_PARAM,
  BOARD_SIZE_IMAGE_HEAVY_BYTES,
  BOARD_SIZE_IMAGE_HEAVY_COPY,
  BOARD_SIZE_IMAGE_HEAVY_COUNT,
  BOARD_SIZE_SOFT_WARN_COPY,
  BOARD_SIZE_STATE_HEAVY,
  BOARD_SIZE_STATE_SMOOTH,
  BOARD_SIZE_STATE_SPLIT_ME,
  BOARD_SIZE_STRONG_WARN_COPY,
  estimateImageBytes,
  formatBoardSizeStatus,
  measureBoardSize,
  readBoardSizeCountOverride,
} from './boardSizeMeter';

function pngDataUrl(byteLength: number): string {
  const chars = Math.ceil((byteLength * 4) / 3);
  return `data:image/png;base64,${'A'.repeat(chars)}`;
}

describe('boardSizeMeter', () => {
  it('counts nodes + edges + deck items and stays Smooth under 1,000', () => {
    const snapshot = measureBoardSize({
      nodeCount: 3,
      edgeCount: 2,
      deckItems: [{ type: 'note', content: 'n' }, { type: 'frame', content: '' }],
    });
    expect(snapshot.objectCount).toBe(7);
    expect(snapshot.state).toBe(BOARD_SIZE_STATE_SMOOTH);
    expect(snapshot.statusLine).toBe(formatBoardSizeStatus(7, BOARD_SIZE_STATE_SMOOTH));
    expect(snapshot.statusLine).toBe('7 objects · Smooth');
    expect(snapshot.warnCopy).toBeNull();
    expect(snapshot.imageHeavyCopy).toBeNull();
  });

  it('uses the exact soft-warn copy at 1,000 objects', () => {
    const snapshot = measureBoardSize({
      nodeCount: 400,
      edgeCount: 400,
      deckItems: Array.from({ length: 200 }, (_, i) => ({ type: 'note', content: String(i) })),
    });
    expect(snapshot.objectCount).toBe(1000);
    expect(snapshot.state).toBe(BOARD_SIZE_STATE_HEAVY);
    expect(snapshot.statusLine).toBe('1,000 objects · Heavy');
    expect(snapshot.warnCopy).toBe(BOARD_SIZE_SOFT_WARN_COPY);
    expect(snapshot.warnCopy).toBe('This board is getting heavy (1,000+ objects). Editing may feel slower.');
  });

  it('uses the exact Split me copy at 5,000 objects', () => {
    const snapshot = measureBoardSize({
      nodeCount: 1,
      edgeCount: 0,
      deckItems: [],
      objectCountOverride: 5000,
    });
    expect(snapshot.objectCount).toBe(5000);
    expect(snapshot.state).toBe(BOARD_SIZE_STATE_SPLIT_ME);
    expect(snapshot.statusLine).toBe('5,000 objects · Split me');
    expect(snapshot.warnCopy).toBe(BOARD_SIZE_STRONG_WARN_COPY);
    expect(snapshot.warnCopy).toBe('Split me — 5,000+ objects. Move work to another board before a workshop.');
  });

  it('treats 50+ images as Heavy even when the object count is small', () => {
    const deckItems = Array.from({ length: BOARD_SIZE_IMAGE_HEAVY_COUNT }, () => ({
      type: 'image' as const,
      content: pngDataUrl(16),
    }));
    const snapshot = measureBoardSize({ nodeCount: 1, edgeCount: 0, deckItems });
    expect(snapshot.objectCount).toBe(51);
    expect(snapshot.imageCount).toBe(50);
    expect(snapshot.imageHeavy).toBe(true);
    expect(snapshot.state).toBe(BOARD_SIZE_STATE_HEAVY);
    expect(snapshot.imageHeavyCopy).toBe(BOARD_SIZE_IMAGE_HEAVY_COPY);
    expect(snapshot.imageHeavyCopy).toBe('Heavy on images — this board may stutter.');
    expect(snapshot.warnCopy).toBeNull();
  });

  it('treats ~20MB of deck images as Heavy', () => {
    const snapshot = measureBoardSize({
      nodeCount: 0,
      edgeCount: 0,
      deckItems: [{ type: 'image', content: pngDataUrl(BOARD_SIZE_IMAGE_HEAVY_BYTES) }],
    });
    expect(snapshot.imageCount).toBe(1);
    expect(snapshot.estimatedImageBytes).toBeGreaterThanOrEqual(BOARD_SIZE_IMAGE_HEAVY_BYTES);
    expect(snapshot.imageHeavy).toBe(true);
    expect(snapshot.state).toBe(BOARD_SIZE_STATE_HEAVY);
    expect(snapshot.imageHeavyCopy).toBe(BOARD_SIZE_IMAGE_HEAVY_COPY);
  });

  it('estimates data-URL size cheaply from the base64 payload', () => {
    expect(estimateImageBytes('not-a-data-url')).toBe(0);
    expect(estimateImageBytes(pngDataUrl(12))).toBeGreaterThanOrEqual(12);
  });

  it('does not read a fixture override unless DEV is on', () => {
    expect(readBoardSizeCountOverride(`?${BOARD_SIZE_FIXTURE_PARAM}=5000`, false)).toBeNull();
    expect(readBoardSizeCountOverride(`?${BOARD_SIZE_FIXTURE_PARAM}=5000`, true)).toBe(5000);
    expect(readBoardSizeCountOverride('?other=1', true)).toBeNull();
  });

  it('does not add a production window.__* hook', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const helper = readFileSync(join(here, 'boardSizeMeter.ts'), 'utf8');
    const ui = readFileSync(join(here, '../components/Workspace/BoardSizeMeter.tsx'), 'utf8');
    const app = readFileSync(join(here, '../App.tsx'), 'utf8');
    expect(helper + ui + app).not.toMatch(/window\.__|__setBoardSize|__getBoardSize/);
    expect(helper).toMatch(/import\.meta\.env\.DEV/);
    expect(ui).toMatch(/import\.meta\.env\.DEV/);
  });
});
