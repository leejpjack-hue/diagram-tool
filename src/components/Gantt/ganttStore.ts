import { create } from 'zustand';
import type { GanttTask, GanttMilestone, GanttZoomLevel } from './types';

interface GanttState {
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  selectedTaskId: string | null;
  zoomLevel: GanttZoomLevel;
  viewStartDate: Date;
  
  // Actions
  setTasks: (tasks: GanttTask[]) => void;
  addTask: (task: GanttTask) => void;
  updateTask: (id: string, updates: Partial<GanttTask>) => void;
  deleteTask: (id: string) => void;
  setSelectedTask: (id: string | null) => void;
  setZoomLevel: (level: GanttZoomLevel) => void;
  setViewStartDate: (date: Date) => void;
  setMilestones: (milestones: GanttMilestone[]) => void;
  addMilestone: (milestone: GanttMilestone) => void;
}

// Default sample tasks
const today = new Date();
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const defaultTasks: GanttTask[] = [
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
    dependencies: ['task-1'],
  },
  {
    id: 'task-3',
    name: 'Design Phase',
    startDate: addDays(today, 7),
    endDate: addDays(today, 14),
    progress: 20,
    assignee: 'Mike',
    color: '#f59e0b',
    dependencies: ['task-2'],
  },
  {
    id: 'task-4',
    name: 'Development',
    startDate: addDays(today, 10),
    endDate: addDays(today, 25),
    progress: 0,
    assignee: 'Jack',
    color: '#8b5cf6',
    dependencies: ['task-3'],
  },
  {
    id: 'task-5',
    name: 'Testing',
    startDate: addDays(today, 20),
    endDate: addDays(today, 28),
    progress: 0,
    assignee: 'Sarah',
    color: '#ef4444',
    dependencies: ['task-4'],
  },
  {
    id: 'task-6',
    name: 'Deployment',
    startDate: addDays(today, 28),
    endDate: addDays(today, 30),
    progress: 0,
    assignee: 'Mike',
    color: '#06b6d4',
    dependencies: ['task-5'],
    milestone: true,
  },
];

export const useGanttStore = create<GanttState>((set) => ({
  tasks: defaultTasks,
  milestones: [],
  selectedTaskId: null,
  zoomLevel: 'week',
  viewStartDate: today,
  
  setTasks: (tasks) => set({ tasks }),
  
  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task],
  })),
  
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === id ? { ...t, ...updates } : t
    ),
  })),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
    selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
  })),
  
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  
  setZoomLevel: (level) => set({ zoomLevel: level }),
  
  setViewStartDate: (date) => set({ viewStartDate: date }),
  
  setMilestones: (milestones) => set({ milestones }),
  
  addMilestone: (milestone) => set((state) => ({
    milestones: [...state.milestones, milestone],
  })),
}));
