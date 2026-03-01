import type { GanttTask, GanttProject, Dependency, DependencyType } from './types';

/**
 * Parse Gantt DSL into structured data
 * 
 * DSL Format:
 * ```
 * diagram: gantt
 * title: Project Name
 * start: 2026-02-23
 * 
 * group "Phase 1" {
 *   task TaskName {
 *     start: 2026-02-23
 *     end: 2026-02-26
 *     assignee: Jack
 *     progress: 50
 *     depends: OtherTask:FS+2d
 *     color: #3b82f6
 *     milestone: true
 *   }
 * }
 * ```
 */
export function parseGanttDSL(dsl: string): GanttProject | null {
  const lines = dsl.split('\n').map(l => l.trim()).filter(l => l);
  
  let title = 'Untitled Project';
  let projectStart = new Date();
  const tasks: GanttTask[] = [];
  const dependencies: Dependency[] = [];
  const groupStack: { id: string; name: string }[] = [];
  
  let currentTask: Partial<GanttTask> | null = null;
  let taskIdCounter = 1;
  
  // Get current group ID (top of stack)
  const getCurrentGroupId = (): string | undefined => {
    return groupStack.length > 0 ? groupStack[groupStack.length - 1].id : undefined;
  };
  
  // Parse dependency string like "TaskName:FS+2d" or "TaskName" or "TaskName:SS"
  const parseDependencyString = (depStr: string): { name: string; type: DependencyType; lag: number } => {
    // Match: TaskName or TaskName:FS or TaskName:FS+2d or TaskName:FS-1d
    const match = depStr.match(/^([^:]+)(?::(FS|SS|FF|SF))?(?:([+-]\d+)d)?$/);
    if (!match) {
      return { name: depStr, type: 'FS', lag: 0 };
    }
    
    return {
      name: match[1].trim(),
      type: (match[2] as DependencyType) || 'FS',
      lag: match[3] ? parseInt(match[3], 10) : 0,
    };
  };
  
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
    
    // Group definition
    if (line.startsWith('group ')) {
      // Save previous task
      if (currentTask && currentTask.name) {
        tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart, getCurrentGroupId()));
        currentTask = null;
      }
      
      const name = line.replace('group ', '').replace('{', '').trim().replace(/"/g, '');
      const groupId = `group-${taskIdCounter}`;
      taskIdCounter++;
      
      // Add group to tasks
      tasks.push({
        id: groupId,
        name,
        startDate: projectStart,
        endDate: new Date(projectStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        progress: 0,
        dependencies: [],
        isGroup: true,
        collapsed: false,
        children: [],
        parentId: getCurrentGroupId(),
      });
      
      groupStack.push({ id: groupId, name });
      continue;
    }
    
    // Close group
    if (line === '}' && groupStack.length > 0 && !currentTask) {
      groupStack.pop();
      continue;
    }
    
    // Task definition
    if (line.startsWith('task ')) {
      // Save previous task
      if (currentTask && currentTask.name) {
        tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart, getCurrentGroupId()));
      }
      
      const name = line.replace('task ', '').replace('{', '').trim();
      currentTask = {
        id: `task-${taskIdCounter}`,
        name,
        dependencies: [],
        progress: 0,
        parentId: getCurrentGroupId(),
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
        const depStr = line.replace('depends:', '').trim();
        
        // Support comma-separated dependencies: "TaskA, TaskB, TaskC"
        const depNames = depStr.split(',').map(d => d.trim()).filter(d => d);
        
        // Ensure arrays exist
        if (!currentTask.dependencies) {
          currentTask.dependencies = [];
        }
        if (!currentTask.dependencyDetails) {
          currentTask.dependencyDetails = [];
        }
        
        // Process each dependency
        depNames.forEach(depName => {
          const parsed = parseDependencyString(depName);
          
          // ADD to dependencies array (don't overwrite!)
          currentTask.dependencies!.push(parsed.name); // Store name temporarily, resolve later
          
          // ADD to dependencyDetails array (don't overwrite!)
          currentTask.dependencyDetails!.push({
            predecessorId: parsed.name, // Will be resolved to ID later
            successorId: currentTask.id || '',
            type: parsed.type,
            lag: parsed.lag,
          });
        });
      } else if (line.startsWith('color:')) {
        currentTask.color = line.replace('color:', '').trim();
      } else if (line.startsWith('milestone:')) {
        const value = line.replace('milestone:', '').trim();
        currentTask.milestone = value === 'true' || value === 'True' || value === '1';
        console.log(`[Parser] Parsed milestone for task "${currentTask.name}":`, currentTask.milestone, '(value:', value, ')');
      } else if (line === '}') {
        // Close task block
        if (currentTask && currentTask.name) {
          tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart, getCurrentGroupId()));
        }
        currentTask = null;
      }
    }
  }
  
  // Save last task if not closed
  if (currentTask && currentTask.name) {
    tasks.push(finalizeTask(currentTask, taskIdCounter++, projectStart, getCurrentGroupId()));
  }
  
  // Resolve dependency names to IDs
  const taskNameToId = new Map(tasks.map(t => [t.name, t.id]));
  
  tasks.forEach(task => {
    // Resolve simple dependencies (backward compatibility)
    task.dependencies = task.dependencies
      .map(dep => taskNameToId.get(dep) || dep)
      .filter(dep => tasks.some(t => t.id === dep));
    
    // Resolve dependency details
    if (task.dependencyDetails) {
      task.dependencyDetails.forEach(dep => {
        dep.predecessorId = taskNameToId.get(dep.predecessorId) || dep.predecessorId;
        dep.successorId = task.id;
      });
    }
    
    // Update parent's children array
    if (task.parentId) {
      const parent = tasks.find(t => t.id === task.parentId);
      if (parent && parent.children) {
        parent.children.push(task.id);
      }
    }
  });
  
  // Build dependencies array from all tasks
  tasks.forEach(task => {
    if (task.dependencyDetails) {
      task.dependencyDetails.forEach(dep => {
        // Only add if predecessor exists
        if (tasks.some(t => t.id === dep.predecessorId)) {
          dependencies.push(dep);
        }
      });
    }
  });
  
  // Calculate group progress (rollup from children)
  tasks.filter(t => t.isGroup).forEach(group => {
    if (group.children && group.children.length > 0) {
      const childTasks = tasks.filter(t => group.children!.includes(t.id));
      const totalProgress = childTasks.reduce((sum, t) => sum + t.progress, 0);
      group.progress = Math.round(totalProgress / childTasks.length);
      
      // Set group dates from children
      const starts = childTasks.map(t => t.startDate.getTime());
      const ends = childTasks.map(t => t.endDate.getTime());
      group.startDate = new Date(Math.min(...starts));
      group.endDate = new Date(Math.max(...ends));
    }
  });
  
  console.log('[Parser] Parsed tasks:', tasks.map(t => ({ name: t.name, milestone: t.milestone, start: t.startDate, end: t.endDate })));
  return { title, startDate: projectStart, tasks, milestones: [], dependencies };
}

function finalizeTask(partial: Partial<GanttTask>, idNum: number, projectStart: Date, parentId?: string): GanttTask {
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
    parentId: parentId,
    children: partial.children || [],
    isGroup: partial.isGroup || false,
    collapsed: partial.collapsed || false,
    dependencyDetails: partial.dependencyDetails,
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
  
  // Get root tasks (no parent)
  const rootTasks = project.tasks.filter(t => !t.parentId);
  
  const renderTask = (task: GanttTask, indent: number = 0): void => {
    const prefix = '  '.repeat(indent);
    
    if (task.isGroup) {
      lines.push(`${prefix}group "${task.name}" {`);
      
      // Render children
      if (task.children) {
        task.children.forEach(childId => {
          const child = project.tasks.find(t => t.id === childId);
          if (child) {
            renderTask(child, indent + 1);
          }
        });
      }
      
      lines.push(`${prefix}}`);
    } else {
      lines.push(`${prefix}task ${task.name} {`);
      lines.push(`${prefix}  start: ${formatDateISO(task.startDate)}`);
      lines.push(`${prefix}  end: ${formatDateISO(task.endDate)}`);
      
      if (task.assignee) {
        lines.push(`${prefix}  assignee: ${task.assignee}`);
      }
      
      if (task.progress > 0) {
        lines.push(`${prefix}  progress: ${task.progress}`);
      }
      
      // Find dependencies for this task
      const taskDeps = project.dependencies.filter(d => d.successorId === task.id);
      taskDeps.forEach(dep => {
        const predTask = project.tasks.find(t => t.id === dep.predecessorId);
        if (predTask) {
          let depStr = predTask.name;
          if (dep.type !== 'FS' || dep.lag !== 0) {
            depStr += `:${dep.type}`;
            if (dep.lag !== 0) {
              depStr += `${dep.lag >= 0 ? '+' : ''}${dep.lag}d`;
            }
          }
          lines.push(`${prefix}  depends: ${depStr}`);
        }
      });
      
      if (task.color) {
        lines.push(`${prefix}  color: ${task.color}`);
      }
      
      if (task.milestone) {
        lines.push(`${prefix}  milestone: true`);
      }
      
      lines.push(`${prefix}}`);
    }
  };
  
  rootTasks.forEach(task => renderTask(task));
  
  return lines.join('\n');
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
