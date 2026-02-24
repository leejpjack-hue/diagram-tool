/**
 * Critical Path Method (CPM) Algorithm
 * 
 * Calculates the longest path through the project network,
 * identifying tasks that directly impact project duration.
 */

import type { GanttTask, Dependency } from './types';

export interface CriticalPathResult {
  /** Task IDs on the critical path in order */
  path: string[];
  /** Total project duration in days */
  duration: number;
  /** Slack/float time for each task (days) */
  slack: Map<string, number>;
  /** Early start for each task */
  earlyStart: Map<string, number>;
  /** Early finish for each task */
  earlyFinish: Map<string, number>;
  /** Late start for each task */
  lateStart: Map<string, number>;
  /** Late finish for each task */
  lateFinish: Map<string, number>;
}

/**
 * Calculate critical path using forward and backward pass
 */
export function calculateCriticalPath(
  tasks: GanttTask[],
  dependencies: Dependency[],
  projectStart: Date
): CriticalPathResult {
  const slack = new Map<string, number>();
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();
  
  // Build adjacency lists
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const depMap = new Map<string, Dependency>();
  
  tasks.forEach(t => {
    successors.set(t.id, []);
    predecessors.set(t.id, []);
    earlyStart.set(t.id, 0);
  });
  
  dependencies.forEach(dep => {
    const key = `${dep.predecessorId}->${dep.successorId}`;
    depMap.set(key, dep);
    successors.get(dep.predecessorId)?.push(dep.successorId);
    predecessors.get(dep.successorId)?.push(dep.predecessorId);
  });
  
  // Get task duration in days
  const getDuration = (task: GanttTask): number => {
    const ms = task.endDate.getTime() - task.startDate.getTime();
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };
  
  // Get task start offset from project start (in days)
  const getStartOffset = (task: GanttTask): number => {
    const ms = task.startDate.getTime() - projectStart.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  };
  
  // Topological sort for forward pass
  const sorted = topologicalSort(tasks, successors);
  
  // Forward pass - calculate early start and early finish
  sorted.forEach(taskId => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const duration = getDuration(task);
    let es = getStartOffset(task);
    
    // Check all predecessors
    const preds = predecessors.get(taskId) || [];
    preds.forEach(predId => {
      const predTask = tasks.find(t => t.id === predId);
      if (!predTask) return;
      
      const depKey = `${predId}->${taskId}`;
      const dep = depMap.get(depKey);
      const predEF = earlyFinish.get(predId) || 0;
      const predES = earlyStart.get(predId) || 0;
      
      // Calculate based on dependency type
      switch (dep?.type || 'FS') {
        case 'FS': // Finish-to-Start
          es = Math.max(es, predEF + (dep?.lag || 0));
          break;
        case 'SS': // Start-to-Start
          es = Math.max(es, predES + (dep?.lag || 0));
          break;
        case 'FF': // Finish-to-Finish
          es = Math.max(es, predEF - duration + (dep?.lag || 0));
          break;
        case 'SF': // Start-to-Finish
          es = Math.max(es, predES - duration + (dep?.lag || 0));
          break;
      }
    });
    
    earlyStart.set(taskId, es);
    earlyFinish.set(taskId, es + duration);
  });
  
  // Find project duration
  const projectDuration = Math.max(...Array.from(earlyFinish.values()));
  
  // Backward pass - calculate late start and late finish
  const reversed = [...sorted].reverse();
  
  // Initialize late finish for all tasks
  tasks.forEach(t => {
    lateFinish.set(t.id, projectDuration);
    lateStart.set(t.id, 0);
  });
  
  reversed.forEach(taskId => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const duration = getDuration(task);
    let lf = projectDuration;
    
    // Check all successors
    const succs = successors.get(taskId) || [];
    succs.forEach(succId => {
      const succTask = tasks.find(t => t.id === succId);
      if (!succTask) return;
      
      const depKey = `${taskId}->${succId}`;
      const dep = depMap.get(depKey);
      const succLS = lateStart.get(succId) || projectDuration;
      const succDuration = getDuration(succTask);
      const succLF = lateFinish.get(succId) || projectDuration;
      
      // Calculate based on dependency type
      switch (dep?.type || 'FS') {
        case 'FS': // Finish-to-Start
          lf = Math.min(lf, succLS - (dep?.lag || 0));
          break;
        case 'SS': // Start-to-Start
          lf = Math.min(lf, succLS + duration - succDuration - (dep?.lag || 0));
          break;
        case 'FF': // Finish-to-Finish
          lf = Math.min(lf, succLF - (dep?.lag || 0));
          break;
        case 'SF': // Start-to-Finish
          lf = Math.min(lf, succLS + duration - (dep?.lag || 0));
          break;
      }
    });
    
    lateFinish.set(taskId, lf);
    lateStart.set(taskId, lf - duration);
  });
  
  // Calculate slack for each task
  tasks.forEach(t => {
    const es = earlyStart.get(t.id) || 0;
    const ls = lateStart.get(t.id) || 0;
    slack.set(t.id, ls - es);
  });
  
  // Find critical path (tasks with zero slack)
  const criticalTasks = tasks.filter(t => (slack.get(t.id) || 0) === 0);
  
  // Order critical tasks by early start
  const path = criticalTasks
    .sort((a, b) => (earlyStart.get(a.id) || 0) - (earlyStart.get(b.id) || 0))
    .map(t => t.id);
  
  return {
    path,
    duration: projectDuration,
    slack,
    earlyStart,
    earlyFinish,
    lateStart,
    lateFinish,
  };
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(
  tasks: GanttTask[],
  successors: Map<string, string[]>
): string[] {
  const inDegree = new Map<string, number>();
  const result: string[] = [];
  
  // Initialize in-degrees
  tasks.forEach(t => inDegree.set(t.id, 0));
  
  // Calculate in-degrees
  tasks.forEach(t => {
    const succs = successors.get(t.id) || [];
    succs.forEach(succId => {
      inDegree.set(succId, (inDegree.get(succId) || 0) + 1);
    });
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
    
    const succs = successors.get(nodeId) || [];
    succs.forEach(succId => {
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
 * Check if a task is on the critical path
 */
export function isCritical(taskId: string, result: CriticalPathResult): boolean {
  return result.path.includes(taskId);
}

/**
 * Get tasks sorted by criticality (most critical first)
 */
export function sortByCriticality(
  tasks: GanttTask[],
  result: CriticalPathResult
): GanttTask[] {
  return [...tasks].sort((a, b) => {
    const slackA = result.slack.get(a.id) || 0;
    const slackB = result.slack.get(b.id) || 0;
    return slackA - slackB; // Lower slack = more critical
  });
}
