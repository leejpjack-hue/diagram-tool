import type { FlowNode, Lane, ParsedDiagram } from '../store/types';

// "Type steps" plain-sentence support (DT-AI-01).
//
// Deterministic local conversion of one-step-per-line typed sentences into the
// app's NATIVE flow DSL. Deliberately the same pattern as Mermaid flowchart
// support (mermaidFlowToDSL): produce existing DSL text and let the one real
// parser (src/parser/parser.ts) do all node/edge/label work. No second parser
// engine, no network, no model — pure string-to-string conversion.
//
// Line forms accepted:
//   Ship the order
//   Validate email, then Send welcome
//   If invalid then Retry
//   If invalid then Retry else Reject        (single line)
//   If invalid
//   else Manual review                       (else on its own line)
//
// DT-AI-04 — optional role-word prefixes on a step (local only, no LLM):
//   Human: ask the question
//   Model draft reply          (bare token + space)
//   TOOL: search docs          (case-insensitive; optional space after colon)
// Unknown prefixes (e.g. Alien: …) stay part of the label.
//
// DT-AI-10 — optional leading list markers are stripped before role words:
//   1. Model: draft reply
//   - Human: ask
//   * Tool: search
//
// DT-AI-12 — chat role aliases normalize to the same PlainStepRole values:
//   User → human, Assistant|AI → model, System → check
//   Same forms: Alias: / Alias: rest / Alias rest (case-insensitive).
//   e.g. 1. User: ask → role human, label ask
//
// DT-AI-24 — data-kind prefixes (a shape, not an actor; no role chip):
//   Data: customer tickets     → type: data,    label "customer tickets"
//   Memory last 3 tickets      → type: data     (bare token + space)
//   DB: crm                    → type: data
//   File: brief                → type: document
//   Same forms as DT-AI-04 (colon or bare token + space, case-insensitive).
//   List markers are already stripped (DT-AI-10). Unknown prefixes stay in
//   the label. A data line never also gets a role. Notes and then/if/else
//   attach exactly as they do on other steps. Lines without these words
//   stay byte-identical to previous output.
//
// DT-AI-15 — optional short "why" note per step, typed on the same line:
//   Model: draft reply — uses the last 3 tickets
//   Send reply -- blocks if confidence < 0.8
//   ` — ` (em dash with spaces) or ` -- ` (two hyphens with spaces) starts the
//   note; the FIRST match on the line wins, so any later dash stays in the
//   note text. A single hyphen ` - ` is NOT a separator and stays in the label.
//   The note is not its own step: it attaches to the LAST step on that line —
//   e.g. `Log in, then Verify email -- SSO only` puts the note on "Verify
//   email", and `If invalid then Retry -- after 3 tries` puts it on "Retry".
//   Splitting happens before then/if/else segmenting, so connector words inside
//   a note are just note text. The note travels as `note: "..."` on the flow
//   node (kept in the board's own DSL — survives save/reload and Copy as DSL),
//   is emitted by Copy as steps as `Label — note`, and shown in Walk through.
//   Node faces never render the note. Lines without a dash are byte-identical
//   to DT-AI-01/04/10/12 output. Deterministic local parsing only — typed text
//   never leaves this device.
//
// DT-AI-25 — loop phrases link to an earlier step instead of creating one:
//   go back to Draft reply
//   back to Draft reply
//   repeat from Draft reply
//   retry from Draft reply
// Case-insensitive, at the start of a step or branch target (plain line, `then`,
// `if … then …`, `else …`). The target is the first earlier node whose label
// matches exactly (case-insensitive, trimmed). A branch keeps Yes/No; any other
// back-edge is labelled "loop". The forward chain stays on the node that
// emitted the back-edge, so the next line does not sprout from the loop target.
// No earlier match → a normal step whose label is the full phrase, and Build
// notes how many loop targets were not found. Lines without these phrases stay
// byte-identical. Plain edges only — no schema change.
//
// DT-AI-26 — parallel phrases split one line into branches that run together:
//   Tool: search docs and at the same time Tool: search tickets
//   Tool: search docs in parallel with Tool: search tickets
//   Tool: search docs meanwhile Tool: search tickets
// Case-insensitive, whole words, two or more branches. Each branch keeps its
// own role or data prefix and its own note. The line becomes a gatewayparallel
// fork, one node per branch, and — when another step follows — a
// gatewayparallel join before that step. The join is omitted when the parallel
// line is last and nothing follows it. A plain "and" does not split. The same
// phrase inside an if/else branch on that line stays text, and Build notes it.
// Lines without these phrases stay byte-identical. Existing node kinds only.
//
// DT-AI-27 — optional role swimlanes. When `lanesByRole` is set, Build appends
// native `lane` blocks after the nodes. Membership follows the step's role or
// data kind: Human, AI agent (model), Tool, Check, Data (data and document),
// Other (no role). Empty lanes are omitted. That order is fixed. Edges and
// node blocks stay exactly as they are with the option off, so step order is
// unchanged. The option off (the default) is byte-identical to today.
//
// DT-AI-28 — optional `understood` trace for the live "Understood as" preview.
// It records the line reading this converter already does (role, kind, label,
// note, loop, parallel, empty `then`). Omit it and the DSL is byte-identical.
// The preview is not a second parser and does not change the board.
//
// `then` links steps in order; `if <text>` makes `<text>` a decision node whose
// following branch is labelled Yes; `else ...` reuses that decision for a No
// branch. Anything else is a plain step, exactly like today.

/** DT-AI-28: one step the converter emitted while reading a typed line. */
export interface UnderstoodStep {
  role?: PlainStepRole;
  /** `loop` is a back-edge, not a new node kind. */
  kind: 'step' | 'decision' | 'data' | 'document' | 'loop';
  label: string;
  note?: string;
  /** Set when this step is the Yes or No branch of a decision. */
  branch?: 'yes' | 'no';
  /** Target of a loop phrase, in the earlier step's own label when it matched. */
  loopTarget?: string;
  /** False when a loop phrase did not match an earlier step. */
  loopFound?: boolean;
}

/** DT-AI-28: how the converter read one non-empty typed line. */
export interface UnderstoodLine {
  /** 0-based index in the original text, counting empty lines. */
  lineIndex: number;
  steps: UnderstoodStep[];
  /** True when a `then` on this line had no branch text. */
  emptyThen: boolean;
  /** True when this line became a parallel fork. */
  parallel: boolean;
}

function remember(line: UnderstoodLine | null, step: UnderstoodStep): void {
  line?.steps.push(step);
}

interface Segment {
  kind: 'op' | 'text';
  op?: 'if' | 'then' | 'else';
  text?: string;
}

function splitSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < line.length) {
    const kw = /\b(then|if|else)\b/i.exec(line.slice(i));
    if (!kw) break;
    const before = line.slice(i, i + kw.index).trim().replace(/^[,:;]+|[,:;]+$/g, '').trim();
    if (before) segments.push({ kind: 'text', text: before });
    segments.push({ kind: 'op', op: kw[1].toLowerCase() as 'if' | 'then' | 'else' });
    i += kw.index + kw[0].length;
  }
  const rest = line.slice(i).trim().replace(/^[,:;]+|[,:;]+$/g, '').trim();
  if (rest) segments.push({ kind: 'text', text: rest });
  return segments;
}

function quote(s: string): string {
  return `"${s.replace(/"/g, "'")}"`;
}

/** DT-AI-04: display roles that round-trip with DT-AI-03 `role:` chips. */
export type PlainStepRole = 'human' | 'model' | 'tool' | 'check';

/** DT-AI-24: data shapes. File maps to the existing document kind. */
export type PlainStepKind = 'data' | 'document';

/** Canonical roles plus DT-AI-12 chat aliases (longest tokens first). */
const ROLE_PREFIX =
  /^(assistant|human|model|tool|check|system|user|ai)(?:\s*:\s*|\s+)(.+)$/i;

/** Map a matched role token (lowercased) to PlainStepRole. */
const ROLE_ALIAS: Record<string, PlainStepRole> = {
  human: 'human',
  user: 'human',
  model: 'model',
  assistant: 'model',
  ai: 'model',
  tool: 'tool',
  check: 'check',
  system: 'check',
};

/**
 * DT-AI-10: drop one leading list marker so pasted outlines keep role words.
 * After leading whitespace is already trimmed: `N.` / `N)` (1+ digits) or
 * `-` / `*` / `•`, then optional whitespace. Mid-line markers stay in the label.
 * Does not handle nested lists or checkbox `- [ ]`.
 */
export function stripListMarker(line: string): string {
  return line.replace(/^(\d+[.)]|[-*•])\s*/, '');
}

/**
 * Strip an optional leading role word from a step label.
 * Colon form: `Human:` / `User:` / `Model:` / … (optional space after colon).
 * Bare form: `Human ` / `AI ` / … followed by the rest of the step.
 * DT-AI-12 aliases: User→human, Assistant|AI→model, System→check.
 * Unknown prefixes are left intact. Tool: stays tool.
 */
export function stripRolePrefix(raw: string): { role?: PlainStepRole; label: string } {
  const m = ROLE_PREFIX.exec(raw);
  if (!m) return { label: raw };
  const role = ROLE_ALIAS[m[1].toLowerCase()];
  if (!role) return { label: raw };
  const label = m[2].trim();
  if (!label) return { label: raw }; // bare "Human:" with nothing after → keep as label
  return { role, label };
}

/** Longest tokens first so `memory` is not eaten by a shorter word. */
const KIND_PREFIX = /^(memory|data|file|db)(?:\s*:\s*|\s+)(.+)$/i;

const KIND_ALIAS: Record<string, PlainStepKind> = {
  data: 'data',
  memory: 'data',
  db: 'data',
  file: 'document',
};

/**
 * DT-AI-24: strip a leading data-kind word.
 * Colon form: `Data:` / `File:` (optional space after the colon).
 * Bare form: `Memory ` / `DB ` followed by the rest of the step.
 * `File` → document; `Data` / `Memory` / `DB` → data.
 * A bare word with nothing after it stays in the label. Unknown prefixes
 * are left intact. This is a kind, not a role — callers must not also
 * assign a role chip when a kind matches.
 */
export function stripKindPrefix(raw: string): { kind?: PlainStepKind; label: string } {
  const m = KIND_PREFIX.exec(raw);
  if (!m) return { label: raw };
  const kind = KIND_ALIAS[m[1].toLowerCase()];
  if (!kind) return { label: raw };
  const label = m[2].trim();
  if (!label) return { label: raw };
  return { kind, label };
}

/**
 * DT-AI-15: split `Label — note` / `Label -- note` (first ` — ` or ` -- `
 * with spaces on both sides). A single ` - ` is not a separator and a dash
 * with nothing after it stays in the label.
 */
const NOTE_SPLIT = /(?:\s—\s|\s--\s)/;

export function splitStepNote(line: string): { text: string; note?: string } {
  const m = NOTE_SPLIT.exec(line);
  if (!m) return { text: line };
  const note = line.slice(m.index + m[0].length).trim();
  if (!note) return { text: line };
  return { text: line.slice(0, m.index).trim(), note };
}

/** Display order for DT-AI-27 role lanes. Empty lanes are not emitted. */
export const ROLE_LANES = [
  { key: 'human', name: 'Human' },
  { key: 'model', name: 'AI agent' },
  { key: 'tool', name: 'Tool' },
  { key: 'check', name: 'Check' },
  { key: 'data', name: 'Data' },
  { key: 'other', name: 'Other' },
] as const;

type RoleLaneKey = (typeof ROLE_LANES)[number]['key'];

interface EmittedNode {
  id: string;
  label: string;
  decision: boolean;
  role?: PlainStepRole;
  kind?: PlainStepKind;
  note?: string;
  /** DT-AI-26: existing BPMN parallel gateway. Not a new node type. */
  gateway?: 'gatewayparallel';
}

interface State {
  nodes: EmittedNode[];
  edges: { from: string; to: string; label?: string }[];
  idFor: Map<string, string>;
  counts: Map<string, number>;
  last: string | null;
  lastDecision: string | null;
  expectBranch: 'yes' | 'no' | null;
  inIf: boolean;
  loopMisses: number;
  parallelHints: number;
}

/**
 * DT-AI-25: `go back to` / `back to` / `repeat from` / `retry from` plus a label.
 * `go back to` is tried before `back to` so the shorter phrase cannot eat it.
 * A bare phrase with no label is not a loop.
 */
const LOOP_PHRASE = /^(?:go\s+back\s+to|back\s+to|repeat\s+from|retry\s+from)\s+(.+)$/i;

export function loopTargetLabel(label: string): string | null {
  const match = LOOP_PHRASE.exec(label.trim());
  if (!match) return null;
  const target = match[1].trim();
  return target.length > 0 ? target : null;
}

/**
 * DT-AI-26: separators between parallel branches. Whitespace on both sides
 * keeps a plain "and" (and a phrase glued to another word) from splitting.
 */
const PARALLEL_SPLIT = /\s+(?:and\s+at\s+the\s+same\s+time|in\s+parallel\s+with|meanwhile)\s+/i;

function hasParallelPhrase(line: string): boolean {
  return PARALLEL_SPLIT.test(line);
}

function splitParallelParts(line: string): string[] | null {
  if (!hasParallelPhrase(line)) return null;
  const parts = line.split(PARALLEL_SPLIT).map(part => part.trim()).filter(part => part.length > 0);
  return parts.length >= 2 ? parts : null;
}

/**
 * A trailing `then …` on the last branch is the next step, not part of the
 * branch. A `then` inside that branch's note stays in the note.
 */
function splitTrailingChain(part: string): { head: string; chain: string } {
  const noteMatch = NOTE_SPLIT.exec(part);
  const headRegion = noteMatch ? part.slice(0, noteMatch.index) : part;
  const kw = /\bthen\b/i.exec(headRegion);
  if (!kw) return { head: part.trim(), chain: '' };
  const head = part.slice(0, kw.index).trim().replace(/[,:;]+$/g, '').trim();
  const chain = part.slice(kw.index).trim();
  return { head, chain };
}

/** First earlier node whose label matches exactly, case-insensitive, trimmed. */
function findEarlierNode(label: string, state: State): string | null {
  const key = label.trim().toLowerCase();
  const found = state.nodes.find(node => node.label.trim().toLowerCase() === key);
  return found?.id ?? null;
}

/**
 * Link `id` (an existing node) as a back-edge. Branch labels stay Yes/No;
 * every other back-edge is "loop". `last` is left where it is so the next
 * typed step continues the forward chain from the node that looped.
 */
function linkLoop(id: string, state: State): void {
  if (state.expectBranch === 'yes' && state.lastDecision) {
    state.edges.push({ from: state.lastDecision, to: id, label: 'Yes' });
    state.expectBranch = null;
    return;
  }
  if (state.expectBranch === 'no' && state.lastDecision) {
    state.edges.push({ from: state.lastDecision, to: id, label: 'No' });
    state.expectBranch = null;
    return;
  }
  if (state.last) {
    state.edges.push({ from: state.last, to: id, label: 'loop' });
  }
}

function stepId(label: string, state: State): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'step';
  const n = (state.counts.get(base) ?? 0) + 1;
  state.counts.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}

function placeNode(
  label: string,
  state: State,
  decision: boolean,
  role?: PlainStepRole,
  kind?: PlainStepKind,
): string {
  const existing = state.idFor.get(label);
  if (existing) return existing;
  const id = stepId(label, state);
  state.idFor.set(label, id);
  state.nodes.push({ id, label, decision, role: kind ? undefined : role, kind });
  return id;
}

/** A parallel gateway is never reused by label — each fork and join is its own node. */
function placeGateway(state: State, label: string, idBase: string): string {
  const id = stepId(idBase, state);
  state.nodes.push({ id, label, decision: false, gateway: 'gatewayparallel' });
  return id;
}

/** Link `id` from the open branch or from the previous step. */
function connectIncoming(id: string, state: State): void {
  if (state.expectBranch === 'yes' && state.lastDecision) {
    state.edges.push({ from: state.lastDecision, to: id, label: 'Yes' });
    state.expectBranch = null;
    return;
  }
  if (state.expectBranch === 'no' && state.lastDecision) {
    state.edges.push({ from: state.lastDecision, to: id, label: 'No' });
    state.expectBranch = null;
    return;
  }
  if (state.last && state.last !== id) {
    state.edges.push({ from: state.last, to: id });
  }
}

function emitParallel(
  branches: string[],
  state: State,
  needJoin: boolean,
  active: UnderstoodLine | null,
): void {
  const forkId = placeGateway(state, 'in parallel', 'in_parallel');
  connectIncoming(forkId, state);
  const branchIds: string[] = [];
  for (const branch of branches) {
    const { text, note } = splitStepNote(stripListMarker(branch.trim()));
    const rawLabel = text.replace(/\|/g, '/').trim();
    if (!rawLabel) continue;
    const kindHit = stripKindPrefix(rawLabel);
    const roleHit = kindHit.kind ? undefined : stripRolePrefix(rawLabel);
    const label = kindHit.kind ? kindHit.label : roleHit!.label;
    const role = roleHit?.role;
    const kind = kindHit.kind;
    if (!label) continue;
    const id = placeNode(label, state, false, role, kind);
    if (note) {
      const owner = state.nodes.find(n => n.id === id);
      if (owner && !owner.note) owner.note = note;
    }
    state.edges.push({ from: forkId, to: id });
    branchIds.push(id);
    if (active) active.parallel = true;
    remember(active, {
      kind: kind === 'data' ? 'data' : kind === 'document' ? 'document' : 'step',
      label,
      role,
      note,
    });
  }
  if (needJoin && branchIds.length > 0) {
    const joinId = placeGateway(state, 'join', 'join');
    for (const id of branchIds) {
      if (id !== joinId) state.edges.push({ from: id, to: joinId });
    }
    state.last = joinId;
    return;
  }
  state.last = forkId;
}

function laneKeyForEmitted(node: EmittedNode): RoleLaneKey {
  if (node.kind === 'data' || node.kind === 'document') return 'data';
  if (node.role) return node.role;
  return 'other';
}

function laneKeyForFlow(node: FlowNode): RoleLaneKey {
  const kind = node.properties.nodeType;
  if (kind === 'data' || kind === 'document') return 'data';
  const role = node.properties.role;
  if (role === 'human' || role === 'model' || role === 'tool' || role === 'check') return role;
  return 'other';
}

/** A lane name that is one identifier stays bare. A space needs quotes. */
function laneHeader(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return `lane ${name} {`;
  return `lane ${quote(name)} {`;
}

/**
 * True when the board's lanes are exactly the non-empty role lanes for its
 * flow nodes (same names, same order, same node ids). Custom swimlanes do
 * not match. No lanes does not match.
 */
export function diagramMatchesRoleLanes(diagram: ParsedDiagram): boolean {
  const actual = diagram.lanes;
  if (!actual || actual.length === 0) return false;
  const expected = roleLanesForFlowNodes(
    diagram.nodes.filter((node): node is FlowNode => node.type === 'flow'),
  );
  if (expected.length !== actual.length) return false;
  return expected.every((lane, index) => sameLane(lane, actual[index]));
}

function roleLanesForFlowNodes(nodes: FlowNode[]): { name: string; contains: string[] }[] {
  const buckets = new Map<RoleLaneKey, string[]>();
  for (const node of nodes) {
    const key = laneKeyForFlow(node);
    const ids = buckets.get(key);
    if (ids) ids.push(node.id);
    else buckets.set(key, [node.id]);
  }
  return ROLE_LANES.flatMap(lane => {
    const contains = buckets.get(lane.key);
    return contains && contains.length > 0 ? [{ name: lane.name, contains }] : [];
  });
}

function sameLane(expected: { name: string; contains: string[] }, actual: Lane): boolean {
  if (actual.name !== expected.name || actual.contains.length !== expected.contains.length) return false;
  return expected.contains.every((id, index) => actual.contains[index] === id);
}

export function plainStepsToDSL(
  text: string,
  opts: {
    title?: string;
    loopMisses?: { count: number };
    parallelHints?: { count: number };
    lanesByRole?: boolean;
    /** DT-AI-28: filled with one entry per non-empty line. Does not change the DSL. */
    understood?: UnderstoodLine[];
  } = {},
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const understood = opts.understood;
  if (understood) understood.length = 0;
  const sourceLineIndexes: number[] = [];
  if (understood) {
    const rawLines = text.split('\n');
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].trim().length > 0) sourceLineIndexes.push(i);
    }
  }
  let active: UnderstoodLine | null = null;
  const state: State = {
    nodes: [],
    edges: [],
    idFor: new Map(),
    counts: new Map(),
    last: null,
    lastDecision: null,
    expectBranch: null,
    inIf: false,
    loopMisses: 0,
    parallelHints: 0,
  };

  const processPlainLine = (unmarked: string) => {
    // DT-AI-15: peel the note off before segmenting, then attach it to the
    // last step created on this line (a `then` chain may create several).
    const { text: lineText, note } = splitStepNote(unmarked);
    let lastOnLine: string | null = null;
    let pendingThen = false;
    let loopMissTarget: string | null = null;
    for (const seg of splitSegments(lineText)) {
      if (seg.kind === 'op') {
        if (seg.op === 'then') pendingThen = true;
        else {
          if (pendingThen) {
            if (active) active.emptyThen = true;
          }
          pendingThen = false;
        }
        if (seg.op === 'if') state.inIf = true;
        else if (seg.op === 'else' && state.lastDecision) state.expectBranch = 'no';
        // `then` needs no state: the next step simply chains from `last`.
        continue;
      }
      if (pendingThen) pendingThen = false;
      const rawLabel = (seg.text ?? '').replace(/\|/g, '/').trim();
      if (!rawLabel) continue;
      // DT-AI-24: a leading data word is a kind, not an actor. The text after
      // `if` is the decision condition, so a data word there stays in the
      // label (the node is a decision). Branch and plain steps take the kind.
      // Only when it does not match do we look for a role word.
      const kindHit: { kind?: PlainStepKind; label: string } = state.inIf
        ? { label: rawLabel }
        : stripKindPrefix(rawLabel);
      const roleHit = kindHit.kind ? undefined : stripRolePrefix(rawLabel);
      const label = kindHit.kind ? kindHit.label : roleHit!.label;
      const role = roleHit?.role;
      const kind = kindHit.kind;
      if (!label) continue;

      // The text after `if` is the decision condition, not a branch target.
      if (!state.inIf) {
        const targetLabel = loopTargetLabel(label);
        if (targetLabel) {
          const earlier = findEarlierNode(targetLabel, state);
          if (earlier) {
            const branch = state.expectBranch === 'yes' || state.expectBranch === 'no'
              ? state.expectBranch
              : undefined;
            linkLoop(earlier, state);
            lastOnLine = earlier;
            const earlierLabel = state.nodes.find(n => n.id === earlier)?.label ?? targetLabel;
            remember(active, {
              kind: 'loop',
              label: earlierLabel,
              branch,
              loopTarget: earlierLabel,
              loopFound: true,
            });
            continue;
          }
          state.loopMisses += 1;
          loopMissTarget = targetLabel;
        }
      }

      let id: string;
      let labelledBranch = false;
      let branch: 'yes' | 'no' | undefined;
      let decision = false;
      if (state.inIf) {
        // The text after `if` IS the condition → decision node.
        id = placeNode(label, state, true, role, kind);
        state.lastDecision = id;
        state.inIf = false;
        state.expectBranch = 'yes';
        decision = true;
      } else if (state.expectBranch === 'yes') {
        id = placeNode(label, state, false, role, kind);
        state.edges.push({ from: state.lastDecision!, to: id, label: 'Yes' });
        state.expectBranch = null;
        labelledBranch = true;
        branch = 'yes';
      } else if (state.expectBranch === 'no') {
        id = placeNode(label, state, false, role, kind);
        state.edges.push({ from: state.lastDecision!, to: id, label: 'No' });
        state.expectBranch = null;
        labelledBranch = true;
        branch = 'no';
      } else {
        id = placeNode(label, state, false, role, kind);
      }

      if (state.last && state.last !== id && !labelledBranch) {
        state.edges.push({ from: state.last, to: id });
      }
      state.last = id;
      lastOnLine = id;
      remember(active, {
        kind: loopMissTarget
          ? 'loop'
          : decision
            ? 'decision'
            : kind === 'data'
              ? 'data'
              : kind === 'document'
                ? 'document'
                : 'step',
        label,
        role,
        branch,
        loopTarget: loopMissTarget ?? undefined,
        loopFound: loopMissTarget ? false : undefined,
      });
      loopMissTarget = null;
    }
    if (pendingThen && active) active.emptyThen = true;
    if (note && lastOnLine) {
      const owner = state.nodes.find(n => n.id === lastOnLine);
      if (owner) owner.note = note;
      const last = active?.steps[active.steps.length - 1];
      if (last) last.note = note;
    }
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (understood) {
      active = {
        lineIndex: sourceLineIndexes[lineIndex] ?? lineIndex,
        steps: [],
        emptyThen: false,
        parallel: false,
      };
      understood.push(active);
    } else {
      active = null;
    }
    const unmarked = stripListMarker(lines[lineIndex]);
    const phrase = hasParallelPhrase(unmarked);
    // Same-line if/else, or the still-open condition of an `If` with no text
    // yet: leave the phrase in the label and tell Build.
    const blocked = phrase && (/\b(?:if|else)\b/i.test(unmarked) || state.inIf);
    if (blocked) state.parallelHints += 1;
    if (!blocked && phrase) {
      const parts = splitParallelParts(unmarked);
      if (parts) {
        const { head, chain } = splitTrailingChain(parts[parts.length - 1]);
        const branches = [...parts.slice(0, -1), head].map(part => part.trim()).filter(part => part.length > 0);
        if (branches.length >= 2) {
          const needJoin = chain.length > 0 || lineIndex < lines.length - 1;
          emitParallel(branches, state, needJoin, active);
          if (chain) processPlainLine(chain);
          continue;
        }
      }
    }
    processPlainLine(unmarked);
  }

  if (state.nodes.length === 0) {
    throw new Error(
      'No steps found. Type one step per line, e.g. "Check email", "then Send reply", "If error then Retry".'
    );
  }
  if (opts.loopMisses) opts.loopMisses.count = state.loopMisses;
  if (opts.parallelHints) opts.parallelHints.count = state.parallelHints;

  // Deduplicate identical edges (same from/to/label), keeping first-seen order.
  const seen = new Set<string>();
  const edges = state.edges.filter(e => {
    const key = `${e.from}|${e.to}|${e.label ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const out: string[] = [];
  out.push('diagram: flow', `title: ${quote(opts.title?.trim() || 'Type steps')}`, 'direction: TB', '');

  for (const e of edges) {
    out.push(e.label ? `${e.from} ->|${quote(e.label)}| ${e.to}` : `${e.from} -> ${e.to}`);
  }
  if (edges.length) out.push('');

  for (const n of state.nodes) {
    const body = [`label: ${quote(n.label)}`];
    if (n.decision) body.push('type: decision');
    else if (n.gateway) body.push(`type: ${n.gateway}`);
    else if (n.kind) body.push(`type: ${n.kind}`);
    if (n.role) body.push(`role: ${n.role}`);
    if (n.note) body.push(`note: ${quote(n.note)}`);
    out.push(`node ${n.id} {`, ...body.map(l => `  ${l}`), '}', '');
  }

  if (opts.lanesByRole) {
    const buckets = new Map<RoleLaneKey, string[]>();
    for (const node of state.nodes) {
      const key = laneKeyForEmitted(node);
      const ids = buckets.get(key);
      if (ids) ids.push(node.id);
      else buckets.set(key, [node.id]);
    }
    for (const lane of ROLE_LANES) {
      const ids = buckets.get(lane.key);
      if (!ids || ids.length === 0) continue;
      out.push(laneHeader(lane.name), `  contains: ${ids.join(', ')}`, '}', '');
    }
  }

  return out.join('\n');
}
