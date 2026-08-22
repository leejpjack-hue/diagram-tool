import type { PresentationItem } from './boardManager';

export type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';

export interface Point {
  x: number;
  y: number;
}

export interface ConnectorAttachment {
  id: string;
  side: ConnectorSide;
  point: Point;
}

export interface ConnectorDraft {
  point: Point;
  snap: ConnectorAttachment | null;
}

const ATTACHABLE = new Set<PresentationItem['type']>(['shape', 'note', 'text', 'frame']);
const SIDES: ConnectorSide[] = ['left', 'right', 'top', 'bottom'];
const CONNECTOR_PAD = 20;
export const CONNECTOR_SNAP_DISTANCE = 28;

export function isConnectorSide(value: unknown): value is ConnectorSide {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom';
}

export function isAttachable(item: PresentationItem): boolean {
  return ATTACHABLE.has(item.type);
}

export function magnetOf(item: PresentationItem, side: ConnectorSide): Point {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  if (side === 'left') return { x: item.x, y: cy };
  if (side === 'right') return { x: item.x + item.width, y: cy };
  if (side === 'top') return { x: cx, y: item.y };
  return { x: cx, y: item.y + item.height };
}

export function closestSide(item: PresentationItem, point: Point): ConnectorSide {
  let best: ConnectorSide = 'right';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const side of SIDES) {
    const magnet = magnetOf(item, side);
    const dist = Math.hypot(magnet.x - point.x, magnet.y - point.y);
    if (dist < bestDist) {
      best = side;
      bestDist = dist;
    }
  }
  return best;
}

export function attachToItem(item: PresentationItem, point: Point): ConnectorAttachment {
  const side = closestSide(item, point);
  return { id: item.id, side, point: magnetOf(item, side) };
}

function pointInExpandedBox(item: PresentationItem, point: Point, pad: number): boolean {
  return point.x >= item.x - pad
    && point.x <= item.x + item.width + pad
    && point.y >= item.y - pad
    && point.y <= item.y + item.height + pad;
}

export function snapAttachment(
  point: Point,
  items: PresentationItem[],
  excludeIds: Iterable<string> = [],
): ConnectorAttachment | null {
  const skip = new Set(excludeIds);
  const z = (item: PresentationItem) => item.zIndex ?? (item.type === 'frame' ? -100 : 10);
  const candidates = items.filter(item => isAttachable(item) && !skip.has(item.id)).sort((a, b) => z(a) - z(b));
  const inside = [...candidates].reverse().find(item => pointInExpandedBox(item, point, 0));
  if (inside) return attachToItem(inside, point);

  let best: { attachment: ConnectorAttachment; dist: number } | null = null;
  for (const item of candidates) {
    if (!pointInExpandedBox(item, point, CONNECTOR_SNAP_DISTANCE)) continue;
    const attachment = attachToItem(item, point);
    const dist = Math.hypot(attachment.point.x - point.x, attachment.point.y - point.y);
    if (!best || dist < best.dist) best = { attachment, dist };
  }
  return best && best.dist <= CONNECTOR_SNAP_DISTANCE * 1.5 ? best.attachment : null;
}

export function parseConnectorLabel(item: PresentationItem): string {
  try {
    const value = JSON.parse(item.content) as { label?: unknown };
    return typeof value.label === 'string' ? value.label : '';
  } catch {
    return '';
  }
}

function localEndpoints(item: PresentationItem): { start: Point; end: Point } {
  try {
    const value = JSON.parse(item.content) as { start?: Point; end?: Point };
    if (value.start && value.end && [value.start.x, value.start.y, value.end.x, value.end.y].every(Number.isFinite)) {
      return { start: value.start, end: value.end };
    }
  } catch { /* Legacy arrows stored their color or an empty string as content. */ }
  return { start: { x: 9, y: item.height / 2 }, end: { x: Math.max(16, item.width - 10), y: item.height / 2 } };
}

export function worldEndpoints(item: PresentationItem): { start: Point; end: Point } {
  const local = localEndpoints(item);
  return {
    start: { x: item.x + local.start.x, y: item.y + local.start.y },
    end: { x: item.x + local.end.x, y: item.y + local.end.y },
  };
}

export function resolveWorldEndpoints(item: PresentationItem, items: PresentationItem[]): { start: Point; end: Point } {
  const fallback = worldEndpoints(item);
  const startTarget = item.startId ? items.find(candidate => candidate.id === item.startId) : undefined;
  const endTarget = item.endId ? items.find(candidate => candidate.id === item.endId) : undefined;
  return {
    start: startTarget && isConnectorSide(item.startSide) ? magnetOf(startTarget, item.startSide) : fallback.start,
    end: endTarget && isConnectorSide(item.endSide) ? magnetOf(endTarget, item.endSide) : fallback.end,
  };
}

export function layoutConnectorArrow(item: PresentationItem, start: Point, end: Point): PresentationItem {
  const x = Math.min(start.x, end.x) - CONNECTOR_PAD;
  const y = Math.min(start.y, end.y) - CONNECTOR_PAD;
  const label = parseConnectorLabel(item);
  const payload: { start: Point; end: Point; label?: string } = {
    start: { x: start.x - x, y: start.y - y },
    end: { x: end.x - x, y: end.y - y },
  };
  if (label) payload.label = label;
  return {
    ...item,
    content: JSON.stringify(payload),
    x,
    y,
    width: Math.max(40, Math.abs(end.x - start.x) + CONNECTOR_PAD * 2),
    height: Math.max(40, Math.abs(end.y - start.y) + CONNECTOR_PAD * 2),
  };
}

export function setConnectorLabel(item: PresentationItem, label: string): PresentationItem {
  const world = worldEndpoints(item);
  const trimmed = label.trim();
  const next = { ...item, content: JSON.stringify({ start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, label: trimmed || undefined }) };
  return layoutConnectorArrow(next, world.start, world.end);
}

export function createConnectorItem(start: ConnectorDraft, end: ConnectorDraft, id: string, zIndex: number): PresentationItem {
  return layoutConnectorArrow({
    id,
    type: 'arrow',
    title: 'Connector',
    content: '',
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    zIndex,
    startId: start.snap?.id,
    startSide: start.snap?.side,
    endId: end.snap?.id,
    endSide: end.snap?.side,
    style: { strokeColor: '#334155', strokeWidth: 3, arrowEnd: true, lineStyle: 'solid', connectorType: 'curved' },
  }, start.snap?.point ?? start.point, end.snap?.point ?? end.point);
}

export function updateConnectorEnd(
  items: PresentationItem[],
  arrowId: string,
  which: 'start' | 'end',
  point: Point,
): PresentationItem[] {
  return items.map(item => {
    if (item.id !== arrowId) return item;
    const exclude = new Set<string>([arrowId]);
    const otherId = which === 'start' ? item.endId : item.startId;
    if (otherId) exclude.add(otherId);
    const snap = snapAttachment(point, items, exclude);
    const world = resolveWorldEndpoints(item, items);
    const start = which === 'start' ? (snap?.point ?? point) : world.start;
    const end = which === 'end' ? (snap?.point ?? point) : world.end;
    return layoutConnectorArrow({
      ...item,
      startId: which === 'start' ? snap?.id : item.startId,
      startSide: which === 'start' ? snap?.side : item.startSide,
      endId: which === 'end' ? snap?.id : item.endId,
      endSide: which === 'end' ? snap?.side : item.endSide,
    }, start, end);
  });
}

export function reflowConnectors(items: PresentationItem[]): PresentationItem[] {
  return items.map(item => {
    if (item.type !== 'arrow') return item;
    const startTarget = item.startId ? items.find(candidate => candidate.id === item.startId) : undefined;
    const endTarget = item.endId ? items.find(candidate => candidate.id === item.endId) : undefined;
    const next: PresentationItem = {
      ...item,
      startId: startTarget ? item.startId : undefined,
      startSide: startTarget && isConnectorSide(item.startSide) ? item.startSide : undefined,
      endId: endTarget ? item.endId : undefined,
      endSide: endTarget && isConnectorSide(item.endSide) ? item.endSide : undefined,
    };
    if (!startTarget && !endTarget && !item.startId && !item.endId) return item;
    const world = resolveWorldEndpoints(next, items);
    return layoutConnectorArrow(next, world.start, world.end);
  });
}

/** Map a pointer onto the same world box as the object under the cursor. */
export function pointOnItem(item: PresentationItem, clientX: number, clientY: number, element: Element): Point {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  }
  return {
    x: item.x + ((clientX - rect.left) / rect.width) * item.width,
    y: item.y + ((clientY - rect.top) / rect.height) * item.height,
  };
}
