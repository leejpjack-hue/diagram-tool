import { describe, expect, it } from 'vitest';
import type { PresentationItem } from './boardManager';
import {
  createConnectorItem,
  parseConnectorLabel,
  pointOnItem,
  reflowConnectors,
  setConnectorLabel,
  snapAttachment,
  updateConnectorEnd,
} from './presentationConnectors';

function item(partial: Partial<PresentationItem> & Pick<PresentationItem, 'id' | 'type'>): PresentationItem {
  return { content: '', x: 0, y: 0, width: 100, height: 80, ...partial };
}

const left = item({ id: 'left', type: 'shape', x: 40, y: 60, width: 120, height: 80 });
const right = item({ id: 'right', type: 'note', x: 320, y: 60, width: 140, height: 100 });

describe('presentation connector attachments', () => {
  it('snaps a nearby click to a shape magnet and leaves far clicks unattached', () => {
    const hit = snapAttachment({ x: 164, y: 100 }, [left, right]);
    expect(hit).toMatchObject({ id: 'left', side: 'right' });
    expect(hit?.point).toEqual({ x: 160, y: 100 });
    expect(snapAttachment({ x: 240, y: 400 }, [left, right])).toBeNull();
  });

  it('reflows both ends when an attached object moves and drops deleted bindings', () => {
    const arrow = createConnectorItem(
      { point: { x: 160, y: 100 }, snap: { id: 'left', side: 'right', point: { x: 160, y: 100 } } },
      { point: { x: 320, y: 110 }, snap: { id: 'right', side: 'left', point: { x: 320, y: 110 } } },
      'arrow-1',
      11,
    );
    expect(arrow.startId).toBe('left');
    expect(arrow.endId).toBe('right');
    expect(arrow.startSide).toBe('right');
    expect(arrow.endSide).toBe('left');

    const moved = reflowConnectors([{ ...left, x: 80 }, right, arrow]);
    const reflowed = moved.find(entry => entry.id === 'arrow-1')!;
    const geometry = JSON.parse(reflowed.content) as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(reflowed.x + geometry.start.x).toBe(200);
    expect(reflowed.y + geometry.start.y).toBe(100);
    expect(reflowed.x + geometry.end.x).toBe(320);

    const orphaned = reflowConnectors([right, reflowed]);
    const leftover = orphaned.find(entry => entry.id === 'arrow-1')!;
    expect(leftover.startId).toBeUndefined();
    expect(leftover.endId).toBe('right');
    expect(leftover.x + (JSON.parse(leftover.content) as { start: { x: number } }).start.x).toBe(200);
  });

  it('keeps a label on the connector while an endpoint is reattached', () => {
    const arrow = setConnectorLabel(createConnectorItem(
      { point: { x: 10, y: 10 }, snap: null },
      { point: { x: 80, y: 10 }, snap: null },
      'arrow-2',
      11,
    ), 'owns');
    expect(parseConnectorLabel(arrow)).toBe('owns');
    const edited = updateConnectorEnd([left, arrow], 'arrow-2', 'start', { x: 160, y: 100 }).find(entry => entry.id === 'arrow-2')!;
    expect(edited.startId).toBe('left');
    expect(parseConnectorLabel(edited)).toBe('owns');
  });

  it('maps a click onto the object under the cursor instead of a chrome-shifted point', () => {
    const element = { getBoundingClientRect: () => ({ left: 400, top: 220, width: 120, height: 80 }) } as Element;
    expect(pointOnItem(left, 460, 260, element)).toEqual({ x: 100, y: 100 });
  });
});
