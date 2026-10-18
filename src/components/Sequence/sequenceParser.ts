// Mermaid-style sequence diagram parser.
//
// Accepts the common core of Mermaid's `sequenceDiagram` syntax:
//
//   sequenceDiagram
//   title Checkout Flow
//   participant U as User
//   actor S as Support
//   autonumber
//   autonumber 10
//   autonumber 10 5
//   U->>S: Hello            (solid, filled head)
//   S-->>U: Hi back         (dashed, filled head)
//   U->S / U-->S            (no arrowhead)
//   U-)S / U--)S            (async, open head)
//   U-xS / U--xS            (lost, cross)
//   U->>+S: call            (+ activates the receiver)
//   S-->>-U: reply          (- deactivates the sender)
//   activate S / deactivate S
//   Note over U,S: text     (also: Note left of U / Note right of U)
//   loop Every minute ... end
//   alt Success ... else Failure ... end
//   opt Optional ... end
//
// These keywords stay in the source text. They are not a board JSON field.

export type SequenceArrow = 'sync' | 'async' | 'lost' | 'open';

/** Role words written by `%% role <id> <role>`. `ai` is the Flow "model" role. */
export const SEQUENCE_ROLES = ['ai', 'human', 'tool', 'data', 'check'] as const;
export type SequenceRole = (typeof SEQUENCE_ROLES)[number];

export interface SequenceParticipant {
  id: string;
  name: string;
  actor: boolean; // declared with `actor` instead of `participant`
  /**
   * Resolved display role. Absent when nothing matched, so the card keeps
   * today's palette. Not a board field — it is derived from the Mermaid text.
   */
  role?: SequenceRole;
}

export type SequenceItem =
  | {
      kind: 'message';
      from: string;
      to: string;
      text: string;
      dashed: boolean;
      /** Missing means the historical filled head (`->>` / `-->>`). */
      arrow?: SequenceArrow;
      /** `+` on the arrow: activates the receiver. */
      activate?: boolean;
      /** `-` on the arrow: deactivates the sender. */
      deactivate?: boolean;
    }
  | { kind: 'note'; targets: string[]; position: 'over' | 'left' | 'right'; text: string }
  | { kind: 'frameStart'; frameType: string; label: string }
  | { kind: 'frameElse'; label: string }
  | { kind: 'frameEnd' }
  | { kind: 'activate'; id: string }
  | { kind: 'deactivate'; id: string };

export interface SequenceAutonumber {
  start: number;
  step: number;
}

export interface SequenceDiagramModel {
  title: string;
  participants: SequenceParticipant[];
  items: SequenceItem[];
  /** null when the source has no autonumber directive. */
  autonumber: SequenceAutonumber | null;
}

/** One activation bar, from item index `from` through item index `to`. */
export interface ActivationSpan {
  id: string;
  from: number;
  to: number;
  /** 0 is the lifeline; each nested activation of the same participant steps up. */
  depth: number;
  /** True when nothing closed this bar. `to` is the last item. */
  open: boolean;
}

export const MESSAGE_RE = /^([\w "]+?)\s*(-{1,2})(>>|>|\)|[xX])\s*([+-]?)\s*([\w "]+?)\s*:\s*(.*)$/;

// Lines the parser consumes before it ever tests MESSAGE_RE. Kept in sync
// with parseSequenceDiagram so edit utilities can locate the nth message
// line in the raw text reliably.
const NON_MESSAGE_PREFIX = /^(sequenceDiagram|autonumber|activate|deactivate|title|participant|actor|note|loop|alt|opt|par|critical|break|else|and|end)\b/i;

/**
 * Indices (into text.split('\n')) of the lines that parse as messages, in
 * document order — messages[i] of the parsed model comes from line
 * messageLineIndices(text)[i].
 */
export function messageLineIndices(text: string): number[] {
  const out: number[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%') || line.startsWith('#')) continue;
    if (NON_MESSAGE_PREFIX.test(line)) continue;
    if (MESSAGE_RE.test(line)) out.push(i);
  }
  return out;
}

function cleanId(raw: string): string {
  return raw.trim().replace(/^"|"$/g, '');
}

const ROLE_COMMENT_RE = /^%%\s*role\s+(?:"([^"]+)"|(\S+))\s+(ai|human|tool|data|check)\s*$/i;
const AI_NAME_RE = /\b(?:agent|model|llm|gpt)\b/i;
const DATA_NAME_RE = /\b(?:db|store|cache)\b/i;
const TOOL_NAME_RE = /\b(?:tool|api)\b/i;

function readRoleComment(line: string): { id: string; role: SequenceRole } | null {
  const match = line.match(ROLE_COMMENT_RE);
  if (!match) return null;
  const id = cleanId(match[1] ?? match[2] ?? '');
  if (!id) return null;
  return { id, role: match[3].toLowerCase() as SequenceRole };
}

/**
 * Name guess, after a role comment and `actor` have already lost.
 * Agent / Model / LLM / GPT → AI, then DB / Store / Cache → Data,
 * then Tool / API → Tool. An unknown name returns nothing.
 */
export function guessSequenceRole(name: string): SequenceRole | undefined {
  if (AI_NAME_RE.test(name)) return 'ai';
  if (DATA_NAME_RE.test(name)) return 'data';
  if (TOOL_NAME_RE.test(name)) return 'tool';
  return undefined;
}

/**
 * Resolution order: `%% role` comment, then `actor` (Human), then the name
 * guess. Anything else is unroled.
 */
export function resolveSequenceRole(input: {
  commentRole?: SequenceRole | null;
  actor?: boolean;
  name: string;
}): SequenceRole | undefined {
  if (input.commentRole) return input.commentRole;
  if (input.actor) return 'human';
  return guessSequenceRole(input.name);
}

function arrowFromToken(token: string): SequenceArrow {
  if (token === '>>') return 'sync';
  if (token === ')') return 'async';
  if (token === 'x' || token === 'X') return 'lost';
  return 'open';
}

/**
 * `autonumber`, `autonumber 10`, `autonumber 10 5`, or `autonumber off`.
 * undefined means the line is autonumber but not a form we apply.
 */
function readAutonumber(line: string): SequenceAutonumber | null | undefined {
  const rest = line.replace(/^autonumber\b/i, '').trim();
  if (!rest) return { start: 1, step: 1 };
  if (/^off$/i.test(rest)) return null;
  const parts = rest.split(/\s+/);
  if (parts.length > 2) return undefined;
  const start = Number(parts[0]);
  const step = parts.length === 2 ? Number(parts[1]) : 1;
  if (!Number.isFinite(start) || !Number.isFinite(step)) return undefined;
  return { start, step };
}

/**
 * Activation bars implied by `+` / `-` and by activate / deactivate lines.
 * `+` starts a bar on the receiver. `-` ends the newest bar on the sender.
 * A deactivate with nothing active is ignored. An unclosed bar runs to the
 * last item. Nested bars on one participant get increasing `depth`.
 */
export function activationSpans(items: SequenceItem[]): ActivationSpan[] {
  const stacks = new Map<string, { from: number; depth: number }[]>();
  const spans: ActivationSpan[] = [];

  const push = (id: string, index: number) => {
    const stack = stacks.get(id) ?? [];
    stack.push({ from: index, depth: stack.length });
    stacks.set(id, stack);
  };
  const pop = (id: string, index: number) => {
    const stack = stacks.get(id) ?? [];
    const open = stack.pop();
    stacks.set(id, stack);
    if (!open) return;
    spans.push({ id, from: open.from, to: index, depth: open.depth, open: false });
  };

  items.forEach((item, index) => {
    if (item.kind === 'activate') push(item.id, index);
    else if (item.kind === 'deactivate') pop(item.id, index);
    else if (item.kind === 'message') {
      if (item.deactivate) pop(item.from, index);
      if (item.activate) push(item.to, index);
    }
  });

  const last = Math.max(0, items.length - 1);
  for (const [id, stack] of stacks) {
    for (const open of stack) {
      spans.push({ id, from: open.from, to: last, depth: open.depth, open: true });
    }
  }
  return spans;
}

export function findUnrecognizedSequenceLines(text: string): { line: number; text: string }[] {
  const leftover: { line: number; text: string }[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%') || line.startsWith('#')) continue;
    if (NON_MESSAGE_PREFIX.test(line)) continue;
    if (MESSAGE_RE.test(line)) continue;
    if (/->/.test(line) || /->>/.test(line) || /-->/.test(line)) {
      leftover.push({ line: i + 1, text: line });
    }
  }
  return leftover;
}

export function parseSequenceSource(text: string): { model: SequenceDiagramModel; error: string | null } {
  if (/^\s*diagram:\s*(architecture|flow|gantt)\b/im.test(text)) {
    return {
      model: parseSequenceDiagram(text),
      error: 'This source is not a sequenceDiagram. Sequence boards use Mermaid (participant / A->>B: text).',
    };
  }
  const leftover = findUnrecognizedSequenceLines(text);
  if (leftover.length > 0) {
    return {
      model: parseSequenceDiagram(text),
      error: `Unrecognized sequence message at line ${leftover[0].line}. Use A->>B: text (edge was not applied).`,
    };
  }
  return { model: parseSequenceDiagram(text), error: null };
}

export function parseSequenceDiagram(text: string): SequenceDiagramModel {
  const participants: SequenceParticipant[] = [];
  const items: SequenceItem[] = [];
  let title = '';
  let autonumber: SequenceAutonumber | null = null;

  const seen = new Map<string, SequenceParticipant>();
  const roleComments = new Map<string, SequenceRole>();
  const ensure = (rawId: string, name?: string, actor = false): SequenceParticipant => {
    const id = cleanId(rawId);
    let p = seen.get(id);
    if (!p) {
      p = { id, name: name ?? id, actor };
      seen.set(id, p);
      participants.push(p);
    } else if (name) {
      p.name = name;
    }
    return p;
  };

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const roleComment = readRoleComment(line);
    if (roleComment) {
      // A later comment for the same id wins, so a correction sticks.
      roleComments.set(roleComment.id, roleComment.role);
      continue;
    }
    if (line.startsWith('%%')) continue;
    if (/^sequenceDiagram\b/i.test(line)) continue;
    if (/^autonumber\b/i.test(line)) {
      const next = readAutonumber(line);
      if (next !== undefined) autonumber = next;
      continue;
    }
    if (/^(activate|deactivate)\b/i.test(line)) {
      const act = line.match(/^(activate|deactivate)\s+(.+)$/i);
      if (act) {
        const id = cleanId(act[2]);
        if (id) {
          ensure(id);
          items.push({
            kind: act[1].toLowerCase() === 'activate' ? 'activate' : 'deactivate',
            id,
          });
        }
      }
      continue;
    }

    const titleMatch = line.match(/^title\s*:?\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    const partMatch = line.match(/^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i);
    if (partMatch) {
      ensure(partMatch[2], partMatch[3]?.trim(), partMatch[1].toLowerCase() === 'actor');
      continue;
    }

    const noteMatch = line.match(/^note\s+(over|left of|right of)\s+([\w ,"]+?)\s*:\s*(.+)$/i);
    if (noteMatch) {
      const position = noteMatch[1].toLowerCase().startsWith('over')
        ? 'over'
        : noteMatch[1].toLowerCase().startsWith('left') ? 'left' : 'right';
      const targets = noteMatch[2].split(',').map(t => ensure(t).id);
      items.push({ kind: 'note', targets, position, text: noteMatch[3].trim() });
      continue;
    }

    const frameMatch = line.match(/^(loop|alt|opt|par|critical|break)\b\s*(.*)$/i);
    if (frameMatch) {
      items.push({ kind: 'frameStart', frameType: frameMatch[1].toLowerCase(), label: frameMatch[2].trim() });
      continue;
    }
    const elseMatch = line.match(/^(else|and)\b\s*(.*)$/i);
    if (elseMatch) {
      items.push({ kind: 'frameElse', label: elseMatch[2].trim() });
      continue;
    }
    if (/^end\b/i.test(line)) {
      items.push({ kind: 'frameEnd' });
      continue;
    }

    const msgMatch = line.match(MESSAGE_RE);
    if (msgMatch) {
      const from = ensure(msgMatch[1]).id;
      const to = ensure(msgMatch[5]).id;
      const marker = msgMatch[4];
      items.push({
        kind: 'message',
        from,
        to,
        text: msgMatch[6].trim(),
        dashed: msgMatch[2] === '--',
        arrow: arrowFromToken(msgMatch[3]),
        ...(marker === '+' ? { activate: true } : {}),
        ...(marker === '-' ? { deactivate: true } : {}),
      });
      continue;
    }
    // Unrecognised lines are skipped so partial typing never hard-fails.
  }

  for (const participant of participants) {
    const role = resolveSequenceRole({
      commentRole: roleComments.get(participant.id),
      actor: participant.actor,
      name: participant.name,
    });
    if (role) participant.role = role;
  }

  return { title, participants, items, autonumber };
}
