import { describe, expect, it } from 'vitest';
import { applyTemplate, softwareDevelopmentTemplate } from '../../data/ganttTemplates';
import { mermaidGanttToDSL } from '../../parser/mermaidGantt';
import { TEMPLATES } from '../TemplatePicker/templates';
import { csvToDSL } from '../../utils/csvToDiagram';
import { generateGanttDSL, reconcileBarEdit } from './ganttGenerator';
import { parseGanttDSL, parseGanttSource } from './ganttParser';

function iso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskByName(text: string, name: string) {
  const result = parseGanttSource(text);
  expect(result.error).toBeNull();
  const task = result.project?.tasks.find(item => item.name === name);
  expect(task).toBeTruthy();
  return { result, task: task! };
}

const SAMPLE = `diagram: gantt
title: Source Sync
start: 2026-03-01

task Planning {
  start: 2026-03-01
  end: 2026-03-05
  progress: 40
  color: #3b82f6
}

task Build {
  start: 2026-03-06
  end: 2026-03-12
  depends: Planning
  progress: 0
  color: #10b981
}`;

describe('parseGanttSource', () => {
  it('parses tasks, dates, dependencies, and progress', () => {
    const result = parseGanttSource(SAMPLE);
    expect(result.error).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.project?.tasks.map(task => task.name)).toEqual(['Planning', 'Build']);
    expect(result.project?.dependencies).toHaveLength(1);
    expect(result.project?.tasks[0].progress).toBe(40);
    expect(iso(result.project!.tasks[0].startDate)).toBe('2026-03-01');
    expect(iso(result.project!.tasks[0].endDate)).toBe('2026-03-05');
    expect(iso(result.project!.tasks[1].startDate)).toBe('2026-03-06');
    expect(iso(result.project!.tasks[1].endDate)).toBe('2026-03-12');
  });

  it('keeps parseGanttDSL available for board-format callers', () => {
    const project = parseGanttDSL(SAMPLE);
    expect(project?.tasks).toHaveLength(2);
  });

  it('rejects an unclosed task block', () => {
    const result = parseGanttSource(`diagram: gantt
title: Broken
task Planning {
  start: 2026-03-01
`);
    expect(result.project).toBeNull();
    expect(result.error).toMatch(/Expected \}/);
  });

  it('rejects an invalid date', () => {
    const result = parseGanttSource(`diagram: gantt
task Planning {
  start: not-a-date
  end: 2026-03-05
}`);
    expect(result.project).toBeNull();
    expect(result.error).toMatch(/Invalid start date/i);
  });

  it('round-trips through the generator used by canvas writeback', () => {
    const parsed = parseGanttSource(SAMPLE);
    expect(parsed.project).toBeTruthy();
    const dsl = generateGanttDSL(
      parsed.project!.tasks,
      parsed.project!.dependencies,
      parsed.project!.title,
    );
    const again = parseGanttSource(dsl);
    expect(again.error).toBeNull();
    expect(again.project?.tasks.map(task => task.name)).toEqual(['Planning', 'Build']);
    expect(again.project?.dependencies).toHaveLength(1);
  });
});

describe('duration and after', () => {
  const header = `diagram: gantt
title: Rollout
start: 2026-03-01`;

  it('reads a duration in days and weeks from the project start', () => {
    const days = taskByName(`${header}
task Design {
  duration: 5d
}`, 'Design');
    expect(iso(days.task.startDate)).toBe('2026-03-01');
    expect(iso(days.task.endDate)).toBe('2026-03-06');

    const weeks = taskByName(`${header}
task Research {
  duration: 2w
}`, 'Research');
    expect(iso(weeks.task.startDate)).toBe('2026-03-01');
    expect(iso(weeks.task.endDate)).toBe('2026-03-15');
  });

  it('schedules an after chain of 3', () => {
    const result = parseGanttSource(`${header}
task Design {
  duration: 1d
}
task Build {
  duration: 1d
  after: Design
}
task Launch {
  duration: 1d
  after: Build
}`);
    expect(result.error).toBeNull();
    const byName = new Map(result.project!.tasks.map(task => [task.name, task]));
    expect(iso(byName.get('Design')!.startDate)).toBe('2026-03-01');
    expect(iso(byName.get('Design')!.endDate)).toBe('2026-03-02');
    expect(iso(byName.get('Build')!.startDate)).toBe('2026-03-03');
    expect(iso(byName.get('Build')!.endDate)).toBe('2026-03-04');
    expect(iso(byName.get('Launch')!.startDate)).toBe('2026-03-05');
    expect(iso(byName.get('Launch')!.endDate)).toBe('2026-03-06');
    expect(result.project!.dependencies).toHaveLength(2);
  });

  it('starts the day after the later of two predecessors', () => {
    const result = parseGanttSource(`${header}
task Design {
  duration: 2d
}
task Research {
  duration: 4d
}
task Build {
  duration: 1d
  after: Design, Research
}`);
    expect(result.error).toBeNull();
    const build = result.project!.tasks.find(task => task.name === 'Build')!;
    expect(iso(build.startDate)).toBe('2026-03-06');
    expect(iso(build.endDate)).toBe('2026-03-07');
    expect(result.project!.dependencies).toHaveLength(2);
    expect(result.project!.dependencies.every(dep => dep.type === 'FS' && dep.lag === 0)).toBe(true);
  });

  it('lets an explicit start beat after', () => {
    const { task, result } = taskByName(`${header}
task Design {
  start: 2026-03-01
  end: 2026-03-04
}
task Build {
  start: 2026-03-02
  duration: 2d
  after: Design
}`, 'Build');
    expect(iso(task.startDate)).toBe('2026-03-02');
    expect(iso(task.endDate)).toBe('2026-03-04');
    expect(result.project!.dependencies).toHaveLength(1);
  });

  it('lets an explicit end beat duration', () => {
    const { task } = taskByName(`${header}
task Design {
  start: 2026-03-01
  end: 2026-03-10
  duration: 2d
}`, 'Design');
    expect(iso(task.startDate)).toBe('2026-03-01');
    expect(iso(task.endDate)).toBe('2026-03-10');
  });

  it('places a milestone on the predecessor end day', () => {
    const { task } = taskByName(`${header}
task Build {
  duration: 5d
}
task Launch {
  milestone: true
  after: Build
}`, 'Launch');
    expect(iso(task.startDate)).toBe('2026-03-06');
    expect(iso(task.endDate)).toBe('2026-03-06');
    expect(task.milestone).toBe(true);
  });

  it('reports a cycle and does not return a plan', () => {
    const result = parseGanttSource(`${header}
task Design {
  duration: 1d
  after: Build
}
task Build {
  duration: 1d
  after: Design
}`);
    expect(result.project).toBeNull();
    expect(result.error).toMatch(/Circular dependency: Design → Build → Design/);
  });

  it('warns with the line number when after names an unknown task', () => {
    const dsl = `${header}

task Design {
  duration: 3d
  after: Nobody
}`;
    const result = parseGanttSource(dsl);
    expect(result.error).toBeNull();
    expect(result.project?.tasks).toHaveLength(1);
    expect(iso(result.project!.tasks[0].startDate)).toBe('2026-03-01');
    expect(result.warnings).toEqual(['Unknown task "Nobody" in after: at line 7.']);
    expect(result.project!.dependencies).toHaveLength(0);
  });

  it('keeps mermaid after and duration links through a round trip', () => {
    const dsl = mermaidGanttToDSL(`gantt
title Sprint Plan
dateFormat YYYY-MM-DD
section Build
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d`);
    expect(dsl).toContain('duration: 4d');
    expect(dsl).toContain('duration: 5d');
    expect(dsl).toContain('after: Design');
    expect(dsl).not.toMatch(/task Implement \{[^}]*end:/);
    const parsed = parseGanttSource(dsl);
    expect(parsed.error).toBeNull();
    expect(parsed.warnings).toEqual([]);
    const design = parsed.project!.tasks.find(task => task.name === 'Design')!;
    const implement = parsed.project!.tasks.find(task => task.name === 'Implement')!;
    expect(iso(design.startDate)).toBe('2026-08-01');
    expect(iso(design.endDate)).toBe('2026-08-05');
    expect(iso(implement.startDate)).toBe('2026-08-06');
    expect(iso(implement.endDate)).toBe('2026-08-11');
    expect(parsed.project!.dependencies).toEqual([
      expect.objectContaining({ predecessorId: design.id, successorId: implement.id, type: 'FS', lag: 0 }),
    ]);
  });

  it('writes start: when an after task is dragged and duration: when it is resized', () => {
    const parsed = parseGanttSource(`${header}
task Design {
  duration: 3d
}
task Build {
  duration: 5d
  after: Design
}`);
    const design = parsed.project!.tasks.find(task => task.name === 'Design')!;
    const build = parsed.project!.tasks.find(task => task.name === 'Build')!;
    const day = 86_400_000;
    const moved = reconcileBarEdit(build, {
      startDate: new Date(build.startDate.getTime() + 2 * day),
      endDate: new Date(build.endDate.getTime() + 2 * day),
    });
    expect(moved.sourceSchedule?.explicitStart).toBe(true);
    expect(moved.sourceSchedule?.after).toEqual(['Design']);
    const movedDsl = generateGanttDSL(
      [design, { ...build, ...moved }],
      parsed.project!.dependencies,
      'Rollout',
    );
    expect(movedDsl).toMatch(/task Build \{\s*start: 2026-03-07/);
    expect(movedDsl).toContain('after: Design');
    expect(movedDsl).toContain('duration: 5d');
    expect(movedDsl).not.toMatch(/task Build \{[^}]*depends:/);

    const resized = reconcileBarEdit(build, {
      endDate: new Date(build.endDate.getTime() + 2 * day),
    });
    expect(resized.sourceSchedule?.explicitEnd).toBe(false);
    expect(resized.sourceSchedule?.explicitStart).toBe(false);
    expect(resized.sourceSchedule?.durationDays).toBe(7);
    const resizedDsl = generateGanttDSL(
      [design, { ...build, ...resized, endDate: new Date(build.endDate.getTime() + 2 * day) }],
      parsed.project!.dependencies,
      'Rollout',
    );
    expect(resizedDsl).toMatch(/task Build \{[^}]*duration: 7d/);
    expect(resizedDsl).toContain('after: Design');
    expect(resizedDsl).not.toMatch(/task Build \{[^}]*end:/);
  });
});

describe('existing Gantt templates and task templates', () => {
  it('parses every dashboard Gantt template', () => {
    const ganttTemplates = TEMPLATES.filter(template => template.mode === 'gantt');
    expect(ganttTemplates.length).toBeGreaterThan(0);
    for (const template of ganttTemplates) {
      const result = parseGanttSource(template.dsl);
      expect(result.error, template.id).toBeNull();
      expect(result.project?.tasks.length, template.id).toBeGreaterThan(0);
    }
  });

  it('still applies in-app Gantt task templates', () => {
    const { tasks, dependencies } = applyTemplate(softwareDevelopmentTemplate);
    expect(tasks.length).toBeGreaterThan(0);
    expect(dependencies.length).toBeGreaterThan(0);
    expect(tasks.some(task => task.name === 'Project Planning')).toBe(true);
  });

  it('leaves architecture CSV import on its existing path', () => {
    const dsl = csvToDSL([
      { source_service: 'Gateway', target_service: 'Orders', protocol: 'http' },
    ], 'APM Import');
    expect(dsl).toMatch(/diagram:\s*architecture/);
    expect(dsl).toContain('service Gateway');
    expect(dsl).toContain('Orders');
  });
});
