import { describe, expect, it } from 'vitest';
import { parseGanttSource } from '../components/Gantt/ganttParser';
import { ganttRoleTint, ROLE_CHIP_PALETTE } from '../components/Canvas/rolePalette';
import {
  plainGanttToDSL,
  plainTasksFromBoardSource,
  retainTypeTasksBlock,
  typeTasksPreviewRows,
  type PlainGanttLine,
} from './plainGantt';

const EXAMPLE = [
  'Phase: Build',
  'Collect data — 3d — Human: Jack',
  'Train model — 5d after Collect data — AI agent',
  'Review — 2d after Train model — Human: May',
  'Go live — milestone after Review',
].join('\n');

function iso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function built(text: string, understood?: PlainGanttLine[], start = '2026-03-01') {
  const dsl = plainGanttToDSL(text, { understood, start, title: 'Plan' });
  const parsed = parseGanttSource(dsl);
  expect(parsed.error, parsed.error ?? '').toBeNull();
  return { dsl, parsed, project: parsed.project! };
}

function task(text: string, name: string) {
  const { project } = built(text);
  const found = project.tasks.find(item => item.name === name);
  expect(found, name).toBeTruthy();
  return { project, task: found! };
}

describe('plainGanttToDSL', () => {
  it('turns the example into a group, bars, a milestone, and finish-to-start links', () => {
    const understood: PlainGanttLine[] = [];
    const { dsl, project } = built(EXAMPLE, understood);
    expect(dsl).toMatch(/^# @type-tasks/m);
    expect(dsl).toContain('diagram: gantt');
    expect(dsl).toContain('duration: 3d');
    expect(dsl).toContain('duration: 5d');
    expect(dsl).toContain('duration: 2d');
    expect(dsl).toContain('after: Collect data');
    expect(dsl).toContain('after: Train model');
    expect(dsl).toContain('after: Review');
    expect(dsl).toContain('milestone: true');
    expect(dsl).toContain('assignee: Jack');
    expect(dsl).toContain('assignee: AI agent');
    expect(dsl).toContain('assignee: May');
    expect(dsl).toContain('custom: role=human');
    expect(dsl).toContain('custom: role=ai');
    expect(dsl).toContain('group "Build"');

    const names = project.tasks.map(item => item.name);
    expect(names).toEqual(['Build', 'Collect data', 'Train model', 'Review', 'Go live']);
    const group = project.tasks.find(item => item.name === 'Build')!;
    expect(group.isGroup).toBe(true);
    expect(group.children).toHaveLength(4);

    const collect = project.tasks.find(item => item.name === 'Collect data')!;
    const train = project.tasks.find(item => item.name === 'Train model')!;
    const review = project.tasks.find(item => item.name === 'Review')!;
    const live = project.tasks.find(item => item.name === 'Go live')!;
    expect(iso(collect.startDate)).toBe('2026-03-01');
    expect(iso(collect.endDate)).toBe('2026-03-04');
    expect(iso(train.startDate)).toBe('2026-03-05');
    expect(iso(train.endDate)).toBe('2026-03-10');
    expect(iso(review.startDate)).toBe('2026-03-11');
    expect(iso(review.endDate)).toBe('2026-03-13');
    expect(live.milestone).toBe(true);
    expect(iso(live.startDate)).toBe('2026-03-13');
    expect(collect.customFields?.role).toBe('human');
    expect(train.customFields?.role).toBe('ai');
    expect(train.assignee).toBe('AI agent');
    expect(review.assignee).toBe('May');
    expect(project.dependencies).toHaveLength(3);
    expect(understood.map(line => line.summary)).toEqual([
      'group Build',
      'Collect data · 3 days · Human: Jack',
      'Train model · 5 days · after Collect data · AI agent',
      'Review · 2 days · after Train model · Human: May',
      'Go live · milestone · after Review',
    ]);
    expect(understood.every(line => !line.warning)).toBe(true);
    expect(plainTasksFromBoardSource(dsl)).toBe(EXAMPLE);
  });

  it('reads every token', () => {
    const weeks = task('Write up — 2w', 'Write up');
    expect(weeks.task.sourceSchedule?.durationDays).toBe(14);
    expect(weeks.task.sourceSchedule?.durationUnit).toBe('w');

    const words = task('Write up — 3 days', 'Write up');
    expect(words.task.sourceSchedule?.durationDays).toBe(3);
    expect(words.task.sourceSchedule?.durationUnit).toBe('d');

    const one = task('Write up — 1 day', 'Write up');
    expect(one.task.sourceSchedule?.durationDays).toBe(1);

    const weekWord = task('Write up — 1 week', 'Write up');
    expect(weekWord.task.sourceSchedule?.durationUnit).toBe('w');
    expect(weekWord.task.sourceSchedule?.durationDays).toBe(7);

    const both = task('Ship — 4d after Alpha and Beta\nAlpha — 1d\nBeta — 2d', 'Ship');
    expect(both.task.sourceSchedule?.after).toEqual(['Alpha', 'Beta']);
    expect(both.project.dependencies.filter(dep => dep.successorId === both.task.id)).toHaveLength(2);

    const started = task('Kickoff — 2d — starts 2026-11-02', 'Kickoff');
    expect(iso(started.task.startDate)).toBe('2026-11-02');
    expect(iso(started.task.endDate)).toBe('2026-11-04');
    expect(started.task.sourceSchedule?.explicitStart).toBe(true);

    const progress = task('Kickoff — 3d — 50% done', 'Kickoff');
    expect(progress.task.progress).toBe(50);

    const aiColon = task('Draft — 1d — AI: Ada', 'Draft');
    expect(aiColon.task.assignee).toBe('Ada');
    expect(aiColon.task.customFields?.role).toBe('ai');

    const aiBare = task('Draft — 1d — AI:', 'Draft');
    expect(aiBare.task.assignee).toBe('AI');
    expect(aiBare.task.customFields?.role).toBe('ai');

    const toolNamed = task('Crawl — 1d — Tool: Search', 'Crawl');
    expect(toolNamed.task.assignee).toBe('Search');
    expect(toolNamed.task.customFields?.role).toBe('tool');

    const toolBare = task('Crawl — 1d — Tool:', 'Crawl');
    expect(toolBare.task.assignee).toBe('Tool');
    expect(toolBare.task.customFields?.role).toBe('tool');
  });

  it('accepts em dash, spaced hyphen, and comma separators', () => {
    const em = task('Collect data — 3d — Human: Jack', 'Collect data');
    const hyphen = task('Collect data - 3d - Human: Jack', 'Collect data');
    const comma = task('Collect data, 3d, Human: Jack', 'Collect data');
    for (const sample of [em, hyphen, comma]) {
      expect(sample.task.assignee).toBe('Jack');
      expect(sample.task.customFields?.role).toBe('human');
      expect(sample.task.sourceSchedule?.durationDays).toBe(3);
    }
  });

  it('starts a group from Phase: or ##', () => {
    const { project } = built('## Ship\nLaunch — 1d — Human: Jo');
    const group = project.tasks.find(item => item.name === 'Ship')!;
    expect(group.isGroup).toBe(true);
    expect(project.tasks.find(item => item.name === 'Launch')?.parentId).toBe(group.id);
  });

  it('tints roles from the Flow role-chip palette', () => {
    expect(ganttRoleTint('ai')).toBe(ROLE_CHIP_PALETTE.model.text);
    expect(ganttRoleTint('human')).toBe(ROLE_CHIP_PALETTE.human.text);
    expect(ganttRoleTint('tool')).toBe(ROLE_CHIP_PALETTE.tool.text);
    expect(ganttRoleTint('check')).toBeUndefined();
    expect(ganttRoleTint('ai')).toBe('#6d28d9');
  });

  it('flags a missing length, an unknown after name, and a line that is not a task', () => {
    const understood: PlainGanttLine[] = [];
    const { dsl, project } = built(
      'Only a name — Human: Jo\nLater — 1d after Train modell\nthis is not a task\nReal — 1d',
      understood,
    );
    expect(understood.find(line => line.summary.startsWith('Only a name'))?.warning).toMatch(/Missing length/);
    expect(understood.find(line => line.summary.startsWith('Later'))?.warning).toMatch(/Unknown task "Train modell"/);
    expect(understood.find(line => line.summary === 'this is not a task')?.warning).toMatch(/wasn't understood/);
    expect(project.tasks.map(item => item.name)).toEqual(['Only a name', 'Later', 'Real']);
    expect(dsl).not.toContain('task this is not a task');
    expect(typeTasksPreviewRows('Later — 1d after Train modell\nReal — 1d')[0].warning).toMatch(/Train modell/);
  });

  it('round-trips the typed lines, including a brace inside a comment', () => {
    const text = 'Collect data — 3d — note {keep}\nTrain — 2d';
    const dsl = plainGanttToDSL(text, { start: '2026-03-01' });
    expect(plainTasksFromBoardSource(dsl)).toBe(text);
    expect(parseGanttSource(dsl).error).toBeNull();
    expect(plainTasksFromBoardSource('diagram: gantt\ntitle: Hand\ntask A {\n  duration: 1d\n}\n')).toBeNull();
  });

  it('keeps the typed-lines block when the chart DSL is rewritten', () => {
    const dsl = plainGanttToDSL(EXAMPLE, { start: '2026-03-01' });
    const rewritten = retainTypeTasksBlock(dsl, 'diagram: gantt\ntitle: Plan\n');
    expect(plainTasksFromBoardSource(rewritten)).toBe(EXAMPLE);
    expect(retainTypeTasksBlock('diagram: gantt\ntitle: Hand\n', 'diagram: gantt\ntitle: Hand\n')).toBe('diagram: gantt\ntitle: Hand\n');
  });

  it('refuses input with no tasks', () => {
    expect(() => plainGanttToDSL('')).toThrow(/No tasks found/);
    expect(() => plainGanttToDSL('Phase: Build\n## Later')).toThrow(/No tasks found/);
    expect(typeTasksPreviewRows('not a task')[0].warning).toMatch(/wasn't understood/);
  });
});
