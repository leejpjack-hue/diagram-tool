// Mermaid `gantt` → native `diagram: gantt` for File → Open.
// The live Gantt editor stays native-DSL-only; this is import-only.

export function isMermaidGantt(text: string): boolean {
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\uFEFF/, '');
    if (!line || line.startsWith('%%')) continue;
    return /^gantt\b/i.test(line);
  }
  return false;
}

const META = /^(title|dateFormat|axisFormat|excludes|tickInterval|todayMarker)\b/i;
const TAGS = new Set(['done', 'active', 'crit', 'milestone']);

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function quoteName(name: string): string {
  return /[\s{}"]/.test(name) ? `"${name.replace(/"/g, "'")}"` : name;
}

export function mermaidGanttToDSL(text: string): string {
  let title = '';
  let section: string | undefined;
  let lastEnd: string | undefined;
  let autoId = 1;
  const resolved = new Map<string, { start: string; end: string }>();
  const tasks: Array<{ section?: string; name: string; start: string; end: string; milestone: boolean }> = [];

  let started = false;
  for (const raw of text.replace(/^\uFEFF/, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (!started) {
      if (/^gantt\b/i.test(line)) started = true;
      continue;
    }
    const titleMatch = line.match(/^title\s*:?\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    if (META.test(line) && !line.includes(':')) continue;
    const sectionMatch = line.match(/^section\s+(.+)$/i);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const taskMatch = line.match(/^(.+?)\s*:\s*(.*)$/);
    if (!taskMatch) continue;
    const name = taskMatch[1].trim();
    if (!name || META.test(name) || /^section\b/i.test(name)) continue;

    let id: string | undefined;
    let start: string | undefined;
    let end: string | undefined;
    let after: string | undefined;
    let durationDays: number | undefined;
    let milestone = false;

    for (const part of taskMatch[2].split(',').map(item => item.trim()).filter(Boolean)) {
      if (TAGS.has(part.toLowerCase())) {
        if (part.toLowerCase() === 'milestone') milestone = true;
        continue;
      }
      const afterMatch = part.match(/^after\s+(\S+)$/i);
      if (afterMatch) {
        after = afterMatch[1];
        continue;
      }
      const duration = part.match(/^(\d+)(?:d|ms)?$/i);
      if (duration && /d$/i.test(part)) {
        durationDays = Number(duration[1]);
        continue;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
        if (!start) start = part;
        else end = part;
        continue;
      }
      if (/^[A-Za-z][\w-]*$/.test(part) && !id) id = part;
    }

    if (after) {
      const pred = resolved.get(after);
      if (pred) start = pred.end;
    }
    if (!start) start = lastEnd ?? '2026-01-01';
    if (!end) {
      if (durationDays != null) end = addDays(start, Math.max(durationDays - 1, 0));
      else end = start;
    }

    const key = id ?? `t${autoId++}`;
    resolved.set(key, { start, end });
    lastEnd = end;
    tasks.push({ section, name, start, end, milestone });
  }

  if (tasks.length === 0) {
    throw new Error("That file couldn't be opened.");
  }

  const lines = ['diagram: gantt'];
  if (title) lines.push(`title: ${title}`);
  lines.push('');

  let currentSection: string | undefined;
  const closeSection = () => {
    if (currentSection != null) lines.push('}');
    currentSection = undefined;
  };

  for (const task of tasks) {
    if (task.section !== currentSection) {
      closeSection();
      if (task.section) {
        lines.push(`group ${quoteName(task.section)} {`);
        currentSection = task.section;
      }
    }
    const indent = task.section ? '  ' : '';
    lines.push(`${indent}task ${quoteName(task.name)} {`);
    lines.push(`${indent}  start: ${task.start}`);
    lines.push(`${indent}  end: ${task.end}`);
    if (task.milestone) lines.push(`${indent}  milestone: true`);
    lines.push(`${indent}}`);
  }
  closeSection();
  return lines.join('\n');
}
