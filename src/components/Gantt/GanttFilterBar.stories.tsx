import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { GanttFilterBar } from './GanttFilterBar';
import { useGanttStore } from './ganttStore';

const meta: Meta<typeof GanttFilterBar> = {
  title: 'Gantt/GanttFilterBar',
  component: GanttFilterBar,
  decorators: [
    (Story) => {
      // Setup sample data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const addDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
      };

      useGanttStore.setState({
        tasks: [
          {
            id: 'task-1',
            name: 'Planning',
            startDate: today,
            endDate: addDays(today, 3),
            progress: 100,
            assignee: 'Jack',
            color: '#3b82f6',
            dependencies: [],
          },
          {
            id: 'task-2',
            name: 'Development',
            startDate: addDays(today, 3),
            endDate: addDays(today, 10),
            progress: 60,
            assignee: 'Sarah',
            color: '#10b981',
            dependencies: [],
          },
          {
            id: 'task-3',
            name: 'Testing',
            startDate: addDays(today, 10),
            endDate: addDays(today, 14),
            progress: 20,
            assignee: 'Mike',
            color: '#f59e0b',
            dependencies: [],
          },
        ],
      });

      return (
        <div style={{ padding: '20px', backgroundColor: '#f9fafb' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof GanttFilterBar>;

export const Default: Story = {};

export const WithActiveFilters: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useGanttStore.getState().setFilter({ search: 'Planning' });
      }, []);
      return <Story />;
    },
  ],
};

export const WithCriticalPath: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        useGanttStore.setState({
          showCriticalPath: true,
          criticalPathResult: {
            path: ['task-1', 'task-2'],
            duration: 10,
            slack: new Map([['task-1', 0], ['task-2', 0], ['task-3', 5]]),
            earlyStart: new Map(),
            earlyFinish: new Map(),
            lateStart: new Map(),
            lateFinish: new Map(),
          },
        });
      }, []);
      return <Story />;
    },
  ],
};
