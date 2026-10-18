import type { GanttTask, GanttProject, Dependency, DependencyType, GanttSourceSchedule } from './types';
import { resolveLinkedSchedule } from './autoSchedule';

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
 *     duration: 5d
 *     after: OtherTask, Research
 *     depends: OtherTask:FS+2d
 *     color: #3b82f6
 *     milestone: true
 *   }
 * }
 * ```
 *
 * `duration:` is calendar days (`d`) or weeks (`w` = 7 days).
 * `after:` starts the day after the latest predecessor ends and adds an FS link.
 * An explicit `start:` beats `after:`. An explicit `end:` beats `duration:`.
 */
export interface GanttParseDetails {
  project: GanttProject | null;
  error: string | null;
  warnings: string[];
}

export function parseGanttDSL(dsl: string): GanttProject | null {
  return parseGanttDSLDetailed(dsl).project;
}

export function parseGanttDSLDetailed(dsl: string): GanttParseDetails {
  let title = 'Untitled Project';
  let projectStart = new Date();
  const tasks: GanttTask[] = [];
  const dependencies: Dependency[] = [];
  const groupStack: { id: string; name: string }[] = [];
  
  let currentTask: Partial<GanttTask> | null = null;
  let taskIdCounter = 1;
  const warnings: string[] = [];
  const afterRefs: { name: string; line: number }[] = [];
  
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
  
  const rawLines = dsl.split('\n');
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const line = rawLines[lineIndex].trim();
    const lineNumber = lineIndex + 1;
    if (!line) continue;

    // Project metadata. A task's own start: is handled with the task.
    if (line.startsWith('title:')) {
      title = line.replace('title:', '').trim();
      continue;
    }
    
    if (line.startsWith('start:') && !currentTask) {
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
        sourceSchedule: { explicitStart: false, explicitEnd: false },
      };
      continue;
    }
    
    // Task properties
    if (currentTask) {
      if (line.startsWith('start:')) {
        const dateStr = line.replace('start:', '').trim();
        const parsed = parseDate(dateStr);
        if (parsed) {
          currentTask.startDate = parsed;
          markSchedule(currentTask, { explicitStart: true });
        }
      } else if (line.startsWith('end:')) {
        const dateStr = line.replace('end:', '').trim();
        const parsed = parseDate(dateStr);
        if (parsed) {
          currentTask.endDate = parsed;
          markSchedule(currentTask, { explicitEnd: true });
        }
      } else if (line.startsWith('duration:')) {
        const parsed = parseDuration(line.replace(/^duration:\s*/i, '').trim());
        if (parsed) {
          markSchedule(currentTask, { durationDays: parsed.days, durationUnit: parsed.unit });
        }
      } else if (line.startsWith('after:')) {
        const names = line.replace(/^after:\s*/i, '').split(',').map(part => part.trim()).filter(Boolean);
        if (names.length === 0) {
          warnings.push(`after: at line ${lineNumber} needs a task name.`);
        }
        names.forEach(depName => {
          afterRefs.push({ name: depName, line: lineNumber });
          addTaskDependency(currentTask!, depName, 'FS', 0);
        });
        const existing = currentTask.sourceSchedule?.after ?? [];
        markSchedule(currentTask, { after: [...existing, ...names] });
      } else if (line.startsWith('assignee:')) {
        currentTask.assignee = line.replace('assignee:', '').trim();
      } else if (line.startsWith('progress:')) {
        currentTask.progress = parseInt(line.replace('progress:', '').trim(), 10) || 0;
      } else if (line.startsWith('depends:')) {
        const depStr = line.replace('depends:', '').trim();
        
        // Support comma-separated dependencies: "TaskA, TaskB, TaskC"
        const depNames = depStr.split(',').map(d => d.trim()).filter(d => d);
        depNames.forEach(depName => {
          const parsed = parseDependencyString(depName);
          addTaskDependency(currentTask!, parsed.name, parsed.type, parsed.lag);
        });
      } else if (line.startsWith('color:')) {
        currentTask.color = line.replace('color:', '').trim();
      } else if (line.startsWith('milestone:')) {
        const value = line.replace('milestone:', '').trim();
        currentTask.milestone = value === 'true' || value === 'True' || value === '1';
        console.log(`[Parser] Parsed milestone for task "${currentTask.name}":`, currentTask.milestone, '(value:', value, ')');
      } else if (line.startsWith('time:')) {
        // Sprint 12: Time tracking syntax: time: estimated:16h, logged:8h
        if (!currentTask.timeTracking) {
          currentTask.timeTracking = { estimated: 0, logged: 0, remaining: 0 };
        }
        const timeStr = line.replace('time:', '').trim();
        const parts = timeStr.split(',').map(p => p.trim());
        parts.forEach(part => {
          if (part.startsWith('estimated:')) {
            currentTask!.timeTracking!.estimated = parseHours(part.replace('estimated:', ''));
          } else if (part.startsWith('logged:')) {
            currentTask!.timeTracking!.logged = parseHours(part.replace('logged:', ''));
          }
        });
        currentTask.timeTracking.remaining = currentTask.timeTracking.estimated - currentTask.timeTracking.logged;
      } else if (line.startsWith('custom:')) {
        // Sprint 12: Custom fields syntax: custom: { priority: high, storyPoints: 5 }
        // DT-GANTT-02 also writes custom: role=ai|human|tool
        const customStr = line.replace('custom:', '').trim();
        currentTask.customFields = parseCustomAssignment(customStr) ?? parseCustomFields(customStr);
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
  const resolveTaskId = (name: string): string | undefined => {
    const exact = taskNameToId.get(name);
    if (exact) return exact;
    const stripped = stripTaskName(name);
    for (const [key, id] of taskNameToId) {
      if (stripTaskName(key) === stripped) return id;
    }
    return undefined;
  };

  const unknownAfter = new Set<string>();
  afterRefs.forEach(ref => {
    if (resolveTaskId(ref.name)) return;
    const key = `${ref.line}:${ref.name}`;
    if (unknownAfter.has(key)) return;
    unknownAfter.add(key);
    warnings.push(`Unknown task "${stripTaskName(ref.name)}" in after: at line ${ref.line}.`);
  });
  
  tasks.forEach(task => {
    // Resolve simple dependencies (backward compatibility)
    task.dependencies = task.dependencies
      .map(dep => resolveTaskId(dep) || dep)
      .filter(dep => tasks.some(t => t.id === dep));
    
    // Resolve dependency details
    if (task.dependencyDetails) {
      task.dependencyDetails.forEach(dep => {
        dep.predecessorId = resolveTaskId(dep.predecessorId) || dep.predecessorId;
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
          const duplicate = dependencies.some(existing =>
            existing.predecessorId === dep.predecessorId
            && existing.successorId === dep.successorId
            && existing.type === dep.type
            && existing.lag === dep.lag,
          );
          if (!duplicate) dependencies.push(dep);
        }
      });
    }
  });

  const scheduled = resolveLinkedSchedule(tasks, dependencies, projectStart);
  if (scheduled.cycleNames) {
    return {
      project: null,
      error: `Circular dependency: ${scheduled.cycleNames.join(' → ')}`,
      warnings: [],
    };
  }
  const scheduledTasks = scheduled.tasks;
  
  // Calculate group progress (rollup from children)
  scheduledTasks.filter(t => t.isGroup).forEach(group => {
    if (group.children && group.children.length > 0) {
      const childTasks = scheduledTasks.filter(t => group.children!.includes(t.id));
      const totalProgress = childTasks.reduce((sum, t) => sum + t.progress, 0);
      group.progress = Math.round(totalProgress / childTasks.length);
      
      // Set group dates from children
      const starts = childTasks.map(t => t.startDate.getTime());
      const ends = childTasks.map(t => t.endDate.getTime());
      group.startDate = new Date(Math.min(...starts));
      group.endDate = new Date(Math.max(...ends));
    }
  });
  
  console.log('[Parser] Parsed tasks:', scheduledTasks.map(t => ({ name: t.name, milestone: t.milestone, start: t.startDate, end: t.endDate })));
  return {
    project: { title, startDate: projectStart, tasks: scheduledTasks, milestones: [], dependencies },
    error: null,
    warnings,
  };
}

function markSchedule(task: Partial<GanttTask>, patch: Partial<GanttSourceSchedule>) {
  task.sourceSchedule = {
    explicitStart: false,
    explicitEnd: false,
    ...task.sourceSchedule,
    ...patch,
  };
}

function addTaskDependency(task: Partial<GanttTask>, name: string, type: DependencyType, lag: number) {
  if (!task.dependencies) task.dependencies = [];
  if (!task.dependencyDetails) task.dependencyDetails = [];
  const duplicate = task.dependencyDetails.some(dep =>
    dep.predecessorId === name && dep.type === type && dep.lag === lag,
  );
  if (duplicate) return;
  task.dependencies.push(name);
  task.dependencyDetails.push({
    predecessorId: name,
    successorId: task.id || '',
    type,
    lag,
  });
}

function stripTaskName(name: string): string {
  const trimmed = name.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
    || (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseDuration(value: string): { days: number; unit: 'd' | 'w' } | undefined {
  const match = value.match(/^(\d+)\s*([dw])$/i);
  if (!match) return undefined;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase() as 'd' | 'w';
  return { days: unit === 'w' ? amount * 7 : amount, unit };
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
    description: partial.description,
    notes: partial.notes,
    tags: partial.tags,
    customFields: partial.customFields,
    timeTracking: partial.timeTracking,
    sourceSchedule: partial.sourceSchedule,
  };
}

const GANTT_HEADER = /^\s*diagram:\s*gantt\b/im;
const OTHER_DIAGRAM_HEADER = /^\s*diagram:\s*(architecture|flow)\b/im;
const MERMAID_SEQUENCE = /^\s*sequenceDiagram\b/im;
const MERMAID_FLOW = /^\s*(?:flowchart|graph)\b/im;
const MERMAID_GANTT = /^\s*gantt\b/im;

/**
 * Validate native Gantt DSL (`diagram: gantt`). Invalid source must not replace
 * the last good plan — callers keep the previous project when `error` is set.
 */
export function findGanttSourceError(text: string): string | null {
  if (MERMAID_SEQUENCE.test(text)) {
    return 'This source is a sequenceDiagram. Open it on the Sequence tab.';
  }
  if (OTHER_DIAGRAM_HEADER.test(text)) {
    return 'This source is not a Gantt plan. Gantt boards use `diagram: gantt` with task / group blocks.';
  }
  if (MERMAID_FLOW.test(text)) {
    return 'This source is a flowchart. Open it on the Flow tab.';
  }
  if (MERMAID_GANTT.test(text) && !GANTT_HEADER.test(text)) {
    return 'Gantt source must start with `diagram: gantt` (native DSL, not Mermaid gantt).';
  }
  if (!GANTT_HEADER.test(text)) {
    return 'Gantt source must start with `diagram: gantt`.';
  }

  const braceError = findGanttBraceError(text);
  if (braceError) return braceError;

  const dateError = findGanttDateError(text);
  if (dateError) return dateError;

  const durationError = findGanttDurationError(text);
  if (durationError) return durationError;

  return null;
}

export function parseGanttSource(text: string): { project: GanttProject | null; error: string | null; warnings: string[] } {
  const error = findGanttSourceError(text);
  if (error) return { project: null, error, warnings: [] };
  const parsed = parseGanttDSLDetailed(text);
  if (parsed.error || !parsed.project) {
    return { project: null, error: parsed.error ?? 'Parse error', warnings: [] };
  }
  return { project: parsed.project, error: null, warnings: parsed.warnings };
}

function findGanttBraceError(text: string): string | null {
  let depth = 0;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // `#` comments (including the Type tasks stash) are not blocks.
    if (lines[i].trim().startsWith('#')) continue;
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth < 0) return `Unexpected } at line ${i + 1}.`;
      }
    }
  }
  if (depth > 0) return 'Expected } to close a task or group block.';
  return null;
}

function findGanttDateError(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^(start|end):\s*(.+)$/i);
    if (!match) continue;
    const value = match[2].trim();
    if (!value) continue;
    if (!parseDate(value)) {
      return `Invalid ${match[1].toLowerCase()} date at line ${i + 1}. Use YYYY-MM-DD or +Nd.`;
    }
  }
  return null;
}

function findGanttDurationError(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^duration:\s*(.*)$/i);
    if (!match) continue;
    if (!parseDuration(match[1].trim())) {
      return `Invalid duration at line ${i + 1}. Use Nd or Nw, for example 5d or 2w.`;
    }
  }
  return null;
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
 * Sprint 12: Parse hours from string like "16h" or "16"
 */
function parseHours(str: string): number {
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*h?$/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

/** `custom: role=ai` (and `role=ai, priority=high`). Brace form stays in parseCustomFields. */
function parseCustomAssignment(str: string): Record<string, string | number | boolean> | null {
  const content = str.trim();
  if (!content || content.startsWith('{') || !content.includes('=')) return null;
  const fields: Record<string, string | number | boolean> = {};
  for (const part of content.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return null;
    const key = part.slice(0, eq).trim();
    if (!key) return null;
    fields[key] = parseCustomValue(part.slice(eq + 1).trim());
  }
  return fields;
}

function parseCustomValue(raw: string): string | number | boolean {
  let value: string | number | boolean = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  const numValue = typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? parseFloat(value) : NaN;
  if (!Number.isNaN(numValue) && value !== '') return numValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * Sprint 12: Parse custom fields from string like "{ priority: high, storyPoints: 5 }"
 */
function parseCustomFields(str: string): Record<string, string | number | boolean> {
  const fields: Record<string, string | number | boolean> = {};
  
  // Remove braces if present
  let content = str.trim();
  if (content.startsWith('{') && content.endsWith('}')) {
    content = content.slice(1, -1);
  }
  
  // Split by comma, but respect nested structures
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of content) {
    if (char === '{' || char === '[') depth++;
    if (char === '}' || char === ']') depth--;
    
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  // Parse each field
  parts.forEach(part => {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const key = part.slice(0, colonIndex).trim();
      let value: string | number | boolean = part.slice(colonIndex + 1).trim();
      
      // Try to parse as number
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        value = numValue;
      }
      
      // Try to parse as boolean
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      
      // Remove quotes from strings
      if (typeof value === 'string' && (value.startsWith('"') || value.startsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      fields[key] = value;
    }
  });
  
  return fields;
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
          lines.push(`${prefix}  time: ${timeParts.join(', ')}`);
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
        lines.push(`${prefix}  custom: { ${customParts.join(', ')} }`);
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
