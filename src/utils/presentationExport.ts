import type { PresentationItem, PresentationItemStyle } from './boardManager';
import {
  boundsForExport,
  itemsForExport,
  visibleFrames,
  type PresentationExportScope,
} from './presentationFrames';

interface Point { x: number; y: number }
interface ConnectorGeometry { start: Point; end: Point }
type ConnectorType = NonNullable<PresentationItemStyle['connectorType']>;

export function itemZ(item: PresentationItem): number {
  return item.zIndex ?? (item.type === 'frame' ? -100 : item.type === 'image' ? 0 : 10);
}

export function sortedItems(items: PresentationItem[]): PresentationItem[] {
  return [...items].sort((a, b) => itemZ(a) - itemZ(b));
}

export function styleFor(item: PresentationItem): Required<PresentationItemStyle> {
  const legacyArrowColor = item.type === 'arrow' && item.content.startsWith('#') ? item.content : undefined;
  return {
    fillColor: item.style?.fillColor ?? (item.type === 'note' ? '#fef3c7' : '#ffffff'),
    strokeColor: item.style?.strokeColor ?? legacyArrowColor ?? '#334155',
    textColor: item.style?.textColor ?? (item.type === 'note' ? '#78350f' : '#0f172a'),
    strokeWidth: item.style?.strokeWidth ?? (item.type === 'arrow' || item.type === 'drawing' ? 3 : 2),
    opacity: item.style?.opacity ?? 1,
    fontSize: item.style?.fontSize ?? (item.type === 'text' ? 28 : 16),
    fontWeight: item.style?.fontWeight ?? (item.type === 'text' ? 'bold' : 'normal'),
    textAlign: item.style?.textAlign ?? 'center',
    lineStyle: item.style?.lineStyle ?? 'solid',
    connectorType: item.style?.connectorType ?? 'straight',
    arrowStart: item.style?.arrowStart ?? false,
    arrowEnd: item.style?.arrowEnd ?? item.type === 'arrow',
    shape: item.style?.shape ?? 'rectangle',
  };
}

export function dashArray(style: PresentationItemStyle['lineStyle'], width: number): string | undefined {
  return style === 'dashed' ? `${width * 3} ${width * 2}` : style === 'dotted' ? `${width} ${width * 2}` : undefined;
}

export function parsePoints(item: PresentationItem): Point[] {
  try {
    const value = JSON.parse(item.content) as unknown;
    return Array.isArray(value) ? value.filter((point): point is Point => Boolean(point) && typeof point.x === 'number' && typeof point.y === 'number') : [];
  } catch { return []; }
}

export function parseConnector(item: PresentationItem): ConnectorGeometry {
  try {
    const value = JSON.parse(item.content) as { start?: Point; end?: Point };
    if (value.start && value.end && [value.start.x, value.start.y, value.end.x, value.end.y].every(Number.isFinite)) {
      return { start: value.start, end: value.end };
    }
  } catch { /* Legacy arrows stored their color or an empty string as content. */ }
  return { start: { x: 9, y: item.height / 2 }, end: { x: Math.max(16, item.width - 10), y: item.height / 2 } };
}

export function connectorPath(geometry: ConnectorGeometry, type: ConnectorType): string {
  const { start, end } = geometry;
  if (type === 'straight') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  if (type === 'elbow') {
    if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
      const midX = (start.x + end.x) / 2;
      return `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
    }
    const midY = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y} V ${midY} H ${end.x} V ${end.y}`;
  }
  const dx = end.x - start.x; const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return `M ${start.x} ${start.y} C ${start.x + dx * 0.48} ${start.y}, ${end.x - dx * 0.48} ${end.y}, ${end.x} ${end.y}`;
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + dy * 0.48}, ${end.x} ${end.y - dy * 0.48}, ${end.x} ${end.y}`;
}

export async function renderPresentationPng(
  items: PresentationItem[],
  scope: PresentationExportScope = 'deck',
  frameId?: string,
): Promise<string> {
  const exported = itemsForExport(items, scope, frameId);
  if (!exported.length) throw new Error('Nothing to export.');
  const bounds = boundsForExport(items, scope, frameId);
  if (!bounds) throw new Error('Nothing to export.');
  const ratio = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(bounds.width * ratio));
  canvas.height = Math.max(1, Math.ceil(bounds.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create export canvas.');
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  ctx.beginPath();
  ctx.rect(0, 0, bounds.width, bounds.height);
  ctx.clip();
  ctx.translate(-bounds.x, -bounds.y);
  for (const item of sortedItems(exported)) await drawItem(ctx, item);
  return canvas.toDataURL('image/png');
}

export async function renderPresentationPdf(
  items: PresentationItem[],
  scope: PresentationExportScope = 'deck',
  frameId?: string,
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  if (scope === 'frames') {
    const frames = visibleFrames(items);
    if (!frames.length) throw new Error('Nothing to export.');
    const first = await rasterPage(items, 'frame', frames[0].id);
    const pdf = new jsPDF({
      orientation: first.width >= first.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [first.width, first.height],
    });
    pdf.addImage(first.url, 'PNG', 0, 0, first.width, first.height);
    for (const frame of frames.slice(1)) {
      const page = await rasterPage(items, 'frame', frame.id);
      pdf.addPage([page.width, page.height], page.width >= page.height ? 'landscape' : 'portrait');
      pdf.addImage(page.url, 'PNG', 0, 0, page.width, page.height);
    }
    return pdf.output('blob');
  }
  const page = await rasterPage(items, scope, frameId);
  const pdf = new jsPDF({
    orientation: page.width >= page.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [page.width, page.height],
  });
  pdf.addImage(page.url, 'PNG', 0, 0, page.width, page.height);
  return pdf.output('blob');
}

async function rasterPage(items: PresentationItem[], scope: PresentationExportScope, frameId?: string) {
  const url = await renderPresentationPng(items, scope, frameId);
  const bounds = boundsForExport(items, scope, frameId);
  if (!bounds) throw new Error('Nothing to export.');
  return { url, width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
}

export function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = href;
  link.click();
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'presentation';
}

export function exportFilename(boardTitle: string, format: 'png' | 'pdf', scope: PresentationExportScope, frameTitle?: string) {
  const base = slug(boardTitle);
  if (scope === 'frame') return `${base}-${slug(frameTitle || 'frame')}.${format}`;
  if (scope === 'frames') return `${base}-frames.${format}`;
  return `${base}-presentation.${format}`;
}

async function drawItem(ctx: CanvasRenderingContext2D, item: PresentationItem) {
  const style = styleFor(item); ctx.save(); ctx.globalAlpha = style.opacity;
  if (item.type === 'image') { try { const image = await loadImage(item.content); const scale = Math.min(item.width / image.width, item.height / image.height); const width = image.width * scale; const height = image.height * scale; ctx.drawImage(image, item.x + (item.width - width) / 2, item.y + (item.height - height) / 2, width, height); } catch { ctx.fillStyle = '#f1f5f9'; ctx.fillRect(item.x, item.y, item.width, item.height); } }
  else if (item.type === 'drawing') { const points = parsePoints(item); if (points.length) { ctx.strokeStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(item.x + points[0].x, item.y + points[0].y); points.slice(1).forEach(point => ctx.lineTo(item.x + point.x, item.y + point.y)); ctx.stroke(); } }
  else if (item.type === 'arrow') {
    const local = parseConnector(item); const start = { x: item.x + local.start.x, y: item.y + local.start.y }; const end = { x: item.x + local.end.x, y: item.y + local.end.y };
    let startAngle = Math.atan2(end.y - start.y, end.x - start.x); let endAngle = startAngle;
    ctx.strokeStyle = style.strokeColor; ctx.fillStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(style.lineStyle === 'dashed' ? [10, 7] : style.lineStyle === 'dotted' ? [2, 6] : []); ctx.beginPath(); ctx.moveTo(start.x, start.y);
    if (style.connectorType === 'curved') {
      const dx = end.x - start.x; const dy = end.y - start.y;
      const c1 = Math.abs(dx) >= Math.abs(dy) ? { x: start.x + dx * 0.48, y: start.y } : { x: start.x, y: start.y + dy * 0.48 };
      const c2 = Math.abs(dx) >= Math.abs(dy) ? { x: end.x - dx * 0.48, y: end.y } : { x: end.x, y: end.y - dy * 0.48 };
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y); startAngle = Math.atan2(c1.y - start.y, c1.x - start.x); endAngle = Math.atan2(end.y - c2.y, end.x - c2.x);
    } else if (style.connectorType === 'elbow') {
      if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) { const midX = (start.x + end.x) / 2; ctx.lineTo(midX, start.y); ctx.lineTo(midX, end.y); ctx.lineTo(end.x, end.y); startAngle = Math.atan2(0, midX - start.x); endAngle = Math.atan2(0, end.x - midX); }
      else { const midY = (start.y + end.y) / 2; ctx.lineTo(start.x, midY); ctx.lineTo(end.x, midY); ctx.lineTo(end.x, end.y); startAngle = Math.atan2(midY - start.y, 0); endAngle = Math.atan2(end.y - midY, 0); }
    } else ctx.lineTo(end.x, end.y);
    ctx.stroke(); ctx.setLineDash([]); if (style.arrowEnd) drawArrowHead(ctx, end, endAngle, style.strokeWidth); if (style.arrowStart) drawArrowHead(ctx, start, startAngle + Math.PI, style.strokeWidth);
    try {
      const payload = JSON.parse(item.content) as { label?: unknown };
      if (typeof payload.label === 'string' && payload.label.trim()) {
        ctx.fillStyle = style.strokeColor; ctx.font = '600 12px Inter, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(payload.label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 6);
      }
    } catch { /* Unlabelled or legacy arrows. */ }
  }
  else if (item.type === 'frame') { ctx.strokeStyle = style.strokeColor; ctx.lineWidth = 2; ctx.strokeRect(item.x, item.y, item.width, item.height); ctx.fillStyle = '#334155'; ctx.font = '600 14px Inter, Arial'; ctx.fillText(item.title || 'Frame', item.x, item.y - 9); }
  else if (item.type === 'shape') { drawShape(ctx, item, style); drawItemText(ctx, item, style, 16); }
  else if (item.type === 'text') drawItemText(ctx, item, style, 4);
  else { roundRect(ctx, item.x, item.y, item.width, item.height, 6); ctx.fillStyle = style.fillColor; ctx.fill(); ctx.strokeStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth; ctx.stroke(); drawItemText(ctx, item, style, 16); }
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, item: PresentationItem, style: ReturnType<typeof styleFor>) { const x = item.x, y = item.y, w = item.width, h = item.height; ctx.fillStyle = style.fillColor; ctx.strokeStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth; ctx.setLineDash(style.lineStyle === 'dashed' ? [10, 6] : style.lineStyle === 'dotted' ? [2, 5] : []); ctx.beginPath(); if (style.shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else if (style.shape === 'diamond') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w / 2, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath(); } else if (style.shape === 'triangle') { ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); } else roundRect(ctx, x, y, w, h, style.shape === 'rounded' ? 16 : 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
function drawItemText(ctx: CanvasRenderingContext2D, item: PresentationItem, style: ReturnType<typeof styleFor>, padding: number) { const weight = style.fontWeight === 'bold' ? 700 : style.fontWeight === 'semibold' ? 600 : 400; ctx.fillStyle = style.textColor; ctx.font = `${weight} ${style.fontSize}px Inter, Arial`; ctx.textAlign = style.textAlign; ctx.textBaseline = 'top'; const x = style.textAlign === 'left' ? item.x + padding : style.textAlign === 'right' ? item.x + item.width - padding : item.x + item.width / 2; drawWrappedText(ctx, item.content, x, item.y + padding, item.width - padding * 2, style.fontSize * 1.25, item.height - padding * 2); }
function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxHeight: number) { let cursor = y; for (const paragraph of text.split('\n')) { let line = ''; for (const word of paragraph.split(/\s+/).filter(Boolean)) { const candidate = line ? `${line} ${word}` : word; if (line && ctx.measureText(candidate).width > maxWidth) { if (cursor + lineHeight > y + maxHeight) return; ctx.fillText(line, x, cursor); cursor += lineHeight; line = word; } else line = candidate; } if (line) { if (cursor + lineHeight > y + maxHeight) return; ctx.fillText(line, x, cursor); cursor += lineHeight; } else cursor += lineHeight; } }
function drawArrowHead(ctx: CanvasRenderingContext2D, point: Point, angle: number, width: number) { const size = 10 + width; ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size * 0.55); ctx.lineTo(-size, size * 0.55); ctx.closePath(); ctx.fill(); ctx.restore(); }
function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; }); }
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) { const r = Math.min(radius, width / 2, height / 2); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r); ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
