import type { BoardMode } from './boardManager';
import type { ImportSkip } from './boardFormat';

/**
 * Best-effort draw.io / diagrams.net → DiagramTool board.
 *
 * Mapped: rectangle / rounded / ellipse / rhombus / flowchart basics, plus
 * edges with both ends. Infra stencils (AWS/Azure/GCP/…) become architecture
 * nodes when they dominate; otherwise the board is flow.
 *
 * Dropped (skipped, never silent): swimlanes, groups, containers, tables,
 * images, text-only overlays, extra pages, edges with a missing endpoint,
 * and stencil shapes we cannot classify as a node.
 */

export interface DrawioImport {
  mode: BoardMode;
  title: string;
  dslText: string;
  mapped: number;
  skipped: ImportSkip[];
}

const RESERVED = new Set([
  'diagram', 'title', 'direction', 'edges', 'service', 'database', 'queue',
  'cloud', 'class', 'note', 'edge', 'group', 'lane', 'start', 'end', 'node',
]);

const INFRA_STYLE = /mxgraph\.(aws|aws3|aws4|azure|gcp|googlecloud|kubernetes|k8s|openstack|ibm|cisco|alibaba|oracle)/i;

type FlowKind =
  | 'process'
  | 'decision'
  | 'terminator'
  | 'data'
  | 'document'
  | 'manualinput'
  | 'subprocesscollapsed'
  | 'gatewayexclusive';

type ArchKind = 'service' | 'database' | 'queue' | 'cloud';

interface ParsedCell {
  id: string;
  parent?: string;
  value: string;
  style: Record<string, string>;
  styleRaw: string;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  x?: number;
  y?: number;
}

interface MappedNode {
  cellId: string;
  ident: string;
  label: string;
  x?: number;
  y?: number;
  flowKind: FlowKind;
  archKind: ArchKind;
  infra: boolean;
}

export function looksLikeDrawio(filename: string, text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  if (/<(?:mxfile|mxGraphModel)\b/i.test(trimmed)) return true;
  return /\.drawio$/i.test(filename) && /diagrams\.net|draw\.io/i.test(trimmed);
}

export async function importDrawio(filename: string, text: string): Promise<DrawioImport> {
  const xml = text.trim();
  if (!xml) throw new Error("That draw.io file is empty.");

  const doc = parseXml(xml);
  if (!doc) throw new Error("That file isn't a valid draw.io diagram.");

  const skipped: ImportSkip[] = [];
  const pages = collectPages(doc);
  if (pages.length === 0) throw new Error("That file isn't a valid draw.io diagram.");

  const page = pages[0];
  for (const extra of pages.slice(1)) {
    skipped.push({
      kind: 'page',
      id: extra.name,
      reason: `Extra page “${extra.name}” is not imported.`,
    });
  }

  const modelXml = await decodeDiagramBody(page.body);
  const modelDoc = modelXml.startsWith('<') ? parseXml(modelXml) : null;
  const root = modelDoc ?? (page.body.startsWith('<') ? parseXml(page.body) : doc);
  if (!root) throw new Error("That file isn't a valid draw.io diagram.");

  const cells = collectCells(root);
  const { nodes, edges, cellSkipped } = mapCells(cells);
  skipped.push(...cellSkipped);

  if (nodes.length === 0) {
    const detail = skipped.length
      ? ` ${skipped.length} object${skipped.length === 1 ? '' : 's'} skipped.`
      : '';
    throw new Error(`That draw.io file has no mappable nodes or edges.${detail}`);
  }

  const infraCount = nodes.filter(node => node.infra).length;
  const mode: BoardMode = infraCount > 0 && infraCount >= nodes.length / 2 ? 'architecture' : 'flow';
  const title = page.name.trim() || filename.replace(/\.(drawio|xml)$/i, '').trim() || 'Imported diagram';
  const dslText = mode === 'architecture' ? emitArchitecture(title, nodes, edges) : emitFlow(title, nodes, edges);

  return {
    mode,
    title,
    dslText,
    mapped: nodes.length + edges.length,
    skipped,
  };
}

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

function collectPages(doc: Document): Array<{ name: string; body: string }> {
  const diagrams = [...doc.getElementsByTagName('diagram')];
  if (diagrams.length > 0) {
    return diagrams.map((el, index) => ({
      name: el.getAttribute('name') || el.getAttribute('id') || `Page ${index + 1}`,
      body: (el.textContent ?? '').trim() || innerXml(el),
    }));
  }
  const models = [...doc.getElementsByTagName('mxGraphModel')];
  if (models.length > 0) {
    return models.map((el, index) => ({
      name: el.getAttribute('name') || `Page ${index + 1}`,
      body: el.outerHTML,
    }));
  }
  return [];
}

function innerXml(el: Element): string {
  return [...el.childNodes].map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) return (node as Element).outerHTML;
    return node.textContent ?? '';
  }).join('').trim();
}

async function decodeDiagramBody(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('<')) return trimmed;
  try {
    const binary = Uint8Array.from(atob(trimmed), c => c.charCodeAt(0));
    const inflated = await inflateRaw(binary);
    const asString = new TextDecoder().decode(inflated);
    try {
      return decodeURIComponent(asString);
    } catch {
      return asString;
    }
  } catch {
    return trimmed;
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('deflate-raw is not available');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function collectCells(doc: Document): ParsedCell[] {
  const cells: ParsedCell[] = [];
  const seen = new Set<string>();

  const push = (cell: ParsedCell) => {
    if (!cell.id || seen.has(cell.id)) return;
    seen.add(cell.id);
    cells.push(cell);
  };

  for (const el of [...doc.getElementsByTagName('object'), ...doc.getElementsByTagName('UserObject')]) {
    const mx = el.getElementsByTagName('mxCell')[0];
    if (!mx) continue;
    push(readCell(mx, el.getAttribute('id') ?? mx.getAttribute('id'), el.getAttribute('label') ?? ''));
  }

  for (const el of [...doc.getElementsByTagName('mxCell')]) {
    const parentTag = el.parentElement?.tagName.toLowerCase();
    if (parentTag === 'object' || parentTag === 'userobject') continue;
    push(readCell(el, el.getAttribute('id'), el.getAttribute('value')));
  }

  return cells;
}

function readCell(el: Element, id: string | null, value: string | null): ParsedCell {
  const styleRaw = el.getAttribute('style') ?? '';
  const geom = el.getElementsByTagName('mxGeometry')[0];
  return {
    id: id ?? '',
    parent: el.getAttribute('parent') ?? undefined,
    value: stripHtml(value ?? ''),
    style: parseStyle(styleRaw),
    styleRaw,
    vertex: el.getAttribute('vertex') === '1',
    edge: el.getAttribute('edge') === '1',
    source: el.getAttribute('source') ?? undefined,
    target: el.getAttribute('target') ?? undefined,
    x: geom ? num(geom.getAttribute('x')) : undefined,
    y: geom ? num(geom.getAttribute('y')) : undefined,
  };
}

function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(';')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) {
      out[part.trim().toLowerCase()] = '1';
      continue;
    }
    out[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return out;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function num(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function mapCells(cells: ParsedCell[]): {
  nodes: MappedNode[];
  edges: Array<{ from: string; to: string; label?: string }>;
  cellSkipped: ImportSkip[];
} {
  const nodes: MappedNode[] = [];
  const usedIdents = new Set<string>();
  const idToIdent = new Map<string, string>();
  const cellSkipped: ImportSkip[] = [];

  for (const cell of cells) {
    if (!cell.vertex || cell.edge) continue;
    if (cell.id === '0' || cell.id === '1') continue;

    const skip = skipReason(cell);
    if (skip) {
      cellSkipped.push({ kind: skip.kind, id: cell.id, reason: skip.reason });
      continue;
    }

    const label = cell.value || `N${nodes.length + 1}`;
    const ident = uniqueIdent(label, usedIdents);
    const node: MappedNode = {
      cellId: cell.id,
      ident,
      label,
      x: cell.x != null ? Math.round(cell.x) : undefined,
      y: cell.y != null ? Math.round(cell.y) : undefined,
      flowKind: flowKind(cell),
      archKind: archKind(cell),
      infra: isInfra(cell),
    };
    nodes.push(node);
    idToIdent.set(cell.id, ident);
  }

  const edges: Array<{ from: string; to: string; label?: string }> = [];
  for (const cell of cells) {
    if (!cell.edge) continue;
    const from = cell.source ? idToIdent.get(cell.source) : undefined;
    const to = cell.target ? idToIdent.get(cell.target) : undefined;
    if (!from || !to) {
      cellSkipped.push({
        kind: 'edge',
        id: cell.id,
        reason: 'Edge is missing a mapped source or target.',
      });
      continue;
    }
    edges.push({ from, to, label: cell.value || undefined });
  }

  return { nodes, edges, cellSkipped };
}

function skipReason(cell: ParsedCell): { kind: string; reason: string } | null {
  const shape = (cell.style.shape ?? '').toLowerCase();
  const raw = cell.styleRaw.toLowerCase();

  if (
    raw.includes('swimlane')
    || shape === 'swimlane'
    || cell.style.container === '1'
    || raw.includes('group;')
    || shape === 'group'
  ) {
    return { kind: 'container', reason: `Container “${cell.value || cell.id}” is not imported.` };
  }
  if (shape.includes('table') || raw.includes('shape=table')) {
    return { kind: 'table', reason: 'Tables are not imported.' };
  }
  if (shape === 'image' || raw.includes('image=') || raw.startsWith('image;')) {
    return { kind: 'image', reason: 'Images are not imported.' };
  }
  if ((raw.includes('text;') || shape === 'text') && !cell.style.whiteSpace) {
    return { kind: 'text', reason: `Text overlay “${cell.value || cell.id}” is not imported.` };
  }
  return null;
}

function isInfra(cell: ParsedCell): boolean {
  return INFRA_STYLE.test(cell.styleRaw) || INFRA_STYLE.test(cell.style.shape ?? '');
}

function flowKind(cell: ParsedCell): FlowKind {
  const shape = (cell.style.shape ?? Object.keys(cell.style)[0] ?? '').toLowerCase();
  const raw = cell.styleRaw.toLowerCase();
  if (/rhombus|diamond|decision|gateway/.test(shape) || /rhombus|decision|gateway/.test(raw)) {
    if (/parallel/.test(raw)) return 'process';
    if (/exclusive|hexagon/.test(raw)) return 'gatewayexclusive';
    return 'decision';
  }
  if (/ellipse|terminator|oval|circle|state/.test(shape) || /ellipse;|terminator/.test(raw)) return 'terminator';
  if (/parallelogram|data|inputoutput/.test(shape) || /parallelogram|flowchart\.data/.test(raw)) return 'data';
  if (/document/.test(shape) || /flowchart\.document/.test(raw)) return 'document';
  if (/manual.?input/.test(shape) || /manual.?input/.test(raw)) return 'manualinput';
  if (/subprocess|subroutine/.test(shape) || /subprocess|subroutine/.test(raw)) return 'subprocesscollapsed';
  return 'process';
}

function archKind(cell: ParsedCell): ArchKind {
  const raw = `${cell.styleRaw} ${cell.style.shape ?? ''} ${cell.value}`.toLowerCase();
  if (/database|dbinstance|dynamodb|rds|sql|postgres|mongo|cylinder/.test(raw)) return 'database';
  if (/queue|sqs|sns|kafka|mq\b|pubsub/.test(raw)) return 'queue';
  if (/cloud|vpc|region|account/.test(raw)) return 'cloud';
  return 'service';
}

function uniqueIdent(label: string, used: Set<string>): string {
  let base = label.replace(/[^A-Za-z0-9_]/g, '');
  if (!base) base = 'N';
  if (/^[0-9]/.test(base)) base = `N${base}`;
  if (RESERVED.has(base.toLowerCase())) base = `N${base}`;
  let ident = base;
  let n = 2;
  while (used.has(ident.toLowerCase())) {
    ident = `${base}${n}`;
    n += 1;
  }
  used.add(ident.toLowerCase());
  return ident;
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`;
}

function emitFlow(
  title: string,
  nodes: MappedNode[],
  edges: Array<{ from: string; to: string; label?: string }>,
): string {
  const direction = inferDirection(nodes, edges);
  const lines = [`diagram: flow`, `title: ${title}`, `direction: ${direction}`, ''];
  for (const edge of edges) {
    lines.push(edge.label ? `${edge.from} ->|${quote(edge.label)}| ${edge.to}` : `${edge.from} -> ${edge.to}`);
  }
  if (edges.length) lines.push('');
  for (const node of nodes) {
    const body: string[] = [];
    if (node.label !== node.ident) body.push(`  label: ${quote(node.label)}`);
    if (node.flowKind !== 'process') body.push(`  type: ${node.flowKind}`);
    if (node.x != null && node.y != null) body.push(`  at: ${node.x}, ${node.y}`);
    if (body.length === 0) continue;
    lines.push(`node ${node.ident} {`, ...body, '}', '');
  }
  return lines.join('\n').trim() + '\n';
}

function emitArchitecture(
  title: string,
  nodes: MappedNode[],
  edges: Array<{ from: string; to: string; label?: string }>,
): string {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge.to);
    outgoing.set(edge.from, list);
  }
  const lines = [`diagram: architecture`, `title: ${title}`, ''];
  for (const node of nodes) {
    lines.push(`${node.archKind} ${node.ident} {`);
    if (node.x != null && node.y != null) lines.push(`  at: ${node.x}, ${node.y}`);
    const connects = outgoing.get(node.ident);
    if (connects?.length) lines.push(`  connects: ${connects.join(', ')}`);
    lines.push('}', '');
  }
  return lines.join('\n').trim() + '\n';
}

function inferDirection(
  nodes: MappedNode[],
  edges: Array<{ from: string; to: string }>,
): 'LR' | 'TB' {
  const byIdent = new Map(nodes.map(node => [node.ident, node]));
  let dx = 0;
  let dy = 0;
  for (const edge of edges) {
    const from = byIdent.get(edge.from);
    const to = byIdent.get(edge.to);
    if (from?.x == null || from.y == null || to?.x == null || to.y == null) continue;
    dx += Math.abs(to.x - from.x);
    dy += Math.abs(to.y - from.y);
  }
  return dx >= dy ? 'LR' : 'TB';
}
