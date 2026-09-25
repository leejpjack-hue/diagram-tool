// DT-AI-08 (#37): role prefix insertion for the Type steps textarea.
//
// Pure string-in/string-out so the editor component stays thin and the
// behavior is unit-testable without a DOM. No parser changes: this only
// writes text that plainSteps.ts already understands (DT-AI-04 vocab:
// Human / Model / Tool / Check, colon form with optional space).
//
// Behavior:
// - Selection present → PREFIX the selection: the role prefix is inserted
//   exactly at the selection start, and the original selection stays
//   selected, shifted past the inserted prefix.
// - No selection → insert at the caret's line start, after leading whitespace.
// - Never double-prefix: if the target line already starts with a
//   Human/Model/Tool/Check role word (colon or bare form, case-insensitive —
//   same rule as plainSteps.ts), the text is returned unchanged.

export type RolePrefixRole = 'Human' | 'Model' | 'Tool' | 'Check';

export interface RolePrefixEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Same role-word rule as DT-AI-04 stripRolePrefix (colon or bare token). */
const ROLE_LINE_PREFIX = /^(human|model|tool|check)(?:\s*:\s*|\s+)/i;

function lineContentStart(text: string, pos: number): number {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const leading = /^\s*/.exec(text.slice(lineStart))![0].length;
  return lineStart + leading;
}

export function insertRolePrefix(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  role: RolePrefixRole,
): RolePrefixEdit {
  const prefix = `${role}: `;
  const at = Math.min(Math.max(selectionStart, 0), text.length);
  const selEnd = Math.min(Math.max(selectionEnd, at), text.length);

  const isSelection = selEnd > at;
  const insertAt = isSelection ? at : lineContentStart(text, at);
  const lineStart = text.lastIndexOf('\n', insertAt - 1) + 1;
  if (ROLE_LINE_PREFIX.test(text.slice(lineStart))) {
    return { text, selectionStart: at, selectionEnd: selEnd };
  }

  const nextText = text.slice(0, insertAt) + prefix + text.slice(insertAt);
  return {
    text: nextText,
    selectionStart: at + prefix.length,
    selectionEnd: selEnd + prefix.length,
  };
}
