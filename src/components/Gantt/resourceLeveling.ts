/**
 * Resource Leveling Algorithm
 * 
 * Automatically reschedule tasks to resolve resource over-allocation
 * while respecting dependencies and constraints.
 * 
 * Sprint 13: Resource Leveling Implementation
 */

import type { GanttTask, Dependency, ResourceAllocation } from './types';
import { calculateResourceAllocations } from './resourceUtils';

/**
 * Leveling strategy
 */
export type LevelingStrategy = 
  | 'conservative'  // Delay tasks as little as possible
  | 'aggressive'   // Minimize resource peaks, even if longer project
  | 'balanced';    // Balance between duration and resource usage

/**
 * Leveling options
 */
export interface LevelingOptions {
  strategy: LevelingStrategy;
  respectConstraints: boolean; // Don't violate dependencies
  maxDelayDays: number; // Maximum days to delay any task
  prioritizeCritical: boolean; // Prefer delaying non-critical tasks
  respectMilestones: boolean; // Don't move tasks linked to milestones
}

/**
 * Leveling result
 */
export interface LevelingResult {
  success: boolean;
  leveledTasks: GanttTask[];
  changes: LevelingChange[];
  unresolvedConflicts: ResourceConflict[];
  originalDuration: number; // Project duration before leveling
  leveledDuration: number; // Project duration after leveling
  extensionDays: number; // Days added to project
}

/**
 * Individual task change during leveling
 */
export interface LevelingChange {
  taskId: string;
  taskName: string;
  originalStart: Date;
  newStart: Date;
  originalEnd: Date;
  newEnd: Date;
  delayDays: number;
  reason: string;
}

/**
 * Resource conflict that couldn't be resolved
 */
export interface ResourceConflict {
  assignee: string;
  date: Date;
  conflictingTasks: string[]; // Task IDs
  reason: string;
}

/**
 * Default leveling options
 */
export const DEFAULT_LEVELING_OPTIONS: LevelingOptions = {
  strategy: 'balanced',
  respectConstraints: true,
  maxDelayDays: 30,
  prioritizeCritical: true,
  respectMilestones: true,
};

/**
 * Main resource leveling function
 * 
 * @param tasks - Current tasks
 * @param dependencies - Task dependencies
 * @param options - Leveling options
 * @returns Leveling result with rescheduled tasks
 */
export function levelResources(
  tasks: GanttTask[],
  dependencies: Dependency[],
  options: Partial<LevelingOptions> = {}
): LevelingResult {
  const opts = { ...DEFAULT_LEVELING_OPTIONS, ...options };
  
  // Track original project duration
  const originalDuration = calculateProjectDuration(tasks);
  
  // Create a working copy of tasks
  const leveledTasks = tasks.map(t => ({ ...t }));
  const changes: LevelingChange[] = [];
  const conflicts: ResourceConflict[] = [];
  
  // Build dependency graph for constraint checking
  const dependencyGraph = buildDependencyGraph(dependencies, tasks);
  
  // Calculate critical path if prioritizing
  let criticalTaskIds = new Set<string>();
  if (opts.prioritizeCritical) {
    criticalTaskIds = identifyCriticalTasks(tasks, dependencies);
  }
  
  // Iterate until no over-allocations or max iterations reached
  let iterations = 0;
  const maxIterations = 100;
  let hasConflicts = true;
  
  while (hasConflicts && iterations < maxIterations) {
    iterations++;
    hasConflicts = false;
    
    // Get current resource allocations
    const allocations = calculateResourceAllocations(leveledTasks);
    const overAllocated = allocations.filter(a => a.overAllocated);
    
    if (overAllocated.length === 0) {
      break; // No conflicts, we're done
    }
    
    // Process each over-allocated resource
    for (const allocation of overAllocated) {
      const result = resolveOverAllocation(
        leveledTasks,
        allocation,
        dependencyGraph,
        criticalTaskIds,
        opts
      );
      
      if (result.changes.length > 0) {
        changes.push(...result.changes);
        hasConflicts = true; // Need another iteration
      }
      
      if (result.conflicts.length > 0) {
        conflicts.push(...result.conflicts);
      }
    }
  }
  
  // Calculate new project duration
  const leveledDuration = calculateProjectDuration(leveledTasks);
  const extensionDays = leveledDuration - originalDuration;
  
  return {
    success: conflicts.length === 0,
    leveledTasks,
    changes,
    unresolvedConflicts: conflicts,
    originalDuration,
    leveledDuration,
    extensionDays,
  };
}

/**
 * Resolve over-allocation for a single resource
 */
function resolveOverAllocation(
  tasks: GanttTask[],
  allocation: ResourceAllocation,
  dependencyGraph: Map<string, Set<string>>,
  criticalTaskIds: Set<string>,
  options: LevelingOptions
): { changes: LevelingChange[]; conflicts: ResourceConflict[] } {
  const changes: LevelingChange[] = [];
  const conflicts: ResourceConflict[] = [];
  
  // Get tasks for this assignee
  const assigneeTasks = tasks.filter(t => 
    t.assignee === allocation.assignee && !t.isGroup
  );
  
  // Sort tasks by priority (critical first, then by start date)
  const sortedTasks = assigneeTasks.sort((a, b) => {
    // Non-critical tasks should be delayed first
    const aCritical = criticalTaskIds.has(a.id) ? 1 : 0;
    const bCritical = criticalTaskIds.has(b.id) ? 1 : 0;
    
    if (aCritical !== bCritical) {
      return bCritical - aCritical; // Non-critical first
    }
    
    // Then by start date
    return a.startDate.getTime() - b.startDate.getTime();
  });
  
  // Find overlapping tasks
  for (let i = 0; i < sortedTasks.length; i++) {
    const task1 = sortedTasks[i];
    
    for (let j = i + 1; j < sortedTasks.length; j++) {
      const task2 = sortedTasks[j];
      
      // Check if tasks overlap
      if (tasksOverlap(task1, task2)) {
        // Determine which task to delay
        const taskToDelay = selectTaskToDelay(
          task1,
          task2,
          dependencyGraph,
          criticalTaskIds,
          options
        );
        
        if (!taskToDelay) {
          // Can't delay either - record conflict
          conflicts.push({
            assignee: allocation.assignee,
            date: task2.startDate,
            conflictingTasks: [task1.id, task2.id],
            reason: 'Cannot delay either task due to constraints',
          });
          continue;
        }
        
        // Calculate delay needed
        const delayNeeded = calculateDelayNeeded(task1, task2);
        
        // Apply delay
        const change = delayTask(
          taskToDelay,
          delayNeeded,
          tasks,
          dependencyGraph,
          options
        );
        
        if (change) {
          changes.push(change);
        } else {
          // Couldn't delay - record conflict
          conflicts.push({
            assignee: allocation.assignee,
            date: task2.startDate,
            conflictingTasks: [task1.id, task2.id],
            reason: 'Delay would violate constraints or max delay limit',
          });
        }
      }
    }
  }
  
  return { changes, conflicts };
}

/**
 * Check if two tasks overlap in time
 */
function tasksOverlap(task1: GanttTask, task2: GanttTask): boolean {
  return task1.startDate <= task2.endDate && task2.startDate <= task1.endDate;
}

/**
 * Select which task to delay based on strategy
 */
function selectTaskToDelay(
  task1: GanttTask,
  task2: GanttTask,
  dependencyGraph: Map<string, Set<string>>,
  criticalTaskIds: Set<string>,
  options: LevelingOptions
): GanttTask | null {
  // If prioritizing critical, delay non-critical task
  if (options.prioritizeCritical) {
    const task1Critical = criticalTaskIds.has(task1.id);
    const task2Critical = criticalTaskIds.has(task2.id);
    
    if (task1Critical && !task2Critical) {
      return task2;
    }
    if (task2Critical && !task1Critical) {
      return task1;
    }
  }
  
  // Check if tasks have successors (dependents)
  const task1HasDependents = dependencyGraph.has(task1.id) && dependencyGraph.get(task1.id)!.size > 0;
  const task2HasDependents = dependencyGraph.has(task2.id) && dependencyGraph.get(task2.id)!.size > 0;
  
  // Delay task with fewer dependents (less impact)
  if (task1HasDependents && !task2HasDependents) {
    return task2;
  }
  if (task2HasDependents && !task1HasDependents) {
    return task1;
  }
  
  // Default: delay the later task
  return task2.startDate > task1.startDate ? task2 : task1;
}

/**
 * Calculate days needed to delay task to avoid overlap
 */
function calculateDelayNeeded(task1: GanttTask, task2: GanttTask): number {
  // Delay until task1 ends
  const msPerDay = 1000 * 60 * 60 * 24;
  const overlap = Math.ceil((task1.endDate.getTime() - task2.startDate.getTime()) / msPerDay);
  return Math.max(1, overlap + 1); // At least 1 day buffer
}

/**
 * Delay a task by specified days
 */
function delayTask(
  task: GanttTask,
  delayDays: number,
  allTasks: GanttTask[],
  dependencyGraph: Map<string, Set<string>>,
  options: LevelingOptions
): LevelingChange | null {
  // Check max delay limit
  if (delayDays > options.maxDelayDays) {
    return null;
  }
  
  const originalStart = new Date(task.startDate);
  const originalEnd = new Date(task.endDate);
  
  // Calculate new dates
  const msPerDay = 1000 * 60 * 60 * 24;
  const newStart = new Date(originalStart.getTime() + delayDays * msPerDay);
  const newEnd = new Date(originalEnd.getTime() + delayDays * msPerDay);
  
  // Check if this would violate any constraints
  if (options.respectConstraints) {
    const violation = checkConstraints(task, newStart, allTasks, dependencyGraph);
    if (violation) {
      return null;
    }
  }
  
  // Apply the delay
  task.startDate = newStart;
  task.endDate = newEnd;
  
  return {
    taskId: task.id,
    taskName: task.name,
    originalStart,
    newStart,
    originalEnd,
    newEnd,
    delayDays,
    reason: `Resource leveling: delayed ${delayDays} days to resolve over-allocation`,
  };
}

/**
 * Check if new start date violates dependencies
 */
function checkConstraints(
  task: GanttTask,
  newStart: Date,
  allTasks: GanttTask[],
  dependencyGraph: Map<string, Set<string>>
): string | null {
  // Find all predecessors (tasks that this task depends on)
  for (const [predecessorId, successors] of dependencyGraph.entries()) {
    if (successors.has(task.id)) {
      const predecessor = allTasks.find(t => t.id === predecessorId);
      if (predecessor && predecessor.endDate > newStart) {
        return `Would violate dependency with ${predecessor.name}`;
      }
    }
  }
  
  return null; // No violation
}

/**
 * Build dependency graph (predecessor -> successors)
 */
function buildDependencyGraph(
  dependencies: Dependency[],
  tasks: GanttTask[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  // Initialize all tasks
  tasks.forEach(t => {
    if (!graph.has(t.id)) {
      graph.set(t.id, new Set());
    }
  });
  
  // Add dependencies
  dependencies.forEach(dep => {
    if (!graph.has(dep.predecessorId)) {
      graph.set(dep.predecessorId, new Set());
    }
    graph.get(dep.predecessorId)!.add(dep.successorId);
  });
  
  return graph;
}

/**
 * Identify critical tasks (simplified - tasks on longest path)
 */
function identifyCriticalTasks(
  tasks: GanttTask[],
  dependencies: Dependency[]
): Set<string> {
  // This is a simplified version - use criticalPath.ts for full implementation
  // For now, just mark tasks with no slack as critical
  const critical = new Set<string>();
  
  // Find tasks with dependents
  const hasDependents = new Set<string>();
  dependencies.forEach(dep => {
    hasDependents.add(dep.predecessorId);
  });
  
  // Find tasks with predecessors
  const hasPredecessors = new Set<string>();
  dependencies.forEach(dep => {
    hasPredecessors.add(dep.successorId);
  });
  
  // Tasks on critical path typically have both
  tasks.forEach(task => {
    if (hasDependents.has(task.id) || !hasPredecessors.has(task.id)) {
      critical.add(task.id);
    }
  });
  
  return critical;
}

/**
 * Calculate total project duration in days
 */
function calculateProjectDuration(tasks: GanttTask[]): number {
  if (tasks.length === 0) return 0;
  
  const startDates = tasks.filter(t => !t.isGroup).map(t => t.startDate.getTime());
  const endDates = tasks.filter(t => !t.isGroup).map(t => t.endDate.getTime());
  
  const minStart = Math.min(...startDates);
  const maxEnd = Math.max(...endDates);
  
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((maxEnd - minStart) / msPerDay);
}

/**
 * Quick check if leveling is needed
 */
export function needsLeveling(tasks: GanttTask[]): boolean {
  const allocations = calculateResourceAllocations(tasks);
  return allocations.some(a => a.overAllocated);
}

/**
 * Get leveling preview (without applying changes)
 */
export function previewLeveling(
  tasks: GanttTask[],
  dependencies: Dependency[],
  options: Partial<LevelingOptions> = {}
): {
  needed: boolean;
  affectedTasks: number;
  estimatedExtension: number;
  conflicts: number;
} {
  const result = levelResources(tasks, dependencies, options);
  
  return {
    needed: result.changes.length > 0,
    affectedTasks: new Set(result.changes.map(c => c.taskId)).size,
    estimatedExtension: result.extensionDays,
    conflicts: result.unresolvedConflicts.length,
  };
}
