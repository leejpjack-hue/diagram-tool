import { parseDiagram } from '../parser/parser';
import { parseSequenceDiagram } from '../components/Sequence/sequenceParser';
import { parseGanttDSL } from '../components/Gantt/ganttParser';
import { calculateHierarchicalLayout } from './autoLayout';
import { isMermaidFlow } from '../parser/mermaidFlow';
import type {
  Board,
  BoardMode,
  BoardVersion,
  PersonalTemplate,
  Presentation,
  PresentationItem,
  Space,
} from './boardManager';

export const BOARD_FORMAT_VERSION = '3.0';
export const EXPORT_WATERMARK = null;
export const EXPORT_REQUIRES_ACCOUNT = false;
export const KNOWN_BOARD_MODES: readonly BoardMode[] = ['architecture', 'flow', 'sequence', 'gantt'];
export const KNOWN_PRESENTATION_TYPES = ['image', 'note', 'text', 'arrow', 'shape', 'drawing', 'frame'] as const;

const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif)(?:;[\w.-]+=[\w.-]+)*;base64,[A-Za-z0-9+/]+={0,2}$/i;

export function isAllowedPresentationContent(type: string, content: string): boolean {
  if (typeof content !== 'string') return false;
  const value = content.trim();
  if (/^https?:\/\//i.test(value) || /^data:image\/svg\+xml/i.test(value)) return false;
  if (type === 'image') return SAFE_IMAGE_DATA_URL.test(value);
  return true;
}

export interface PortableSource {
  kind: 'dsl' | 'mermaid';
  text: string;
}

export interface PortableNode {
  id: string;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  properties?: Record<string, unknown>;
}

export interface PortableEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface PortableLayout {
  pins: Record<string, { x: number; y: number }>;
}

export interface PortableBoard {
  id?: string;
  title: string;
  description?: string;
  mode: BoardMode;
  dslText: string;
  source: PortableSource;
  nodes: PortableNode[];
  edges: PortableEdge[];
  frames: unknown[];
  comments: unknown[];
  layout: PortableLayout;
  presentation?: Presentation;
  thumbnail?: string;
  spaceId?: string;
  tags?: string[];
  starred?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastOpenedAt?: string;
  deletedAt?: string;
  templateSourceId?: string;
  schemaVersion?: number;
}

export interface BoardDocument {
  version: string;
  kind: 'board';
  exportedAt: string;
  board: PortableBoard;
}

export interface WorkspaceDocument {
  version: string;
  kind: 'workspace';
  exportedAt: string;
  boards: PortableBoard[];
  spaces: Space[];
  templates: PersonalTemplate[];
  versions: BoardVersion[];
}

export type PortableDocument = BoardDocument | WorkspaceDocument;

export interface ImportSkip {
  kind: string;
  id?: string;
  reason: string;
}

export interface PortableImportPlan {
  boards: PortableBoard[];
  spaces: Array<Partial<Space> & { name: string }>;
  templates: Array<Partial<PersonalTemplate> & Pick<PersonalTemplate, 'name' | 'mode' | 'dslText'>>;
  versions: Array<Partial<BoardVersion> & Pick<BoardVersion, 'boardId' | 'name' | 'dslText' | 'mode' | 'createdAt'>>;
  skipped: ImportSkip[];
}

export interface ImportReport {
  boards: Board[];
  spaces: number;
  templates: number;
  versions: number;
  skipped: ImportSkip[];
}

export interface LayoutPoint {
  x: number;
  y: number;
}

const PRESENTATION_TYPE_SET = new Set<string>(KNOWN_PRESENTATION_TYPES);
const BOARD_MODE_SET = new Set<string>(KNOWN_BOARD_MODES);

export function sourceKindFor(mode: BoardMode, text: string): PortableSource['kind'] {
  if (mode === 'sequence' || isMermaidFlow(text)) return 'mermaid';
  return 'dsl';
}

export function projectBoardGraph(mode: BoardMode, dslText: string): {
  nodes: PortableNode[];
  edges: PortableEdge[];
  layout: PortableLayout;
} {
  const layout = computeTypedLayout(mode, dslText);
  if (mode === 'sequence') {
    const model = parseSequenceDiagram(dslText);
    const nodes = model.participants.map(participant => ({
      id: participant.id,
      name: participant.name,
      type: participant.actor ? 'actor' : 'participant',
      ...layout[participant.id],
    }));
    const edges = model.items
      .filter(item => item.kind === 'message')
      .map((item, index) => ({
        id: `msg-${index}`,
        from: item.from,
        to: item.to,
        label: item.text,
      }));
    return { nodes, edges, layout: { pins: layout } };
  }

  if (mode === 'gantt') {
    const project = parseGanttDSL(dslText);
    const nodes = (project?.tasks ?? []).map(task => ({
      id: task.id,
      name: task.name,
      type: task.milestone ? 'milestone' : 'task',
      ...layout[task.id],
    }));
    const edges = (project?.dependencies ?? []).map((dependency, index) => ({
      id: `dep-${index}`,
      from: dependency.predecessorId,
      to: dependency.successorId,
    }));
    return { nodes, edges, layout: { pins: layout } };
  }

  try {
    const parsed = parseDiagram(dslText);
    const nodes = parsed.nodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      ...layout[node.id],
    }));
    const edges = parsed.edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
    }));
    return { nodes, edges, layout: { pins: layout } };
  } catch {
    return { nodes: [], edges: [], layout: { pins: layout } };
  }
}

export function computeTypedLayout(mode: BoardMode, dslText: string): Record<string, LayoutPoint> {
  if (mode === 'sequence') {
    const model = parseSequenceDiagram(dslText);
    const points: Record<string, LayoutPoint> = {};
    model.participants.forEach((participant, index) => {
      points[participant.id] = { x: 80 + index * 160, y: 40 };
    });
    return points;
  }

  if (mode === 'gantt') {
    const project = parseGanttDSL(dslText);
    const points: Record<string, LayoutPoint> = {};
    (project?.tasks ?? []).forEach((task, index) => {
      const start = task.startDate instanceof Date ? task.startDate : new Date(task.startDate);
      points[task.id] = { x: start.getTime() / 86_400_000, y: 48 + index * 40 };
    });
    return points;
  }

  try {
    const parsed = parseDiagram(dslText);
    const computed = calculateHierarchicalLayout(
      parsed.nodes.map(node => ({ id: node.id, type: node.type, name: node.name })),
      parsed.edges.map(edge => ({ id: edge.id, from: edge.from, to: edge.to })),
      parsed.direction ?? 'TB',
    );
    const points: Record<string, LayoutPoint> = {};
    parsed.nodes.forEach(node => {
      const pin = parsed.pins?.[node.id];
      const fallback = computed.get(node.id) ?? { x: 100, y: 100 };
      points[node.id] = pin ?? fallback;
    });
    return points;
  } catch {
    return {};
  }
}

export function layoutDelta(
  before: Record<string, LayoutPoint>,
  after: Record<string, LayoutPoint>,
): number {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  let max = 0;
  ids.forEach(id => {
    const a = before[id];
    const b = after[id];
    if (!a || !b) {
      max = Number.POSITIVE_INFINITY;
      return;
    }
    max = Math.max(max, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  });
  return max;
}

export function toPortableBoard(board: Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>): PortableBoard {
  const graph = projectBoardGraph(board.mode, board.dslText);
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    mode: board.mode,
    dslText: board.dslText,
    source: { kind: sourceKindFor(board.mode, board.dslText), text: board.dslText },
    nodes: graph.nodes,
    edges: graph.edges,
    frames: [],
    comments: [],
    layout: graph.layout,
    presentation: board.presentation,
    thumbnail: board.thumbnail,
    spaceId: board.spaceId,
    tags: board.tags,
    starred: board.starred,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    lastOpenedAt: board.lastOpenedAt,
    deletedAt: board.deletedAt,
    templateSourceId: board.templateSourceId,
    schemaVersion: board.schemaVersion,
  };
}

export function buildBoardDocument(board: Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>, exportedAt = new Date().toISOString()): BoardDocument {
  return {
    version: BOARD_FORMAT_VERSION,
    kind: 'board',
    exportedAt,
    board: toPortableBoard(board),
  };
}

export function buildWorkspaceDocument(input: {
  boards: Board[];
  spaces: Space[];
  templates: PersonalTemplate[];
  versions: BoardVersion[];
}, exportedAt = new Date().toISOString()): WorkspaceDocument {
  return {
    version: BOARD_FORMAT_VERSION,
    kind: 'workspace',
    exportedAt,
    boards: input.boards.map(board => toPortableBoard(board)),
    spaces: input.spaces,
    templates: input.templates,
    versions: input.versions,
  };
}

export function containsWatermark(value: string): boolean {
  return /watermark|diagram-tool\.com|teqcon\s+preview|unlicensed/i.test(value);
}

export function validatePortableDocument(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['Document must be a JSON object.'] };
  const object = data as Record<string, unknown>;
  if (typeof object.version !== 'string' || !object.version.trim()) errors.push('Missing version.');
  if (object.board && typeof object.board === 'object') {
    errors.push(...validatePortableBoard(object.board, 'board'));
  } else if (Array.isArray(object.boards)) {
    object.boards.forEach((board, index) => errors.push(...validatePortableBoard(board, `boards[${index}]`)));
    if (object.spaces !== undefined && !Array.isArray(object.spaces)) errors.push('spaces must be an array.');
    if (object.templates !== undefined && !Array.isArray(object.templates)) errors.push('templates must be an array.');
    if (object.versions !== undefined && !Array.isArray(object.versions)) errors.push('versions must be an array.');
  } else if (object.diagram && typeof object.diagram === 'object') {
    const diagram = object.diagram as Record<string, unknown>;
    if (typeof diagram.dslText !== 'string' && typeof (diagram as { source?: { text?: string } }).source?.text !== 'string') {
      errors.push('diagram.source.text or diagram.dslText is required.');
    }
  } else {
    errors.push('Document must include board, boards, or diagram.');
  }
  return { ok: errors.length === 0, errors };
}

function validatePortableBoard(value: unknown, path: string): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return [`${path} must be an object.`];
  const board = value as Record<string, unknown>;
  const sourceText = readSourceText(board);
  if (typeof board.title !== 'string' && !sourceText) errors.push(`${path}.title is required.`);
  const mode = board.mode ?? (board as { source?: { mode?: string } }).source;
  if (typeof board.mode === 'string' && !BOARD_MODE_SET.has(board.mode)) errors.push(`${path}.mode is not a known board type.`);
  if (!sourceText) errors.push(`${path}.source.text (or dslText) is required.`);
  if (board.nodes !== undefined && !Array.isArray(board.nodes)) errors.push(`${path}.nodes must be an array.`);
  if (board.edges !== undefined && !Array.isArray(board.edges)) errors.push(`${path}.edges must be an array.`);
  if (board.frames !== undefined && !Array.isArray(board.frames)) errors.push(`${path}.frames must be an array.`);
  if (board.comments !== undefined && !Array.isArray(board.comments)) errors.push(`${path}.comments must be an array.`);
  void mode;
  return errors;
}

function readSourceText(board: Record<string, unknown>): string {
  if (typeof board.dslText === 'string' && board.dslText.trim()) return board.dslText;
  const source = board.source;
  if (source && typeof source === 'object' && typeof (source as PortableSource).text === 'string') {
    return (source as PortableSource).text;
  }
  return '';
}

export function parsePortableImport(data: unknown): PortableImportPlan {
  const skipped: ImportSkip[] = [];
  if (!data || typeof data !== 'object') {
    throw new Error("That file isn't a valid board file.");
  }
  const object = data as Record<string, unknown>;
  const boards: PortableBoard[] = [];

  const pushCandidate = (raw: unknown, label: string) => {
    if (!raw || typeof raw !== 'object') {
      skipped.push({ kind: label, reason: 'Skipped an unreadable object.' });
      return;
    }
    const record = raw as Record<string, unknown>;
    const mode = record.mode;
    if (typeof mode !== 'string' || !BOARD_MODE_SET.has(mode)) {
      skipped.push({ kind: typeof mode === 'string' ? mode : label, id: asString(record.id), reason: 'Unknown or missing board type.' });
      return;
    }
    const dslText = readSourceText(record);
    if (!dslText) {
      skipped.push({ kind: 'board', id: asString(record.id), reason: 'Missing diagram source (DSL/Mermaid).' });
      return;
    }
    if (Array.isArray(record.comments) && record.comments.length > 0) {
      skipped.push({ kind: 'comments', id: asString(record.id), reason: 'Comments are reserved in the format and are not imported.' });
    }
    if (Array.isArray(record.frames) && record.frames.length > 0) {
      skipped.push({ kind: 'frames', id: asString(record.id), reason: 'Board-level frames are reserved and are not imported.' });
    }
    const presentation = sanitizePresentation(record.presentation, asString(record.id), skipped);
    const graph = projectBoardGraph(mode as BoardMode, dslText);
    boards.push({
      id: asString(record.id),
      title: typeof record.title === 'string' && record.title.trim() ? record.title : 'Imported board',
      description: typeof record.description === 'string' ? record.description : '',
      mode: mode as BoardMode,
      dslText,
      source: { kind: sourceKindFor(mode as BoardMode, dslText), text: dslText },
      nodes: Array.isArray(record.nodes) ? record.nodes as PortableNode[] : graph.nodes,
      edges: Array.isArray(record.edges) ? record.edges as PortableEdge[] : graph.edges,
      frames: [],
      comments: [],
      layout: graph.layout,
      presentation,
      thumbnail: typeof record.thumbnail === 'string' ? record.thumbnail : undefined,
      spaceId: typeof record.spaceId === 'string' ? record.spaceId : undefined,
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      starred: Boolean(record.starred),
      lastOpenedAt: typeof record.lastOpenedAt === 'string' ? record.lastOpenedAt : undefined,
      deletedAt: typeof record.deletedAt === 'string' ? record.deletedAt : undefined,
      templateSourceId: typeof record.templateSourceId === 'string' ? record.templateSourceId : undefined,
    });
  };

  if (Array.isArray(object.boards)) object.boards.forEach((board, index) => pushCandidate(board, `boards[${index}]`));
  else if (object.board && typeof object.board === 'object') pushCandidate(object.board, 'board');
  else if (object.diagram && typeof object.diagram === 'object') {
    const diagram = object.diagram as Record<string, unknown>;
    pushCandidate({
      title: diagram.title,
      mode: diagram.mode,
      dslText: readSourceText(diagram),
      source: diagram.source,
    }, 'diagram');
  } else {
    throw new Error("That file isn't a valid board file.");
  }

  const spaces = Array.isArray(object.spaces)
    ? (object.spaces as Partial<Space>[]).filter((space): space is Partial<Space> & { name: string } => Boolean(space?.name))
    : [];
  const templates: PortableImportPlan['templates'] = [];
  if (Array.isArray(object.templates)) {
    for (const candidate of object.templates as Partial<PersonalTemplate>[]) {
      if (!candidate?.name || !candidate.mode || !candidate.dslText || !BOARD_MODE_SET.has(candidate.mode)) {
        skipped.push({ kind: 'template', id: candidate?.id, reason: 'Personal template was missing name, mode, or source.' });
        continue;
      }
      templates.push(candidate as PortableImportPlan['templates'][number]);
    }
  }
  const versions: PortableImportPlan['versions'] = [];
  if (Array.isArray(object.versions)) {
    for (const candidate of object.versions as Partial<BoardVersion>[]) {
      if (!candidate?.boardId || !candidate.name || !candidate.dslText || !candidate.mode || !candidate.createdAt) {
        skipped.push({ kind: 'version', id: candidate?.id, reason: 'Version checkpoint metadata was incomplete.' });
        continue;
      }
      versions.push(candidate as PortableImportPlan['versions'][number]);
    }
  }

  return { boards, spaces, templates, versions, skipped };
}

function sanitizePresentation(value: unknown, boardId: string | undefined, skipped: ImportSkip[]): Presentation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as { items?: unknown; updatedAt?: string };
  if (!Array.isArray(record.items)) return undefined;
  const items: PresentationItem[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== 'object') {
      skipped.push({ kind: 'presentation', id: boardId, reason: 'Skipped an unreadable deck object.' });
      continue;
    }
    const candidate = item as PresentationItem;
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
    items.push({ ...candidate, content: candidate.content });
  }
  return { items, updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString() };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
