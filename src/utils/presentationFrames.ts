import type { PresentationItem, PresentationItemStyle } from './boardManager';

export type PresentationExportScope = 'frame' | 'frames' | 'deck';

export interface FrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FRAME_PAD = 24;

export function isFrame(item: PresentationItem): boolean {
  return item.type === 'frame';
}

export function isHiddenFrame(item: PresentationItem): boolean {
  return item.type === 'frame' && item.hidden === true;
}

/** Frames in outline / Present order: deck item order, hidden frames omitted. */
export function visibleFrames(items: PresentationItem[]): PresentationItem[] {
  return items.filter(item => item.type === 'frame' && item.hidden !== true);
}

export function itemCenter(item: PresentationItem): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

export function containsItem(frame: PresentationItem, item: PresentationItem): boolean {
  if (frame.id === item.id) return false;
  const { x, y } = itemCenter(item);
  return x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
}

/** Spatial children. Frames never nest for this issue; items stay as their original types. */
export function itemsInsideFrame(items: PresentationItem[], frame: PresentationItem): PresentationItem[] {
  return items.filter(item => item.type !== 'frame' && containsItem(frame, item));
}

export function childLockedByFrame(item: PresentationItem, items: PresentationItem[]): boolean {
  return items.some(frame => frame.type === 'frame' && frame.lockChildren === true && containsItem(frame, item));
}

export function boundsOf(items: PresentationItem[], padding = 0): FrameBounds | null {
  if (!items.length) return null;
  const x = Math.min(...items.map(item => item.x));
  const y = Math.min(...items.map(item => item.y));
  const right = Math.max(...items.map(item => item.x + item.width));
  const bottom = Math.max(...items.map(item => item.y + item.height));
  return { x: x - padding, y: y - padding, width: right - x + padding * 2, height: bottom - y + padding * 2 };
}

export function frameFromSelection(
  items: PresentationItem[],
  selectedIds: string[],
  uid: () => string,
  style?: PresentationItemStyle,
): { frame: PresentationItem; next: PresentationItem[] } | null {
  const selected = items.filter(item => selectedIds.includes(item.id) && item.type !== 'frame');
  if (!selected.length) return null;
  const box = boundsOf(selected, FRAME_PAD);
  if (!box) return null;
  const frame: PresentationItem = {
    id: uid(),
    type: 'frame',
    title: 'Frame',
    content: '',
    x: box.x,
    y: box.y,
    width: Math.max(80, box.width),
    height: Math.max(60, box.height),
    zIndex: -100 + items.filter(isFrame).length,
    style: { fillColor: '#ffffff', strokeColor: style?.strokeColor ?? '#94a3b8', strokeWidth: 2, ...style },
  };
  return { frame, next: [...items, frame] };
}

export function moveFrameAndChildren(
  items: PresentationItem[],
  frameId: string,
  x: number,
  y: number,
): PresentationItem[] {
  const frame = items.find(item => item.id === frameId);
  if (!frame || frame.type !== 'frame') {
    return items.map(item => item.id === frameId ? { ...item, x, y } : item);
  }
  const dx = x - frame.x;
  const dy = y - frame.y;
  if (!dx && !dy) return items;
  const childIds = new Set(itemsInsideFrame(items, frame).map(item => item.id));
  return items.map(item => {
    if (item.id === frameId) return { ...item, x, y };
    if (childIds.has(item.id)) return { ...item, x: item.x + dx, y: item.y + dy };
    return item;
  });
}

export function itemsForExport(
  items: PresentationItem[],
  scope: PresentationExportScope,
  frameId?: string,
): PresentationItem[] {
  const hiddenFrames = items.filter(isHiddenFrame);

  const insideHidden = (item: PresentationItem) =>
    hiddenFrames.some(frame => containsItem(frame, item));

  if (scope === 'deck') {
    return items.filter(item => !isHiddenFrame(item) && !insideHidden(item));
  }

  if (scope === 'frames') {
    const frames = visibleFrames(items);
    const keep = new Set<string>();
    for (const frame of frames) {
      keep.add(frame.id);
      for (const child of itemsInsideFrame(items, frame)) keep.add(child.id);
    }
    return items.filter(item => keep.has(item.id));
  }

  const frame = items.find(item => item.id === frameId && item.type === 'frame' && item.hidden !== true);
  if (!frame) return [];
  return [frame, ...itemsInsideFrame(items, frame)];
}

export function boundsForExport(
  items: PresentationItem[],
  scope: PresentationExportScope,
  frameId?: string,
): FrameBounds | null {
  if (scope === 'frame') {
    const frame = items.find(item => item.id === frameId && item.type === 'frame' && item.hidden !== true);
    if (!frame) return null;
    return { x: frame.x, y: frame.y - 20, width: frame.width, height: frame.height + 20 };
  }
  if (scope === 'frames') {
    return boundsOf(visibleFrames(items), 16);
  }
  return boundsOf(itemsForExport(items, 'deck'), 60);
}

export function fitViewportToFrame(
  frame: PresentationItem,
  stage: { width: number; height: number },
  margin = 72,
): { x: number; y: number; zoom: number } {
  const zoom = Math.max(0.2, Math.min(3, Math.min(
    (stage.width - margin * 2) / Math.max(1, frame.width),
    (stage.height - margin * 2) / Math.max(1, frame.height),
  )));
  return {
    zoom,
    x: stage.width / zoom / 2 - frame.width / 2 - frame.x,
    y: stage.height / zoom / 2 - frame.height / 2 - frame.y,
  };
}
