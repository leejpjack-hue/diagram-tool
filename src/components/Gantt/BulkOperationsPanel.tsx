/**
 * Sprint 10: Bulk Operations Panel
 * 
 * Provides bulk task operations (delete, update progress, assign, etc.)
 * when multiple tasks are selected.
 */

import { useGanttStore } from './ganttStore';
import type { GanttTask } from './types';
import './BulkOperationsPanel.css';

interface BulkOperationsPanelProps {
  onClose?: () => void;
}

export function BulkOperationsPanel({ onClose }: BulkOperationsPanelProps) {
  const {
    selectedTaskIds,
    getSelectedTasks,
    clearSelection,
    deleteSelectedTasks,
    updateSelectedTasks,
    tasks,
  } = useGanttStore();
  
  const selectedTasks = getSelectedTasks();
  const selectionCount = selectedTaskIds.size;
  
  if (selectionCount === 0) {
    return null;
  }
  
  // Get common values from selected tasks
  const commonAssignee = getCommonAssignee(selectedTasks);
  const avgProgress = Math.round(
    selectedTasks.reduce((sum, t) => sum + t.progress, 0) / selectedTasks.length
  );
  
  // Get unique assignees for dropdown
  const assignees = Array.from(
    new Set(tasks.filter(t => t.assignee).map(t => t.assignee!))
  ).sort();
  
  const handleDeleteSelected = () => {
    if (confirm(`Delete ${selectionCount} selected tasks?`)) {
      deleteSelectedTasks();
      onClose?.();
    }
  };
  
  const handleProgressChange = (progress: number) => {
    updateSelectedTasks({ progress });
  };
  
  const handleAssigneeChange = (assignee: string) => {
    updateSelectedTasks({ assignee: assignee || undefined });
  };
  
  const handleClearSelection = () => {
    clearSelection();
    onClose?.();
  };
  
  return (
    <div className="bulk-operations-panel">
      {/* Header */}
      <div className="bulk-panel-header">
        <div className="bulk-panel-title">
          <span className="bulk-count">{selectionCount}</span>
          <span>tasks selected</span>
        </div>
        <button
          onClick={handleClearSelection}
          className="bulk-close-btn"
          title="Clear selection"
        >
          ✕
        </button>
      </div>
      
      {/* Quick Actions */}
      <div className="bulk-quick-actions">
        <button
          onClick={handleDeleteSelected}
          className="bulk-action-btn bulk-action-danger"
          title="Delete selected tasks"
        >
          🗑️ Delete
        </button>
        <button
          onClick={handleClearSelection}
          className="bulk-action-btn"
          title="Clear selection"
        >
          ✕ Clear
        </button>
        <button
          onClick={() => useGanttStore.getState().selectAllTasks()}
          className="bulk-action-btn"
          title="Select all tasks"
        >
          ✓ Select All
        </button>
      </div>
      
      {/* Progress Control */}
      <div className="bulk-control-group">
        <label className="bulk-label">
          Set Progress (avg: {avgProgress}%)
        </label>
        <div className="bulk-progress-control">
          <input
            type="range"
            min="0"
            max="100"
            value={avgProgress}
            onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
            className="bulk-progress-slider"
          />
          <span className="bulk-progress-value">{avgProgress}%</span>
        </div>
        <div className="bulk-progress-presets">
          {[0, 25, 50, 75, 100].map(p => (
            <button
              key={p}
              onClick={() => handleProgressChange(p)}
              className="bulk-preset-btn"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
      
      {/* Assignee Control */}
      <div className="bulk-control-group">
        <label className="bulk-label">
          Assign To
        </label>
        <select
          value={commonAssignee || ''}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          className="bulk-assignee-select"
        >
          <option value="">Unassigned</option>
          {assignees.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      
      {/* Selected Tasks Preview */}
      <div className="bulk-tasks-preview">
        <div className="bulk-preview-header">
          Selected Tasks
        </div>
        <div className="bulk-preview-list">
          {selectedTasks.slice(0, 5).map(task => (
            <div key={task.id} className="bulk-preview-item">
              <span className="bulk-preview-name">{task.name}</span>
              <span className="bulk-preview-progress">{task.progress}%</span>
            </div>
          ))}
          {selectedTasks.length > 5 && (
            <div className="bulk-preview-more">
              +{selectedTasks.length - 5} more...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get the common assignee from selected tasks
 * Returns null if tasks have different assignees
 */
function getCommonAssignee(tasks: GanttTask[]): string | null {
  const assignees = new Set(tasks.map(t => t.assignee || ''));
  if (assignees.size === 1) {
    return Array.from(assignees)[0] || null;
  }
  return null;
}

export default BulkOperationsPanel;
