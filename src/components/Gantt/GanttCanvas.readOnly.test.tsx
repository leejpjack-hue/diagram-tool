import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GanttCanvas } from './GanttCanvas';
import { useGanttStore } from './ganttStore';

const task = {
  id: 'lock-1',
  name: 'Locked Task',
  startDate: new Date('2026-08-01'),
  endDate: new Date('2026-08-05'),
  progress: 0,
  dependencies: [] as string[],
};

beforeEach(() => {
  useGanttStore.setState({
    tasks: [task],
    dependencies: [],
    selectedTaskId: 'lock-1',
    selectedTaskIds: new Set(['lock-1']),
    zoomLevel: 'week',
    widthScale: 1,
    showCriticalPath: false,
    criticalPathResult: null,
    filter: {
      search: '',
      assignee: null,
      status: 'all',
      dateRange: { start: null, end: null },
      criticalOnly: false,
    },
    expandedGroups: new Set(),
  });
});

describe('GanttCanvas read-only viewer', () => {
  it('hides resize handles and does not move dates when readOnly', () => {
    const { container } = render(<GanttCanvas readOnly />);
    expect(container.querySelector('[data-testid="gantt-canvas"]')).toHaveAttribute('data-readonly', 'true');
    expect(container.querySelector('.cursor-ew-resize')).toBeNull();

    const start = useGanttStore.getState().tasks[0].startDate.getTime();
    fireEvent.mouseDown(container.querySelector('[data-testid="gantt-canvas"]')!, { clientX: 40 });
    fireEvent.mouseMove(container.querySelector('[data-testid="gantt-canvas"]')!, { clientX: 200 });
    fireEvent.mouseUp(container.querySelector('[data-testid="gantt-canvas"]')!);
    expect(useGanttStore.getState().tasks[0].startDate.getTime()).toBe(start);
  });

  it('keeps resize handles when the owner is editing', () => {
    const { container } = render(<GanttCanvas />);
    expect(container.querySelector('[data-testid="gantt-canvas"]')).toHaveAttribute('data-readonly', 'false');
    expect(container.querySelector('.cursor-ew-resize')).not.toBeNull();
  });
});
