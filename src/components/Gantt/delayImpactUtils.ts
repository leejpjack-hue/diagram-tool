/**
 * Delay Impact Prediction Utilities
 * 
 * Calculate how task delays propagate through the project
 */

import type { GanttTask, Dependency } from './types';

export interface DelayImpactResult {
  affectedTasks: AffectedTask[];
  projectDelay: number;
  criticalPathImpacted: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
}

export interface AffectedTask {
  task: GanttTask;
  originalStart: Date;
  newStart: Date;
  delayDays: number;
  impactLevel: 'none' | 'indirect' | 'direct';
}

/**
 * Calculate the impact of a task delay
 */
export function calculateDelayImpact(
  delayedTaskId: string,
  delayDays: number,
  tasks: GanttTask[],
  dependencies: Dependency[]
): DelayImpactResult {
  // Find the delayed task
  const delayedTask = tasks.find(t => t.id === delayedTaskId);
  if (!delayedTask) {
    throw new Error(`Task ${delayedTaskId} not found`);
  }

  // Build dependency graph
  const graph = buildDependencyGraph(tasks, dependencies);
  
  // Calculate affected tasks using BFS
  const affectedTasks = calculateAffectedTasks(
    delayedTask,
    delayDays,
    graph,
    tasks
  );

  // Calculate project delay
  const projectDelay = calculateProjectDelay(affectedTasks);

  // Check if critical path is impacted
  const criticalPathImpacted = checkCriticalPathImpact(affectedTasks);

  // Calculate risk score
  const riskScore = calculateRiskScore(delayDays, affectedTasks, criticalPathImpacted);

  // Determine risk level
  const riskLevel = getRiskLevel(riskScore);

  return {
    affectedTasks,
    projectDelay,
    criticalPathImpacted,
    riskLevel,
    riskScore,
  };
}

/**
 * Build a dependency graph
 */
function buildDependencyGraph(
  tasks: GanttTask[],
  dependencies: Dependency[]
): Map<string, { predecessors: string[]; successors: string[] }> {
  const graph = new Map<string, { predecessors: string[]; successors: string[] }>();

  // Initialize graph
  tasks.forEach(task => {
    graph.set(task.id, { predecessors: [], successors: [] });
  });

  // Add dependencies
  dependencies.forEach(dep => {
    const predecessor = graph.get(dep.predecessorId);
    const successor = graph.get(dep.successorId);
    
    if (predecessor && successor) {
      predecessor.successors.push(dep.successorId);
      successor.predecessors.push(dep.predecessorId);
    }
  });

  return graph;
}

/**
 * Calculate affected tasks using BFS
 */
function calculateAffectedTasks(
  delayedTask: GanttTask,
  delayDays: number,
  graph: Map<string, { predecessors: string[]; successors: string[] }>,
  tasks: GanttTask[]
): AffectedTask[] {
  const affected: AffectedTask[] = [];
  const visited = new Set<string>();
  const queue: { taskId: string; delay: number }[] = [];

  // Start with the delayed task
  queue.push({ taskId: delayedTask.id, delay: delayDays });

  while (queue.length > 0) {
    const { taskId, delay } = queue.shift()!;

    if (visited.has(taskId)) continue;
    visited.add(taskId);

    const task = tasks.find(t => t.id === taskId);
    if (!task) continue;

    // Calculate new start date
    const originalStart = new Date(task.startDate);
    const newStart = new Date(originalStart);
    newStart.setDate(newStart.getDate() + delay);

    // Determine impact level
    let impactLevel: 'none' | 'indirect' | 'direct' = 'none';
    if (delay > 0) {
      impactLevel = taskId === delayedTask.id ? 'direct' : 'indirect';
    }

    // Add to affected tasks
    affected.push({
      task,
      originalStart,
      newStart,
      delayDays: delay,
      impactLevel,
    });

    // Propagate to successors
    const node = graph.get(taskId);
    if (node) {
      node.successors.forEach(successorId => {
        if (!visited.has(successorId)) {
          queue.push({ taskId: successorId, delay });
        }
      });
    }
  }

  return affected;
}

/**
 * Calculate total project delay
 */
function calculateProjectDelay(
  affectedTasks: AffectedTask[]
): number {
  if (affectedTasks.length === 0) return 0;

  // Find the latest end date in affected tasks
  const maxDelay = Math.max(...affectedTasks.map(t => t.delayDays));
  
  return maxDelay;
}

/**
 * Check if critical path is impacted
 */
function checkCriticalPathImpact(affectedTasks: AffectedTask[]): boolean {
  // For now, assume all affected tasks could be on critical path
  // In a full implementation, we'd check against actual critical path
  return affectedTasks.some(t => t.delayDays > 0);
}

/**
 * Calculate risk score (0-100)
 */
function calculateRiskScore(
  delayDays: number,
  affectedTasks: AffectedTask[],
  criticalPathImpacted: boolean
): number {
  let score = 0;

  // Base score from delay days
  score += Math.min(delayDays * 5, 30); // Max 30 points

  // Score from number of affected tasks
  const impactedCount = affectedTasks.filter(t => t.delayDays > 0).length;
  score += Math.min(impactedCount * 10, 40); // Max 40 points

  // Critical path impact
  if (criticalPathImpacted) {
    score += 30; // Max 30 points
  }

  return Math.min(score, 100);
}

/**
 * Get risk level from score
 */
function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score < 30) return 'low';
  if (score < 70) return 'medium';
  return 'high';
}

/**
 * Format delay for display
 */
export function formatDelay(days: number): string {
  if (days === 0) return 'No delay';
  if (days === 1) return '+1 day';
  return `+${days} days`;
}

/**
 * Get impact color
 */
export function getImpactColor(level: 'none' | 'indirect' | 'direct'): string {
  switch (level) {
    case 'direct':
      return '#ef4444'; // red
    case 'indirect':
      return '#f59e0b'; // yellow
    case 'none':
    default:
      return '#10b981'; // green
  }
}

/**
 * Get risk level color
 */
export function getRiskLevelColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return '#ef4444'; // red
    case 'medium':
      return '#f59e0b'; // yellow
    case 'low':
    default:
      return '#10b981'; // green
  }
}
