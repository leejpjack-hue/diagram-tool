// Gantt Chart Types

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number; // 0-100
  assignee?: string;
  color?: string;
  dependencies: string[]; // task IDs
  milestone?: boolean;
}

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
}

export type GanttZoomLevel = 'day' | 'week' | 'month';

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'; 
// FS: Finish-to-Start (default)
// SS: Start-to-Start
// FF: Finish-to-Finish
// SF: Start-to-Finish
