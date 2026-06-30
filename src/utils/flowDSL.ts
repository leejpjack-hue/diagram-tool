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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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