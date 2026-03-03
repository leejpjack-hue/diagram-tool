// Gantt Chart Types

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
// FS: Finish-to-Start (default) - predecessor must finish before successor starts
// SS: Start-to-Start - both tasks start at same time
// FF: Finish-to-Finish - both tasks finish at same time
// SF: Start-to-Finish - predecessor starts before successor finishes

export interface Dependency {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lag: number; // days (can be negative for lead time)
}

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  assignee?: string;
  color?: string;
  dependencies: string[]; // task IDs (for backward compatibility)
  milestone?: boolean;
  
  // Sprint 8: Task Groups
  parentId?: string;
  children?: string[];
  isGroup?: boolean;
  collapsed?: boolean;
  
  // Sprint 8: Advanced dependencies (stored separately in project)
  dependencyDetails?: Dependency[];
  
  // Sprint 11: Task notes/description
  description?: string;
  notes?: string;
  tags?: string[];
  
  // Sprint 12: Custom fields
  customFields?: Record<string, any>;
  
  // Sprint 12: Time tracking
  timeTracking?: {
    estimated: number; // hours
    logged: number; // hours
    remaining: number; // hours (auto-calculated or manually set)
  };
}

// Sprint 12: Custom field definition
export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'checkbox';
  options?: string[]; // for select/multiselect types
  required?: boolean;
  defaultValue?: any;
}

// Sprint 12: Predefined custom fields
export const DEFAULT_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  {
    id: 'priority',
    name: 'Priority',
    type: 'select',
    options: ['low', 'medium', 'high', 'critical'],
    defaultValue: 'medium',
  },
  {
    id: 'storyPoints',
    name: 'Story Points',
    type: 'number',
    defaultValue: 0,
  },
  {
    id: 'sprint',
    name: 'Sprint',
    type: 'text',
  },
  {
    id: 'category',
    name: 'Category',
    type: 'select',
    options: ['feature', 'bug', 'improvement', 'documentation', 'testing'],
  },
];

export interface GanttMilestone {
  id: string;
  name: string;
  date: Date;
  color?: string;
}

export interface GanttProject {
  title: string;
  startDate: Date;
  tasks: GanttTask[];
  milestones: GanttMilestone[];
  
  // Sprint 8: Advanced dependencies
  dependencies: Dependency[];
}

export type GanttZoomLevel = 'day' | 'week' | 'month';

// Sprint 8: Critical Path Result
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

// Sprint 8: Resource allocation
export interface ResourceAllocation {
  assignee: string;
  tasks: string[];
  totalDays: number;
  peakLoad: number; // max hours in any single day
  utilization: number; // percentage (100% = 8h/day)
  overAllocated: boolean;
}

// Sprint 8: Filter state
export interface GanttFilter {
  search: string;
  assignee: string | null;
  status: 'all' | 'not-started' | 'in-progress' | 'complete';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  criticalOnly: boolean;
}

// Sprint 8: Export options
export interface GanttExportOptions {
  format: 'png' | 'pdf' | 'svg';
  includeTaskList: boolean;
  dateRange: 'current' | 'full' | 'custom';
  customStart?: Date;
  customEnd?: Date;
}
