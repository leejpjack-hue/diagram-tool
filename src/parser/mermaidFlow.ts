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

const UNSUPPORTED_MERMAID = /^(erDiagram|classDiagram|mindmap|stateDiagram(?:-v2)?|pie|gitGraph|journey|quadrantChart|timeline|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban|requirementDiagram|zenuml|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|(?!sequenceDiagram\b)[A-Za-z][A-Za-z0-9]*Diagram|(?!flowchart\b)[A-Za-z][A-Za-z0-9]*Chart)\b/i;

function firstSignificantLineWithNumber(text: string): { line: string; lineNumber: number } {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('%%') || line.startsWith('#')) continue;
    return { line, lineNumber: i + 1 };
  }
  return { line: '', lineNumber: 1 };
}

export function firstSignificantLine(text: string): string {
  return firstSignificantLineWithNumber(text).line;
}

/** Recognizable Mermaid that this app does not import or apply. Names the kind, line, and likely fix. */
export function unsupportedMermaidOpenError(text: string): string | null {
  const { line, lineNumber } = firstSignificantLineWithNumber(text);
  const kind = line.match(UNSUPPORTED_MERMAID)?.[1];
  if (!kind) return null;
  if (/^c4/i.test(kind)) {
    return `Mermaid ${kind} isn't supported yet. Line ${lineNumber} starts with "${kind}"; for C4, use native diagram: architecture with level: and parent:, or use flowchart TD, sequenceDiagram, or gantt.`;
  }
  return `Mermaid ${kind} isn't supported yet. Line ${lineNumber} starts with "${kind}"; use flowchart TD, sequenceDiagram, or gantt, or native diagram: flow / diagram: architecture.`;
}

export function isMermaidFlow(text: string): boolean {
  // First non-blank, non-comment line begins with flowchart/graph.
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('%%')) continue;
    return /^(flowchart|graph)\b/i.test(line);
  }
  return false;
}

export function isMermaidSequence(text: string): boolean {
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('%%') || line.startsWith('#')) continue;
    return /^sequenceDiagram\b/i.test(line);
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
function readNode(s: string, i: number, lineNo: number): { node: NodeDef; end: number } | null {
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
        const trimmedInner = inner.trim();
        const isQuoted =
          (trimmedInner.startsWith('"') && trimmedInner.endsWith('"')) ||
          (trimmedInner.startsWith("'") && trimmedInner.endsWith("'"));
        if (!isQuoted && (/-->/.test(inner) || inner.includes(sh.open))) {
          throw new Error(
            `Unclosed Mermaid node shape "${id}${sh.open}..." at line ${lineNo}. Close it with "${sh.close}" before the next arrow or node (for example, ${id}${sh.open}Label${sh.close} --> Next).`,
          );
        }
        // Trim a stray slash/backslash left from para/trapezoid forms.
        inner = inner.replace(/^[/\\]/, '').replace(/[/\\]$/, '');
        return { node: { id, text: stripQuotes(inner) || id, shape: sh.kind }, end: closeAt + sh.close.length };
      }
      throw new Error(
        `Unclosed Mermaid node shape "${id}${sh.open}..." at line ${lineNo}. Close it with "${sh.close}" (for example, ${id}${sh.open}Label${sh.close}).`,
      );
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
  const laneStack: { name: string; ids: string[]; line: number }[] = [];
  // Position pins carried in `%% at <id> <x> <y>` comments — written when the
  // user drags a node on a Mermaid-format flowchart so placement persists.
  const posPins: Record<string, { x: number; y: number }> = {};

  // Reversed-input flags carried in `%% reverse <id>` comments — written when
  // the user double-clicks a flow node on a Mermaid-format flowchart so the
  // toggle survives the Mermaid→native transpilation round-trip.
  const reverses = new Set<string>();

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

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNo = lineIdx + 1;
    let line = lines[lineIdx].trim().replace(/^\uFEFF/, '');
    if (!line) continue;
    // Position pin comment: `%% at <id> <x> <y>` (intercept before the
    // generic comment strip below).
    const posM = /^%%\s*at\s+(\S+)\s+(-?\d+)\s+(-?\d+)\s*$/i.exec(line);
    if (posM) {
      posPins[posM[1]] = { x: Number(posM[2]), y: Number(posM[3]) };
      continue;
    }
    // Reverse flag comment: `%% reverse <id>` (presence = flipped).
    const revM = /^%%\s*reverse\s+(\S+)\s*$/i.exec(line);
    if (revM) {
      reverses.add(revM[1]);
      continue;
    }
    // Strip trailing comments / whole-line comments.
    const cm = line.indexOf('%%');
    if (cm !== -1) line = line.slice(0, cm).trim();
    if (!line) continue;

    // Header: flowchart / graph + direction
    const header = /^(?:flowchart|graph)(?:\s+(TB|TD|BT|RL|LR))?\s*;?\s*$/i.exec(line);
    if (header) {
      const d = (header[1] || 'TB').toUpperCase();
      direction = d === 'LR' || d === 'RL' ? 'LR' : 'TB';
      continue;
    }
    if (/^(?:flowchart|graph)\b/i.test(line)) {
      throw new Error(
        `Invalid Mermaid flowchart header "${line}" at line ${lineNo}. Use "flowchart TD" or "flowchart LR".`,
      );
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
      const lane = { name, ids: [] as string[], line: lineNo };
      lanes.push(lane);
      laneStack.push(lane);
      continue;
    }
    if (/^subgraph\b/i.test(line)) {
      throw new Error(
        `Missing subgraph title at line ${lineNo} ("${line}"). Use "subgraph LaneName" and close with "end".`,
      );
    }
    if (/^end\b/i.test(line)) {
      if (laneStack.length === 0) {
        throw new Error(
          `Unexpected "end" at line ${lineNo} with no open subgraph. Remove "end" or add "subgraph Title" above it.`,
        );
      }
      laneStack.pop();
      continue;
    }
    if (/^(direction|classDef|class|style|linkStyle|click)\b/i.test(line)) continue;

    // Strip optional trailing semicolons before statement parsing.
    line = line.replace(/;+\s*$/, '').trim();
    if (!line) continue;

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
        const r = readNode(line, i, lineNo);
        if (!r) break;
        group.push(r.node);
        recordNode(r.node);
        i = r.end;
        while (line[i] === ' ') i++;
        if (line[i] === '&') {
          i++;
          while (line[i] === ' ') i++;
          if (i >= line.length || !ID_RE.test(line.slice(i))) {
            throw new Error(
              `Missing target node after "&" at line ${lineNo} ("${line}"). Add a node ID after "&" (for example, A --> B & C).`,
            );
          }
          continue;
        }
        break;
      }
      if (group.length === 0) {
        if (prevGroup !== null) {
          throw new Error(
            `Missing target node after arrow at line ${lineNo} ("${line}"). Add a target node after the arrow (for example, ${prevGroup[0].id} --> NextStep).`,
          );
        }
        break;
      }
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
      if (!link) {
        const rest = line.slice(i).trim();
        throw new Error(
          `Unexpected "${rest}" in Mermaid flowchart at line ${lineNo} ("${line}"). Connect nodes with "-->" (for example, ${group[0].id}[Start] --> Next[End]).`,
        );
      }
      const afterLink = line.slice(link.end).trimStart();
      if (afterLink.startsWith('|')) {
        throw new Error(
          `Unclosed edge label at line ${lineNo} ("${line}"). Close the label with "|" before the target node (for example, ${group[0].id} -->|Yes| NextStep).`,
        );
      }
      if (!afterLink) {
        throw new Error(
          `Missing target node after arrow at line ${lineNo} ("${line}"). Add a target node after the arrow (for example, ${group[0].id} --> NextStep).`,
        );
      }
      pendingLabel = link.label;
      i = link.end;
    }
    if (!sawAny) {
      if (/^(?:<?[-.=]+|-->|---)/.test(line)) {
        throw new Error(
          `Missing source node before arrow at line ${lineNo} ("${line}"). Start the connection with a node ID (for example, A --> B).`,
        );
      }
      throw new Error(
        `Invalid Mermaid flowchart syntax at line ${lineNo} ("${line}"). Write nodes and arrows like A[Start] --> B[End].`,
      );
    }
  }

  if (laneStack.length > 0) {
    const openLane = laneStack[laneStack.length - 1];
    throw new Error(
      `Unclosed Mermaid subgraph "${openLane.name}" from line ${openLane.line}. Add "end" to close the subgraph.`,
    );
  }

  if (nodes.size === 0 && edges.length === 0) {
    throw new Error(
      'Mermaid flowchart has no nodes or connections. Add a step or arrow like A[Start] --> B[End].',
    );
  }

  const inEdge = new Set<string>();
  for (const e of edges) {
    inEdge.add(e.from);
    inEdge.add(e.to);
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
    const standalone = !inEdge.has(n.id);
    const label = (n.text && n.text !== n.id) ? n.text : (standalone ? (n.text || n.id) : undefined);
    const pin = posPins[n.id];
    const reversed = reverses.has(n.id);
    if (!type && !label && !pin && !reversed) continue; // nothing to declare; bare id is fine
    const body: string[] = [];
    if (label) body.push(`  label: ${quote(label)}`);
    if (type) body.push(`  type: ${type}`);
    if (pin) body.push(`  at: ${pin.x}, ${pin.y}`);
    if (reversed) body.push('  reverse: true');
    out.push(`node ${n.id} {`, ...body, '}', '');
  }

  for (const lane of lanes) {
    if (lane.ids.length === 0) continue;
    const safe = lane.name.replace(/[^A-Za-z0-9]/g, '') || 'Lane';
    out.push(`lane ${safe} {`, `  contains: ${lane.ids.join(', ')}`, '}', '');
  }

  return out.join('\n');
}
