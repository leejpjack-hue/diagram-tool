import { stripListMarker } from './plainSteps';

// DT-SEQ-02 — "Type messages".
//
// Deterministic local conversion of short lines into Mermaid sequenceDiagram
// text. The sequence parser still draws the board. No second engine, no
// network, no model.
//
// Line forms:
//   A <verb> B: text
//     asks / calls / sends / tells / uses → solid ->>
//     replies / returns / answers / responds → dashed -->>
//     notifies / fires / emits → async -)
//   A -> B: text and A => B: text → solid ->>
//   if <cond>: … else: … end → alt
//   repeat <cond>: … end → loop
//   maybe <cond>: … end → opt
//   at the same time: … and: … end → par
//   note on A: text → Note over A
// A leading Human: / AI: / Tool: / Data: on the first mention of a name is
// stored as `%% role <id> human|ai|tool|data`. Mermaid ignores the comment.
// DT-SEQ-04 reads it. Leading list markers are stripped, same as Type parts.
//
// The generated source starts with a `%% @type-messages` comment block holding
// the typed lines, so opening Type messages can refill the box. That comment
// is ordinary Mermaid commentary — not a board field. Hand-written sequence
// text has no marker, so the box stays empty and the source is left alone.

const SOURCE_START = '%% @type-messages';
const SOURCE_END = '%% @type-messages-end';

const ROLE_RE = /^(human|ai|tool|data):\s*/i;
const VERB_RE = /^(.+?)\s+(asks|calls|sends|tells|uses|replies|returns|answers|responds|notifies|fires|emits)\s+(.+)$/i;
const IF_RE = /^if\b\s*(.*?)\s*:\s*$/i;
const REPEAT_RE = /^repeat\b\s*(.*?)\s*:\s*$/i;
const MAYBE_RE = /^maybe\b\s*(.*?)\s*:\s*$/i;
const PAR_RE = /^at the same time\b\s*(.*?)\s*:\s*$/i;
const ELSE_RE = /^else\b\s*(.*?)\s*:?\s*$/i;
const AND_RE = /^and\b\s*(.*?)\s*:?\s*$/i;
const END_RE = /^end\b\s*:?\s*$/i;
const NOTE_RE = /^note\s+on\s+(.+)$/i;

const CALLS = new Set(['asks', 'calls', 'sends', 'tells', 'uses']);
const REPLIES = new Set(['replies', 'returns', 'answers', 'responds']);

const RESERVED = new Set([
  'sequencediagram', 'autonumber', 'activate', 'deactivate', 'title',
  'participant', 'actor', 'note', 'loop', 'alt', 'opt', 'par', 'critical',
  'break', 'else', 'and', 'end',
]);

const UNKNOWN = 'This line wasn\'t understood. Use "User asks Agent: text", if/else/end, or note on User: text.';
const NO_FRAME = 'This line wasn\'t understood. There is no open if, repeat, maybe, or at the same time.';

export type SequenceRole = 'human' | 'ai' | 'tool' | 'data';
export type SequenceArrowKind = 'call' | 'reply' | 'async';

export interface PlainSequenceLine {
  /** 0-based index in the original text, counting empty lines. */
  lineIndex: number;
  summary: string;
  /** Set when the line was not a message, note, or frame. */
  warning?: string;
}

interface Actor {
  name: string;
  id: string;
  role?: SequenceRole;
}

interface Endpoint {
  role?: SequenceRole;
  name: string;
  text: string;
}

function cleanTitle(title?: string): string {
  const raw = (title ?? '').trim().replace(/^["']|["']$/g, '').trim();
  return raw || 'Type messages';
}

function splitRole(raw: string): { role?: SequenceRole; rest: string } {
  const match = ROLE_RE.exec(raw);
  if (!match) return { rest: raw };
  return { role: match[1].toLowerCase() as SequenceRole, rest: raw.slice(match[0].length) };
}

function splitEndpoint(raw: string): Endpoint | null {
  const { role, rest } = splitRole(raw.trim());
  const colon = rest.indexOf(':');
  if (colon < 0) return null;
  const name = rest.slice(0, colon).trim();
  if (!name) return null;
  return { role, name, text: rest.slice(colon + 1).trim() };
}

function verbKind(verb: string): SequenceArrowKind {
  const word = verb.toLowerCase();
  if (REPLIES.has(word)) return 'reply';
  if (CALLS.has(word)) return 'call';
  return 'async';
}

function arrowToken(kind: SequenceArrowKind): string {
  if (kind === 'reply') return '-->>';
  if (kind === 'async') return '-)';
  return '->>';
}

function matchArrow(line: string): { from: string; rhs: string } | null {
  const match = /^(.*?)(->|=>)(.*)$/.exec(line);
  if (!match) return null;
  if (match[1].endsWith('-') || match[1].endsWith('=')) return null;
  const from = match[1].trim();
  const rhs = match[3].trim();
  if (!from || !rhs || from.includes(':')) return null;
  return { from, rhs };
}

function shown(name: string, role?: SequenceRole): string {
  return role ? `${name} (${role})` : name;
}

function quoteText(text: string): string {
  return `"${text.replace(/"/g, "'")}"`;
}

function messageSummary(from: string, fromRole: SequenceRole | undefined, to: string, toRole: SequenceRole | undefined, kind: SequenceArrowKind, text: string): string {
  const body = `${shown(from, fromRole)} → ${shown(to, toRole)} (${kind})`;
  return text ? `${body} ${quoteText(text)}` : body;
}

function keywordLine(keyword: string, label: string): string {
  const trimmed = label.trim();
  return trimmed ? `${keyword} ${trimmed}` : keyword;
}

function allocateId(name: string, used: Set<string>): string {
  let base = name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base || /^\d/.test(base)) base = `P_${base || 'x'}`;
  if (RESERVED.has(base.toLowerCase())) base = `${base}_p`;
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

function participantLine(actor: Actor): string {
  if (actor.id === actor.name) return `participant ${actor.id}`;
  return `participant ${actor.id} as ${actor.name}`;
}

/**
 * Typed lines stashed in a board that Type messages built.
 * Hand-written sequence Mermaid returns null — the caller leaves the box
 * empty and does not touch the source.
 */
export function plainMessagesFromBoardSource(source: string): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex(line => line.trim() === SOURCE_START);
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === SOURCE_END) return out.join('\n');
    if (line.startsWith('%% ')) {
      out.push(line.slice(3));
      continue;
    }
    if (line.trim() === '%%') {
      out.push('');
      continue;
    }
    return null;
  }
  return null;
}

export function typeMessagesSuccessMessage(participants: number, messages: number): string {
  const participantWord = participants === 1 ? 'participant' : 'participants';
  const messageWord = messages === 1 ? 'message' : 'messages';
  return `${participants} ${participantWord}, ${messages} ${messageWord}`;
}

export interface TypeMessagesPreviewRow {
  lineIndex: number;
  lineNumber: number;
  summary: string;
  warning?: string;
}

/** One preview row per non-empty line, from the same converter Build uses. */
export function typeMessagesPreviewRows(text: string): TypeMessagesPreviewRow[] {
  const understood: PlainSequenceLine[] = [];
  try {
    plainSequenceToMermaid(text, { understood });
  } catch {
    // Empty input still leaves a trace of the lines that were read.
  }
  return understood.map(line => ({
    lineIndex: line.lineIndex,
    lineNumber: line.lineIndex + 1,
    summary: line.summary,
    warning: line.warning,
  }));
}

export function plainSequenceToMermaid(
  text: string,
  opts: {
    title?: string;
    understood?: PlainSequenceLine[];
    stats?: { participants: number; messages: number };
  } = {},
): string {
  const understood = opts.understood;
  if (understood) understood.length = 0;

  const actors: Actor[] = [];
  const byName = new Map<string, Actor>();
  const usedIds = new Set<string>();
  const statements: string[] = [];
  let depth = 0;
  let messages = 0;

  const push = (line: string, at = depth) => {
    statements.push(`${'  '.repeat(Math.max(0, at))}${line}`);
  };

  const mention = (name: string, role?: SequenceRole): { id: string; applied?: SequenceRole } => {
    const existing = byName.get(name);
    if (existing) return { id: existing.id };
    const actor: Actor = { name, id: allocateId(name, usedIds), role };
    byName.set(name, actor);
    actors.push(actor);
    return { id: actor.id, applied: role };
  };

  const rawLines = text.split('\n');
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const trimmed = rawLines[lineIndex].trim();
    if (!trimmed) continue;
    const unmarked = stripListMarker(trimmed).trim();
    if (!unmarked) continue;

    const fail = (warning = UNKNOWN) => {
      understood?.push({ lineIndex, summary: unmarked, warning });
    };

    if (/^end\b/i.test(unmarked)) {
      if (!END_RE.test(unmarked)) {
        fail();
        continue;
      }
      if (depth === 0) {
        fail(NO_FRAME);
        continue;
      }
      depth -= 1;
      push('end');
      understood?.push({ lineIndex, summary: 'end' });
      continue;
    }

    if (/^else\b/i.test(unmarked)) {
      const match = ELSE_RE.exec(unmarked);
      if (!match) {
        fail();
        continue;
      }
      if (depth === 0) {
        fail(NO_FRAME);
        continue;
      }
      const line = keywordLine('else', match[1]);
      push(line, depth - 1);
      understood?.push({ lineIndex, summary: line });
      continue;
    }

    if (/^and\b/i.test(unmarked)) {
      const match = AND_RE.exec(unmarked);
      if (!match) {
        fail();
        continue;
      }
      if (depth === 0) {
        fail(NO_FRAME);
        continue;
      }
      const line = keywordLine('and', match[1]);
      push(line, depth - 1);
      understood?.push({ lineIndex, summary: line });
      continue;
    }

    const frame = IF_RE.exec(unmarked) ?? REPEAT_RE.exec(unmarked) ?? MAYBE_RE.exec(unmarked) ?? PAR_RE.exec(unmarked);
    if (/^(if|repeat|maybe|at the same time)\b/i.test(unmarked)) {
      if (!frame) {
        fail();
        continue;
      }
      const keyword = /^if\b/i.test(unmarked)
        ? 'alt'
        : /^repeat\b/i.test(unmarked)
          ? 'loop'
          : /^maybe\b/i.test(unmarked)
            ? 'opt'
            : 'par';
      const line = keywordLine(keyword, frame[1] ?? '');
      push(line);
      depth += 1;
      understood?.push({ lineIndex, summary: line });
      continue;
    }

    const note = NOTE_RE.exec(unmarked);
    if (/^note\b/i.test(unmarked)) {
      const endpoint = note ? splitEndpoint(note[1]) : null;
      if (!endpoint) {
        fail();
        continue;
      }
      const target = mention(endpoint.name, endpoint.role);
      push(`Note over ${target.id}: ${endpoint.text}`);
      understood?.push({
        lineIndex,
        summary: `Note over ${shown(endpoint.name, target.applied)}${endpoint.text ? ` ${quoteText(endpoint.text)}` : ''}`,
      });
      continue;
    }

    const { role: fromRole, rest } = splitRole(unmarked);
    const arrow = matchArrow(rest);
    const verb = arrow ? null : VERB_RE.exec(rest);
    if (!arrow && !verb) {
      fail();
      continue;
    }

    const fromName = (arrow ? arrow.from : verb![1]).trim();
    const rhs = arrow ? arrow.rhs : verb![3];
    const kind: SequenceArrowKind = arrow ? 'call' : verbKind(verb![2]);
    const to = splitEndpoint(rhs);
    if (!fromName || !to) {
      fail();
      continue;
    }

    const from = mention(fromName, fromRole);
    const target = mention(to.name, to.role);
    push(`${from.id}${arrowToken(kind)}${target.id}: ${to.text}`);
    messages += 1;
    understood?.push({
      lineIndex,
      summary: messageSummary(fromName, from.applied, to.name, target.applied, kind, to.text),
    });
  }

  while (depth > 0) {
    depth -= 1;
    push('end');
  }

  if (actors.length === 0) {
    if (understood && understood.length > 0 && understood.every(line => !line.warning)) {
      understood[0].warning = 'No messages found. Type one message per line, e.g. "User asks Agent: plan my trip".';
    }
    throw new Error('No messages found. Type one message per line, e.g. "User asks Agent: plan my trip".');
  }

  if (opts.stats) {
    opts.stats.participants = actors.length;
    opts.stats.messages = messages;
  }

  const out: string[] = [SOURCE_START];
  for (const line of text.trim().split('\n')) out.push(`%% ${line}`);
  out.push(SOURCE_END, 'sequenceDiagram', `title ${cleanTitle(opts.title)}`);
  for (const actor of actors) {
    if (actor.role) out.push(`%% role ${actor.id} ${actor.role}`);
    out.push(participantLine(actor));
  }
  out.push(...statements);
  return out.join('\n');
}
