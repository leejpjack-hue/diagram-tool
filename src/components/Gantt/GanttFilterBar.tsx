import { useState } from 'react';
import { useGanttStore } from './ganttStore';
import { getAssignees } from './resourceUtils';

export function GanttFilterBar() {
  const { tasks, filter, setFilter, clearFilter, criticalPathResult, showCriticalPath } = useGanttStore();
  const [showDateRange, setShowDateRange] = useState(false);
  
  const assignees = getAssignees(tasks);
  
  const hasActiveFilters = 
    filter.search || 
    filter.assignee || 
    filter.status !== 'all' || 
    filter.criticalOnly ||
    filter.dateRange.start ||
    filter.dateRange.end;
  
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'not-started', label: 'Not Started' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'complete', label: 'Complete' },
  ];
  
  return (
    <div className="filter-bar" role="search" aria-label="Filter Gantt tasks">
      {/* Search */}
      <div className="filter-group">
        <span className="filter-label" aria-hidden="true">🔍</span>
        <input
          type="search"
          placeholder="Search tasks..."
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="filter-input"
          aria-label="Search tasks"
          style={{ width: '200px' }}
        />
      </div>
      
      {/* Assignee Filter */}
      <div className="filter-group">
        <span className="filter-label" aria-hidden="true">👤</span>
        <select
          value={filter.assignee || ''}
          onChange={(e) => setFilter({ assignee: e.target.value || null })}
          className="filter-input"
          aria-label="Filter by assignee"
        >
          <option value="">All Assignees</option>
          {assignees.map(assignee => (
            <option key={assignee} value={assignee}>{assignee}</option>
          ))}
        </select>
      </div>
      
      {/* Status Filter */}
      <div className="filter-group">
        <span className="filter-label" aria-hidden="true">📊</span>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ status: e.target.value as typeof filter.status })}
          className="filter-input"
          aria-label="Filter by status"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      
      {/* Critical Path Filter (only if enabled) */}
      {showCriticalPath && criticalPathResult && (
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filter.criticalOnly}
            onChange={(e) => setFilter({ criticalOnly: e.target.checked })}
            className="filter-checkbox-input"
            aria-label="Show critical path tasks only"
          />
          <span className="filter-checkbox-label">
            <span className="critical-indicator" aria-hidden="true"></span>
            Critical only
          </span>
        </label>
      )}
      
      {/* Date Range Toggle */}
      <button
        onClick={() => setShowDateRange(!showDateRange)}
        className={`btn btn-sm ${showDateRange || filter.dateRange.start ? 'btn-primary' : 'btn-secondary'}`}
        aria-expanded={showDateRange}
        aria-controls="date-range-picker"
      >
        <svg className="btn-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Date Range
      </button>
      
      {/* Clear Filters */}
      {hasActiveFilters && (
        <button 
          onClick={clearFilter} 
          className="btn btn-ghost btn-sm btn-danger-text"
          aria-label="Clear all filters"
        >
          <svg className="btn-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
      
      {/* Filter Count */}
      {hasActiveFilters && (
        <span className="filter-count-badge" role="status" aria-live="polite">
          {countActiveFilters(filter)} filter{countActiveFilters(filter) > 1 ? 's' : ''} active
        </span>
      )}
      
      {/* Date Range Picker (expanded) */}
      {showDateRange && (
        <div className="date-range-picker">
          <div className="date-range-field">
            <label className="filter-label">From:</label>
            <input
              type="date"
              value={filter.dateRange.start ? formatDateForInput(filter.dateRange.start) : ''}
              onChange={(e) => setFilter({
                dateRange: {
                  ...filter.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null,
                },
              })}
              className="input input-sm"
            />
          </div>
          
          <div className="date-range-field">
            <label className="filter-label">To:</label>
            <input
              type="date"
              value={filter.dateRange.end ? formatDateForInput(filter.dateRange.end) : ''}
              onChange={(e) => setFilter({
                dateRange: {
                  ...filter.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null,
                },
              })}
              className="input input-sm"
            />
          </div>
          
          <button
            onClick={() => setFilter({ dateRange: { start: null, end: null } })}
            className="btn btn-ghost btn-sm"
          >
            Reset dates
          </button>
        </div>
      )}
    </div>
  );
}

function countActiveFilters(filter: ReturnType<typeof useGanttStore.getState>['filter']): number {
  let count = 0;
  if (filter.search) count++;
  if (filter.assignee) count++;
  if (filter.status !== 'all') count++;
  if (filter.criticalOnly) count++;
  if (filter.dateRange.start || filter.dateRange.end) count++;
  return count;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default GanttFilterBar;
