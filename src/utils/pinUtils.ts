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
