import { useGanttStore } from './ganttStore';
import { calculateResourceAllocations } from './resourceUtils';
import type { ResourceAllocation } from './types';
import './GanttResourcePanel.css';

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
    if (utilization > 100) return 'utilization-danger';
    if (utilization > 80) return 'utilization-warning';
    return 'utilization-success';
  };
  
  const getUtilizationBarColor = (utilization: number): string => {
    if (utilization > 100) return 'bar-danger';
    if (utilization > 80) return 'bar-warning';
    return 'bar-success';
  };
  
  return (
    <div className="resource-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Resources</h2>
          <p className="panel-subtitle">{allocations.length} team members</p>
        </div>
      </div>
      
      {/* Resource List */}
      <div className="resource-list">
        {allocations.length === 0 ? (
          <div className="resource-empty">
            <div className="resource-empty-icon">👥</div>
            <p className="resource-empty-title">No resources assigned</p>
            <p className="resource-empty-text">Assign team members to tasks</p>
          </div>
        ) : (
          allocations.map((allocation) => (
            <ResourceCard
              key={allocation.assignee}
              allocation={allocation}
              isSelected={filter.assignee === allocation.assignee}
              onClick={() => handleAssigneeClick(allocation.assignee)}
              utilizationClass={getUtilizationColor(allocation.utilization)}
              barClass={getUtilizationBarColor(allocation.utilization)}
            />
          ))
        )}
      </div>
      
      {/* Summary */}
      {allocations.length > 0 && (
        <div className="resource-summary">
          <div className="resource-summary-row">
            <span className="resource-summary-label">Over-allocated:</span>
            <span className={`resource-summary-value ${allocations.some(a => a.overAllocated) ? 'text-danger' : 'text-success'}`}>
              {allocations.filter(a => a.overAllocated).length} of {allocations.length}
            </span>
          </div>
          <div className="resource-summary-row">
            <span className="resource-summary-label">Avg utilization:</span>
            <span className="resource-summary-value">
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
  utilizationClass: string;
  barClass: string;
}

function ResourceCard({ allocation, isSelected, onClick, utilizationClass, barClass }: ResourceCardProps) {
  return (
    <div
      onClick={onClick}
      className={`resource-card ${isSelected ? 'selected' : ''}`}
    >
      {/* Header row */}
      <div className="resource-card-header">
        <div className="resource-card-info">
          <div className="resource-avatar">
            {allocation.assignee.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="resource-name">{allocation.assignee}</div>
            <div className="resource-task-count">{allocation.tasks.length} tasks</div>
          </div>
        </div>
        
        <div className={`resource-utilization-badge ${utilizationClass}`}>
          {allocation.utilization}%
          {allocation.overAllocated && ' ⚠️'}
        </div>
      </div>
      
      {/* Utilization bar */}
      <div className="resource-bar-container">
        <div className="resource-bar-track">
          <div
            className={`resource-bar-fill ${barClass}`}
            style={{ width: `${Math.min(allocation.utilization, 100)}%` }}
          />
        </div>
        {allocation.utilization > 100 && (
          <div className="resource-bar-track resource-bar-overflow">
            <div
              className="resource-bar-fill bar-danger"
              style={{ width: `${allocation.utilization - 100}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Stats row */}
      <div className="resource-stats">
        <span>Peak: {allocation.peakLoad} tasks/day</span>
        <span>Total: {allocation.totalDays} days</span>
      </div>
      
      {/* Over-allocation warning */}
      {allocation.overAllocated && (
        <div className="resource-warning">
          ⚠️ Over-allocated on some days
        </div>
      )}
    </div>
  );
}

export default GanttResourcePanel;
