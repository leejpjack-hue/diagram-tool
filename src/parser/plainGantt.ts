import { stripListMarker } from './plainSteps';

// DT-GANTT-02 — "Type tasks".
//
// Deterministic local conversion of one line per task into native
// `diagram: gantt` DSL. The Gantt parser (ganttParser.ts) still builds the
// chart, using the DT-GANTT-01 `duration:` / `after:` keys. No second
// engine, no network, no model.
//
// Separators are `—`, `–`, ` - `, or `,`:
//   Collect data — 3d — Human: Jack
//   Train model — 5d after Collect data — AI agent
//   Go live — milestone after Review
// Length: `3d`, `2w`, `3 days`. Waits for: `after X` or `after X and Y`.
// `milestone`. Owner: `Human: Name`, `AI agent`, `AI:`, `Tool:` → assignee
// plus `custom: role=ai|human|tool`. `Phase: X` or `## X` starts a group.
// `50% done` → progress. `starts 2026-11-02` → start.
//
// The generated source starts with a `# @type-tasks` comment block holding
// the typed lines, so opening Type tasks can refill the box. That comment
// is ordinary DSL commentary — not a board field. Hand-written Gantt DSL
// has no marker, so the box stays empty and the source is left alone.

const SOURCE_START = '# @type-tasks';
const SOURCE_END = '# @type-tasks-end';

const PHASE = /^(?:phase\s*:\s*|##\s+)(.*)$/i;
const DURATION = /^(\d+)\s*(d|w|days?|weeks?)$/i;
const PROGRESS = /^(\d{1,3})\s*%(?:\s*done)?$/i;
const STARTS = /^starts?\s*:?\s*(\d{4}-\d{2}-\d{2})$/i;
const AFTER_ONLY = /^after\s+(.+)$/i;
const COMBINED_AFTER = /^(.*?)\s+after\s+(.+)$/i;
const HUMAN = /^human\s*:\s*(.*)$/i;
const AI_COLON = /^ai\s*:\s*(.*)$/i;
const TOOL_COLON = /^tool\s*:\s*(.*)$/i;
const AI_AGENT = /^ai\s+agent$/i;

const MISSING_LENGTH = 'Missing length. Use 3d, 2w, or 3 days.';
const NOT_UNDERSTOOD = 'This line wasn\'t understood. Use "Collect data — 3d — Human: Jack".';

export type GanttTaskRole = 'ai' | 'human' | 'tool';

export interface PlainGanttLine {
  /** 0-based index in the original text, counting empty lines. */
  lineIndex: number;
  summary: string;
  /** Set when the line is missing a length, names an unknown task, or was not a task. */
  warning?: string;
}

interface Owner {
  role: GanttTaskRole;
  assignee: string;
  label: string;
}

interface DurationToken {
  /** DSL token, `3d` or `2w`. */
  dsl: string;
  label: string;
}

interface TaskDraft {
  lineIndex: number;
  name: string;
  duration?: DurationToken;
  after: string[];
  milestone: boolean;
  owner?: Owner;
  progress?: number;
  start?: string;
  warnings: string[];
}

interface GroupDraft {
  name: string;
  tasks: TaskDraft[];
}

interface RowDraft {
  lineIndex: number;
  summary: string;
  warnings: string[];
  /** After names to check once every task name is known. */
  after?: string[];
}

function cleanTitle(title?: string): string {
  const raw = (title ?? '').trim().replace(/^["']|["']$/g, '').trim();
  return raw || 'Type tasks';
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`;
}

function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function splitSegments(line: string): string[] {
  if (/[—–]/.test(line)) {
    return line.split(/\s*[—–]\s*/).map(part => part.trim()).filter(Boolean);
  }
  if (/\s-\s/.test(line)) {
    return line.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  }
  if (line.includes(',')) {
    return line.split(',').map(part => part.trim()).filter(Boolean);
  }
  return [line.trim()].filter(Boolean);
}

function parseAfterNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(/\s+and\s+|,\s*/i)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function parseDuration(token: string): DurationToken | null {
  const match = DURATION.exec(token.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const word = match[2].toLowerCase();
  const unit = word.startsWith('w') ? 'w' : 'd';
  const labelWord = unit === 'w'
    ? (amount === 1 ? 'week' : 'weeks')
    : (amount === 1 ? 'day' : 'days');
  return { dsl: `${amount}${unit}`, label: `${amount} ${labelWord}` };
}

function parseOwner(segment: string): Owner | null {
  const human = HUMAN.exec(segment);
  if (human) {
    const name = human[1].trim();
    return { role: 'human', assignee: name || 'Human', label: name ? `Human: ${name}` : 'Human' };
  }
  const ai = AI_COLON.exec(segment);
  if (ai) {
    const name = ai[1].trim();
    return { role: 'ai', assignee: name || 'AI', label: name ? `AI: ${name}` : 'AI' };
  }
  const tool = TOOL_COLON.exec(segment);
  if (tool) {
    const name = tool[1].trim();
    return { role: 'tool', assignee: name || 'Tool', label: name ? `Tool: ${name}` : 'Tool' };
  }
  if (AI_AGENT.test(segment)) {
    return { role: 'ai', assignee: 'AI agent', label: 'AI agent' };
  }
  return null;
}

function taskSummary(task: TaskDraft): string {
  const parts = [task.name];
  if (task.milestone) parts.push('milestone');
  else if (task.duration) parts.push(task.duration.label);
  if (task.after.length > 0) parts.push(`after ${task.after.join(' and ')}`);
  if (task.progress != null) parts.push(`${task.progress}% done`);
  if (task.start) parts.push(`starts ${task.start}`);
  if (task.owner) parts.push(task.owner.label);
  return parts.join(' · ');
}

function safeTaskName(name: string): string {
  return name.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function emitTask(task: TaskDraft, indent: string): string[] {
  const lines = [`${indent}task ${safeTaskName(task.name)} {`];
  if (task.start) lines.push(`${indent}  start: ${task.start}`);
  if (task.duration) lines.push(`${indent}  duration: ${task.duration.dsl}`);
  if (task.owner) lines.push(`${indent}  assignee: ${task.owner.assignee}`);
  if (task.progress != null) lines.push(`${indent}  progress: ${task.progress}`);
  if (task.after.length > 0) lines.push(`${indent}  after: ${task.after.join(', ')}`);
  if (task.milestone) lines.push(`${indent}  milestone: true`);
  if (task.owner) lines.push(`${indent}  custom: role=${task.owner.role}`);
  lines.push(`${indent}}`, '');
  return lines;
}

/**
 * Typed lines stashed in a board that Type tasks built.
 * Hand-written Gantt DSL returns null — the caller leaves the box empty
 * and does not touch the source.
 */
export function plainTasksFromBoardSource(dsl: string): string | null {
  const lines = dsl.split('\n');
  const start = lines.findIndex(line => line.trim() === SOURCE_START);
  if (start < 0) return null;
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === SOURCE_END) return out.join('\n');
    if (!line.startsWith('# ')) return null;
    out.push(line.slice(2));
  }
  return null;
}

/** Keep the typed-lines comment when a later canvas edit rewrites the DSL. */
export function retainTypeTasksBlock(previousSource: string, generated: string): string {
  if (generated.includes(SOURCE_START)) return generated;
  const lines = previousSource.split('\n');
  const start = lines.findIndex(line => line.trim() === SOURCE_START);
  if (start < 0) return generated;
  const end = lines.findIndex((line, index) => index > start && line.trim() === SOURCE_END);
  if (end < 0) return generated;
  return `${lines.slice(start, end + 1).join('\n')}\n${generated}`;
}

export function typeTasksSuccessMessage(tasks: number, groups: number): string {
  const taskWord = tasks === 1 ? 'task' : 'tasks';
  if (groups === 0) return `${tasks} ${taskWord}`;
  const groupWord = groups === 1 ? 'group' : 'groups';
  return `${tasks} ${taskWord}, ${groups} ${groupWord}`;
}

export interface TypeTasksPreviewRow {
  lineIndex: number;
  lineNumber: number;
  summary: string;
  warning?: string;
}

/** One preview row per non-empty line, from the same converter Build uses. */
export function typeTasksPreviewRows(text: string): TypeTasksPreviewRow[] {
  const understood: PlainGanttLine[] = [];
  try {
    plainGanttToDSL(text, { understood });
  } catch {
    // Empty input still leaves a trace of the lines that were read.
  }
  return understood.map(line => ({
    lineIndex: line.lineIndex,
    lineNumber: line.lineIndex + 1,
    summary: line.summary,
    warning: line.warning,
  }));
}

export function plainGanttToDSL(
  text: string,
  opts: {
    title?: string;
    /** Project start `YYYY-MM-DD`. Defaults to the earliest task start, or today. */
    start?: string;
    understood?: PlainGanttLine[];
    stats?: { tasks: number; groups: number; milestones: number };
  } = {},
): string {
  const understood = opts.understood;
  if (understood) understood.length = 0;

  const rows: RowDraft[] = [];
  const groups: GroupDraft[] = [];
  const loose: TaskDraft[] = [];
  let current: GroupDraft | null = null;
  const tasks: TaskDraft[] = [];

  const rawLines = text.split('\n');
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const trimmed = rawLines[lineIndex].trim();
    if (!trimmed) continue;
    const unmarked = stripListMarker(trimmed).trim();
    if (!unmarked) continue;

    const phase = PHASE.exec(unmarked);
    if (phase && !/[—–]/.test(unmarked) && !/\s-\s/.test(unmarked)) {
      const name = phase[1].trim();
      if (!name) {
        rows.push({
          lineIndex,
          summary: unmarked,
          warnings: ['This line wasn\'t understood. Use Phase: Build or ## Build.'],
        });
        continue;
      }
      current = { name, tasks: [] };
      groups.push(current);
      rows.push({ lineIndex, summary: `group ${name}`, warnings: [] });
      continue;
    }

    const segments = splitSegments(unmarked);
    const name = segments[0] ?? '';
    const task: TaskDraft = {
      lineIndex,
      name,
      after: [],
      milestone: false,
      warnings: [],
    };
    let recognized = false;

    for (const segment of segments.slice(1)) {
      const owner = parseOwner(segment);
      if (owner) {
        task.owner = owner;
        recognized = true;
        continue;
      }

      const progress = PROGRESS.exec(segment);
      if (progress) {
        task.progress = Math.min(100, parseInt(progress[1], 10));
        recognized = true;
        continue;
      }

      const starts = STARTS.exec(segment);
      if (starts && isIsoDate(starts[1])) {
        task.start = starts[1];
        recognized = true;
        continue;
      }

      const afterOnly = AFTER_ONLY.exec(segment);
      if (afterOnly) {
        task.after.push(...parseAfterNames(afterOnly[1]));
        recognized = true;
        continue;
      }

      const combined = COMBINED_AFTER.exec(segment);
      if (combined) {
        const left = combined[1].trim();
        const duration = parseDuration(left);
        if (duration) {
          task.duration = duration;
          task.after.push(...parseAfterNames(combined[2]));
          recognized = true;
          continue;
        }
        if (/^milestone$/i.test(left)) {
          task.milestone = true;
          task.after.push(...parseAfterNames(combined[2]));
          recognized = true;
          continue;
        }
      }

      const duration = parseDuration(segment);
      if (duration) {
        task.duration = duration;
        recognized = true;
        continue;
      }

      if (/^milestone$/i.test(segment)) {
        task.milestone = true;
        recognized = true;
        continue;
      }

      task.warnings.push(`This line wasn't understood: ${segment}.`);
    }

    if (!recognized || !safeTaskName(name)) {
      rows.push({ lineIndex, summary: unmarked, warnings: [NOT_UNDERSTOOD] });
      continue;
    }

    task.after = parseAfterNames(task.after.join(' and '));
    const self = task.name.toLowerCase();
    if (task.after.some(item => item.toLowerCase() === self)) {
      task.warnings.push('A task can\'t wait for itself.');
      task.after = task.after.filter(item => item.toLowerCase() !== self);
    }
    if (!task.duration && !task.milestone) task.warnings.push(MISSING_LENGTH);

    tasks.push(task);
    if (current) current.tasks.push(task);
    else loose.push(task);
    rows.push({
      lineIndex,
      summary: taskSummary(task),
      warnings: task.warnings,
      after: task.after,
    });
  }

  const known = new Set(tasks.map(task => task.name.toLowerCase()));
  for (const row of rows) {
    if (!row.after) continue;
    for (const name of row.after) {
      if (!known.has(name.toLowerCase())) row.warnings.push(`Unknown task "${name}".`);
    }
  }

  if (understood) {
    for (const row of rows) {
      understood.push({
        lineIndex: row.lineIndex,
        summary: row.summary,
        warning: row.warnings.length > 0 ? row.warnings.join(' ') : undefined,
      });
    }
  }

  const milestones = tasks.filter(task => task.milestone).length;
  if (opts.stats) {
    opts.stats.tasks = tasks.length;
    opts.stats.groups = groups.filter(group => group.tasks.length > 0).length;
    opts.stats.milestones = milestones;
  }

  if (tasks.length === 0) {
    throw new Error('No tasks found. Type one task per line, e.g. "Collect data — 3d — Human: Jack".');
  }

  const explicitStarts = tasks.map(task => task.start).filter((start): start is string => Boolean(start));
  const projectStart = (opts.start && isIsoDate(opts.start))
    ? opts.start
    : (explicitStarts.sort()[0] ?? todayISO());

  const out: string[] = [SOURCE_START];
  for (const line of text.trim().split('\n')) out.push(`# ${line}`);
  out.push(SOURCE_END, 'diagram: gantt', `title: ${cleanTitle(opts.title)}`, `start: ${projectStart}`, '');

  for (const task of loose) out.push(...emitTask(task, ''));
  for (const group of groups) {
    if (group.tasks.length === 0) continue;
    out.push(`group ${quote(group.name)} {`);
    for (const task of group.tasks) out.push(...emitTask(task, '  '));
    out.push('}', '');
  }

  return out.join('\n');
}
