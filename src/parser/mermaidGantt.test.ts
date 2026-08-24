import { describe, expect, it } from 'vitest';
import { parseGanttSource } from '../components/Gantt/ganttParser';
import { isMermaidGantt, mermaidGanttToDSL } from './mermaidGantt';

const SAMPLE = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
section Build
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d`;

describe('isMermaidGantt', () => {
  it('detects mermaid gantt and ignores native DSL', () => {
    expect(isMermaidGantt(SAMPLE)).toBe(true);
    expect(isMermaidGantt('diagram: gantt\ntask Design {\n  start: 2026-08-01\n  end: 2026-08-04\n}')).toBe(false);
    expect(isMermaidGantt('flowchart TD\nA-->B')).toBe(false);
  });
});

describe('mermaidGanttToDSL', () => {
  it('converts a mermaid gantt into native diagram: gantt', () => {
    const dsl = mermaidGanttToDSL(SAMPLE);
    expect(dsl).toMatch(/^diagram:\s*gantt/m);
    expect(dsl).toContain('title: Sprint Plan');
    expect(dsl).toContain('task Design');
    expect(dsl).toContain('task Implement');
    const parsed = parseGanttSource(dsl);
    expect(parsed.error).toBeNull();
    expect(parsed.project?.tasks.map(task => task.name)).toEqual(expect.arrayContaining(['Build', 'Design', 'Implement']));
  });
});
