// Drag-to-connect support: the canvas mutates the DSL text (the source of
// truth) when the user drags an edge between two nodes, then re-parses.

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Add a connection from sourceName to targetName in the DSL text.
 * Returns the updated DSL, or null if the connection already exists
 * or the source block can't be found.
 */
export function addConnectionDSL(
  dsl: string,
  mode: 'architecture' | 'flow',
  sourceName: string,
  targetName: string,
): string | null {
  if (mode === 'flow') {
    // Flow edges are standalone `A -> B` lines; the parser accepts them
    // anywhere in the document.
    const edgePattern = new RegExp(
      `^\\s*${escapeRegex(sourceName)}\\s*->\\s*(\\|[^|]*\\|\\s*)?${escapeRegex(targetName)}\\s*$`,
      'm',
    );
    if (edgePattern.test(dsl)) return null;
    return `${dsl.replace(/\s+$/, '')}\n\n${sourceName} -> ${targetName}\n`;
  }

  // Architecture: append to the source block's `connects:` list (or add one).
  const blockPattern = new RegExp(
    `((?:service|database|queue|cloud|class)\\s+${escapeRegex(sourceName)}\\s*\\{)([^}]*)(\\})`,
  );
  const match = dsl.match(blockPattern);
  if (!match) return null;

  const [, header, body, closer] = match;
  const connectsPattern = /(\n(\s*)connects:\s*)([^\n]*)/;
  const connectsMatch = body.match(connectsPattern);

  let newBody: string;
  if (connectsMatch) {
    const existing = connectsMatch[3].split(',').map(s => s.trim());
    if (existing.includes(targetName)) return null;
    newBody = body.replace(connectsPattern, `$1$3, ${targetName}`);
  } else {
    // Insert as the first property line inside the block
    newBody = `\n  connects: ${targetName}${body}`;
  }

  return dsl.replace(blockPattern, `${header}${newBody}${closer}`);
}
