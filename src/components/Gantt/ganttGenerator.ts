import type { GanttTask, Dependency } from './types';

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
    lines.push(`${indent}task ${task.name} {`);
    lines.push(`${indent}  start: ${formatDate(new Date(task.startDate))}`);
    lines.push(`${indent}  end: ${formatDate(new Date(task.endDate))}`);
    
    if (task.assignee) {
      lines.push(`${indent}  assignee: ${task.assignee}`);
    }
    
    if (task.progress !== undefined && task.progress !== 0) {
      lines.push(`${indent}  progress: ${task.progress}`);
    }
    
    // Add dependencies
    const taskDeps = getTaskDependencies(task.id);
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
