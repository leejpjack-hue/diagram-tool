import type { GanttTask } from './types';

/**
 * Build a map of task-id -> WBS code (e.g. "1", "1.2", "1.2.3").
 *
 * Root tasks are numbered in the order they appear in the `tasks` array.
 * Children are numbered in the order they appear under a parent.
 * Applies to both leaf tasks and groups.
 */
export function computeWbsCodes(tasks: GanttTask[]): Map<string, string> {
  const wbs = new Map<string, string>();
  const childrenByParent = new Map<string | undefined, GanttTask[]>();

  tasks.forEach(t => {
    const key = t.parentId ?? undefined;
    const list = childrenByParent.get(key) ?? [];
    list.push(t);
    childrenByParent.set(key, list);
  });

  const walk = (parentId: string | undefined, prefix: string) => {
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.forEach((t, i) => {
      const code = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      wbs.set(t.id, code);
      if (t.isGroup) {
        walk(t.id, code);
      }
    });
  };

  walk(undefined, '');
  return wbs;
}

/**
 * Recompute group-level rollup fields (startDate, endDate, progress) based on
 * direct + indirect children. Returns a new array; input is not mutated.
 *
 * - startDate = min of descendant leaf start dates
 * - endDate   = max of descendant leaf end dates
 * - progress  = unweighted average of descendant leaf progresses (rounded)
 *
 * Groups with no descendant leaves keep their existing values.
 */
export function recomputeGroupRollups(tasks: GanttTask[]): GanttTask[] {
  const childrenByParent = new Map<string, GanttTask[]>();
  tasks.forEach(t => {
    if (t.parentId) {
      const list = childrenByParent.get(t.parentId) ?? [];
      list.push(t);
      childrenByParent.set(t.parentId, list);
    }
  });

  // Collect all descendant leaves (non-group tasks) of a group.
  const leavesOf = (groupId: string, acc: GanttTask[] = []): GanttTask[] => {
    const direct = childrenByParent.get(groupId) ?? [];
    direct.forEach(c => {
      if (c.isGroup) {
        leavesOf(c.id, acc);
      } else {
        acc.push(c);
      }
    });
    return acc;
  };

  const updates = new Map<string, Partial<GanttTask>>();
  tasks.forEach(t => {
    if (!t.isGroup) return;
    const leaves = leavesOf(t.id);
    if (leaves.length === 0) return;

    const starts = leaves.map(l => new Date(l.startDate).getTime());
    const ends = leaves.map(l => new Date(l.endDate).getTime());
    const progressSum = leaves.reduce((s, l) => s + (l.progress ?? 0), 0);

    updates.set(t.id, {
      startDate: new Date(Math.min(...starts)),
      endDate: new Date(Math.max(...ends)),
      progress: Math.round(progressSum / leaves.length),
    });
  });

  if (updates.size === 0) return tasks;

  return tasks.map(t => {
    const patch = updates.get(t.id);
    return patch ? { ...t, ...patch } : t;
  });
}
