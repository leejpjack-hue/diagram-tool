/**
 * Auto-Scheduling and Dependency Validation
 * 
 * Features:
 * - Automatic task scheduling based on dependencies
 * - Circular dependency detection
 * - Dependency violation warnings
 * - Resource conflict detection
 */

import type { GanttTask, Dependency, DependencyType } from './types';

export interface ScheduleResult {
  tasks: GanttTask[];
  warnings: ScheduleWarning[];
  changed: string[]; // IDs of tasks that were changed
}

export interface ScheduleWarning {
  type: 'circular' | 'violation' | 'conflict' | 'overallocation';
  taskId: string;
  message: string;
  details?: unknown;
}

/**
 * Detect circular dependencies in the task graph
 */
export function detectCircularDependencies(
  tasks: GanttTask[],
  dependencies: Dependency[]
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  // Build adjacency list
  const graph = new Map<string, string[]>();
  tasks.forEach(t => graph.set(t.id, []));
  dependencies.forEach(dep => {
    const successors = graph.get(dep.predecessorId) || [];
    successors.push(dep.successorId);
    graph.set(dep.predecessorId, successors);
  });
  
  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const successors = graph.get(nodeId) || [];
    for (const successorId of successors) {
      if (!visited.has(successorId)) {
        if (dfs(successorId, [...path])) {
          return true;
        }
      } else if (recursionStack.has(successorId)) {
        // Found a cycle
        const cycleStart = path.indexOf(successorId);
        const cycle = path.slice(cycleStart);
        cycle.push(successorId);
        cycles.push(cycle);
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  tasks.forEach(task => {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  });
  
  return cycles;
}

/**
 * Auto-schedule tasks based on dependencies
 * Uses forward pass to calculate earliest start dates
 */
export function autoScheduleTasks(
  tasks: GanttTask[],
  dependencies: Dependency[],
  options: {
    respectExistingDates?: boolean;
    preserveMilestones?: boolean;
  } = {}
): ScheduleResult {
  const { respectExistingDates = false, preserveMilestones = true } = options;
  const warnings: ScheduleWarning[] = [];
  const changed: string[] = [];
  
  // Check for circular dependencies first
  const cycles = detectCircularDependencies(tasks, dependencies);
  if (cycles.length > 0) {
    cycles.forEach(cycle => {
      warnings.push({
        type: 'circular',
        taskId: cycle[0],
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        details: { cycle },
      });
    });
    return { tasks, warnings, changed };
  }
  
  // Build dependency graph
  const predecessors = new Map<string, Dependency[]>();
  tasks.forEach(t => predecessors.set(t.id, []));
  dependencies.forEach(dep => {
    const preds = predecessors.get(dep.successorId) || [];
    preds.push(dep);
    predecessors.set(dep.successorId, preds);
  });
  
  // Get task duration in days
  const getDuration = (task: GanttTask): number => {
    const ms = task.endDate.getTime() - task.startDate.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };
  
  // Topological sort for scheduling order
  const sorted = topologicalSort(tasks, dependencies);
  
  // Create a map for quick task lookup
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  
  // Forward pass - calculate earliest start dates
  sorted.forEach(taskId => {
    const task = taskMap.get(taskId);
    if (!task) return;
    
    // Skip milestones if preserving
    if (preserveMilestones && task.milestone) return;
    
    const preds = predecessors.get(taskId) || [];
    let earliestStart = respectExistingDates ? task.startDate : new Date(0);
    
    preds.forEach(dep => {
      const predTask = taskMap.get(dep.predecessorId);
      if (!predTask) return;
      
      const duration = getDuration(task);
      let calculatedStart: Date;
      
      switch (dep.type) {
        case 'FS': // Finish-to-Start
          calculatedStart = addDays(predTask.endDate, dep.lag);
          break;
        case 'SS': // Start-to-Start
          calculatedStart = addDays(predTask.startDate, dep.lag);
          break;
        case 'FF': // Finish-to-Finish
          calculatedStart = addDays(predTask.endDate, dep.lag - duration);
          break;
        case 'SF': // Start-to-Finish
          calculatedStart = addDays(predTask.startDate, dep.lag - duration);
          break;
        default:
          calculatedStart = addDays(predTask.endDate, dep.lag);
      }
      
      if (calculatedStart.getTime() > earliestStart.getTime()) {
        earliestStart = calculatedStart;
      }
    });
    
    // Only update if we found a valid date
    if (earliestStart.getTime() > 0) {
      const duration = getDuration(task);
      const newEndDate = addDays(earliestStart, duration);
      
      // Check if dates changed
      if (task.startDate.getTime() !== earliestStart.getTime() ||
          task.endDate.getTime() !== newEndDate.getTime()) {
        task.startDate = earliestStart;
        task.endDate = newEndDate;
        changed.push(taskId);
      }
    }
  });
  
  return {
    tasks: Array.from(taskMap.values()),
    warnings,
    changed,
  };
}

/**
 * Check for dependency violations in current schedule
 */
export function checkDependencyViolations(
  tasks: GanttTask[],
  dependencies: Dependency[]
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  
  dependencies.forEach(dep => {
    const predecessor = tasks.find(t => t.id === dep.predecessorId);
    const successor = tasks.find(t => t.id === dep.successorId);
    
    if (!predecessor || !successor) return;
    
    let violated = false;
    let message = '';
    
    switch (dep.type) {
      case 'FS':
        if (successor.startDate < predecessor.endDate) {
          violated = true;
          message = `"${successor.name}" starts before "${predecessor.name}" finishes (FS dependency)`;
        }
        break;
      case 'SS':
        if (successor.startDate < predecessor.startDate) {
          violated = true;
          message = `"${successor.name}" starts before "${predecessor.name}" starts (SS dependency)`;
        }
        break;
      case 'FF':
        if (successor.endDate < predecessor.endDate) {
          violated = true;
          message = `"${successor.name}" finishes before "${predecessor.name}" finishes (FF dependency)`;
        }
        break;
      case 'SF':
        if (successor.endDate < predecessor.startDate) {
          violated = true;
          message = `"${successor.name}" finishes before "${predecessor.name}" starts (SF dependency)`;
        }
        break;
    }
    
    if (violated) {
      warnings.push({
        type: 'violation',
        taskId: successor.id,
        message,
        details: { dependency: dep },
      });
    }
  });
  
  return warnings;
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(
  tasks: GanttTask[],
  dependencies: Dependency[]
): string[] {
  const inDegree = new Map<string, number>();
  const result: string[] = [];
  const graph = new Map<string, string[]>();
  
  // Initialize
  tasks.forEach(t => {
    inDegree.set(t.id, 0);
    graph.set(t.id, []);
  });
  
  // Build graph and calculate in-degrees
  dependencies.forEach(dep => {
    const successors = graph.get(dep.predecessorId) || [];
    successors.push(dep.successorId);
    graph.set(dep.predecessorId, successors);
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1);
  });
  
  // Find all nodes with no incoming edges
  const queue: string[] = [];
  tasks.forEach(t => {
    if ((inDegree.get(t.id) || 0) === 0) {
      queue.push(t.id);
    }
  });
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);
    
    const successors = graph.get(nodeId) || [];
    successors.forEach(succId => {
      const newDegree = (inDegree.get(succId) || 0) - 1;
      inDegree.set(succId, newDegree);
      if (newDegree === 0) {
        queue.push(succId);
      }
    });
  }
  
  return result;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Place tasks that use `duration:` / `after:`.
 * Explicit `start:` / `end:` tasks are left on their authored dates so
 * existing boards stay put. `after:` starts the day after the latest
 * predecessor ends; a milestone sits on that end day.
 * Cycles are reported and not scheduled.
 */
export function resolveLinkedSchedule(
  tasks: GanttTask[],
  dependencies: Dependency[],
  projectStart: Date,
): { tasks: GanttTask[]; cycleNames: string[] | null } {
  const nameOf = new Map(tasks.map(task => [task.id, task.name]));
  const cycles = detectCircularDependencies(tasks, dependencies);
  if (cycles.length > 0) {
    return {
      tasks,
      cycleNames: cycles[0].map(id => nameOf.get(id) ?? id),
    };
  }

  const predecessors = new Map<string, Dependency[]>();
  tasks.forEach(task => predecessors.set(task.id, []));
  dependencies.forEach(dep => {
    const list = predecessors.get(dep.successorId);
    if (list) list.push(dep);
  });

  const sorted = topologicalSort(tasks, dependencies);
  const taskMap = new Map(tasks.map(task => [task.id, {
    ...task,
    startDate: new Date(task.startDate),
    endDate: new Date(task.endDate),
  }]));

  sorted.forEach(taskId => {
    const task = taskMap.get(taskId);
    if (!task || task.isGroup) return;
    const hint = task.sourceSchedule;
    if (!hint) return;

    const preds = (predecessors.get(taskId) ?? [])
      .map(dep => taskMap.get(dep.predecessorId))
      .filter((pred): pred is GanttTask => Boolean(pred));
    const afterNames = (hint.after ?? []).map(stripScheduleName);
    const afterPreds = afterNames.length === 0
      ? []
      : preds.filter(pred => afterNames.some(name => scheduleNamesMatch(name, pred.name)));

    let start = new Date(task.startDate);
    if (!hint.explicitStart) {
      if (afterPreds.length > 0) {
        const latest = afterPreds.reduce((max, pred) => (
          pred.endDate.getTime() > max.getTime() ? pred.endDate : max
        ), afterPreds[0].endDate);
        // A milestone sits on the predecessor's end day. Any other task
        // starts the day after that end.
        start = task.milestone ? new Date(latest) : addDays(latest, 1);
      } else {
        start = new Date(projectStart);
      }
    }

    let end = new Date(task.endDate);
    const milestoneOnPredecessor = Boolean(
      task.milestone
      && !hint.explicitStart
      && !hint.explicitEnd
      && afterPreds.length > 0,
    );
    if (milestoneOnPredecessor) {
      end = new Date(start);
    } else if (!hint.explicitEnd && hint.durationDays != null) {
      end = addDays(start, hint.durationDays);
    } else if (!hint.explicitEnd && task.milestone) {
      end = new Date(start);
    } else if (!hint.explicitEnd && !hint.explicitStart) {
      end = addDays(start, 3);
    }

    task.startDate = start;
    task.endDate = end;
  });

  return {
    tasks: tasks.map(task => taskMap.get(task.id) ?? task),
    cycleNames: null,
  };
}

function stripScheduleName(name: string): string {
  const trimmed = name.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function scheduleNamesMatch(written: string, taskName: string): boolean {
  return stripScheduleName(written) === stripScheduleName(taskName);
}

/**
 * Validate a new dependency before adding it
 */
export function validateNewDependency(
  predecessorId: string,
  successorId: string,
  type: DependencyType,
  tasks: GanttTask[],
  dependencies: Dependency[]
): { valid: boolean; message: string } {
  // Check if tasks exist
  const predecessor = tasks.find(t => t.id === predecessorId);
  const successor = tasks.find(t => t.id === successorId);
  
  if (!predecessor || !successor) {
    return { valid: false, message: 'One or both tasks not found' };
  }
  
  // Check for self-dependency
  if (predecessorId === successorId) {
    return { valid: false, message: 'Cannot create dependency to self' };
  }
  
  // Check if dependency already exists
  const exists = dependencies.some(
    d => d.predecessorId === predecessorId && d.successorId === successorId
  );
  if (exists) {
    return { valid: false, message: 'Dependency already exists' };
  }
  
  // Check for circular dependency
  const testDeps = [...dependencies, { predecessorId, successorId, type, lag: 0 }];
  const cycles = detectCircularDependencies(tasks, testDeps);
  if (cycles.length > 0) {
    return { valid: false, message: 'Would create circular dependency' };
  }
  
  return { valid: true, message: '' };
}

/**
 * Get suggested lag time based on task durations
 */
export function suggestLagTime(
  predecessorId: string,
  successorId: string,
  type: DependencyType,
  tasks: GanttTask[]
): number {
  const predecessor = tasks.find(t => t.id === predecessorId);
  const successor = tasks.find(t => t.id === successorId);
  
  if (!predecessor || !successor) return 0;
  
  // For FS dependencies, suggest 0 or 1 day buffer
  if (type === 'FS') {
    return 0;
  }
  
  // For other types, calculate based on current dates
  const msPerDay = 1000 * 60 * 60 * 24;
  
  switch (type) {
    case 'SS':
      return Math.round((successor.startDate.getTime() - predecessor.startDate.getTime()) / msPerDay);
    case 'FF':
      return Math.round((successor.endDate.getTime() - predecessor.endDate.getTime()) / msPerDay);
    case 'SF':
      return Math.round((successor.endDate.getTime() - predecessor.startDate.getTime()) / msPerDay);
    default:
      return 0;
  }
}
