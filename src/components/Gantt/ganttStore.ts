import { create } from 'zustand';
import type { GanttTask, GanttMilestone, GanttZoomLevel, Dependency, GanttFilter, LevelingOptions, LevelingResult } from './types';
import { calculateCriticalPath, type CriticalPathResult } from './criticalPath';
import { 
  autoScheduleTasks, 
  detectCircularDependencies, 
  checkDependencyViolations 
} from './autoSchedule';
import { levelResources, needsLeveling } from './resourceLeveling';
import { recomputeGroupRollups } from './wbsUtils';

// Sprint 11: History for undo/redo
interface HistoryState {
  tasks: GanttTask[];
  dependencies: Dependency[];
}

interface GanttState {
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  dependencies: Dependency[];
  selectedTaskId: string | null;
  selectedTaskIds: Set<string>; // Sprint 10: Bulk operations - multi-select
  zoomLevel: GanttZoomLevel;
  viewStartDate: Date;
  
  // Sprint 8: Critical path
  criticalPathResult: CriticalPathResult | null;
  showCriticalPath: boolean;
  
  // Sprint 8: Filtering
  filter: GanttFilter;
  
  // Sprint 8: Groups
  expandedGroups: Set<string>;
  
  // Sprint 11: Undo/Redo
  history: HistoryState[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  
  // Sprint 13: Resource leveling
  levelingResult: LevelingResult | null;
  showLevelingPreview: boolean;
  
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
  
  // Sprint 8: Dependencies
  setDependencies: (deps: Dependency[]) => void;
  addDependency: (dep: Dependency) => void;
  updateDependency: (predecessorId: string, successorId: string, updates: Partial<Dependency>) => void;
  removeDependency: (predecessorId: string, successorId: string) => void;
  
  // Sprint 8: Critical path
  toggleCriticalPath: () => void;
  recalculateCriticalPath: () => void;
  
  // Sprint 8: Filtering
  setFilter: (filter: Partial<GanttFilter>) => void;
  clearFilter: () => void;
  getFilteredTasks: () => GanttTask[];
  
  // Sprint 8: Groups
  toggleGroup: (groupId: string) => void;
  
  // Sprint 9: Auto-scheduling
  runAutoSchedule: () => { success: boolean; message: string; changed: number };
  detectCycles: () => string[][];
  checkViolations: () => any[];
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
  
  // Sprint 10: Bulk operations
  toggleTaskSelection: (id: string, multi?: boolean) => void;
  selectAllTasks: () => void;
  clearSelection: () => void;
  deleteSelectedTasks: () => void;
  updateSelectedTasks: (updates: Partial<GanttTask>) => void;
  getSelectedTasks: () => GanttTask[];
  
  // Project
  setProject: (tasks: GanttTask[], dependencies: Dependency[]) => void;
  
  // Sprint 11: Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Sprint 13: Resource leveling
  runLeveling: (options?: Partial<LevelingOptions>) => LevelingResult;
  previewLeveling: (options?: Partial<LevelingOptions>) => LevelingResult;
  applyLeveling: (result: LevelingResult) => void;
  clearLeveling: () => void;
  needsLeveling: () => boolean;
}

const defaultFilter: GanttFilter = {
  search: '',
  assignee: null,
  status: 'all',
  dateRange: { start: null, end: null },
  criticalOnly: false,
};

// Default sample tasks
const today = new Date();
today.setHours(0, 0, 0, 0);

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
  {
    id: 'task-4',
    name: 'Development',
    startDate: addDays(today, 10),
    endDate: addDays(today, 25),
    progress: 0,
    assignee: 'Jack',
    color: '#8b5cf6',
    dependencies: [],
  },
  {
    id: 'task-5',
    name: 'Testing',
    startDate: addDays(today, 20),
    endDate: addDays(today, 28),
    progress: 0,
    assignee: 'Sarah',
    color: '#ef4444',
    dependencies: [],
  },
  {
    id: 'task-6',
    name: 'Deployment',
    startDate: addDays(today, 28),
    endDate: addDays(today, 30),
    progress: 0,
    assignee: 'Mike',
    color: '#06b6d4',
    dependencies: [],
    milestone: true,
  },
];

const defaultDependencies: Dependency[] = [
  { predecessorId: 'task-1', successorId: 'task-2', type: 'FS', lag: 0 },
  { predecessorId: 'task-2', successorId: 'task-3', type: 'FS', lag: 0 },
  { predecessorId: 'task-3', successorId: 'task-4', type: 'FS', lag: 0 },
  { predecessorId: 'task-4', successorId: 'task-5', type: 'SS', lag: -5 }, // Overlap testing
  { predecessorId: 'task-5', successorId: 'task-6', type: 'FS', lag: 0 },
];

export const useGanttStore = create<GanttState>((set, get) => ({
  tasks: defaultTasks,
  milestones: [],
  dependencies: defaultDependencies,
  selectedTaskId: null,
  selectedTaskIds: new Set<string>(), // Sprint 10: Bulk operations
  zoomLevel: 'week',
  viewStartDate: today,
  criticalPathResult: null,
  showCriticalPath: false,
  filter: defaultFilter,
  expandedGroups: new Set(),
  
  // Sprint 11: History for undo/redo
  history: [{ tasks: defaultTasks, dependencies: defaultDependencies }],
  historyIndex: 0,
  canUndo: false,
  canRedo: false,
  
  // Sprint 13: Resource leveling
  levelingResult: null,
  showLevelingPreview: false,
  
  
  // Sprint 11: Push current state to history
  pushHistory: () => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push({
      tasks: JSON.parse(JSON.stringify(state.tasks)),
      dependencies: JSON.parse(JSON.stringify(state.dependencies)),
    });
    // Keep history to 50 items max
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: newHistory.length > 1,
      canRedo: false,
  
  // Sprint 13: Resource leveling
  levelingResult: null,
  showLevelingPreview: false,
  
    };
  }),
  
  // Sprint 11: Undo
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const newIndex = state.historyIndex - 1;
    const historyState = state.history[newIndex];
    return {
      tasks: JSON.parse(JSON.stringify(historyState.tasks)),
      dependencies: JSON.parse(JSON.stringify(historyState.dependencies)),
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
    };
  }),
  
  // Sprint 11: Redo
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const newIndex = state.historyIndex + 1;
    const historyState = state.history[newIndex];
    return {
      tasks: JSON.parse(JSON.stringify(historyState.tasks)),
      dependencies: JSON.parse(JSON.stringify(historyState.dependencies)),
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < state.history.length - 1,
    };
  }),
  
  setTasks: (tasks) => {
    const state = get();
    state.pushHistory();
    set({ tasks: recomputeGroupRollups(tasks) });
  },

  addTask: (task) => set((state) => {
    state.pushHistory();
    return { tasks: recomputeGroupRollups([...state.tasks, task]) };
  }),

  updateTask: (id, updates) => set((state) => {
    state.pushHistory();
    const next = state.tasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    return { tasks: recomputeGroupRollups(next) };
  }),

  deleteTask: (id) => set((state) => {
    state.pushHistory();
    return {
      tasks: recomputeGroupRollups(state.tasks.filter((t) => t.id !== id)),
      dependencies: state.dependencies.filter(
        d => d.predecessorId !== id && d.successorId !== id
      ),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    };
  }),
  
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  
  setZoomLevel: (level) => set({ zoomLevel: level }),
  
  setViewStartDate: (date) => set({ viewStartDate: date }),
  
  setMilestones: (milestones) => set({ milestones }),
  
  addMilestone: (milestone) => set((state) => ({
    milestones: [...state.milestones, milestone],
  })),
  
  // Dependencies
  setDependencies: (deps) => set({ dependencies: deps }),
  
  addDependency: (dep) => set((state) => ({
    dependencies: [...state.dependencies, dep],
  })),
  
  updateDependency: (predecessorId, successorId, updates) => set((state) => ({
    dependencies: state.dependencies.map((d) =>
      d.predecessorId === predecessorId && d.successorId === successorId
        ? { ...d, ...updates }
        : d
    ),
  })),
  
  removeDependency: (predecessorId, successorId) => set((state) => ({
    dependencies: state.dependencies.filter(
      (d) => !(d.predecessorId === predecessorId && d.successorId === successorId)
    ),
  })),
  
  // Critical path
  toggleCriticalPath: () => set((state) => {
    const newShow = !state.showCriticalPath;
    if (newShow && !state.criticalPathResult) {
      const result = calculateCriticalPath(state.tasks, state.dependencies, state.viewStartDate);
      return { showCriticalPath: newShow, criticalPathResult: result };
    }
    return { showCriticalPath: newShow };
  }),
  
  recalculateCriticalPath: () => {
    const state = get();
    const result = calculateCriticalPath(state.tasks, state.dependencies, state.viewStartDate);
    set({ criticalPathResult: result });
  },
  
  // Filtering
  setFilter: (filterUpdates) => set((state) => ({
    filter: { ...state.filter, ...filterUpdates },
  })),
  
  clearFilter: () => set({ filter: defaultFilter }),
  
  getFilteredTasks: () => {
    const state = get();
    let filtered = [...state.tasks];
    const { search, assignee, status, dateRange, criticalOnly } = state.filter;
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        (t.assignee && t.assignee.toLowerCase().includes(searchLower))
      );
    }
    
    // Assignee filter
    if (assignee) {
      filtered = filtered.filter(t => t.assignee === assignee);
    }
    
    // Status filter
    if (status !== 'all') {
      if (status === 'not-started') {
        filtered = filtered.filter(t => t.progress === 0);
      } else if (status === 'in-progress') {
        filtered = filtered.filter(t => t.progress > 0 && t.progress < 100);
      } else if (status === 'complete') {
        filtered = filtered.filter(t => t.progress === 100);
      }
    }
    
    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(t => t.endDate >= dateRange.start!);
    }
    if (dateRange.end) {
      filtered = filtered.filter(t => t.startDate <= dateRange.end!);
    }
    
    // Critical path filter
    if (criticalOnly && state.criticalPathResult) {
      filtered = filtered.filter(t => 
        state.criticalPathResult!.path.includes(t.id)
      );
    }
    
    return filtered;
  },
  
  // Groups
  toggleGroup: (groupId) => set((state) => {
    const expanded = new Set(state.expandedGroups);
    if (expanded.has(groupId)) {
      expanded.delete(groupId);
    } else {
      expanded.add(groupId);
    }
    return { expandedGroups: expanded };
  }),
  
  expandAllGroups: () => set((state) => {
    const groupIds = state.tasks.filter(t => t.isGroup).map(t => t.id);
    return { expandedGroups: new Set(groupIds) };
  }),
  
  collapseAllGroups: () => set({ expandedGroups: new Set() }),
  
  // Sprint 9: Auto-scheduling
  runAutoSchedule: () => {
    const state = get();
    const result = autoScheduleTasks(state.tasks, state.dependencies);
    
    if (result.warnings.length > 0) {
      console.warn('Auto-schedule warnings:', result.warnings);
    }
    
    if (result.changed.length > 0) {
      set({ tasks: result.tasks });
      
      // Recalculate critical path if shown
      if (state.showCriticalPath) {
        const criticalResult = calculateCriticalPath(result.tasks, state.dependencies, new Date());
        set({ criticalPathResult: criticalResult });
      }
    }
    
    return {
      success: result.warnings.filter(w => w.type === 'circular').length === 0,
      message: result.warnings.length > 0 
        ? `Auto-scheduled with ${result.warnings.length} warnings`
        : 'Auto-schedule completed successfully',
      changed: result.changed.length,
    };
  },
  
  detectCycles: () => {
    const state = get();
    return detectCircularDependencies(state.tasks, state.dependencies);
  },
  
  checkViolations: () => {
    const state = get();
    return checkDependencyViolations(state.tasks, state.dependencies);
  },
  
  // Sprint 10: Bulk operations
  toggleTaskSelection: (id, multi = false) => set((state) => {
    const newSelection = new Set(state.selectedTaskIds);
    
    if (multi) {
      // Toggle selection for multi-select mode (Ctrl+click)
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
    } else {
      // Single select mode - clear previous selection and select this task
      newSelection.clear();
      newSelection.add(id);
    }
    
    return { 
      selectedTaskIds: newSelection,
      selectedTaskId: newSelection.size === 1 ? id : null,
    };
  }),
  
  selectAllTasks: () => set((state) => {
    const allTaskIds = new Set(state.tasks.filter(t => !t.isGroup).map(t => t.id));
    return { 
      selectedTaskIds: allTaskIds,
      selectedTaskId: null,
    };
  }),
  
  clearSelection: () => set({ 
    selectedTaskIds: new Set(),
    selectedTaskId: null,
  }),
  
  deleteSelectedTasks: () => set((state) => {
    const idsToDelete = state.selectedTaskIds;
    if (idsToDelete.size === 0) return state;
    
    state.pushHistory();
    
    // Remove tasks
    const newTasks = state.tasks.filter(t => !idsToDelete.has(t.id));
    
    // Remove associated dependencies
    const newDependencies = state.dependencies.filter(
      d => !idsToDelete.has(d.predecessorId) && !idsToDelete.has(d.successorId)
    );
    
    return {
      tasks: newTasks,
      dependencies: newDependencies,
      selectedTaskIds: new Set(),
      selectedTaskId: null,
    };
  }),
  
  updateSelectedTasks: (updates) => set((state) => {
    const idsToUpdate = state.selectedTaskIds;
    if (idsToUpdate.size === 0) return state;
    
    state.pushHistory();
    
    const newTasks = state.tasks.map(t => 
      idsToUpdate.has(t.id) ? { ...t, ...updates } : t
    );
    
    return { tasks: newTasks };
  }),
  
  getSelectedTasks: () => {
    const state = get();
    return state.tasks.filter(t => state.selectedTaskIds.has(t.id));
  },
  
  // Project
  setProject: (tasks, dependencies) => set({ tasks, dependencies }),
  
  // Sprint 13: Resource leveling
  runLeveling: (options) => {
    const state = get();
    const result = levelResources(state.tasks, state.dependencies, options);
    set({ levelingResult: result });
    return result;
  },
  
  previewLeveling: (options) => {
    const state = get();
    const result = levelResources(state.tasks, state.dependencies, options);
    set({ levelingResult: result, showLevelingPreview: true });
    return result;
  },
  
  applyLeveling: (result) => {
    get().pushHistory();
    set({ 
      tasks: result.leveledTasks,
      levelingResult: result,
      showLevelingPreview: false,
    });
  },
  
  clearLeveling: () => set({ 
    levelingResult: null, 
    showLevelingPreview: false,
  }),
  
  needsLeveling: () => {
    const state = get();
    return needsLeveling(state.tasks);
  },
}));
