import type { GanttTask, GanttProject } from './types';

/**
 * Parse Gantt DSL into structured data
 * 
 * DSL Format:
 * ```
 * diagram: gantt
 * title: Project Name
 * start: 2026-02-23
 * 
 * task TaskName {
 *   start: 2026-02-23
 *   end: 2026-02-26
 *   assignee: Jack
 *   progress: 50
 *   depends: OtherTask
 *   color: #3b82f6
 *   milestone: true
 * }
 * ```
 */
export function parseGanttDSL(dsl: string): GanttProject | null {
  const lines = dsl.split('\n').map(l => l.trim()).filter(l => l);
  
  let title = 'Untitled Project';
  let projectStart = new Date();
  const tasks: GanttTask[] = [];
  
  let currentTask: Partial<GanttTask> | null = null;
  let taskIdCounter = 1;
  
  for (const line of lines) {
    // Project metadata
    if (line.startsWith('title:')) {
      title = line.replace('title:', '').trim();
      continue;
    }
    
    if (line.startsWith('start:')) {
      const dateStr = line.replace('start:', '').trim();
      const parsed = parseDate(dateStr);
      if (parsed) projectStart = parsed;
      continue;
    }
    
    // Task definition
    if (line.startsWith('task ')) {
      // Save previous task
      if (currentTask && currentTask.name) {
        tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart));
      }
      
      const name = line.replace('task ', '').replace('{', '').trim();
      currentTask = {
        id: `task-${taskIdCounter}`,
        name,
        dependencies: [],
        progress: 0,
      };
      continue;
    }
    
    // Task properties
    if (currentTask) {
      if (line.startsWith('start:')) {
        const dateStr = line.replace('start:', '').trim();
        currentTask.startDate = parseDate(dateStr);
      } else if (line.startsWith('end:')) {
        const dateStr = line.replace('end:', '').trim();
        currentTask.endDate = parseDate(dateStr);
      } else if (line.startsWith('assignee:')) {
        currentTask.assignee = line.replace('assignee:', '').trim();
      } else if (line.startsWith('progress:')) {
        currentTask.progress = parseInt(line.replace('progress:', '').trim(), 10) || 0;
      } else if (line.startsWith('depends:')) {
        const depName = line.replace('depends:', '').trim();
        currentTask.dependencies = [depName];
      } else if (line.startsWith('color:')) {
        currentTask.color = line.replace('color:', '').trim();
      } else if (line.startsWith('milestone:')) {
        currentTask.milestone = line.replace('milestone:', '').trim() === 'true';
      } else if (line === '}') {
        // Close task block
        if (currentTask && currentTask.name) {
          tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart));
        }
        currentTask = null;
      }
    }
  }
  
  // Save last task if not closed
  if (currentTask && currentTask.name) {
    tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart));
  }
  
  // Resolve dependency names to IDs
  const taskNameToId = new Map(tasks.map(t => [t.name, t.id]));
  tasks.forEach(task => {
    task.dependencies = task.dependencies
      .map(dep => taskNameToId.get(dep) || dep)
      .filter(dep => tasks.some(t => t.id === dep));
  });
  
  return { title, startDate: projectStart, tasks, milestones: [] };
}

function finalizeTask(partial: Partial<GanttTask>, idNum: number, projectStart: Date): GanttTask {
  const startDate = partial.startDate || projectStart;
  const endDate = partial.endDate || new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  
  return {
    id: partial.id || `task-${idNum}`,
    name: partial.name || 'Unnamed Task',
    startDate,
    endDate,
    progress: partial.progress ?? 0,
    assignee: partial.assignee,
    color: partial.color,
    dependencies: partial.dependencies || [],
    milestone: partial.milestone,
  };
}

function parseDate(str: string): Date | undefined {
  // Try ISO format: 2026-02-23
  const iso = Date.parse(str);
  if (!isNaN(iso)) {
    return new Date(iso);
  }
  
  // Try relative format: +3d, +1w
  const relativeMatch = str.match(/^\+(\d+)([dwmy])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const now = new Date();
    
    switch (unit) {
      case 'd': now.setDate(now.getDate() + amount); break;
      case 'w': now.setDate(now.getDate() + amount * 7); break;
      case 'm': now.setMonth(now.getMonth() + amount); break;
      case 'y': now.setFullYear(now.getFullYear() + amount); break;
    }
    
    return now;
  }
  
  return undefined;
}

/**
 * Generate Gantt DSL from tasks
 */
export function generateGanttDSL(project: GanttProject): string {
  const lines: string[] = [
    'diagram: gantt',
    `title: ${project.title}`,
    `start: ${formatDateISO(project.startDate)}`,
    '',
  ];
  
  project.tasks.forEach(task => {
    lines.push(`task ${task.name} {`);
    lines.push(`  start: ${formatDateISO(task.startDate)}`);
    lines.push(`  end: ${formatDateISO(task.endDate)}`);
    
    if (task.assignee) {
      lines.push(`  assignee: ${task.assignee}`);
    }
    
    if (task.progress > 0) {
      lines.push(`  progress: ${task.progress}`);
    }
    
    if (task.dependencies.length > 0) {
      const depTask = project.tasks.find(t => t.id === task.dependencies[0]);
      if (depTask) {
        lines.push(`  depends: ${depTask.name}`);
      }
    }
    
    if (task.color) {
      lines.push(`  color: ${task.color}`);
    }
    
    if (task.milestone) {
      lines.push(`  milestone: true`);
    }
    
    lines.push('}');
  });
  
  return lines.join('\n');
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
