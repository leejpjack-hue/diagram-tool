import { useState, useMemo } from 'react';
import { useGanttStore } from './ganttStore';
import { computeWbsCodes } from './wbsUtils';
import type { GanttTask, DependencyType } from './types';
import './GanttPanel.css';

interface GanttPanelProps {
  onAddTask: (task: Partial<GanttTask>) => void;
}

const DEPENDENCY_TYPES: { value: DependencyType; label: string; description: string }[] = [
  { value: 'FS', label: 'Finish → Start', description: 'Predecessor finishes before successor starts' },
  { value: 'SS', label: 'Start → Start', description: 'Both tasks start together' },
  { value: 'FF', label: 'Finish → Finish', description: 'Both tasks finish together' },
  { value: 'SF', label: 'Start → Finish', description: 'Predecessor starts before successor finishes' },
];

// Preset task colours (matches the Gantt canvas default palette)
const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

export function GanttPanel({ onAddTask }: GanttPanelProps) {
  const {
    tasks,
    dependencies,
    selectedTaskId,
    setSelectedTask,
    updateTask,
    deleteTask,
    addDependency,
    updateDependency,
    removeDependency,
    expandAllGroups,
    collapseAllGroups,
  } = useGanttStore();

  const wbsCodes = useMemo(() => computeWbsCodes(tasks), [tasks]);
  const hasGroups = useMemo(() => tasks.some(t => t.isGroup), [tasks]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingDependency, setIsAddingDependency] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    startDate: '',
    endDate: '',
    assignee: '',
  });
  const [newDependency, setNewDependency] = useState<{
    predecessorId: string;
    type: DependencyType;
    lag: number;
  } | null>(null);
  
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  
  // Get dependencies for selected task
  const taskDependencies = useMemo(() => {
    if (!selectedTaskId) return [];
    return dependencies.filter(d => d.successorId === selectedTaskId);
  }, [dependencies, selectedTaskId]);
  
  // Get available predecessors (tasks that can be predecessors)
  const availablePredecessors = useMemo(() => {
    if (!selectedTaskId) return tasks;
    return tasks.filter(t => 
      t.id !== selectedTaskId && 
      !dependencies.some(d => d.predecessorId === t.id && d.successorId === selectedTaskId)
    );
  }, [tasks, dependencies, selectedTaskId]);
  
  const handleAddTask = () => {
    if (!newTask.name || !newTask.startDate || !newTask.endDate) return;
    
    onAddTask({
      name: newTask.name,
      startDate: new Date(newTask.startDate),
      endDate: new Date(newTask.endDate),
      assignee: newTask.assignee || undefined,
      progress: 0,
      dependencies: [],
    });
    
    setNewTask({ name: '', startDate: '', endDate: '', assignee: '' });
    setIsAdding(false);
  };
  
  const handleProgressChange = (progress: number) => {
    if (selectedTaskId) {
      updateTask(selectedTaskId, { progress });
    }
  };
  
  const handleDeleteTask = () => {
    if (selectedTaskId && confirm('Delete this task?')) {
      deleteTask(selectedTaskId);
    }
  };
  
  const handleAddDependency = () => {
    if (!newDependency || !selectedTaskId) return;
    
    addDependency({
      predecessorId: newDependency.predecessorId,
      successorId: selectedTaskId,
      type: newDependency.type,
      lag: newDependency.lag,
    });
    
    setNewDependency(null);
    setIsAddingDependency(false);
  };
  
  const formatForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="gantt-task-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Gantt Tasks</h2>
          <p className="panel-subtitle">{tasks.length} tasks • {tasks.filter(t => t.isGroup).length} groups</p>
        </div>
      </div>
      
      {/* Task List */}
      {hasGroups && (
        <div className="task-list-controls">
          <button
            type="button"
            className="task-list-ctrl-btn"
            onClick={expandAllGroups}
            title="Expand all groups"
          >
            ▼ Expand all
          </button>
          <button
            type="button"
            className="task-list-ctrl-btn"
            onClick={collapseAllGroups}
            title="Collapse all groups"
          >
            ▶ Collapse all
          </button>
        </div>
      )}
      <div className="task-list">
        {tasks.filter(t => !t.parentId).map(task => (
          <TaskListItem
            key={task.id}
            task={task}
            allTasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTask}
            level={0}
            wbsCodes={wbsCodes}
          />
        ))}
      </div>
      
      {/* Add Task Form */}
      {isAdding && (
        <div className="gantt-form-section">
          <h3 className="gantt-form-title">Add New Task</h3>
          
          <div className="gantt-form-fields">
            <div className="gantt-form-group">
              <label className="gantt-label">Task Name</label>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                className="input"
                placeholder="Enter task name"
              />
            </div>
            
            <div className="gantt-form-row">
              <div className="gantt-form-group">
                <label className="gantt-label">Start Date</label>
                <input
                  type="date"
                  value={newTask.startDate}
                  onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                  className="input"
                />
              </div>
              
              <div className="gantt-form-group">
                <label className="gantt-label">End Date</label>
                <input
                  type="date"
                  value={newTask.endDate}
                  onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            
            <div className="gantt-form-group">
              <label className="gantt-label">Assignee (optional)</label>
              <input
                type="text"
                value={newTask.assignee}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                className="input"
                placeholder="Enter assignee name"
              />
            </div>
            
            <div className="gantt-form-actions">
              <button onClick={handleAddTask} className="btn btn-primary">
                Add Task
              </button>
              <button onClick={() => setIsAdding(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Button */}
      {!isAdding && (
        <div className="gantt-panel-footer">
          <button onClick={() => setIsAdding(true)} className="btn btn-primary btn-full">
            <svg className="btn-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      )}
      
      {/* Selected Task Editor */}
      {selectedTask && !isAdding && (
        <div className="gantt-editor-section">
          <h3 className="gantt-editor-title">
            {selectedTask.isGroup ? '📁 ' : ''}Edit: {selectedTask.name}
          </h3>
          
          {/* Progress Slider */}
          <div className="gantt-progress-section">
            <label className="gantt-label">
              Progress: {selectedTask.progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTask.progress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
              className="gantt-range-input"
            />
          </div>
          
          {/* Date Editors */}
          {!selectedTask.isGroup && (
            <div className="gantt-form-row">
              <div className="gantt-form-group">
                <label className="gantt-label">Start</label>
                <input
                  type="date"
                  value={formatForInput(selectedTask.startDate)}
                  onChange={(e) => updateTask(selectedTask.id, { startDate: new Date(e.target.value) })}
                  className="input input-sm"
                />
              </div>
              <div className="gantt-form-group">
                <label className="gantt-label">End</label>
                <input
                  type="date"
                  value={formatForInput(selectedTask.endDate)}
                  onChange={(e) => updateTask(selectedTask.id, { endDate: new Date(e.target.value) })}
                  className="input input-sm"
                />
              </div>
            </div>
          )}

          {/* Colour Picker */}
          {!selectedTask.isGroup && (
            <div className="gantt-form-group" style={{ marginTop: 4 }}>
              <label className="gantt-label">Colour</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {TASK_COLORS.map((c) => {
                  const isActive = (selectedTask.color || '').toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={`Set colour ${c}`}
                      onClick={() => updateTask(selectedTask.id, { color: c })}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: c,
                        border: isActive ? '2px solid #1e293b' : '1px solid #cbd5e1',
                        boxShadow: isActive ? '0 0 0 2px #fff inset' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  );
                })}
                <input
                  type="color"
                  value={selectedTask.color || '#3b82f6'}
                  title="Custom colour"
                  aria-label="Custom colour"
                  onChange={(e) => updateTask(selectedTask.id, { color: e.target.value })}
                  style={{
                    width: 28,
                    height: 24,
                    padding: 0,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Dependencies Section */}
          {!selectedTask.isGroup && (
            <div className="gantt-dependencies-section">
              <div className="gantt-dependencies-header">
                <label className="gantt-label">Dependencies</label>
                <button
                  onClick={() => setIsAddingDependency(true)}
                  className="btn btn-ghost btn-sm"
                  disabled={availablePredecessors.length === 0}
                >
                  + Add
                </button>
              </div>
              
              {/* Existing Dependencies */}
              {taskDependencies.length > 0 ? (
                <div className="gantt-dependencies-list">
                  {taskDependencies.map((dep) => {
                    const predTask = tasks.find(t => t.id === dep.predecessorId);
                    if (!predTask) return null;
                    
                    return (
                      <div key={`${dep.predecessorId}-${dep.successorId}`} className="gantt-dependency-item">
                        <div className="gantt-dependency-header">
                          <span className="gantt-dependency-name">{predTask.name}</span>
                          <button
                            onClick={() => removeDependency(dep.predecessorId, dep.successorId)}
                            className="btn btn-danger btn-icon btn-sm"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="gantt-dependency-controls">
                          <select
                            value={dep.type}
                            onChange={(e) => updateDependency(dep.predecessorId, dep.successorId, { 
                              type: e.target.value as DependencyType 
                            })}
                            className="input input-sm"
                          >
                            {DEPENDENCY_TYPES.map(dt => (
                              <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                          </select>
                          
                          <div className="gantt-lag-input">
                            <span className="gantt-lag-label">Lag:</span>
                            <input
                              type="number"
                              value={dep.lag}
                              onChange={(e) => updateDependency(dep.predecessorId, dep.successorId, { 
                                lag: parseInt(e.target.value, 10) || 0 
                              })}
                              className="input input-sm gantt-lag-number"
                            />
                            <span className="gantt-lag-label">d</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="gantt-empty-text">No dependencies</p>
              )}
              
              {/* Add Dependency Form */}
              {isAddingDependency && (
                <div className="gantt-add-dependency-form">
                  <select
                    value={newDependency?.predecessorId || ''}
                    onChange={(e) => setNewDependency({ 
                      predecessorId: e.target.value, 
                      type: 'FS', 
                      lag: 0 
                    })}
                    className="input input-sm"
                  >
                    <option value="">Select predecessor...</option>
                    {availablePredecessors.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  
                  {newDependency && (
                    <>
                      <select
                        value={newDependency.type}
                        onChange={(e) => setNewDependency({ 
                          ...newDependency, 
                          type: e.target.value as DependencyType 
                        })}
                        className="input input-sm"
                      >
                        {DEPENDENCY_TYPES.map(dt => (
                          <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                      </select>
                      
                      <div className="gantt-lag-input">
                        <span className="gantt-lag-label">Lag (days):</span>
                        <input
                          type="number"
                          value={newDependency.lag}
                          onChange={(e) => setNewDependency({ 
                            ...newDependency, 
                            lag: parseInt(e.target.value, 10) || 0 
                          })}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div className="gantt-form-actions">
                        <button onClick={handleAddDependency} className="btn btn-primary btn-sm">
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingDependency(false);
                            setNewDependency(null);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Delete Button */}
          <button onClick={handleDeleteTask} className="btn btn-danger btn-full">
            Delete {selectedTask.isGroup ? 'Group' : 'Task'}
          </button>
        </div>
      )}
    </div>
  );
}

// Recursive task list item component
interface TaskListItemProps {
  task: GanttTask;
  allTasks: GanttTask[];
  selectedTaskId: string | null;
  onSelect: (id: string) => void;
  level: number;
  wbsCodes: Map<string, string>;
}

function TaskListItem({ task, allTasks, selectedTaskId, onSelect, level, wbsCodes }: TaskListItemProps) {
  const { expandedGroups, toggleGroup } = useGanttStore();
  const isExpanded = expandedGroups.has(task.id);
  const children = allTasks.filter(t => t.parentId === task.id);
  const wbs = wbsCodes.get(task.id);
  
  return (
    <div>
      <div
        onClick={() => onSelect(task.id)}
        className={`task-item ${selectedTaskId === task.id ? 'active' : ''}`}
        style={{ marginLeft: level * 16 }}
      >
        <div className="task-item-header">
          <div className="task-item-info">
            {task.isGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(task.id);
                }}
                className="task-expand-btn"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <span className="task-item-title">
              {wbs && <span className="task-wbs">{wbs}</span>}
              {task.isGroup ? '📁 ' : ''}{task.name}
            </span>
          </div>
          {task.milestone && (
            <span className="status-badge badge-warning">
              Milestone
            </span>
          )}
        </div>
        
        {!task.isGroup && (
          <>
            <div className="task-item-meta">
              <div>{formatDate(task.startDate)} - {formatDate(task.endDate)}</div>
              {task.assignee && <div>👤 {task.assignee}</div>}
            </div>
            
            {/* Progress bar */}
            <div className="task-progress-section">
              <div className="task-progress-label">
                <span>Progress</span>
                <span>{task.progress}%</span>
              </div>
              <div className="task-progress">
                <div
                  className="task-progress-bar"
                  style={{
                    width: `${task.progress}%`,
                    backgroundColor: task.color || 'var(--primary-600)',
                  }}
                />
              </div>
            </div>
          </>
        )}
        
        {task.isGroup && (
          <div className="task-group-meta">
            {children.length} tasks • {task.progress}% complete
          </div>
        )}
      </div>
      
      {/* Render children */}
      {task.isGroup && isExpanded && children.map(child => (
        <TaskListItem
          key={child.id}
          task={child}
          allTasks={allTasks}
          selectedTaskId={selectedTaskId}
          onSelect={onSelect}
          level={level + 1}
          wbsCodes={wbsCodes}
        />
      ))}
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
