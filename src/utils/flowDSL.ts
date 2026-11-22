// Canvas relabel writes the words on the shape into `label:` and leaves the
// step id alone. Arrows keep using that id, so a phrase such as "Human ask"
// round-trips without becoming a second identifier.

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatFlowLabel(label: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) return label;
  return `"${label.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function setFlowNodeLabel(dsl: string, nodeName: string, label: string): string {
  const line = `label: ${formatFlowLabel(label)}`;
  const n = escapeRegex(nodeName);
  const blockRe = new RegExp(`(node\\s+(?:"${n}"|${n})\\s*\\{)([^}]*)(\\})`);
  const match = dsl.match(blockRe);
  if (match) {
    const [, header, body, closer] = match;
    const labelRe = /^([ \t]*)label:[ \t]*[^\n]*/m;
    const nextBody = labelRe.test(body)
      ? body.replace(labelRe, indent => `${indent.match(/^[ \t]*/)?.[0] ?? ''}${line}`)
      : `\n  ${line}${body}`;
    const next = dsl.replace(blockRe, () => `${header}${nextBody}${closer}`);
    return next === dsl ? dsl : next;
  }

  const headerName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(nodeName)
    ? nodeName
    : `"${nodeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return `${dsl.replace(/\s+$/, '')}\n\nnode ${headerName} {\n  ${line}\n}\n`;
}

// Toggle the `reverse:` flag on a flow node in the DSL text.
// Returns the updated DSL, or null if the node can't be found or has no
// metadata block (i.e. was declared only via a `start X` / `end X` line or
// a bare connection).
//
// Strategy:
//   1. If the node has an explicit `node X { ... }` metadata block, add or
//      replace `reverse: true|false` inside it.
//   2. Otherwise, append a minimal `node X { reverse: true }` block before
//      the closing newline so the parser will pick it up on re-parse.
//
// This is the source-of-truth update that the canvas double-click handler
// calls before re-parsing the diagram.

export function setReverseDSL(dsl: string, nodeName: string, reversed: boolean): string | null {
  const blockPattern = new RegExp(
    `((?:node|service)\\s+${escapeRegex(nodeName)}\\s*\\{)([^}]*)(\\})`,
  );
  const match = dsl.match(blockPattern);

  if (match) {
    const [, header, body, closer] = match;
    const reversePattern = /(\n(\s*)reverse:\s*)([^\n]*)/;
    const reverseMatch = body.match(reversePattern);

    let newBody: string;
    if (reverseMatch) {
      // Replace existing value
      newBody = body.replace(reversePattern, `$1${reversed ? 'true' : 'false'}`);
    } else {
      // Insert as the first property line inside the block
      newBody = `\n  reverse: ${reversed ? 'true' : 'false'}${body}`;
    }
    return dsl.replace(blockPattern, `${header}${newBody}${closer}`);
  }

  // No metadata block — append one at the end so the parser will read it
  // next time around.
  return `${dsl.replace(/\s+$/, '')}\n\nnode ${nodeName} {\n  reverse: ${reversed ? 'true' : 'false'}\n}\n`;
}

// Toggle the `reverse:` flag for a node declared in Mermaid flowchart syntax.
// Mermaid has no native reverse concept, so we use a side-channel `%% reverse <id>`
// comment that the Mermaid→native transpiler picks up and carries into the
// generated `node X { reverse: true }` block.
//
//   reversed: true  → add `%% reverse <id>` (or leave an existing one)
//   reversed: false → remove any existing `%% reverse <id>` line
//
// Returns the updated DSL, or null if the input isn't Mermaid.
export function setReverseMermaidDSL(dsl: string, nodeName: string, reversed: boolean): string | null {
  if (!/^\s*(?:flowchart|graph)\b/im.test(dsl)) return null;

  const lines = dsl.split('\n');
  const targetLine = `%% reverse ${nodeName}`;
  const hasExisting = lines.some(l => new RegExp(`^%%\\s*reverse\\s+${escapeRegex(nodeName)}\\s*$`, 'i').test(l));

  if (reversed && !hasExisting) {
    // Insert the comment near the top (right after the flowchart header) so
    // it stays grouped with the rest of the metadata comments.
    const insertAt = lines.findIndex(l => /^\s*(?:flowchart|graph)\b/i.test(l));
    const idx = insertAt >= 0 ? insertAt + 1 : 0;
    lines.splice(idx, 0, targetLine);
    return lines.join('\n');
  }
  if (!reversed && hasExisting) {
    const filtered = lines.filter(l => !new RegExp(`^%%\\s*reverse\\s+${escapeRegex(nodeName)}\\s*$`, 'i').test(l));
    return filtered.join('\n');
  }
  // No-op (already in the desired state) — return the original text so the
  // caller can still re-parse to refresh the canvas.
  return dsl;
}