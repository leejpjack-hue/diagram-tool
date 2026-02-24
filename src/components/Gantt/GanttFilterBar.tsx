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
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks..."
            value={filter.search}
            onChange={(e) => setFilter({ search: e.target.value })}
            className="w-48 pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Assignee Filter */}
        <select
          value={filter.assignee || ''}
          onChange={(e) => setFilter({ assignee: e.target.value || null })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Assignees</option>
          {assignees.map(assignee => (
            <option key={assignee} value={assignee}>{assignee}</option>
          ))}
        </select>
        
        {/* Status Filter */}
        <select
          value={filter.status}
          onChange={(e) => setFilter({ status: e.target.value as typeof filter.status })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        
        {/* Critical Path Filter (only if enabled) */}
        {showCriticalPath && criticalPathResult && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.criticalOnly}
              onChange={(e) => setFilter({ criticalOnly: e.target.checked })}
              className="w-4 h-4 text-red-500 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Critical only
            </span>
          </label>
        )}
        
        {/* Date Range Toggle */}
        <button
          onClick={() => setShowDateRange(!showDateRange)}
          className={`px-3 py-1.5 text-sm border rounded-md flex items-center gap-1 ${
            showDateRange || filter.dateRange.start
              ? 'border-blue-500 text-blue-600 bg-blue-50'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Date Range
        </button>
        
        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilter}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
        
        {/* Filter Count */}
        {hasActiveFilters && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {countActiveFilters(filter)} filter{countActiveFilters(filter) > 1 ? 's' : ''} active
          </span>
        )}
      </div>
      
      {/* Date Range Picker (expanded) */}
      {showDateRange && (
        <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <input
              type="date"
              value={filter.dateRange.start ? formatDateForInput(filter.dateRange.start) : ''}
              onChange={(e) => setFilter({
                dateRange: {
                  ...filter.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null,
                },
              })}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <input
              type="date"
              value={filter.dateRange.end ? formatDateForInput(filter.dateRange.end) : ''}
              onChange={(e) => setFilter({
                dateRange: {
                  ...filter.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null,
                },
              })}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => setFilter({ dateRange: { start: null, end: null } })}
            className="text-sm text-gray-500 hover:text-gray-700"
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
