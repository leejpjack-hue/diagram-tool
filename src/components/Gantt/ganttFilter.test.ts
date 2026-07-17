import { describe, expect, it } from 'vitest';
import { applyGanttFilter, hasActiveGanttFilter } from './ganttStore';
import type { GanttFilter, GanttTask } from './types';

const baseFilter: GanttFilter = {
  search: '',
  assignee: null,
  status: 'all',
  dateRange: { start: null, end: null },
  criticalOnly: false,
};

const tasks: GanttTask[] = [
  {
    id: 'task-1',
    name: 'Discovery',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-05'),
    progress: 100,
    assignee: 'Jack',
    dependencies: [],
  },
  {
    id: 'task-2',
    name: 'Testing',
    startDate: new Date('2026-03-08'),
    endDate: new Date('2026-03-12'),
    progress: 50,
    assignee: 'Sarah',
    dependencies: [],
  },
  {
    id: 'task-3',
    name: 'Deployment',
    startDate: new Date('2026-03-13'),
    endDate: new Date('2026-03-14'),
    progress: 0,
    assignee: 'Mike',
    dependencies: [],
  },
];

describe('Gantt filtering', () => {
  it('matches search text immediately across task names and assignees', () => {
    expect(applyGanttFilter(tasks, { ...baseFilter, search: ' test ' }).map(t => t.id)).toEqual(['task-2']);
    expect(applyGanttFilter(tasks, { ...baseFilter, search: 'jack' }).map(t => t.id)).toEqual(['task-1']);
  });

  it('combines status, assignee, and date range filters', () => {
    const filtered = applyGanttFilter(tasks, {
      ...baseFilter,
      assignee: 'Sarah',
      status: 'in-progress',
      dateRange: {
        start: new Date('2026-03-07'),
        end: new Date('2026-03-10'),
      },
    });

    expect(filtered.map(t => t.id)).toEqual(['task-2']);
  });

  it('detects whether filters are active', () => {
    expect(hasActiveGanttFilter(baseFilter)).toBe(false);
    expect(hasActiveGanttFilter({ ...baseFilter, search: 'Deployment' })).toBe(true);
  });
});
