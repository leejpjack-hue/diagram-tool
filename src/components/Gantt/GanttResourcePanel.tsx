import { useGanttStore } from './ganttStore';
import { calculateResourceAllocations } from './resourceUtils';
import type { ResourceAllocation } from './types';

export function GanttResourcePanel() {
  const { tasks, filter, setFilter } = useGanttStore();
  
  const allocations = calculateResourceAllocations(tasks);
  
  const handleAssigneeClick = (assignee: string) => {
    if (filter.assignee === assignee) {
      setFilter({ assignee: null });
    } else {
      setFilter({ assignee });
    }
  };
  
  const getUtilizationColor = (utilization: number): string => {
    if (utilization > 100) return 'text-red-600 bg-red-100';
    if (utilization > 80) return 'text-amber-600 bg-amber-100';
    return 'text-green-600 bg-green-100';
  };
  
  const getUtilizationBarColor = (utilization: number): string => {
    if (utilization > 100) return 'bg-red-500';
    if (utilization > 80) return 'bg-amber-500';
    return 'bg-green-500';
  };
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Resources</h2>
        <p className="text-sm text-gray-500 mt-1">{allocations.length} team members</p>
      </div>
      
      {/* Resource List */}
      <div className="flex-1 overflow-y-auto p-4">
        {allocations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm">No resources assigned</p>
            <p className="text-xs text-gray-400 mt-1">Assign team members to tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allocations.map((allocation) => (
              <ResourceCard
                key={allocation.assignee}
                allocation={allocation}
                isSelected={filter.assignee === allocation.assignee}
                onClick={() => handleAssigneeClick(allocation.assignee)}
                utilizationColor={getUtilizationColor(allocation.utilization)}
                barColor={getUtilizationBarColor(allocation.utilization)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Summary */}
      {allocations.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Over-allocated:</span>
            <span className={`font-medium ${allocations.some(a => a.overAllocated) ? 'text-red-600' : 'text-green-600'}`}>
              {allocations.filter(a => a.overAllocated).length} of {allocations.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-600">Avg utilization:</span>
            <span className="font-medium text-gray-900">
              {Math.round(allocations.reduce((sum, a) => sum + a.utilization, 0) / allocations.length)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResourceCardProps {
  allocation: ResourceAllocation;
  isSelected: boolean;
  onClick: () => void;
  utilizationColor: string;
  barColor: string;
}

function ResourceCard({ allocation, isSelected, onClick, utilizationColor, barColor }: ResourceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
            {allocation.assignee.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900">{allocation.assignee}</div>
            <div className="text-xs text-gray-500">{allocation.tasks.length} tasks</div>
          </div>
        </div>
        
        <div className={`px-2 py-1 rounded text-xs font-medium ${utilizationColor}`}>
          {allocation.utilization}%
          {allocation.overAllocated && ' ⚠️'}
        </div>
      </div>
      
      {/* Utilization bar */}
      <div className="mt-3">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(allocation.utilization, 100)}%` }}
          />
        </div>
        {allocation.utilization > 100 && (
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-red-500"
              style={{ width: `${allocation.utilization - 100}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Stats row */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Peak: {allocation.peakLoad} tasks/day</span>
        <span>Total: {allocation.totalDays} days</span>
      </div>
      
      {/* Over-allocation warning */}
      {allocation.overAllocated && (
        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
          ⚠️ Over-allocated on some days
        </div>
      )}
    </div>
  );
}

export default GanttResourcePanel;
