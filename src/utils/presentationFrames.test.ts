import { describe, expect, it } from 'vitest';
import type { PresentationItem } from './boardManager';
import {
  boundsForExport,
  childLockedByFrame,
  frameFromSelection,
  itemsForExport,
  itemsInsideFrame,
  moveFrameAndChildren,
  visibleFrames,
} from './presentationFrames';

function item(partial: Partial<PresentationItem> & Pick<PresentationItem, 'id' | 'type'>): PresentationItem {
  return {
    content: '',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    ...partial,
  };
}

const intro = item({ id: 'intro', type: 'frame', title: 'Intro', x: 0, y: 0, width: 200, height: 160 });
const review = item({ id: 'review', type: 'frame', title: 'Review', x: 400, y: 0, width: 200, height: 160 });
const hidden = item({ id: 'hidden', type: 'frame', title: 'Secret', x: 0, y: 400, width: 800, height: 600, hidden: true });
const note = item({ id: 'note', type: 'note', content: 'keep me', x: 20, y: 20, width: 80, height: 60 });
const shape = item({ id: 'shape', type: 'shape', content: 'Box', x: 420, y: 20, width: 80, height: 60 });
const secretNote = item({ id: 'secret-note', type: 'note', content: 'HIDDEN_MARKER', x: 40, y: 440, width: 120, height: 80 });

describe('presentation frames', () => {
  it('walks visible frames in list order and skips hidden frames', () => {
    expect(visibleFrames([hidden, intro, review]).map(frame => frame.title)).toEqual(['Intro', 'Review']);
  });

  it('create-from-selection wraps items without flattening them to a raster', () => {
    const result = frameFromSelection([note, shape], ['note', 'shape'], () => 'frame-new');
    expect(result).not.toBeNull();
    expect(result!.frame.type).toBe('frame');
    expect(result!.next.map(entry => entry.id)).toEqual(['note', 'shape', 'frame-new']);
    expect(result!.next.find(entry => entry.id === 'note')).toMatchObject({ type: 'note', content: 'keep me' });
    expect(result!.next.find(entry => entry.id === 'shape')).toMatchObject({ type: 'shape', content: 'Box' });
    expect(result!.next.some(entry => entry.type === 'image')).toBe(false);
    expect(itemsInsideFrame(result!.next, result!.frame).map(entry => entry.id)).toEqual(['note', 'shape']);
  });

  it('moves children with the frame and honors lockChildren', () => {
    const locked = { ...intro, lockChildren: true };
    const moved = moveFrameAndChildren([locked, note], 'intro', 50, 25);
    expect(moved.find(entry => entry.id === 'intro')).toMatchObject({ x: 50, y: 25 });
    expect(moved.find(entry => entry.id === 'note')).toMatchObject({ x: 70, y: 45 });
    expect(childLockedByFrame(note, [locked, note])).toBe(true);
    expect(childLockedByFrame(shape, [locked, note, shape])).toBe(false);
  });

  it('export-one-frame is a tighter crop than export-all and omits the hidden frame', () => {
    const items = [intro, review, hidden, note, shape, secretNote];
    const one = itemsForExport(items, 'frame', 'intro');
    const all = itemsForExport(items, 'frames');
    const deck = itemsForExport(items, 'deck');

    expect(one.map(entry => entry.id)).toEqual(['intro', 'note']);
    expect(all.map(entry => entry.id).sort()).toEqual(['intro', 'note', 'review', 'shape']);
    expect(deck.map(entry => entry.id)).not.toContain('hidden');
    expect(deck.map(entry => entry.id)).not.toContain('secret-note');
    expect(one.some(entry => entry.content === 'HIDDEN_MARKER')).toBe(false);
    expect(all.some(entry => entry.content === 'HIDDEN_MARKER')).toBe(false);

    const oneBox = boundsForExport(items, 'frame', 'intro')!;
    const allBox = boundsForExport(items, 'frames')!;
    expect(oneBox.width * oneBox.height).toBeLessThan(allBox.width * allBox.height);
    expect(allBox.y + allBox.height).toBeLessThan(hidden.y);
  });
});
