// In-place edits for Mermaid sequenceDiagram text — the canvas calls these
// when the user renames a participant, rewrites a message label, or toggles
// a message between solid and dashed directly on the diagram. The text stays
// the source of truth; the canvas re-parses after each edit.

import { MESSAGE_RE, messageLineIndices } from './sequenceParser';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rename a participant's display name. Updates the `participant X as Name`
 * (or `actor`) declaration; if the participant was only implicit (declared by
 * appearing in a message), a declaration line is inserted after the
 * `sequenceDiagram` header so the alias takes effect.
 */
export function renameParticipant(text: string, id: string, newName: string): string {
  const name = newName.trim();
  if (!name) return text;

  const lines = text.split('\n');
  const declRe = new RegExp(`^(\\s*)(participant|actor)\\s+${escapeRegex(id)}(\\s+as\\s+.+)?\\s*$`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(declRe);
    if (m) {
      lines[i] = `${m[1]}${m[2]} ${id} as ${name}`;
      return lines.join('\n');
    }
  }

  // No declaration — insert one after the sequenceDiagram header (or at top).
  const headerIdx = lines.findIndex(l => /^\s*sequenceDiagram\b/i.test(l));
  lines.splice(headerIdx + 1, 0, `participant ${id} as ${name}`);
  return lines.join('\n');
}

/** Replace the text of the nth message (0-based, document order). */
export function editMessageText(text: string, msgIndex: number, newText: string): string {
  const idx = messageLineIndices(text)[msgIndex];
  if (idx === undefined) return text;

  const lines = text.split('\n');
  const raw = lines[idx];
  const indent = raw.match(/^\s*/)?.[0] ?? '';
  const m = raw.trim().match(MESSAGE_RE);
  if (!m) return text;

  lines[idx] = `${indent}${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}: ${newText.trim()}`;
  return lines.join('\n');
}

/** Toggle the nth message between solid (`-`) and dashed (`--`) line style. */
export function toggleMessageDashed(text: string, msgIndex: number): string {
  const idx = messageLineIndices(text)[msgIndex];
  if (idx === undefined) return text;

  const lines = text.split('\n');
  const raw = lines[idx];
  const indent = raw.match(/^\s*/)?.[0] ?? '';
  const m = raw.trim().match(MESSAGE_RE);
  if (!m) return text;

  const dashes = m[2] === '--' ? '-' : '--';
  lines[idx] = `${indent}${m[1]}${dashes}${m[3]}${m[4]}${m[5]}: ${m[6]}`;
  return lines.join('\n');
}
