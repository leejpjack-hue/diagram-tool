// Mermaid flowchart support.
//
// Rather than teach the hand-written lexer/parser a second grammar, we detect
// Mermaid `flowchart` / `graph` syntax and transpile it into the app's native
// flow DSL, which the existing parser + renderer already understand. This
// keeps one rendering pipeline (shapes, swimlanes, edges, export).
//
// Supported Mermaid features:
//   flowchart TD | graph LR (direction TD/TB/BT → TB, LR/RL → LR)
//   node shapes: A[rect] A(round) A([stadium]) A[[subroutine]] A[(db)]
//                A((circle)) A{decision} A{{hexagon}} A[/para/] A[\para\] A>flag]
//   links: --> --- -.-> ==> --o --x  with labels via -->|text| or -- text -->
//   chains: A --> B --> C   and fan-out: A --> B & C
//   subgraph Title ... end  → swimlane lane
//   %% comments

export function isMermaidFlow(text: string): boolean {
  // First non-blank, non-comment line begins with flowchart/graph.
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    return /^(flowchart|graph)\b/i.test(line);
  }
  return false;
}

type Shape =
  | 'process' | 'decision' | 'terminator' | 'data'
  | 'manualinput' | 'document' | 'subprocesscollapsed' | 'gatewayexclusive';

// Shape wrappers, longest opener first so e.g. `([` wins over `(`.
const SHAPES: { open: string; close: string; kind: Shape }[] = [
  { open: '([', close: '])', kind: 'terminator' },
  { open: '[[', close: ']]', kind: 'subprocesscollapsed' },
  { open: '[(', close: ')]', kind: 'data' },
  { open: '((', close: '))', kind: 'terminator' },
  { open: '{{', close: '}}', kind: 'gatewayexclusive' },
  { open: '[/', close: ']', kind: 'data' },   // [/para/] or [/trap\]
  { open: '[\\', close: ']', kind: 'data' },  // [\para\]
  { open: '>', close: ']', kind: 'document' },
  { open: '[', close: ']', kind: 'process' },
  { open: '(', close: ')', kind: 'process' },
  { open: '{', close: '}', kind: 'decision' },
];

interface NodeDef { id: string; text?: string; shape?: Shape; }

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function quote(s: string): string {
  return `"${s.replace(/"/g, "'")}"`;
}

const ID_RE = /^[A-Za-z0-9_]+/;

// Read a node (id plus optional shape wrapper) at position i. Returns the node
// and the index just past it, or null if no id is present.
function readNode(s: string, i: number): { node: NodeDef; end: number } | null {
  const slice = s.slice(i);
  const m = ID_RE.exec(slice);
  if (!m) return null;
  const id = m[0];
  const pos = i + id.length;

  for (const sh of SHAPES) {
    if (s.startsWith(sh.open, pos)) {
      const closeAt = s.indexOf(sh.close, pos + sh.open.length);
      if (closeAt !== -1) {
        let inner = s.slice(pos + sh.open.length, closeAt);
        // Trim a stray slash/backslash left from para/trapezoid forms.
        inner = inner.replace(/^[/\\]/, '').replace(/[/\\]$/, '');
        return { node: { id, text: stripQuotes(inner) || id, shape: sh.kind }, end: closeAt + sh.close.length };
      }
    }
  }
  return { node: { id }, end: pos };
}

// Match a link operator (with optional pipe label) at position i.
// Returns the label (if any), whether it's a no-arrow line, and the end index.
const PIPE_LINK_RE = /^\s*(<?[-.=]{1,}[-.=]*[->ox]?>?|-{2,3}|={2,3}|-\.->|-\.-)\s*(?:\|([^|]*)\|)?\s*/;

function readLink(s: string, i: number): { label?: string; end: number } | null {
  // Inline-label form first: `-- text -->`, `== text ==>`, `-. text .->`
  const inline = /^\s*(--|==|-\.)\s+([^|]+?)\s+(-{2,3}>?|={2,3}>?|\.-?->?)\s*/.exec(s.slice(i));
  if (inline) {
    return { label: inline[2].trim(), end: i + inline[0].length };
  }
  const m = PIPE_LINK_RE.exec(s.slice(i));
  if (!m || m[0].trim() === '') return null;
  return { label: m[2]?.trim() || undefined, end: i + m[0].length };
}

interface Edge { from: string; to: string; label?: string; }

export function mermaidFlowToDSL(text: string): string {
  const lines = text.split('\n');
  let direction: 'TB' | 'LR' = 'TB';
  let title = 'Flowchart';

  const nodes = new Map<string, NodeDef>();
  const edges: Edge[] = [];
  const lanes: { name: string; ids: string[] }[] = [];
  const laneStack: { name: string; ids: string[] }[] = [];

  const recordNode = (n: NodeDef) => {
    const existing = nodes.get(n.id);
    if (!existing) {
      nodes.set(n.id, n);
    } else {
      if (n.text) existing.text = n.text;
      if (n.shape) existing.shape = n.shape;
    }
    if (laneStack.length) {
      const lane = laneStack[laneStack.length - 1];
      if (!lane.ids.includes(n.id)) lane.ids.push(n.id);
    }
  };

  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    // Strip trailing comments / whole-line comments.
    const cm = line.indexOf('%%');
    if (cm !== -1) line = line.slice(0, cm).trim();
    if (!line) continue;

    // Header: flowchart / graph + direction
    const header = /^(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)?/i.exec(line);
    if (header) {
      const d = (header[1] || 'TB').toUpperCase();
      direction = d === 'LR' || d === 'RL' ? 'LR' : 'TB';
      continue;
    }
    // Optional title (non-standard but convenient): `title: X` or `%% title X`
    const tt = /^title\s*:?\s+(.+)$/i.exec(line);
    if (tt) { title = stripQuotes(tt[1]); continue; }

    // Subgraph open: `subgraph Title` or `subgraph id [Title]`
    const sg = /^subgraph\s+(.+)$/i.exec(line);
    if (sg) {
      let name = sg[1].trim();
      const withTitle = /\[(.+?)\]\s*$/.exec(name);
      if (withTitle) name = withTitle[1];
      name = stripQuotes(name);
      const lane = { name, ids: [] as string[] };
      lanes.push(lane);
      laneStack.push(lane);
      continue;
    }
    if (/^end\b/i.test(line)) { laneStack.pop(); continue; }
    if (/^(direction|classDef|class|style|linkStyle|click)\b/i.test(line)) continue;

    // Statement: a chain of nodes joined by links, possibly with `&` fan-out.
    let i = 0;
    let prevGroup: NodeDef[] | null = null;
    let pendingLabel: string | undefined;
    let sawAny = false;

    while (i < line.length) {
      // Read a node group (one or more nodes separated by `&`).
      const group: NodeDef[] = [];
      for (;;) {
        while (line[i] === ' ') i++;
        const r = readNode(line, i);
        if (!r) break;
        group.push(r.node);
        recordNode(r.node);
        i = r.end;
        while (line[i] === ' ') i++;
        if (line[i] === '&') { i++; continue; }
        break;
      }
      if (group.length === 0) break;
      sawAny = true;

      if (prevGroup) {
        for (const a of prevGroup) {
          for (const b of group) {
            edges.push({ from: a.id, to: b.id, label: pendingLabel });
          }
        }
      }
      pendingLabel = undefined;
      prevGroup = group;

      while (line[i] === ' ') i++;
      if (i >= line.length) break;
      const link = readLink(line, i);
      if (!link) break;
      pendingLabel = link.label;
      i = link.end;
    }
    if (!sawAny) continue;
  }

  // Emit native flow DSL.
  const SHAPE_TO_TYPE: Record<Shape, string | undefined> = {
    process: undefined, // default rectangle
    decision: 'decision',
    terminator: 'terminator',
    data: 'data',
    manualinput: 'manualinput',
    document: 'document',
    subprocesscollapsed: 'subprocesscollapsed',
    gatewayexclusive: 'gatewayexclusive',
  };

  const out: string[] = [];
  out.push('diagram: flow', `title: ${title}`, `direction: ${direction}`, '');

  for (const e of edges) {
    out.push(e.label ? `${e.from} ->|${quote(e.label)}| ${e.to}` : `${e.from} -> ${e.to}`);
  }
  if (edges.length) out.push('');

  for (const n of nodes.values()) {
    const type = n.shape ? SHAPE_TO_TYPE[n.shape] : undefined;
    const label = n.text && n.text !== n.id ? n.text : undefined;
    if (!type && !label) continue; // nothing to declare; bare id is fine
    const body: string[] = [];
    if (label) body.push(`  label: ${quote(label)}`);
    if (type) body.push(`  type: ${type}`);
    out.push(`node ${n.id} {`, ...body, '}', '');
  }

  for (const lane of lanes) {
    if (lane.ids.length === 0) continue;
    const safe = lane.name.replace(/[^A-Za-z0-9]/g, '') || 'Lane';
    out.push(`lane ${safe} {`, `  contains: ${lane.ids.join(', ')}`, '}', '');
  }

  return out.join('\n');
}
