/**
 * Resource Workload Panel Component
 * 
 * Shows resource allocation and workload visualization
 * Similar to Monday.com's Workload view and Asana's Timeline
 */

import React, { useMemo, useState } from 'react';
import { useGanttStore } from './ganttStore';
import { calculateResourceWorkload } from './ganttEnhancements';
import './GanttResourcePanel.css';

interface Props {
  onClose?: () => void;
  onSelectResource?: (assignee: string) => void;
  selectedAssignee?: string | null;
}

export const ResourceWorkloadPanel: React.FC<Props> = ({
  onClose,
  onSelectResource,
  selectedAssignee,
}) => {
  const { tasks, setFilter } = useGanttStore();
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('chart');
  const [workHoursPerDay] = useState(8);
  
  // Get unique assignees
  const assignees = useMemo(() => {
    const set = new Set(tasks.map(t => t.assignee).filter(Boolean));
    return Array.from(set) as string[];
  }, [tasks]);
  
  // Calculate workload for each resource
  const workloads = useMemo(() => {
    return assignees.map(a => calculateResourceWorkload(a, tasks, workHoursPerDay));
  }, [assignees, tasks, workHoursPerDay]);
  
  // Sort by utilization
  const sortedWorkloads = useMemo(() => {
    return [...workloads].sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }, [workloads]);
  
  const handleResourceClick = (assignee: string) => {
    if (selectedAssignee === assignee) {
      setFilter({ assignee: null });
    } else {
      setFilter({ assignee });
    }
    onSelectResource?.(assignee);
  };
  
  const getUtilizationColor = (percent: number): string => {
    if (percent > 100) return 'bg-red-500';
    if (percent > 80) return 'bg-yellow-500';
    if (percent > 50) return 'bg-green-500';
    return 'bg-gray-300';
  };
  
  const getUtilizationTextColor = (percent: number): string => {
    if (percent > 100) return 'text-red-600';
    if (percent > 80) return 'text-yellow-600';
    return 'text-gray-700';
  };
  
  return (
    <div className="resource-workload-panel bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-gray-800">Resource Workload</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'chart' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              List
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 max-h-96 overflow-y-auto">
        {sortedWorkloads.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No resources assigned to tasks
          </p>
        ) : viewMode === 'chart' ? (
          /* Chart View */
          <div className="space-y-3">
            {sortedWorkloads.map(workload => (
              <div
                key={workload.assignee}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedAssignee === workload.assignee
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleResourceClick(workload.assignee)}
              >
                {/* Resource Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                      {workload.assignee.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{workload.assignee}</div>
                      <div className="text-xs text-gray-500">
                        {workload.dailyWorkload.length} days • {workload.totalHours.toFixed(1)}h total
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${getUtilizationTextColor(workload.utilizationPercent)}`}>
                      {workload.utilizationPercent.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500">utilization</div>
                  </div>
                </div>
                
                {/* Workload Bar Chart */}
                <div className="flex gap-0.5 h-8 items-end">
                  {workload.dailyWorkload.slice(0, 30).map((day, idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-t transition-colors ${
                        day.overAllocated
                          ? 'bg-red-400 hover:bg-red-500'
                          : day.hours > 0
                          ? 'bg-blue-300 hover:bg-blue-400'
                          : 'bg-gray-100'
                      }`}
                      style={{
                        height: day.hours > 0 
                          ? `${Math.min((day.hours / workHoursPerDay) * 100, 100)}%`
                          : '10%',
                      }}
                      title={`${day.date.toLocaleDateString()}: ${day.hours.toFixed(1)}h`}
                    />
                  ))}
                </div>
                
                {/* Stats Row */}
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>Peak: {workload.peakHours.toFixed(1)}h</span>
                  <span>Avg: {workload.averageHours.toFixed(1)}h</span>
                  {workload.overAllocatedDays > 0 && (
                    <span className="text-red-500">
                      ⚠️ {workload.overAllocatedDays} over-allocated
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {sortedWorkloads.map(workload => (
              <div
                key={workload.assignee}
                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedAssignee === workload.assignee
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleResourceClick(workload.assignee)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {workload.assignee.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{workload.assignee}</div>
                    <div className="text-xs text-gray-500">
                      {tasks.filter(t => t.assignee === workload.assignee).length} tasks
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Utilization Bar */}
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getUtilizationColor(workload.utilizationPercent)}`}
                      style={{ width: `${Math.min(workload.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  
                  <div className={`text-sm font-medium ${getUtilizationTextColor(workload.utilizationPercent)}`}>
                    {workload.utilizationPercent.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer Summary */}
      <div className="p-3 border-t bg-gray-50 rounded-b-lg">
        <div className="flex justify-between text-xs text-gray-600">
          <span>
            {assignees.length} resource{assignees.length !== 1 ? 's' : ''}
          </span>
          <span>
            {workloads.filter(w => w.overAllocatedDays > 0).length} with conflicts
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResourceWorkloadPanel;
