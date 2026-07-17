/**
 * Resource Leveling Algorithm Tests
 * Sprint 13
 */

import { describe, it, expect } from 'vitest';
import {
  levelResources,
  needsLeveling,
  previewLeveling,
} from '../src/components/Gantt/resourceLeveling';
import type { GanttTask, Dependency } from '../src/components/Gantt/types';

describe('Resource Leveling', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  describe('needsLeveling', () => {
    it('should return false when no over-allocation', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 2),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: addDays(today, 3),
          endDate: addDays(today, 5),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      expect(needsLeveling(tasks)).toBe(false);
    });

    it('should return true when over-allocated', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 5),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      expect(needsLeveling(tasks)).toBe(true);
    });
  });

  describe('levelResources', () => {
    it('should resolve simple over-allocation', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 2),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const dependencies: Dependency[] = [];
      const result = levelResources(tasks, dependencies);
      
      expect(result.success).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.extensionDays).toBeGreaterThan(0);
    });

    it('should respect dependencies when leveling', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: ['task-2'],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: addDays(today, 4),
          endDate: addDays(today, 6),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const dependencies: Dependency[] = [
        {
          predecessorId: 'task-2',
          successorId: 'task-1',
          type: 'FS',
          lag: 0,
        },
      ];
      
      const result = levelResources(tasks, dependencies, {
        respectConstraints: true,
      });
      
      // Task-2 should not be delayed before task-1
      const task2 = result.leveledTasks.find(t => t.id === 'task-2');
      expect(task2).toBeDefined();
    });

    it('should handle multiple resources', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Sarah',
          dependencies: [],
        },
        {
          id: 'task-3',
          name: 'Task 3',
          startDate: today,
          endDate: addDays(today, 2),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const dependencies: Dependency[] = [];
      const result = levelResources(tasks, dependencies);
      
      // Should only level Jack's tasks
      const jackChanges = result.changes.filter(c => {
        const task = tasks.find(t => t.id === c.taskId);
        return task?.assignee === 'Jack';
      });
      
      expect(jackChanges.length).toBeGreaterThan(0);
    });

    it('should respect maxDelayDays option', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 30),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 30),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const dependencies: Dependency[] = [];
      const result = levelResources(tasks, dependencies, {
        maxDelayDays: 5,
      });
      
      // All delays should be <= 5
      result.changes.forEach(change => {
        expect(change.delayDays).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('previewLeveling', () => {
    it('should preview leveling without applying changes', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 2),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const dependencies: Dependency[] = [];
      const preview = previewLeveling(tasks, dependencies);
      
      expect(preview.needed).toBe(true);
      expect(preview.affectedTasks).toBeGreaterThan(0);
      expect(preview.estimatedExtension).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task list', () => {
      const result = levelResources([], []);
      expect(result.success).toBe(true);
      expect(result.leveledTasks).toEqual([]);
    });

    it('should handle tasks with no assignee', () => {
      const tasks: GanttTask[] = [
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          dependencies: [],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          startDate: today,
          endDate: addDays(today, 2),
          progress: 0,
          dependencies: [],
        },
      ];
      
      const result = levelResources(tasks, []);
      expect(result.success).toBe(true);
      expect(result.changes.length).toBe(0);
    });

    it('should handle group tasks', () => {
      const tasks: GanttTask[] = [
        {
          id: 'group-1',
          name: 'Group',
          startDate: today,
          endDate: addDays(today, 5),
          progress: 0,
          isGroup: true,
          dependencies: [],
        },
        {
          id: 'task-1',
          name: 'Task 1',
          startDate: today,
          endDate: addDays(today, 3),
          progress: 0,
          assignee: 'Jack',
          dependencies: [],
        },
      ];
      
      const result = levelResources(tasks, []);
      expect(result.success).toBe(true);
    });
  });
});
