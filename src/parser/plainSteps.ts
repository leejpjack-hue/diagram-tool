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
// `then` links steps in order; `if <text>` makes `<text>` a decision node whose
// following branch is labelled Yes; `else ...` reuses that decision for a No
// branch. Anything else is a plain step, exactly like today.

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

const ROLE_PREFIX =
  /^(human|model|tool|check)(?:\s*:\s*|\s+)(.+)$/i;

/**
 * Strip an optional leading role word from a step label.
 * Colon form: `Human:` / `Model:` / … (optional space after colon).
 * Bare form: `Human ` / `Model ` / … followed by the rest of the step.
 * Unknown prefixes are left intact.
 */
export function stripRolePrefix(raw: string): { role?: PlainStepRole; label: string } {
  const m = ROLE_PREFIX.exec(raw);
  if (!m) return { label: raw };
  const role = m[1].toLowerCase() as PlainStepRole;
  const label = m[2].trim();
  if (!label) return { label: raw }; // bare "Human:" with nothing after → keep as label
  return { role, label };
}

interface EmittedNode { id: string; label: string; decision: boolean; role?: PlainStepRole; }

interface State {
  nodes: EmittedNode[];
  edges: { from: string; to: string; label?: string }[];
  idFor: Map<string, string>;
  counts: Map<string, number>;
  last: string | null;
  lastDecision: string | null;
  expectBranch: 'yes' | 'no' | null;
  inIf: boolean;
}

function stepId(label: string, state: State): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'step';
  const n = (state.counts.get(base) ?? 0) + 1;
  state.counts.set(base, n);
  return n === 1 ? base : `${base}_${n}`;
}

function useNode(label: string, state: State, decision: boolean, role?: PlainStepRole): string {
  const existing = state.idFor.get(label);
  if (existing) return existing;
  const id = stepId(label, state);
  state.idFor.set(label, id);
  state.nodes.push({ id, label, decision, role });
  return id;
}

export function plainStepsToDSL(text: string, opts: { title?: string } = {}): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const state: State = {
    nodes: [],
    edges: [],
    idFor: new Map(),
    counts: new Map(),
    last: null,
    lastDecision: null,
    expectBranch: null,
    inIf: false,
  };

  for (const line of lines) {
    for (const seg of splitSegments(line)) {
      if (seg.kind === 'op') {
        if (seg.op === 'if') state.inIf = true;
        else if (seg.op === 'else' && state.lastDecision) state.expectBranch = 'no';
        // `then` needs no state: the next step simply chains from `last`.
        continue;
      }
      const rawLabel = (seg.text ?? '').replace(/\|/g, '/').trim();
      if (!rawLabel) continue;
      const { role, label } = stripRolePrefix(rawLabel);
      if (!label) continue;

      let id: string;
      let labelledBranch = false;
      if (state.inIf) {
        // The text after `if` IS the condition → decision node.
        id = useNode(label, state, true, role);
        state.lastDecision = id;
        state.inIf = false;
        state.expectBranch = 'yes';
      } else if (state.expectBranch === 'yes') {
        id = useNode(label, state, false, role);
        state.edges.push({ from: state.lastDecision!, to: id, label: 'Yes' });
        state.expectBranch = null;
        labelledBranch = true;
      } else if (state.expectBranch === 'no') {
        id = useNode(label, state, false, role);
        state.edges.push({ from: state.lastDecision!, to: id, label: 'No' });
        state.expectBranch = null;
        labelledBranch = true;
      } else {
        id = useNode(label, state, false, role);
      }

      if (state.last && state.last !== id && !labelledBranch) {
        state.edges.push({ from: state.last, to: id });
      }
      state.last = id;
    }
  }

  if (state.nodes.length === 0) {
    throw new Error(
      'No steps found. Type one step per line, e.g. "Check email", "then Send reply", "If error then Retry".'
    );
  }

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
    if (n.role) body.push(`role: ${n.role}`);
    out.push(`node ${n.id} {`, ...body.map(l => `  ${l}`), '}', '');
  }

  return out.join('\n');
}
