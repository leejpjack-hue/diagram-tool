/**
 * Resource Allocation Utilities
 * 
 * Calculate workload, utilization, and over-allocation for assignees
 */

import type { GanttTask, ResourceAllocation } from './types';

/**
 * Calculate resource allocation for all assignees
 */
export function calculateResourceAllocations(tasks: GanttTask[]): ResourceAllocation[] {
  const allocations = new Map<string, ResourceAllocation>();
  
  // Filter to only tasks with assignees (skip groups)
  const assignedTasks = tasks.filter(t => t.assignee && !t.isGroup);
  
  // Group tasks by assignee
  assignedTasks.forEach(task => {
    const assignee = task.assignee!;
    
    if (!allocations.has(assignee)) {
      allocations.set(assignee, {
        assignee,
        tasks: [],
        totalDays: 0,
        peakLoad: 0,
        utilization: 0,
        overAllocated: false,
      });
    }
    
    const allocation = allocations.get(assignee)!;
    allocation.tasks.push(task.id);
  });
  
  // Calculate metrics for each assignee
  allocations.forEach((allocation, assignee) => {
    const assigneeTasks = assignedTasks.filter(t => t.assignee === assignee);
    
    // Calculate total days (sum of all task durations)
    allocation.totalDays = assigneeTasks.reduce((sum, task) => {
      const days = getTaskDuration(task);
      return sum + days;
    }, 0);
    
    // Calculate daily workload to find peak
    const dailyWorkload = calculateDailyWorkload(assigneeTasks);
    allocation.peakLoad = Math.max(...dailyWorkload.values(), 0);
    
    // Utilization: peak load as percentage of 8h/day (assuming 1 task = 8h)
    // If someone has 2 tasks on same day, that's 200% utilization
    allocation.utilization = Math.round((allocation.peakLoad / 1) * 100);
    
    // Over-allocated if peak > 1 task per day (100%)
    allocation.overAllocated = allocation.peakLoad > 1;
  });
  
  return Array.from(allocations.values()).sort((a, b) => b.utilization - a.utilization);
}

/**
 * Get task duration in days
 */
function getTaskDuration(task: GanttTask): number {
  const ms = task.endDate.getTime() - task.startDate.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate workload for each day across all tasks
 */
function calculateDailyWorkload(tasks: GanttTask[]): Map<string, number> {
  const workload = new Map<string, number>();
  
  tasks.forEach(task => {
    const startDate = new Date(task.startDate);
    const endDate = new Date(task.endDate);
    
    // Iterate through each day of the task
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // Skip weekends
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateKey = formatDateKey(currentDate);
        workload.set(dateKey, (workload.get(dateKey) || 0) + 1);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  return workload;
}

/**
 * Format date as key for map
 */
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Get workload distribution for an assignee (for charting)
 */
export function getWorkloadDistribution(
  tasks: GanttTask[], 
  assignee: string,
  startDate: Date,
  endDate: Date
): { date: Date; load: number }[] {
  const assigneeTasks = tasks.filter(t => t.assignee === assignee && !t.isGroup);
  const distribution: { date: Date; load: number }[] = [];
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    let load = 0;
    
    // Skip weekends (load = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      assigneeTasks.forEach(task => {
        if (currentDate >= task.startDate && currentDate <= task.endDate) {
          load++;
        }
      });
    }
    
    distribution.push({
      date: new Date(currentDate),
      load,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return distribution;
}

/**
 * Get unique assignees from tasks
 */
export function getAssignees(tasks: GanttTask[]): string[] {
  const assignees = new Set<string>();
  tasks.forEach(t => {
    if (t.assignee && !t.isGroup) {
      assignees.add(t.assignee);
    }
  });
  return Array.from(assignees).sort();
}

/**
 * Check if a specific day is over-allocated for an assignee
 */
export function isOverAllocatedOn(
  tasks: GanttTask[],
  assignee: string,
  date: Date
): boolean {
  const assigneeTasks = tasks.filter(t => 
    t.assignee === assignee && 
    !t.isGroup &&
    date >= t.startDate && 
    date <= t.endDate
  );
  
  return assigneeTasks.length > 1;
}
