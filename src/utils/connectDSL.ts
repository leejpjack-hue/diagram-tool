// Drag-to-connect support: the canvas mutates the DSL text (the source of
// truth) when the user drags an edge between two nodes, then re-parses.

import type { ConnectionSide } from '../store/types';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface FlowEdgeAttachment {
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
}

function flowAttachmentSuffix(attachment?: FlowEdgeAttachment): string {
  if (!attachment?.sourceSide || !attachment?.targetSide) return '';
  return ` { from: ${attachment.sourceSide}, to: ${attachment.targetSide} }`;
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
  attachment?: FlowEdgeAttachment,
): string | null {
  if (mode === 'flow') {
    // Flow edges are standalone `A -> B` lines; the parser accepts them
    // anywhere in the document. Optional `{ from, to }` records a manual side.
    const edgePattern = new RegExp(
      `^\\s*${escapeRegex(sourceName)}\\s*->\\s*(\\|[^|]*\\|\\s*)?${escapeRegex(targetName)}(?:\\s*\\{[^}]*\\})?\\s*$`,
      'm',
    );
    if (edgePattern.test(dsl)) return null;
    return `${dsl.replace(/\s+$/, '')}\n\n${sourceName} -> ${targetName}${flowAttachmentSuffix(attachment)}\n`;
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

/**
 * Rewrite one Flow arrow line (`A -> B` or `A ->|label| B`) so a reconnect
 * can change its ends and remember the handles the user dropped on.
 * Returns null when that pair is not its own line (for example a chain).
 */
export function updateFlowEdgeDSL(
  dsl: string,
  fromName: string,
  toName: string,
  next: { fromName?: string; toName?: string } & FlowEdgeAttachment,
): string | null {
  const line = new RegExp(
    `^([ \\t]*)${escapeRegex(fromName)}[ \\t]*->[ \\t]*(\\|[^|\\n]*\\|[ \\t]*)?${escapeRegex(toName)}(?:[ \\t]*\\{[^}\\n]*\\})?[ \\t]*$`,
    'm',
  );
  const match = dsl.match(line);
  if (!match) return null;
  const indent = match[1] ?? '';
  const label = match[2] ?? '';
  const from = next.fromName ?? fromName;
  const to = next.toName ?? toName;
  const arrow = label ? `->${label}` : '-> ';
  const replacement = `${indent}${from} ${arrow}${to}${flowAttachmentSuffix(next)}`;
  return dsl.replace(line, () => replacement);
}
