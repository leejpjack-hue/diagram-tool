/**
 * Gantt Chart Enhancements
 * 
 * Features inspired by Monday.com, Asana, Jira:
 * - Drag & drop task scheduling
 * - Task resizing (duration adjustment)
 * - Baseline comparison (planned vs actual)
 * - Resource workload visualization
 * - Conflict detection
 */

import type { GanttTask, Dependency } from './types';

// ============================================
// DRAG & DROP UTILITIES
// ============================================

export interface DragState {
  taskId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Calculate new dates when dragging a task
 */
export function calculateDragDates(
  task: GanttTask,
  dragState: DragState,
  deltaX: number,
  dayWidth: number,
  snapToDays: boolean = true
): { startDate: Date; endDate: Date } {
  const daysDelta = Math.round(deltaX / dayWidth);
  
  let newStart = new Date(task.startDate);
  let newEnd = new Date(task.endDate);
  
  switch (dragState.type) {
    case 'move':
      newStart.setDate(newStart.getDate() + daysDelta);
      newEnd.setDate(newEnd.getDate() + daysDelta);
      break;
    case 'resize-start':
      newStart.setDate(newStart.getDate() + daysDelta);
      // Ensure minimum duration of 1 day
      if (newStart >= newEnd) {
        newStart = new Date(newEnd);
        newStart.setDate(newStart.getDate() - 1);
      }
      break;
    case 'resize-end':
      newEnd.setDate(newEnd.getDate() + daysDelta);
      // Ensure minimum duration of 1 day
      if (newEnd <= newStart) {
        newEnd = new Date(newStart);
        newEnd.setDate(newEnd.getDate() + 1);
      }
      break;
  }
  
  // Snap to day boundaries if enabled
  if (snapToDays) {
    newStart.setHours(0, 0, 0, 0);
    newEnd.setHours(23, 59, 59, 999);
  }
  
  return { startDate: newStart, endDate: newEnd };
}

/**
 * Check if new dates would violate dependencies
 */
export function checkDependencyViolation(
  task: GanttTask,
  newStartDate: Date,
  newEndDate: Date,
  dependencies: Dependency[],
  allTasks: GanttTask[]
): { violated: boolean; message: string } {
  const taskDeps = dependencies.filter(d => d.successorId === task.id);
  
  for (const dep of taskDeps) {
    const predecessor = allTasks.find(t => t.id === dep.predecessorId);
    if (!predecessor) continue;
    
    switch (dep.type) {
      case 'FS': // Finish-to-Start
        if (newStartDate < predecessor.endDate) {
          return {
            violated: true,
            message: `Cannot start before "${predecessor.name}" finishes (FS dependency)`,
          };
        }
        break;
      case 'SS': // Start-to-Start
        if (newStartDate < predecessor.startDate) {
          return {
            violated: true,
            message: `Cannot start before "${predecessor.name}" starts (SS dependency)`,
          };
        }
        break;
      case 'FF': // Finish-to-Finish
        if (newEndDate < predecessor.endDate) {
          return {
            violated: true,
            message: `Cannot finish before "${predecessor.name}" finishes (FF dependency)`,
          };
        }
        break;
      case 'SF': // Start-to-Finish
        if (newEndDate < predecessor.startDate) {
          return {
            violated: true,
            message: `Cannot finish before "${predecessor.name}" starts (SF dependency)`,
          };
        }
        break;
    }
  }
  
  return { violated: false, message: '' };
}

// ============================================
// BASELINE COMPARISON
// ============================================

export interface Baseline {
  id: string;
  name: string;
  createdAt: Date;
  tasks: Map<string, { startDate: Date; endDate: Date; progress: number }>;
}

/**
 * Create a baseline snapshot of current project state
 */
export function createBaseline(
  tasks: GanttTask[],
  name: string
): Baseline {
  const taskSnapshots = new Map<string, { startDate: Date; endDate: Date; progress: number }>();
  
  tasks.forEach(task => {
    taskSnapshots.set(task.id, {
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      progress: task.progress,
    });
  });
  
  return {
    id: `baseline-${Date.now()}`,
    name,
    createdAt: new Date(),
    tasks: taskSnapshots,
  };
}

/**
 * Calculate variance between baseline and current state
 */
export function calculateBaselineVariance(
  task: GanttTask,
  baseline: Baseline
): { startVariance: number; endVariance: number; progressVariance: number } | null {
  const baselineTask = baseline.tasks.get(task.id);
  if (!baselineTask) return null;
  
  const msPerDay = 1000 * 60 * 60 * 24;
  
  const startVariance = Math.round(
    (task.startDate.getTime() - baselineTask.startDate.getTime()) / msPerDay
  );
  const endVariance = Math.round(
    (task.endDate.getTime() - baselineTask.endDate.getTime()) / msPerDay
  );
  const progressVariance = task.progress - baselineTask.progress;
  
  return { startVariance, endVariance, progressVariance };
}

// ============================================
// RESOURCE WORKLOAD
// ============================================

export interface WorkloadDay {
  date: Date;
  hours: number;
  tasks: string[];
  overAllocated: boolean;
}

export interface ResourceWorkload {
  assignee: string;
  dailyWorkload: WorkloadDay[];
  totalHours: number;
  peakHours: number;
  averageHours: number;
  utilizationPercent: number;
  overAllocatedDays: number;
}

/**
 * Calculate resource workload over time
 */
export function calculateResourceWorkload(
  assignee: string,
  tasks: GanttTask[],
  workHoursPerDay: number = 8
): ResourceWorkload {
  const assigneeTasks = tasks.filter(t => t.assignee === assignee);
  
  if (assigneeTasks.length === 0) {
    return {
      assignee,
      dailyWorkload: [],
      totalHours: 0,
      peakHours: 0,
      averageHours: 0,
      utilizationPercent: 0,
      overAllocatedDays: 0,
    };
  }
  
  // Find date range
  const minDate = new Date(Math.min(...assigneeTasks.map(t => t.startDate.getTime())));
  const maxDate = new Date(Math.max(...assigneeTasks.map(t => t.endDate.getTime())));
  
  // Calculate daily workload
  const dailyWorkload: WorkloadDay[] = [];
  const currentDate = new Date(minDate);
  
  while (currentDate <= maxDate) {
    const dayTasks = assigneeTasks.filter(
      t => currentDate >= t.startDate && currentDate <= t.endDate
    );
    
    // Assume equal distribution of effort across task duration
    const dayHours = dayTasks.reduce((sum, task) => {
      const taskDays = Math.ceil(
        (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) || 1;
      // Assume 8 hours of work per task, distributed across its duration
      const taskHoursPerDay = (workHoursPerDay * (task.progress / 100)) / taskDays;
      return sum + taskHoursPerDay;
    }, 0);
    
    dailyWorkload.push({
      date: new Date(currentDate),
      hours: dayHours,
      tasks: dayTasks.map(t => t.id),
      overAllocated: dayHours > workHoursPerDay,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const totalHours = dailyWorkload.reduce((sum, d) => sum + d.hours, 0);
  const peakHours = Math.max(...dailyWorkload.map(d => d.hours), 0);
  const averageHours = dailyWorkload.length > 0 ? totalHours / dailyWorkload.length : 0;
  const overAllocatedDays = dailyWorkload.filter(d => d.overAllocated).length;
  const utilizationPercent = workHoursPerDay > 0 ? (averageHours / workHoursPerDay) * 100 : 0;
  
  return {
    assignee,
    dailyWorkload,
    totalHours,
    peakHours,
    averageHours,
    utilizationPercent,
    overAllocatedDays,
  };
}

/**
 * Calculate workload for all resources
 */
export function calculateAllResourceWorkloads(
  tasks: GanttTask[],
  workHoursPerDay: number = 8
): ResourceWorkload[] {
  const assignees = new Set(tasks.map(t => t.assignee).filter(Boolean));
  return Array.from(assignees).map(assignee => 
    calculateResourceWorkload(assignee!, tasks, workHoursPerDay)
  );
}

/**
 * Detect resource conflicts
 */
export function detectResourceConflicts(
  tasks: GanttTask[],
  workHoursPerDay: number = 8
): { assignee: string; date: Date; tasks: string[]; hours: number }[] {
  const conflicts: { assignee: string; date: Date; tasks: string[]; hours: number }[] = [];
  const workloads = calculateAllResourceWorkloads(tasks, workHoursPerDay);
  
  workloads.forEach(workload => {
    workload.dailyWorkload.forEach(day => {
      if (day.overAllocated) {
        conflicts.push({
          assignee: workload.assignee,
          date: day.date,
          tasks: day.tasks,
          hours: day.hours,
        });
      }
    });
  });
  
  return conflicts;
}

// ============================================
// MILESTONE DETECTION
// ============================================

/**
 * Check if a date is a milestone date (task with zero duration or marked as milestone)
 */
export function isMilestoneDate(task: GanttTask): boolean {
  if (task.milestone) return true;
  const duration = task.endDate.getTime() - task.startDate.getTime();
  return duration <= 0 || task.endDate.getTime() === task.startDate.getTime();
}

// ============================================
// PRINT LAYOUT HELPERS
// ============================================

export interface PrintLayout {
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter' | 'a3';
  scale: number;
  margins: { top: number; right: number; bottom: number; left: number };
  headerEnabled: boolean;
  footerEnabled: boolean;
  includeTaskList: boolean;
  dateRange: { start: Date; end: Date } | 'auto';
}

/**
 * Calculate optimal print layout for a Gantt chart
 */
export function calculatePrintLayout(
  tasks: GanttTask[],
  options: Partial<PrintLayout> = {}
): PrintLayout {
  const defaultLayout: PrintLayout = {
    orientation: 'landscape',
    paperSize: 'a4',
    scale: 100,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    headerEnabled: true,
    footerEnabled: true,
    includeTaskList: true,
    dateRange: 'auto',
  };
  
  const layout = { ...defaultLayout, ...options };
  
  // Auto-adjust scale based on content width
  if (layout.dateRange === 'auto' && tasks.length > 0) {
    const minDate = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
    const maxDate = new Date(Math.max(...tasks.map(t => t.endDate.getTime())));
    const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // If more than 60 days, reduce scale
    if (days > 60) {
      layout.scale = Math.max(50, Math.round(100 * (60 / days)));
    }
  }
  
  return layout;
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Get the start of the week containing a date
 */
export function getWeekStart(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the start of the month containing a date
 */
export function getMonthStart(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(days: number): string {
  if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  } else {
    const months = Math.round(days / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
}

/**
 * Calculate business days between two dates (excludes weekends)
 */
export function calculateBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}
