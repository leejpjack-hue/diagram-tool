import type { GanttTask, Dependency } from '../components/Gantt/types';

/**
 * Sprint 11: Task Templates for common project workflows
 */

export interface GanttTemplate {
  id: string;
  name: string;
  description: string;
  category: 'software' | 'marketing' | 'general' | 'event' | 'construction';
  tasks: Omit<GanttTask, 'id'>[];
  dependencies: Omit<Dependency, 'predecessorId' | 'successorId'>[]; // indices into tasks array
}

const COLORS = {
  planning: '#3b82f6',
  design: '#8b5cf6',
  development: '#10b981',
  testing: '#f59e0b',
  deployment: '#06b6d4',
  review: '#ec4899',
  milestone: '#ef4444',
};

/**
 * Software Development Project Template
 */
export const softwareDevelopmentTemplate: GanttTemplate = {
  id: 'software-dev',
  name: 'Software Development',
  description: 'Complete software development lifecycle from planning to deployment',
  category: 'software',
  tasks: [
    { name: 'Project Planning', startDate: new Date(), endDate: addDays(3), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Requirements Analysis', startDate: addDays(3), endDate: addDays(7), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Technical Design', startDate: addDays(7), endDate: addDays(12), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'UI/UX Design', startDate: addDays(7), endDate: addDays(14), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Database Design', startDate: addDays(12), endDate: addDays(15), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Backend Development', startDate: addDays(15), endDate: addDays(30), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Frontend Development', startDate: addDays(15), endDate: addDays(28), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'API Integration', startDate: addDays(25), endDate: addDays(32), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Unit Testing', startDate: addDays(28), endDate: addDays(35), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Integration Testing', startDate: addDays(32), endDate: addDays(38), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'UAT', startDate: addDays(35), endDate: addDays(40), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Bug Fixes', startDate: addDays(38), endDate: addDays(43), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Documentation', startDate: addDays(35), endDate: addDays(42), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
    { name: 'Deployment Prep', startDate: addDays(42), endDate: addDays(45), progress: 0, color: COLORS.deployment, dependencies: [], assignee: '' },
    { name: 'Production Deployment', startDate: addDays(45), endDate: addDays(46), progress: 0, color: COLORS.milestone, dependencies: [], milestone: true, assignee: '' },
    { name: 'Post-Launch Review', startDate: addDays(46), endDate: addDays(48), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
  ],
  dependencies: [
    { type: 'FS', lag: 0 }, // 0 -> 1
    { type: 'FS', lag: 0 }, // 1 -> 2
    { type: 'FS', lag: 0 }, // 1 -> 3
    { type: 'FS', lag: 0 }, // 2 -> 4
    { type: 'FS', lag: 0 }, // 4 -> 5
    { type: 'FS', lag: 0 }, // 4 -> 6
    { type: 'FS', lag: 0 }, // 5 -> 7
    { type: 'SS', lag: -5 }, // 5 -> 8 (overlap)
    { type: 'FS', lag: 0 }, // 7 -> 9
    { type: 'FS', lag: 0 }, // 9 -> 10
    { type: 'SS', lag: -3 }, // 10 -> 11 (overlap)
    { type: 'SS', lag: 0 }, // 10 -> 12
    { type: 'FS', lag: 0 }, // 11 -> 13
    { type: 'FS', lag: 0 }, // 13 -> 14
    { type: 'FS', lag: 0 }, // 14 -> 15
  ],
};

/**
 * Marketing Campaign Template
 */
export const marketingCampaignTemplate: GanttTemplate = {
  id: 'marketing-campaign',
  name: 'Marketing Campaign',
  description: 'Complete marketing campaign from strategy to analysis',
  category: 'marketing',
  tasks: [
    { name: 'Market Research', startDate: new Date(), endDate: addDays(5), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Target Audience Analysis', startDate: addDays(3), endDate: addDays(7), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Campaign Strategy', startDate: addDays(5), endDate: addDays(10), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Creative Brief', startDate: addDays(7), endDate: addDays(12), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Content Creation', startDate: addDays(10), endDate: addDays(20), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Visual Design', startDate: addDays(10), endDate: addDays(18), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Video Production', startDate: addDays(12), endDate: addDays(22), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Channel Setup', startDate: addDays(18), endDate: addDays(22), progress: 0, color: COLORS.deployment, dependencies: [], assignee: '' },
    { name: 'Campaign Launch', startDate: addDays(22), endDate: addDays(23), progress: 0, color: COLORS.milestone, dependencies: [], milestone: true, assignee: '' },
    { name: 'Monitoring & Optimization', startDate: addDays(22), endDate: addDays(35), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Performance Analysis', startDate: addDays(35), endDate: addDays(40), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
  ],
  dependencies: [
    { type: 'SS', lag: -2 }, // 0 -> 1
    { type: 'FS', lag: 0 }, // 0 -> 2
    { type: 'FS', lag: 0 }, // 1 -> 3
    { type: 'FS', lag: 0 }, // 2 -> 4
    { type: 'FS', lag: 0 }, // 2 -> 5
    { type: 'FS', lag: 0 }, // 3 -> 6
    { type: 'FS', lag: 0 }, // 4 -> 7
    { type: 'FS', lag: 0 }, // 5 -> 7
    { type: 'FS', lag: 0 }, // 6 -> 7
    { type: 'FS', lag: 0 }, // 7 -> 8
    { type: 'SS', lag: 0 }, // 8 -> 9
    { type: 'FS', lag: 0 }, // 9 -> 10
  ],
};

/**
 * Event Planning Template
 */
export const eventPlanningTemplate: GanttTemplate = {
  id: 'event-planning',
  name: 'Event Planning',
  description: 'Complete event planning from concept to post-event',
  category: 'event',
  tasks: [
    { name: 'Event Concept', startDate: new Date(), endDate: addDays(5), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Budget Planning', startDate: addDays(3), endDate: addDays(8), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Venue Selection', startDate: addDays(5), endDate: addDays(12), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Vendor Selection', startDate: addDays(8), endDate: addDays(15), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Marketing & Promotion', startDate: addDays(12), endDate: addDays(30), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Registration Setup', startDate: addDays(10), endDate: addDays(15), progress: 0, color: COLORS.deployment, dependencies: [], assignee: '' },
    { name: 'Speaker/Entertainment Booking', startDate: addDays(15), endDate: addDays(25), progress: 0, color: COLORS.design, dependencies: [], assignee: '' },
    { name: 'Catering Arrangements', startDate: addDays(20), endDate: addDays(28), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Equipment & AV Setup', startDate: addDays(25), endDate: addDays(30), progress: 0, color: COLORS.deployment, dependencies: [], assignee: '' },
    { name: 'Final Walkthrough', startDate: addDays(29), endDate: addDays(30), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Event Day', startDate: addDays(30), endDate: addDays(31), progress: 0, color: COLORS.milestone, dependencies: [], milestone: true, assignee: '' },
    { name: 'Post-Event Follow-up', startDate: addDays(31), endDate: addDays(35), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
  ],
  dependencies: [
    { type: 'SS', lag: -2 }, // 0 -> 1
    { type: 'FS', lag: 0 }, // 0 -> 2
    { type: 'FS', lag: 0 }, // 1 -> 3
    { type: 'FS', lag: 0 }, // 2 -> 4
    { type: 'FS', lag: 0 }, // 2 -> 5
    { type: 'FS', lag: 0 }, // 3 -> 6
    { type: 'FS', lag: 0 }, // 3 -> 7
    { type: 'FS', lag: 0 }, // 6 -> 8
    { type: 'FS', lag: 0 }, // 7 -> 8
    { type: 'FS', lag: 0 }, // 8 -> 9
    { type: 'FS', lag: 0 }, // 9 -> 10
    { type: 'FS', lag: 0 }, // 10 -> 11
  ],
};

/**
 * Sprint/Agile Template
 */
export const agileSprintTemplate: GanttTemplate = {
  id: 'agile-sprint',
  name: 'Agile Sprint (2 weeks)',
  description: 'Two-week agile sprint template with ceremonies',
  category: 'software',
  tasks: [
    { name: 'Sprint Planning', startDate: new Date(), endDate: addDays(1), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Story Point Estimation', startDate: new Date(), endDate: addDays(1), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Development - Day 1-3', startDate: addDays(1), endDate: addDays(4), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Daily Standups', startDate: addDays(1), endDate: addDays(10), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
    { name: 'Development - Day 4-6', startDate: addDays(4), endDate: addDays(7), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Mid-Sprint Review', startDate: addDays(5), endDate: addDays(5), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
    { name: 'Development - Day 7-9', startDate: addDays(7), endDate: addDays(10), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Code Review', startDate: addDays(8), endDate: addDays(10), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Testing & Bug Fixes', startDate: addDays(9), endDate: addDays(11), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Sprint Demo Prep', startDate: addDays(10), endDate: addDays(11), progress: 0, color: COLORS.deployment, dependencies: [], assignee: '' },
    { name: 'Sprint Review', startDate: addDays(11), endDate: addDays(11), progress: 0, color: COLORS.milestone, dependencies: [], milestone: true, assignee: '' },
    { name: 'Sprint Retrospective', startDate: addDays(11), endDate: addDays(12), progress: 0, color: COLORS.review, dependencies: [], assignee: '' },
  ],
  dependencies: [
    { type: 'SS', lag: 0 }, // 0 -> 1
    { type: 'FS', lag: 0 }, // 0 -> 2
    { type: 'SS', lag: 0 }, // 2 -> 3
    { type: 'FS', lag: 0 }, // 2 -> 4
    { type: 'FS', lag: 0 }, // 4 -> 6
    { type: 'SS', lag: 0 }, // 4 -> 5
    { type: 'FS', lag: 0 }, // 6 -> 7
    { type: 'SS', lag: -1 }, // 6 -> 8
    { type: 'FS', lag: 0 }, // 8 -> 9
    { type: 'FS', lag: 0 }, // 9 -> 10
    { type: 'FS', lag: 0 }, // 10 -> 11
  ],
};

/**
 * Simple Project Template
 */
export const simpleProjectTemplate: GanttTemplate = {
  id: 'simple-project',
  name: 'Simple Project',
  description: 'Basic project structure with planning, execution, and wrap-up',
  category: 'general',
  tasks: [
    { name: 'Planning', startDate: new Date(), endDate: addDays(5), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Research', startDate: addDays(2), endDate: addDays(8), progress: 0, color: COLORS.planning, dependencies: [], assignee: '' },
    { name: 'Execution Phase 1', startDate: addDays(5), endDate: addDays(12), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Execution Phase 2', startDate: addDays(10), endDate: addDays(18), progress: 0, color: COLORS.development, dependencies: [], assignee: '' },
    { name: 'Review & Testing', startDate: addDays(15), endDate: addDays(20), progress: 0, color: COLORS.testing, dependencies: [], assignee: '' },
    { name: 'Final Delivery', startDate: addDays(20), endDate: addDays(21), progress: 0, color: COLORS.milestone, dependencies: [], milestone: true, assignee: '' },
  ],
  dependencies: [
    { type: 'SS', lag: -3 }, // 0 -> 1
    { type: 'FS', lag: 0 }, // 0 -> 2
    { type: 'SS', lag: -2 }, // 2 -> 3
    { type: 'FS', lag: 0 }, // 3 -> 4
    { type: 'FS', lag: 0 }, // 4 -> 5
  ],
};

// Helper function
function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * All available templates
 */
export const GANTT_TEMPLATES: GanttTemplate[] = [
  simpleProjectTemplate,
  softwareDevelopmentTemplate,
  agileSprintTemplate,
  marketingCampaignTemplate,
  eventPlanningTemplate,
];

/**
 * Apply a template to create tasks with unique IDs
 */
export function applyTemplate(template: GanttTemplate): { tasks: GanttTask[]; dependencies: Dependency[] } {
  const idPrefix = `template-${Date.now()}`;
  
  const tasks: GanttTask[] = template.tasks.map((task, index) => ({
    ...task,
    id: `${idPrefix}-task-${index}`,
    startDate: new Date(task.startDate),
    endDate: new Date(task.endDate),
  }));
  
  const dependencies: Dependency[] = template.dependencies.map((dep, index) => ({
    ...dep,
    predecessorId: `${idPrefix}-task-${index}`,
    successorId: `${idPrefix}-task-${index + 1}`,
  }));
  
  return { tasks, dependencies };
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: GanttTemplate['category']): GanttTemplate[] {
  return GANTT_TEMPLATES.filter(t => t.category === category);
}
