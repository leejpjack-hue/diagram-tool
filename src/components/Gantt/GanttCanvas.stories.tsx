import type { Meta, StoryObj } from '@storybook/react';
import { GanttCanvas } from './GanttCanvas';
import { useGanttStore } from './ganttStore';
import { useEffect } from 'react';

const meta: Meta<typeof GanttCanvas> = {
  title: 'Gantt/GanttCanvas',
  component: GanttCanvas,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      // Reset store before each story
      useGanttStore.setState({
        tasks: [],
        dependencies: [],
        selectedTaskId: null,
        zoomLevel: 'week',
        filter: {
          search: '',
          assignee: null,
          status: 'all',
          dateRange: { start: null, end: null },
          criticalOnly: false,
        },
      });
      return (
        <div style={{ width: '100%', height: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof GanttCanvas>;

// Helper to setup tasks
const setupDefaultTasks = () => {
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
        name: 'Project Planning',
        startDate: today,
        endDate: addDays(today, 3),
        progress: 100,
        assignee: 'Jack',
        color: '#3b82f6',
        dependencies: [],
      },
      {
        id: 'task-2',
        name: 'Requirements Gathering',
        startDate: addDays(today, 3),
        endDate: addDays(today, 7),
        progress: 60,
        assignee: 'Sarah',
        color: '#10b981',
        dependencies: [],
      },
      {
        id: 'task-3',
        name: 'Design Phase',
        startDate: addDays(today, 7),
        endDate: addDays(today, 14),
        progress: 20,
        assignee: 'Mike',
        color: '#f59e0b',
        dependencies: [],
      },
    ],
    dependencies: [],
  });
};

// Default story with sample tasks
export const Default: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
        setupDefaultTasks();
      }, []);
      return <Story />;
    },
  ],
};

// Empty state
export const Empty: Story = {};

// With dependencies
export const WithDependencies: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
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
              progress: 40,
              assignee: 'Sarah',
              color: '#10b981',
              dependencies: ['task-1'],
            },
            {
              id: 'task-3',
              name: 'Testing',
              startDate: addDays(today, 10),
              endDate: addDays(today, 14),
              progress: 0,
              assignee: 'Mike',
              color: '#f59e0b',
              dependencies: ['task-2'],
            },
          ],
          dependencies: [
            { predecessorId: 'task-1', successorId: 'task-2', type: 'FS', lag: 0 },
            { predecessorId: 'task-2', successorId: 'task-3', type: 'FS', lag: 0 },
          ],
        });
      }, []);
      return <Story />;
    },
  ],
};

// Critical path visualization
export const CriticalPath: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
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
              name: 'Critical Task 1',
              startDate: today,
              endDate: addDays(today, 5),
              progress: 80,
              assignee: 'Jack',
              color: '#ef4444',
              dependencies: [],
            },
            {
              id: 'task-2',
              name: 'Critical Task 2',
              startDate: addDays(today, 5),
              endDate: addDays(today, 10),
              progress: 30,
              assignee: 'Sarah',
              color: '#ef4444',
              dependencies: ['task-1'],
            },
            {
              id: 'task-3',
              name: 'Non-Critical',
              startDate: addDays(today, 2),
              endDate: addDays(today, 6),
              progress: 50,
              assignee: 'Mike',
              color: '#10b981',
              dependencies: [],
            },
          ],
          dependencies: [
            { predecessorId: 'task-1', successorId: 'task-2', type: 'FS', lag: 0 },
          ],
          showCriticalPath: true,
        });
      }, []);
      return <Story />;
    },
  ],
};

// Zoom levels
export const ZoomDay: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
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
              name: 'Short Task',
              startDate: today,
              endDate: addDays(today, 2),
              progress: 50,
              assignee: 'Jack',
              color: '#3b82f6',
              dependencies: [],
            },
          ],
          zoomLevel: 'day',
        });
      }, []);
      return <Story />;
    },
  ],
};

export const ZoomMonth: Story = {
  decorators: [
    (Story) => {
      useEffect(() => {
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
              name: 'Long Project',
              startDate: today,
              endDate: addDays(today, 60),
              progress: 25,
              assignee: 'Jack',
              color: '#8b5cf6',
              dependencies: [],
            },
          ],
          zoomLevel: 'month',
        });
      }, []);
      return <Story />;
    },
  ],
};
