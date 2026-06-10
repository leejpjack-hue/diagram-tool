import { useMemo, useState } from 'react';
import { useGanttStore } from './ganttStore';
import type { GanttTask } from './types';

// Monday-style board view: tasks grouped into status columns by progress.
// Dragging a card to another column updates the task's progress, which
// round-trips into the DSL through the existing generator effect.

type ColumnKey = 'todo' | 'doing' | 'done';

const COLUMNS: { key: ColumnKey; title: string; accent: string; hint: string }[] = [
  { key: 'todo', title: 'Not started', accent: '#94a3b8', hint: 'Tasks at 0% progress' },
  { key: 'doing', title: 'In progress', accent: '#3b82f6', hint: 'Tasks underway' },
  { key: 'done', title: 'Done', accent: '#10b981', hint: 'Tasks at 100%' },
];

function columnFor(task: GanttTask): ColumnKey {
  if (task.progress >= 100) return 'done';
  if (task.progress > 0) return 'doing';
  return 'todo';
}

// Progress applied when a card is dropped into a column. Moving to "doing"
// keeps existing partial progress if there is any.
function progressFor(col: ColumnKey, current: number): number {
  if (col === 'done') return 100;
  if (col === 'todo') return 0;
  return current > 0 && current < 100 ? current : 50;
}

const fmt = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function GanttBoardView() {
  const { tasks, updateTask, setSelectedTask, selectedTaskId } = useGanttStore();
  const [dragOver, setDragOver] = useState<ColumnKey | null>(null);

  const cards = useMemo(() => tasks.filter(t => !t.isGroup), [tasks]);
  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, GanttTask[]> = { todo: [], doing: [], done: [] };
    cards.forEach(t => map[columnFor(t)].push(t));
    return map;
  }, [cards]);

  const handleDrop = (col: ColumnKey, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/task-id');
    const task = cards.find(t => t.id === id);
    if (!task || columnFor(task) === col) return;
    updateTask(id, { progress: progressFor(col, task.progress) });
  };

  return (
    <div className="h-full overflow-x-auto bg-slate-50 p-4">
      <div className="flex gap-4 h-full min-w-[760px]">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            className={`flex-1 flex flex-col rounded-xl border transition-colors ${
              dragOver === col.key ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
            onDragLeave={() => setDragOver(prev => (prev === col.key ? null : prev))}
            onDrop={(e) => handleDrop(col.key, e)}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.accent }} />
              <span className="text-sm font-semibold text-slate-800">{col.title}</span>
              <span className="ml-auto text-xs font-medium text-slate-400" title={col.hint}>
                {byColumn[col.key].length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {byColumn[col.key].length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6">
                  Drag tasks here
                </div>
              ) : (
                byColumn[col.key].map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                    onClick={() => setSelectedTask(task.id)}
                    className={`rounded-lg border bg-white p-2.5 cursor-grab shadow-sm hover:shadow-md transition-shadow ${
                      selectedTaskId === task.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: task.color || '#3b82f6' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-slate-900 leading-snug">
                          {task.milestone ? '◆ ' : ''}{task.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-slate-500">
                            {fmt(task.startDate)} – {fmt(task.endDate)}
                          </span>
                          {task.assignee && (
                            <span
                              className="ml-auto w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center"
                              title={task.assignee}
                            >
                              {task.assignee.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {col.key === 'doing' && (
                          <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${task.progress}%`, background: task.color || '#3b82f6' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
