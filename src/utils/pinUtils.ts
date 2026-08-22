// Persist canvas drag/resize back into the DSL (the source of truth) by
// writing `at: x, y` on nodes and `at:`/`size:` on group blocks. The renderer
// then honours those pins on every parse, so manual placement survives reload
// and is captured in the exported diagram.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AT_RE = /(\n?[ \t]*)at:[ \t]*[^\n]*/;
const SIZE_RE = /(\n?[ \t]*)size:[ \t]*[^\n]*/;

function upsert(body: string, re: RegExp, line: string): string {
  return re.test(body) ? body.replace(re, `$1${line}`) : `\n  ${line}${body}`;
}

/**
 * Write `at: x, y` into a node's block. Works for architecture nodes
 * (service/database/queue/cloud/class) and flow `node` blocks. If the node has
 * no block yet (e.g. a flow node referenced only in connections), one is
 * appended.
 */
export function setNodePin(dsl: string, name: string, x: number, y: number): string {
  const X = Math.round(x);
  const Y = Math.round(y);
  const n = escapeRegex(name);
  const blockRe = new RegExp(
    `((?:service|database|queue|cloud|class|node)\\s+"?${n}"?\\s*\\{)([^}]*)(\\})`,
  );
  const m = dsl.match(blockRe);
  if (m) {
    const body = upsert(m[2], AT_RE, `at: ${X}, ${Y}`);
    return dsl.replace(blockRe, `${m[1]}${body}${m[3]}`);
  }
  // No block — append one (flow nodes can be connection-only).
  return `${dsl.replace(/\s+$/, '')}\n\nnode ${name} {\n  at: ${X}, ${Y}\n}\n`;
}

/**
 * Mermaid flowcharts keep their Mermaid source, so positions are stored as
 * `%% at <id> <x> <y>` comments that the transpiler reads (writing a native
 * `node {}` block would be ignored on re-parse). Upserts the comment line.
 */
export function setMermaidNodePin(dsl: string, id: string, x: number, y: number): string {
  const X = Math.round(x);
  const Y = Math.round(y);
  const re = new RegExp(`^%%[ \\t]*at[ \\t]+${escapeRegex(id)}[ \\t]+-?\\d+[ \\t]+-?\\d+[ \\t]*$`, 'm');
  const line = `%% at ${id} ${X} ${Y}`;
  return re.test(dsl) ? dsl.replace(re, line) : `${dsl.replace(/\s+$/, '')}\n${line}\n`;
}

/**
 * Write canvas positions back into DSL. Architecture pins every graph node so
 * a drag cannot leave unpinned siblings to be auto-laid out on the next parse.
 * Flow only writes the supplied ids (native `at:` or Mermaid `%% at`).
 */
export function applyCanvasPins(
  dsl: string,
  nodes: ReadonlyArray<{ id: string; name: string; type: string }>,
  positions: Map<string, { x: number; y: number }>,
  options?: {
    mode?: 'architecture' | 'flow';
    mermaidFlow?: boolean;
    group?: { name: string; x: number; y: number; w: number; h: number };
  },
): string {
  let next = dsl;
  if (options?.group) {
    const group = options.group;
    next = setGroupPin(next, group.name, group.x, group.y, group.w, group.h);
  }

  if (options?.mode !== 'flow') {
    for (const meta of nodes) {
      if (meta.type === 'annotation') continue;
      const position = positions.get(meta.id);
      if (!position) continue;
      next = setNodePin(next, meta.name, position.x, position.y);
    }
    return next;
  }

  for (const [id, position] of positions) {
    const meta = nodes.find(node => node.id === id);
    if (!meta || meta.type === 'annotation') continue;
    next = options?.mermaidFlow
      ? setMermaidNodePin(next, meta.name, position.x, position.y)
      : setNodePin(next, meta.name, position.x, position.y);
  }
  return next;
}

/** Write `at:` and `size:` into a `group` block. */
export function setGroupPin(
  dsl: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const n = escapeRegex(name);
  const blockRe = new RegExp(`(group\\s+"?${n}"?\\s*\\{)([^}]*)(\\})`);
  const m = dsl.match(blockRe);
  if (!m) return dsl;
  let body = upsert(m[2], AT_RE, `at: ${Math.round(x)}, ${Math.round(y)}`);
  body = upsert(body, SIZE_RE, `size: ${Math.round(w)}, ${Math.round(h)}`);
  return dsl.replace(blockRe, `${m[1]}${body}${m[3]}`);
}
