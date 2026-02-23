import { useState } from 'react';
import { useGanttStore } from './ganttStore';
import type { GanttTask } from './types';

interface GanttPanelProps {
  onAddTask: (task: Partial<GanttTask>) => void;
}

export function GanttPanel({ onAddTask }: GanttPanelProps) {
  const { tasks, selectedTaskId, setSelectedTask, updateTask, deleteTask } = useGanttStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    startDate: '',
    endDate: '',
    assignee: '',
  });
  
  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  
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
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
        <p className="text-sm text-gray-500 mt-1">{tasks.length} tasks</p>
      </div>
      
      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedTaskId === task.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{task.name}</span>
                {task.milestone && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Milestone
                  </span>
                )}
              </div>
              
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
            </div>
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
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Edit: {selectedTask.name}</h3>
          
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
          
          {/* Delete Button */}
          <button
            onClick={handleDeleteTask}
            className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200"
          >
            Delete Task
          </button>
        </div>
      )}
    </div>
  );
}
