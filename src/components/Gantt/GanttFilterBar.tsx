import { useState } from 'react';
import { useGanttStore } from './ganttStore';
import { getAssignees } from './resourceUtils';

interface GanttFilterBarProps {
  onShowTemplates?: () => void;
  onShowShortcuts?: () => void;
}

export function GanttFilterBar({ onShowTemplates, onShowShortcuts }: GanttFilterBarProps) {
  const { 
    tasks, 
    filter, 
    setFilter, 
    clearFilter, 
    criticalPathResult, 
    showCriticalPath,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useGanttStore();
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
      {/* Undo/Redo Buttons */}
      <div className="flex items-center gap-1 mr-2 pr-2 border-r border-gray-200">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-1.5 rounded transition-colors ${
            canUndo 
              ? 'hover:bg-gray-100 text-gray-700' 
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-1.5 rounded transition-colors ${
            canRedo 
              ? 'hover:bg-gray-100 text-gray-700' 
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>
      
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
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Templates Button */}
      {onShowTemplates && (
        <button
          onClick={onShowTemplates}
          className="btn btn-secondary btn-sm"
          title="Task Templates"
        >
          <svg className="btn-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          Templates
        </button>
      )}
      
      {/* Shortcuts Button */}
      {onShowShortcuts && (
        <button
          onClick={onShowShortcuts}
          className="btn btn-ghost btn-sm"
          title="Keyboard Shortcuts (?)"
        >
          <svg className="btn-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
          </svg>
          <span className="text-xs">?</span>
        </button>
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
