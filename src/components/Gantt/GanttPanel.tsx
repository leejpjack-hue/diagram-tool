import { useState, useMemo } from 'react';
import { useGanttStore } from './ganttStore';
import type { GanttTask, DependencyType } from './types';

interface GanttPanelProps {
  onAddTask: (task: Partial<GanttTask>) => void;
}

const DEPENDENCY_TYPES: { value: DependencyType; label: string; description: string }[] = [
  { value: 'FS', label: 'Finish → Start', description: 'Predecessor finishes before successor starts' },
  { value: 'SS', label: 'Start → Start', description: 'Both tasks start together' },
  { value: 'FF', label: 'Finish → Finish', description: 'Both tasks finish together' },
  { value: 'SF', label: 'Start → Finish', description: 'Predecessor starts before successor finishes' },
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
  } = useGanttStore();
  
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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Gantt Tasks</h2>
        <p className="text-sm text-gray-500 mt-1">{tasks.length} tasks • {tasks.filter(t => t.isGroup).length} groups</p>
      </div>
      
      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {tasks.filter(t => !t.parentId).map(task => (
            <TaskListItem
              key={task.id}
              task={task}
              allTasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelect={setSelectedTask}
              level={0}
            />
          ))}
        </div>
      </div>
      
      {/* Add Task Form */}
      {isAdding && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Task</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Task Name</label>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter task name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={newTask.startDate}
                  onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={newTask.endDate}
                  onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assignee (optional)</label>
              <input
                type="text"
                value={newTask.assignee}
                onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter assignee name"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Add Task
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Button */}
      {!isAdding && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setIsAdding(true)}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      )}
      
      {/* Selected Task Editor */}
      {selectedTask && !isAdding && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 max-h-80 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            {selectedTask.isGroup ? '📁 ' : ''}Edit: {selectedTask.name}
          </h3>
          
          {/* Progress Slider */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">
              Progress: {selectedTask.progress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTask.progress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
          
          {/* Date Editors */}
          {!selectedTask.isGroup && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start</label>
                <input
                  type="date"
                  value={formatForInput(selectedTask.startDate)}
                  onChange={(e) => updateTask(selectedTask.id, { startDate: new Date(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End</label>
                <input
                  type="date"
                  value={formatForInput(selectedTask.endDate)}
                  onChange={(e) => updateTask(selectedTask.id, { endDate: new Date(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          )}
          
          {/* Dependencies Section */}
          {!selectedTask.isGroup && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Dependencies</label>
                <button
                  onClick={() => setIsAddingDependency(true)}
                  className="text-xs text-blue-500 hover:text-blue-600"
                  disabled={availablePredecessors.length === 0}
                >
                  + Add
                </button>
              </div>
              
              {/* Existing Dependencies */}
              {taskDependencies.length > 0 ? (
                <div className="space-y-2">
                  {taskDependencies.map((dep) => {
                    const predTask = tasks.find(t => t.id === dep.predecessorId);
                    if (!predTask) return null;
                    
                    return (
                      <div key={`${dep.predecessorId}-${dep.successorId}`} className="bg-white p-2 rounded border text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{predTask.name}</span>
                          <button
                            onClick={() => removeDependency(dep.predecessorId, dep.successorId)}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={dep.type}
                            onChange={(e) => updateDependency(dep.predecessorId, dep.successorId, { 
                              type: e.target.value as DependencyType 
                            })}
                            className="text-xs border rounded px-1 py-0.5"
                          >
                            {DEPENDENCY_TYPES.map(dt => (
                              <option key={dt.value} value={dt.value}>{dt.label}</option>
                            ))}
                          </select>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Lag:</span>
                            <input
                              type="number"
                              value={dep.lag}
                              onChange={(e) => updateDependency(dep.predecessorId, dep.successorId, { 
                                lag: parseInt(e.target.value, 10) || 0 
                              })}
                              className="w-12 text-xs border rounded px-1 py-0.5"
                            />
                            <span className="text-xs text-gray-500">d</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No dependencies</p>
              )}
              
              {/* Add Dependency Form */}
              {isAddingDependency && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <select
                    value={newDependency?.predecessorId || ''}
                    onChange={(e) => setNewDependency({ 
                      predecessorId: e.target.value, 
                      type: 'FS', 
                      lag: 0 
                    })}
                    className="w-full text-xs border rounded px-2 py-1 mb-2"
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
                        className="w-full text-xs border rounded px-2 py-1 mb-2"
                      >
                        {DEPENDENCY_TYPES.map(dt => (
                          <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                      </select>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">Lag (days):</span>
                        <input
                          type="number"
                          value={newDependency.lag}
                          onChange={(e) => setNewDependency({ 
                            ...newDependency, 
                            lag: parseInt(e.target.value, 10) || 0 
                          })}
                          className="flex-1 text-xs border rounded px-2 py-1"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddDependency}
                          className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingDependency(false);
                            setNewDependency(null);
                          }}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
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
          <button
            onClick={handleDeleteTask}
            className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200"
          >
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
}

function TaskListItem({ task, allTasks, selectedTaskId, onSelect, level }: TaskListItemProps) {
  const { expandedGroups, toggleGroup } = useGanttStore();
  const isExpanded = expandedGroups.has(task.id);
  const children = allTasks.filter(t => t.parentId === task.id);
  
  return (
    <div>
      <div
        onClick={() => onSelect(task.id)}
        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
          selectedTaskId === task.id
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        style={{ marginLeft: level * 16 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.isGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(task.id);
                }}
                className="text-gray-500"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <span className={`font-medium text-gray-900 ${task.isGroup ? 'text-sm' : ''}`}>
              {task.isGroup ? '📁 ' : ''}{task.name}
            </span>
          </div>
          {task.milestone && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Milestone
            </span>
          )}
        </div>
        
        {!task.isGroup && (
          <>
            <div className="mt-2 text-sm text-gray-500">
              <div>{formatDate(task.startDate)} - {formatDate(task.endDate)}</div>
              {task.assignee && <div>👤 {task.assignee}</div>}
            </div>
            
            {/* Progress bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{task.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${task.progress}%`,
                    backgroundColor: task.color || '#3b82f6',
                  }}
                />
              </div>
            </div>
          </>
        )}
        
        {task.isGroup && (
          <div className="mt-1 text-xs text-gray-500">
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
        />
      ))}
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
