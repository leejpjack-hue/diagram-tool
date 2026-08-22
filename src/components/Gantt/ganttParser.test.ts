import { describe, expect, it } from 'vitest';
import { applyTemplate, softwareDevelopmentTemplate } from '../../data/ganttTemplates';
import { TEMPLATES } from '../TemplatePicker/templates';
import { csvToDSL } from '../../utils/csvToDiagram';
import { generateGanttDSL } from './ganttGenerator';
import { parseGanttDSL, parseGanttSource } from './ganttParser';

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
    expect(result.project?.tasks.map(task => task.name)).toEqual(['Planning', 'Build']);
    expect(result.project?.dependencies).toHaveLength(1);
    expect(result.project?.tasks[0].progress).toBe(40);
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
