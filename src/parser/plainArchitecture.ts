import { stripListMarker } from './plainSteps';

// DT-ARCH-01 — "Type parts".
//
// Deterministic local conversion of short lines into the app's NATIVE
// architecture DSL (service / database / queue / edge / group). The one real
// parser (src/parser/parser.ts) still builds the board. No second engine, no
// network, no model.
//
// Line forms:
//   A -> B
//   A -> B: label          (also `A > B` and `A → B`)
//   inside Cloud: A, B, C
// Leading list markers (`-`, `*`, `1.`) are stripped, same as DT-AI-10.
//
// Kind comes from the name:
//   (db) / (database), or a name ending in DB / Database / Store → database
//   (queue), or Queue / Topic / Bus → queue
//   (AI) / (model), or LLM / Model / GPT / Agent → service with an AI badge
//   (tool), or Tool → service with a tool icon
//   (user), or User / Human / Customer → service drawn as a person
//   anything else → service
// A parenthetical hint wins over a suffix. The same name on later lines is
// one part (a later, more specific kind can fill in a plain service).
//
// The generated source starts with a `# @type-parts` comment block holding
// the typed lines, so opening Type parts can refill the box. That comment
// is ordinary DSL commentary — not a board field. Hand-written architecture
// DSL has no marker, so the box stays empty and the source is left alone.

const SOURCE_START = '# @type-parts';
const SOURCE_END = '# @type-parts-end';

const ARROW = /^(.+?)\s*(?:->|→|>)\s*(.+)$/;
const INSIDE = /^inside\s+(.+?)\s*:\s*(.*)$/i;
const KIND_PAREN_SOURCE = String.raw`\(\s*(database|db|queue|ai|model|tool|user)\s*\)`;

const DATABASE_WORDS = ['db', 'database', 'store'];
const QUEUE_WORDS = ['queue', 'topic', 'bus'];
const AI_WORDS = ['llm', 'model', 'gpt', 'agent'];
const TOOL_WORDS = ['tool'];
const USER_WORDS = ['user', 'human', 'customer'];

export type ArchitecturePartKind = 'service' | 'database' | 'queue';
export type ArchitecturePartMark = 'plain' | 'ai' | 'tool' | 'user';

export interface PlainArchitectureLine {
  /** 0-based index in the original text, counting empty lines. */
  lineIndex: number;
  summary: string;
  /** Set when the line was not a connection or an inside-group. */
  warning?: string;
}

interface Part {
  id: string;
  name: string;
  kind: ArchitecturePartKind;
  mark: ArchitecturePartMark;
}

interface ArchEdge {
  from: string;
  to: string;
  label?: string;
}

interface ArchGroup {
  name: string;
  members: string[];
}

/** Same id the architecture parser derives from a node name. */
export function architectureNodeId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function matchesWord(name: string, word: string): boolean {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower === word) return true;
  const last = lower.split(/\s+/).pop() ?? '';
  if (last === word) return true;
  if (!lower.endsWith(word) || lower.length === word.length) return false;
  const boundary = trimmed[trimmed.length - word.length - 1];
  if (!boundary) return false;
  if (/[^A-Za-z0-9]/.test(boundary)) return true;
  const suffix = trimmed.slice(trimmed.length - word.length);
  return /[a-z0-9]/.test(boundary) && (/^[A-Z]/.test(suffix) || suffix === suffix.toUpperCase());
}

function matchesAny(name: string, words: readonly string[]): boolean {
  return words.some(word => matchesWord(name, word));
}

function classify(raw: string): { name: string; kind: ArchitecturePartKind; mark: ArchitecturePartMark } {
  const hints: string[] = [];
  const paren = new RegExp(KIND_PAREN_SOURCE, 'gi');
  const stripped = raw.replace(paren, (_match, word: string) => {
    hints.push(word.toLowerCase());
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  const name = stripped || raw.replace(new RegExp(KIND_PAREN_SOURCE, 'gi'), ' ').replace(/\s+/g, ' ').trim();
  const explicit = hints[0];
  if (explicit === 'db' || explicit === 'database') return { name, kind: 'database', mark: 'plain' };
  if (explicit === 'queue') return { name, kind: 'queue', mark: 'plain' };
  if (explicit === 'ai' || explicit === 'model') return { name, kind: 'service', mark: 'ai' };
  if (explicit === 'tool') return { name, kind: 'service', mark: 'tool' };
  if (explicit === 'user') return { name, kind: 'service', mark: 'user' };
  if (matchesAny(name, DATABASE_WORDS)) return { name, kind: 'database', mark: 'plain' };
  if (matchesAny(name, QUEUE_WORDS)) return { name, kind: 'queue', mark: 'plain' };
  if (matchesAny(name, AI_WORDS)) return { name, kind: 'service', mark: 'ai' };
  if (matchesAny(name, TOOL_WORDS)) return { name, kind: 'service', mark: 'tool' };
  if (matchesAny(name, USER_WORDS)) return { name, kind: 'service', mark: 'user' };
  return { name, kind: 'service', mark: 'plain' };
}

function rank(part: Pick<Part, 'kind' | 'mark'>): number {
  if (part.kind !== 'service') return 2;
  if (part.mark !== 'plain') return 1;
  return 0;
}

function kindTag(part: Pick<Part, 'kind' | 'mark'>): string | null {
  if (part.kind === 'database') return 'database';
  if (part.kind === 'queue') return 'queue';
  if (part.mark === 'ai') return 'AI';
  if (part.mark === 'tool') return 'tool';
  if (part.mark === 'user') return 'user';
  return null;
}

function formatEnd(part: Pick<Part, 'name' | 'kind' | 'mark'>): string {
  const tag = kindTag(part);
  return tag ? `${part.name} (${tag})` : part.name;
}

function dslName(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return name;
  return `"${name.replace(/"/g, "'")}"`;
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`;
}

function cleanTitle(title?: string): string {
  const raw = (title ?? '').trim().replace(/^["']|["']$/g, '').trim();
  return raw || 'Type parts';
}

/**
 * Typed lines stashed in a board that Type parts built.
 * Hand-written architecture DSL returns null — the caller leaves the box
 * empty and does not touch the source.
 */
export function plainPartsFromBoardSource(dsl: string): string | null {
  const lines = dsl.split('\n');
  const start = lines.findIndex(line => line.trim() === SOURCE_START);
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === SOURCE_END) return out.join('\n');
    if (!line.startsWith('# ')) return null;
    out.push(line.slice(2));
  }
  return null;
}

export function typePartsSuccessMessage(parts: number, connections: number): string {
  const partWord = parts === 1 ? 'part' : 'parts';
  const connectionWord = connections === 1 ? 'connection' : 'connections';
  return `${parts} ${partWord}, ${connections} ${connectionWord}`;
}

export interface TypePartsPreviewRow {
  lineIndex: number;
  lineNumber: number;
  summary: string;
  warning?: string;
}

/** One preview row per non-empty line, from the same converter Build uses. */
export function typePartsPreviewRows(text: string): TypePartsPreviewRow[] {
  const understood: PlainArchitectureLine[] = [];
  try {
    plainArchitectureToDSL(text, { understood });
  } catch {
    // Empty input and connector-only input still leave a trace of lines read.
  }
  return understood.map(line => ({
    lineIndex: line.lineIndex,
    lineNumber: line.lineIndex + 1,
    summary: line.summary,
    warning: line.warning,
  }));
}

export function plainArchitectureToDSL(
  text: string,
  opts: {
    title?: string;
    understood?: PlainArchitectureLine[];
    stats?: { parts: number; connections: number };
  } = {},
): string {
  const understood = opts.understood;
  if (understood) understood.length = 0;

  const parts: Part[] = [];
  const byId = new Map<string, Part>();
  const edges: ArchEdge[] = [];
  const groups: ArchGroup[] = [];
  const groupByName = new Map<string, ArchGroup>();

  const ensure = (raw: string): Part | null => {
    const classified = classify(raw);
    if (!classified.name) return null;
    const id = architectureNodeId(classified.name);
    if (!id) return null;
    const existing = byId.get(id);
    if (existing) {
      if (rank(classified) > rank(existing)) {
        existing.kind = classified.kind;
        existing.mark = classified.kind === 'service' ? classified.mark : 'plain';
      }
      return existing;
    }
    const part: Part = {
      id,
      name: classified.name,
      kind: classified.kind,
      mark: classified.kind === 'service' ? classified.mark : 'plain',
    };
    byId.set(id, part);
    parts.push(part);
    return part;
  };

  const rawLines = text.split('\n');
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const trimmed = rawLines[lineIndex].trim();
    if (!trimmed) continue;
    const unmarked = stripListMarker(trimmed).trim();
    if (!unmarked) continue;

    const inside = INSIDE.exec(unmarked);
    if (inside) {
      const groupName = inside[1].trim();
      const members = inside[2].split(',').map(member => member.trim()).filter(Boolean);
      if (!groupName || members.length === 0) {
        understood?.push({
          lineIndex,
          summary: unmarked,
          warning: "This line wasn't understood. Use inside Group: A, B.",
        });
        continue;
      }
      const memberParts = members.map(member => ensure(member)).filter((part): part is Part => Boolean(part));
      const key = groupName.toLowerCase();
      let group = groupByName.get(key);
      if (!group) {
        group = { name: groupName, members: [] };
        groupByName.set(key, group);
        groups.push(group);
      }
      for (const member of memberParts) {
        if (!group.members.includes(member.id)) group.members.push(member.id);
      }
      understood?.push({
        lineIndex,
        summary: `inside ${groupName} · ${memberParts.map(formatEnd).join(', ')}`,
      });
      continue;
    }

    const arrow = ARROW.exec(unmarked);
    if (arrow) {
      const fromRaw = arrow[1].trim();
      let toRaw = arrow[2].trim();
      let label: string | undefined;
      const colon = toRaw.indexOf(':');
      if (colon >= 0) {
        const rest = toRaw.slice(colon + 1).trim();
        toRaw = toRaw.slice(0, colon).trim();
        if (rest) label = rest;
      }
      if (!fromRaw || !toRaw || /(?:->|→|>)/.test(fromRaw) || /(?:->|→|>)/.test(toRaw)) {
        understood?.push({
          lineIndex,
          summary: unmarked,
          warning: "This line wasn't understood. Use A -> B or A -> B: label.",
        });
        continue;
      }
      const from = ensure(fromRaw);
      const to = ensure(toRaw);
      if (!from || !to) {
        understood?.push({
          lineIndex,
          summary: unmarked,
          warning: "This line wasn't understood. Use A -> B or A -> B: label.",
        });
        continue;
      }
      const existing = edges.find(edge => edge.from === from.id && edge.to === to.id);
      if (existing) {
        if (label) existing.label = label;
      } else {
        edges.push({ from: from.id, to: to.id, label });
      }
      const summary = `${formatEnd(from)} → ${formatEnd(to)}${label ? ` · "${label}"` : ''}`;
      understood?.push({ lineIndex, summary });
      continue;
    }

    understood?.push({
      lineIndex,
      summary: unmarked,
      warning: "This line wasn't understood. Use A -> B or inside Group: A, B.",
    });
  }

  if (opts.stats) {
    opts.stats.parts = parts.length;
    opts.stats.connections = edges.length;
  }

  if (parts.length === 0) {
    throw new Error(
      'No parts found. Type one connection per line, e.g. "Chat app -> Agent: question".',
    );
  }

  const out: string[] = [SOURCE_START];
  for (const line of text.trim().split('\n')) out.push(`# ${line}`);
  out.push(SOURCE_END, 'diagram: architecture', `title: ${quote(cleanTitle(opts.title))}`, 'direction: LR', 'edges: orthogonal', '');

  for (const part of parts) {
    const keyword = part.kind === 'database' ? 'database' : part.kind === 'queue' ? 'queue' : 'service';
    const props: string[] = [];
    if (part.kind === 'service' && part.mark === 'ai') props.push('icon: "AI"');
    if (part.kind === 'service' && part.mark === 'tool') props.push('icon: "🔧"');
    if (part.kind === 'service' && part.mark === 'user') {
      props.push('icon: "👤"');
      props.push('color: "#0284c7"');
    }
    if (props.length === 0) out.push(`${keyword} ${dslName(part.name)} {}`, '');
    else out.push(`${keyword} ${dslName(part.name)} {`, ...props.map(prop => `  ${prop}`), '}', '');
  }

  for (const edge of edges) {
    const from = parts.find(part => part.id === edge.from);
    const to = parts.find(part => part.id === edge.to);
    if (!from || !to) continue;
    if (edge.label) {
      out.push(`edge ${dslName(from.name)} -> ${dslName(to.name)} {`, `  label: ${quote(edge.label)}`, '}', '');
    } else {
      out.push(`edge ${dslName(from.name)} -> ${dslName(to.name)}`, '');
    }
  }

  for (const group of groups) {
    if (group.members.length === 0) continue;
    out.push(`group ${dslName(group.name)} {`, `  contains: ${group.members.join(', ')}`, '}', '');
  }

  return out.join('\n');
}
