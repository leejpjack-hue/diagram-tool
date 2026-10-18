import type { GanttTask, Dependency, GanttSourceSchedule } from './types';

/**
 * Generate Gantt DSL from tasks and dependencies
 * This ensures DSL is always the single source of truth
 */
export function generateGanttDSL(
  tasks: GanttTask[],
  dependencies: Dependency[],
  title: string = 'Gantt Chart'
): string {
  const lines: string[] = [];
  
  // Add header
  lines.push('diagram: gantt');
  lines.push(`title: ${title}`);
  
  // Find the earliest start date for project start
  const startDate = tasks.length > 0
    ? tasks.reduce((earliest, task) => {
        const taskStart = new Date(task.startDate);
        return taskStart < earliest ? taskStart : earliest;
      }, new Date(tasks[0].startDate))
    : new Date();
  
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  lines.push(`start: ${formatDate(startDate)}`);
  lines.push('');
  
  // Separate groups and standalone tasks
  const groups = tasks.filter(t => t.isGroup);
  const standaloneTasks = tasks.filter(t => !t.isGroup && !t.parentId);
  
  // Helper function to get dependencies for a task
  const getTaskDependencies = (taskId: string): Dependency[] => {
    return dependencies.filter(d => d.successorId === taskId);
  };
  
  // Helper function to format dependency
  const formatDependency = (dep: Dependency, tasks: GanttTask[]): string => {
    const predecessor = tasks.find(t => t.id === dep.predecessorId);
    if (!predecessor) return '';
    
    let depStr = predecessor.name;
    if (dep.type !== 'FS') {
      depStr += `:${dep.type}`;
    }
    if (dep.lag !== 0) {
      depStr += `${dep.lag >= 0 ? '+' : ''}${dep.lag}d`;
    }
    return depStr;
  };
  
  // Helper function to write a task
  const writeTask = (task: GanttTask, indent: string = ''): void => {
    const schedule = task.sourceSchedule;
    const explicitStart = schedule ? schedule.explicitStart : true;
    const explicitEnd = schedule ? schedule.explicitEnd : true;
    const writeDuration = Boolean(schedule && schedule.durationDays != null && !explicitEnd);
    const anchoredByAfter = Boolean(schedule?.after?.length && !explicitStart);

    lines.push(`${indent}task ${task.name} {`);
    if (explicitStart) {
      lines.push(`${indent}  start: ${formatDate(new Date(task.startDate))}`);
    }
    if (writeDuration && schedule) {
      lines.push(`${indent}  duration: ${formatDuration(schedule)}`);
    } else if (explicitEnd || !anchoredByAfter) {
      lines.push(`${indent}  end: ${formatDate(new Date(task.endDate))}`);
    }
    
    if (task.assignee) {
      lines.push(`${indent}  assignee: ${task.assignee}`);
    }
    
    if (task.progress !== undefined && task.progress !== 0) {
      lines.push(`${indent}  progress: ${task.progress}`);
    }

    if (schedule?.after && schedule.after.length > 0) {
      lines.push(`${indent}  after: ${schedule.after.join(', ')}`);
    }
    
    // Add dependencies that are not already expressed by after:
    const taskDeps = getTaskDependencies(task.id).filter(dep => !coveredByAfter(task, dep, tasks));
    if (taskDeps.length > 0) {
      const depStrings = taskDeps
        .map(dep => formatDependency(dep, tasks))
        .filter(s => s);
      if (depStrings.length > 0) {
        lines.push(`${indent}  depends: ${depStrings.join(', ')}`);
      }
    }
    
    if (task.color) {
      lines.push(`${indent}  color: ${task.color}`);
    }
    
    if (task.milestone) {
      lines.push(`${indent}  milestone: true`);
    }
    
    // Sprint 12: Time tracking
    if (task.timeTracking) {
      const timeParts: string[] = [];
      if (task.timeTracking.estimated > 0) {
        timeParts.push(`estimated:${task.timeTracking.estimated}h`);
      }
      if (task.timeTracking.logged > 0) {
        timeParts.push(`logged:${task.timeTracking.logged}h`);
      }
      if (timeParts.length > 0) {
        lines.push(`${indent}  time: ${timeParts.join(', ')}`);
      }
    }
    
    // Sprint 12: Custom fields
    if (task.customFields && Object.keys(task.customFields).length > 0) {
      const customParts = Object.entries(task.customFields).map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key}: ${value}`;
        }
        return `${key}: ${value}`;
      });
      lines.push(`${indent}  custom: { ${customParts.join(', ')} }`);
    }
    
    lines.push(`${indent}}`);
    lines.push('');
  };
  
  // Write groups and their children
  groups.forEach(group => {
    lines.push(`group "${group.name}" {`);
    
    // Write children of this group
    if (group.children) {
      group.children.forEach(childId => {
        const child = tasks.find(t => t.id === childId);
        if (child) {
          writeTask(child, '  ');
        }
      });
    }
    
    lines.push('}');
    lines.push('');
  });
  
  // Write standalone tasks
  standaloneTasks.forEach(task => {
    writeTask(task);
  });
  
  return lines.join('\n');
}

function formatDuration(schedule: GanttSourceSchedule): string {
  if (schedule.durationUnit === 'w' && schedule.durationDays != null && schedule.durationDays % 7 === 0) {
    return `${schedule.durationDays / 7}w`;
  }
  return `${schedule.durationDays ?? 1}d`;
}

function coveredByAfter(task: GanttTask, dep: Dependency, tasks: GanttTask[]): boolean {
  if (!task.sourceSchedule?.after?.length) return false;
  if (dep.type !== 'FS' || dep.lag !== 0) return false;
  const predecessor = tasks.find(item => item.id === dep.predecessorId);
  if (!predecessor) return false;
  return task.sourceSchedule.after.some(name => scheduleNamesMatch(name, predecessor.name));
}

function scheduleNamesMatch(written: string, taskName: string): boolean {
  return stripScheduleName(written) === stripScheduleName(taskName);
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

function spanDays(end: Date, start: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

/**
 * Canvas edits write back through the task model. A move of a task that
 * has `after:` records an explicit start (that start wins). A resize
 * records `duration:` and drops an explicit end.
 */
export function reconcileBarEdit(task: GanttTask, updates: Partial<GanttTask>): Partial<GanttTask> {
  if (updates.sourceSchedule) return updates;
  const nextStart = updates.startDate ?? task.startDate;
  const nextEnd = updates.endDate ?? task.endDate;
  const startChanged = updates.startDate != null && updates.startDate.getTime() !== new Date(task.startDate).getTime();
  const endChanged = updates.endDate != null && updates.endDate.getTime() !== new Date(task.endDate).getTime();
  if (!startChanged && !endChanged) return updates;

  const prev: GanttSourceSchedule = task.sourceSchedule
    ? { ...task.sourceSchedule, after: task.sourceSchedule.after ? [...task.sourceSchedule.after] : undefined }
    : { explicitStart: true, explicitEnd: true };
  const next: GanttSourceSchedule = { ...prev };

  if (startChanged && endChanged) {
    next.explicitStart = true;
    return { ...updates, sourceSchedule: next };
  }

  if (endChanged && !startChanged) {
    next.durationDays = spanDays(nextEnd, nextStart);
    next.durationUnit = 'd';
    next.explicitEnd = false;
    return { ...updates, sourceSchedule: next };
  }

  next.explicitStart = true;
  if (next.durationDays != null || !next.explicitEnd) {
    next.durationDays = spanDays(nextEnd, nextStart);
    next.durationUnit = 'd';
    next.explicitEnd = false;
  }
  return { ...updates, sourceSchedule: next };
}
