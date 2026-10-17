import {
  plainStepsToDSL,
  splitStepNote,
  stripListMarker,
  type PlainStepRole,
  type UnderstoodLine,
} from './plainSteps';

// DT-AI-28 — row model for the "Understood as" preview.
// One row per non-empty typed line. Labels, roles, notes, loops, and parallel
// branches come from the same plainStepsToDSL trace Build uses. Warnings are
// read-only hints and never change that trace.

export type PreviewKind = 'step' | 'decision' | 'data' | 'loop' | 'parallel';

export interface TypeStepsPreviewRow {
  /** 0-based index in the textarea, counting empty lines. */
  lineIndex: number;
  lineNumber: number;
  roles: PlainStepRole[];
  kind: PreviewKind;
  kindTag: string;
  label: string;
  note?: string;
  /** Gentle hint. Absent when the line reads cleanly. */
  warning?: string;
}

const ROLE_SUGGESTIONS = ['human', 'model', 'tool', 'check', 'user', 'assistant', 'ai', 'system'] as const;

const ROLE_DISPLAY: Record<(typeof ROLE_SUGGESTIONS)[number], string> = {
  human: 'Human',
  model: 'Model',
  tool: 'Tool',
  check: 'Check',
  user: 'User',
  assistant: 'Assistant',
  ai: 'AI',
  system: 'System',
};

/** Exact role and data words. A typo warning never fires for these. */
const KNOWN_PREFIX = /^(assistant|human|model|tool|check|system|user|ai|memory|data|file|db)$/i;

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Closest known role word within edit distance 1–2.
 * Distance 2 only applies when both words are at least 4 letters, so a short
 * alias such as "AI" does not claim ordinary words like "Ask".
 */
export function suggestRoleWord(token: string): string | null {
  const word = token.toLowerCase();
  if (KNOWN_PREFIX.test(word)) return null;
  let best: { name: (typeof ROLE_SUGGESTIONS)[number]; dist: number } | null = null;
  for (const name of ROLE_SUGGESTIONS) {
    const dist = levenshtein(word, name);
    if (dist < 1 || dist > 2) continue;
    if (dist === 2 && (word.length < 4 || name.length < 4)) continue;
    if (!best || dist < best.dist) best = { name, dist };
  }
  return best ? ROLE_DISPLAY[best.name] : null;
}

function roleTypoWarning(line: string): string | undefined {
  const { text } = splitStepNote(stripListMarker(line.trim()));
  const re = /(?:^|\b(?:then|else)\s+)([A-Za-z]+)(?=\s*:|\s+\S)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const suggestion = suggestRoleWord(match[1]);
    if (suggestion) return `Did you mean ${suggestion}:?`;
  }
  return undefined;
}

function toRow(line: UnderstoodLine, source: string): TypeStepsPreviewRow {
  const warnings: string[] = [];
  const typo = roleTypoWarning(source);
  if (typo) warnings.push(typo);

  const misses = line.steps.filter(step => step.kind === 'loop' && step.loopFound === false && step.loopTarget);
  if (misses.length === 1) warnings.push(`go back to target not found: ${misses[0].loopTarget}`);
  else if (misses.length > 1) {
    warnings.push(`go back to targets not found: ${misses.map(step => step.loopTarget).join(', ')}`);
  }
  if (line.emptyThen) warnings.push('Empty branch after then');

  const roles: PlainStepRole[] = [];
  for (const step of line.steps) {
    if (step.role && !roles.includes(step.role)) roles.push(step.role);
  }

  const notes = line.steps.map(step => step.note).filter((note): note is string => Boolean(note));
  let kind: PreviewKind = 'step';
  let kindTag = 'step';
  if (line.parallel) {
    kind = 'parallel';
    kindTag = 'parallel';
  } else if (line.steps.some(step => step.kind === 'decision' || step.branch)) {
    kind = 'decision';
    kindTag = 'decision Yes/No';
  } else if (line.steps.some(step => step.kind === 'loop')) {
    kind = 'loop';
    const target = line.steps.find(step => step.kind === 'loop')?.loopTarget ?? '';
    kindTag = `loop → ${target}`;
  } else if (line.steps.length > 0 && line.steps.every(step => step.kind === 'data' || step.kind === 'document')) {
    kind = 'data';
    kindTag = 'data';
  }

  const labels = line.steps.map(step => step.label).filter(label => label.length > 0);
  return {
    lineIndex: line.lineIndex,
    lineNumber: line.lineIndex + 1,
    roles,
    kind,
    kindTag,
    label: labels.length > 0 ? labels.join(' · ') : source.trim(),
    note: notes.length > 0 ? notes.join(' · ') : undefined,
    warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
  };
}

/** One preview row per non-empty line, from the Build converter. */
export function typeStepsPreviewRows(text: string): TypeStepsPreviewRow[] {
  const understood: UnderstoodLine[] = [];
  try {
    plainStepsToDSL(text, { understood });
  } catch {
    // Empty or connector-only input still leaves a trace of the lines read.
  }
  if (understood.length === 0) return [];
  const raw = text.split('\n');
  return understood.map(line => toRow(line, raw[line.lineIndex] ?? ''));
}

/** Polite summary for the live region. Counts lines, not keystrokes. */
export function typeStepsPreviewSummary(rows: readonly TypeStepsPreviewRow[]): string {
  const steps = rows.length;
  const warnings = rows.reduce((count, row) => count + (row.warning ? 1 : 0), 0);
  const stepWord = steps === 1 ? 'step' : 'steps';
  const warningWord = warnings === 1 ? 'warning' : 'warnings';
  return `${steps} ${stepWord}, ${warnings} ${warningWord}`;
}

/** Character range of one textarea line, so a warning click can select it. */
export function stepLineRange(text: string, lineIndex: number): { start: number; end: number } {
  const lines = text.split('\n');
  const capped = Math.max(0, Math.min(lineIndex, Math.max(lines.length - 1, 0)));
  let start = 0;
  for (let i = 0; i < capped; i++) start += lines[i].length + 1;
  return { start, end: start + (lines[capped]?.length ?? 0) };
}
