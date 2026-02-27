import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useGanttStore } from './ganttStore';
import type { GanttTask, GanttZoomLevel, Dependency } from './types';
import { isCritical } from './criticalPath';

// Constants
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const TASK_NAME_WIDTH = 200;

const ZOOM_WIDTHS: Record<GanttZoomLevel, number> = {
  day: 60,
  week: 25,
  month: 8,
};

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16'
];

const CRITICAL_COLOR = '#dc2626';
const SLACK_COLOR = '#fca5a5';

// Helper functions
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const diffDays = (a: Date, b: Date): number => {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

export function GanttCanvas() {
  const { 
    tasks, 
    dependencies,
    selectedTaskId, 
    zoomLevel, 
    showCriticalPath,
    criticalPathResult,
    expandedGroups,
    setSelectedTask, 
    updateTask,
    toggleGroup,
    recalculateCriticalPath,
    getFilteredTasks,
  } = useGanttStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: string; type: 'move' | 'resize-start' | 'resize-end'; startX: number; originalTask: GanttTask } | null>(null);

  // Recalculate critical path when tasks or dependencies change
  useEffect(() => {
    if (showCriticalPath) {
      recalculateCriticalPath();
    }
  }, [tasks, dependencies, showCriticalPath, recalculateCriticalPath]);

  // Filter out collapsed group children for display AND apply filter
  const visibleTasks = useMemo(() => {
    // First apply the filter from the store
    const filteredTasks = getFilteredTasks();
    
    const result: GanttTask[] = [];
    
    const addTask = (task: GanttTask) => {
      if (task.isGroup) {
        result.push(task);
        if (expandedGroups.has(task.id) && task.children) {
          task.children.forEach(childId => {
            const child = filteredTasks.find(t => t.id === childId);
            if (child) addTask(child);
          });
        }
      } else if (!task.parentId) {
        result.push(task);
      } else {
        // Has parent - only show if parent is expanded
        const parent = filteredTasks.find(t => t.id === task.parentId);
        if (parent && expandedGroups.has(parent.id)) {
          result.push(task);
        }
      }
    };
    
    filteredTasks.filter(t => !t.parentId).forEach(addTask);
    return result;
  }, [getFilteredTasks, expandedGroups]);

  // Calculate date range
  const { minDate, totalDays } = useMemo(() => {
    const tasksToUse = visibleTasks.length > 0 ? visibleTasks : tasks;
    if (tasksToUse.length === 0) {
      const today = new Date();
      return { minDate: today, totalDays: 30 };
    }
    
    const dates = tasksToUse.flatMap((t) => [t.startDate, t.endDate]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    
    // Add padding
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 7);
    
    return { minDate: min, totalDays: diffDays(max, min) };
  }, [visibleTasks, tasks]);

  const dayWidth = ZOOM_WIDTHS[zoomLevel];
  const chartWidth = totalDays * dayWidth;
  const chartHeight = visibleTasks.length * ROW_HEIGHT + HEADER_HEIGHT;

  // Generate timeline headers
  const timelineHeaders = useMemo(() => {
    const headers: { date: Date; label: string; isWeekend: boolean; isMonthStart: boolean }[] = [];
    
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(minDate, i);
      const day = date.getDay();
      headers.push({
        date,
        label: date.getDate().toString(),
        isWeekend: day === 0 || day === 6,
        isMonthStart: date.getDate() === 1,
      });
    }
    
    return headers;
  }, [minDate, totalDays]);

  // Generate month headers
  const monthHeaders = useMemo(() => {
    const months: { label: string; startOffset: number; width: number }[] = [];
    let currentMonth = -1;
    let monthStart = 0;
    let monthDays = 0;
    
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(minDate, i);
      const month = date.getMonth();
      
      if (month !== currentMonth) {
        if (currentMonth !== -1) {
          months.push({
            label: addDays(minDate, monthStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            startOffset: monthStart * dayWidth,
            width: monthDays * dayWidth,
          });
        }
        currentMonth = month;
        monthStart = i;
        monthDays = 0;
      }
      monthDays++;
    }
    
    // Add last month
    if (monthDays > 0) {
      months.push({
        label: addDays(minDate, monthStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startOffset: monthStart * dayWidth,
        width: monthDays * dayWidth,
      });
    }
    
    return months;
  }, [minDate, totalDays, dayWidth]);

  // Handle task bar interactions
  const handleMouseDown = useCallback((e: React.MouseEvent, taskId: string, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    const task = visibleTasks.find((t) => t.id === taskId);
    if (!task || task.isGroup) return;
    
    setSelectedTask(taskId);
    setDragging({
      taskId,
      type,
      startX: e.clientX,
      originalTask: { ...task },
    });
  }, [visibleTasks, setSelectedTask]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    
    const deltaX = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaX / dayWidth);
    
    if (deltaDays === 0) return;
    
    const task = visibleTasks.find((t) => t.id === dragging.taskId);
    if (!task) return;
    
    if (dragging.type === 'move') {
      updateTask(dragging.taskId, {
        startDate: addDays(dragging.originalTask.startDate, deltaDays),
        endDate: addDays(dragging.originalTask.endDate, deltaDays),
      });
    } else if (dragging.type === 'resize-start') {
      const newStart = addDays(dragging.originalTask.startDate, deltaDays);
      if (diffDays(task.endDate, newStart) >= 1) {
        updateTask(dragging.taskId, { startDate: newStart });
      }
    } else if (dragging.type === 'resize-end') {
      const newEnd = addDays(dragging.originalTask.endDate, deltaDays);
      if (diffDays(newEnd, task.startDate) >= 1) {
        updateTask(dragging.taskId, { endDate: newEnd });
      }
    }
  }, [dragging, dayWidth, visibleTasks, updateTask]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Get dependency arrow style based on type
  const getDependencyStyle = (type: Dependency['type']) => {
    switch (type) {
      case 'FS': return { dash: '4,2', color: '#94a3b8' };
      case 'SS': return { dash: '8,4', color: '#3b82f6' };
      case 'FF': return { dash: '2,2', color: '#10b981' };
      case 'SF': return { dash: '6,3', color: '#f59e0b' };
      default: return { dash: '4,2', color: '#94a3b8' };
    }
  };

  // Draw dependency arrows
  const renderDependencies = () => {
    const arrows: React.ReactElement[] = [];
    
    dependencies.forEach((dep) => {
      const successorTask = visibleTasks.find((t) => t.id === dep.successorId);
      const predecessorTask = visibleTasks.find((t) => t.id === dep.predecessorId);
      if (!successorTask || !predecessorTask) return;
      
      const successorIndex = visibleTasks.findIndex((t) => t.id === dep.successorId);
      const predecessorIndex = visibleTasks.findIndex((t) => t.id === dep.predecessorId);
      
      if (successorIndex === -1 || predecessorIndex === -1) return;
      
      const style = getDependencyStyle(dep.type);
      
      // Calculate arrow endpoints based on dependency type
      const predBarStart = TASK_NAME_WIDTH + diffDays(predecessorTask.startDate, minDate) * dayWidth;
      const predBarEnd = TASK_NAME_WIDTH + diffDays(predecessorTask.endDate, minDate) * dayWidth;
      const succBarStart = TASK_NAME_WIDTH + diffDays(successorTask.startDate, minDate) * dayWidth;
      const succBarEnd = TASK_NAME_WIDTH + diffDays(successorTask.endDate, minDate) * dayWidth;

      const startY = HEADER_HEIGHT + predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const endY = HEADER_HEIGHT + successorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      let startX: number, endX: number;
      switch (dep.type) {
        case 'FS': // Finish to Start
          startX = predBarEnd;
          endX = succBarStart + (dep.lag * dayWidth);
          break;
        case 'SS': // Start to Start
          startX = predBarStart;
          endX = succBarStart + (dep.lag * dayWidth);
          break;
        case 'FF': // Finish to Finish
          startX = predBarEnd;
          endX = succBarEnd + (dep.lag * dayWidth);
          break;
        case 'SF': // Start to Finish
          startX = predBarStart;
          endX = succBarEnd + (dep.lag * dayWidth);
          break;
        default:
          startX = predBarEnd;
          endX = succBarStart;
      }
      
      // Create curved path
      const midX = (startX + endX) / 2;
      const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
      
      arrows.push(
        <g key={`${dep.predecessorId}-${dep.successorId}-${dep.type}`}>
          <path
            d={path}
            fill="none"
            stroke={style.color}
            strokeWidth="1.5"
            strokeDasharray={style.dash}
          />
          <polygon
            points={`${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`}
            fill={style.color}
          />
          {/* Lag indicator */}
          {dep.lag !== 0 && (
            <text
              x={midX}
              y={(startY + endY) / 2 - 5}
              fontSize="9"
              fill={style.color}
              textAnchor="middle"
            >
              {dep.lag > 0 ? `+${dep.lag}d` : `${dep.lag}d`}
            </text>
          )}
        </g>
      );
    });
    
    return arrows;
  };

  // Check if task is on critical path
  const isTaskCritical = (taskId: string): boolean => {
    return showCriticalPath && criticalPathResult !== null && isCritical(taskId, criticalPathResult);
  };

  // Get slack for task
  const getTaskSlack = (taskId: string): number => {
    if (!criticalPathResult) return 0;
    return criticalPathResult.slack.get(taskId) || 0;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-auto bg-white"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={{ minWidth: chartWidth + TASK_NAME_WIDTH }}>
        <svg width={chartWidth + TASK_NAME_WIDTH} height={chartHeight} className="block">
          {/* Month headers */}
          <g>
            {monthHeaders.map((month, i) => (
              <g key={i}>
                <rect
                  x={TASK_NAME_WIDTH + month.startOffset}
                  y={0}
                  width={month.width}
                  height={24}
                  fill="#f1f5f9"
                  stroke="#e2e8f0"
                />
                <text
                  x={TASK_NAME_WIDTH + month.startOffset + 8}
                  y={16}
                  fontSize="12"
                  fontWeight="600"
                  fill="#475569"
                >
                  {month.label}
                </text>
              </g>
            ))}
          </g>
          
          {/* Day headers */}
          <g transform={`translate(0, 24)`}>
            {timelineHeaders.map((day, i) => (
              <g key={i}>
                <rect
                  x={TASK_NAME_WIDTH + i * dayWidth}
                  y={0}
                  width={dayWidth}
                  height={36}
                  fill={day.isWeekend ? '#f8fafc' : '#ffffff'}
                  stroke="#e2e8f0"
                />
                <text
                  x={TASK_NAME_WIDTH + i * dayWidth + dayWidth / 2}
                  y={24}
                  fontSize="11"
                  fill={day.isWeekend ? '#94a3b8' : '#64748b'}
                  textAnchor="middle"
                >
                  {day.label}
                </text>
              </g>
            ))}
          </g>
          
          {/* Task name column header */}
          <rect x={0} y={0} width={TASK_NAME_WIDTH} height={24} fill="#f1f5f9" stroke="#e2e8f0" />
          <text x={8} y={16} fontSize="12" fontWeight="600" fill="#475569">Task Name</text>
          <rect x={0} y={24} width={TASK_NAME_WIDTH} height={36} fill="#ffffff" stroke="#e2e8f0" />
          <text x={8} y={48} fontSize="11" fill="#64748b">Assignee</text>
          
          {/* Task rows */}
          {visibleTasks.map((task, index) => {
            const startIndex = diffDays(task.startDate, minDate);
            const duration = diffDays(task.endDate, task.startDate);
            const barX = TASK_NAME_WIDTH + startIndex * dayWidth;
            const barWidth = duration * dayWidth;
            const rowY = HEADER_HEIGHT + index * ROW_HEIGHT;
            const isSelected = selectedTaskId === task.id;
            const isCriticalTask = isTaskCritical(task.id);
            const slack = getTaskSlack(task.id);
            const slackWidth = slack * dayWidth;
            
            // Group styling
            const taskColor = task.isGroup 
              ? '#64748b' 
              : isCriticalTask 
                ? CRITICAL_COLOR 
                : task.color || COLORS[index % COLORS.length];
            
            return (
              <g key={task.id}>
                {/* Task name cell */}
                <rect
                  x={0}
                  y={rowY}
                  width={TASK_NAME_WIDTH}
                  height={ROW_HEIGHT}
                  fill={isSelected ? '#eff6ff' : task.isGroup ? '#f8fafc' : '#ffffff'}
                  stroke="#e2e8f0"
                />
                
                {/* Group expand/collapse toggle */}
                {task.isGroup ? (
                  <g 
                    className="cursor-pointer"
                    onClick={() => toggleGroup(task.id)}
                  >
                    <text
                      x={8}
                      y={rowY + 25}
                      fontSize="14"
                      fill="#64748b"
                    >
                      {expandedGroups.has(task.id) ? '▼' : '▶'}
                    </text>
                    <text
                      x={24}
                      y={rowY + 25}
                      fontSize="13"
                      fill="#1e293b"
                      fontWeight="600"
                    >
                      {task.name}
                    </text>
                    <text
                      x={24}
                      y={rowY + 36}
                      fontSize="10"
                      fill="#94a3b8"
                    >
                      {task.children?.length || 0} tasks • {task.progress}% complete
                    </text>
                  </g>
                ) : (
                  <>
                    <text
                      x={task.parentId ? 24 : 12}
                      y={rowY + 25}
                      fontSize="13"
                      fill="#1e293b"
                      fontWeight={isSelected ? '600' : '400'}
                    >
                      {task.name}
                    </text>
                    <text
                      x={task.parentId ? 24 : 12}
                      y={rowY + 36}
                      fontSize="10"
                      fill="#94a3b8"
                    >
                      {task.assignee || 'Unassigned'}
                    </text>
                  </>
                )}
                
                {/* Chart row background */}
                {timelineHeaders.map((day, i) => (
                  <rect
                    key={i}
                    x={TASK_NAME_WIDTH + i * dayWidth}
                    y={rowY}
                    width={dayWidth}
                    height={ROW_HEIGHT}
                    fill={day.isWeekend ? '#f8fafc' : '#ffffff'}
                    stroke="#f1f5f9"
                    strokeWidth={0.5}
                  />
                ))}
                
                {/* Task bar (skip for groups unless showing summary) */}
                {!task.isGroup && (
                  <g
                    className="cursor-pointer"
                    onClick={() => setSelectedTask(task.id)}
                  >
                    {/* Slack indicator (if showing critical path) */}
                    {showCriticalPath && slack > 0 && (
                      <rect
                        x={barX + barWidth}
                        y={rowY + 12}
                        width={slackWidth}
                        height={16}
                        rx={2}
                        fill={SLACK_COLOR}
                        opacity={0.4}
                        stroke={SLACK_COLOR}
                        strokeDasharray="2,2"
                      />
                    )}
                    
                    {/* Background bar */}
                    <rect
                      x={barX}
                      y={rowY + 8}
                      width={barWidth}
                      height={24}
                      rx={4}
                      fill={taskColor}
                      opacity={0.2}
                      stroke={taskColor}
                      strokeWidth={isSelected ? 2 : isCriticalTask ? 2 : 1}
                    />
                    
                    {/* Progress bar */}
                    <rect
                      x={barX}
                      y={rowY + 8}
                      width={barWidth * (task.progress / 100)}
                      height={24}
                      rx={4}
                      fill={taskColor}
                    />
                    
                    {/* Task name on bar */}
                    <text
                      x={barX + 8}
                      y={rowY + 24}
                      fontSize="11"
                      fill="#ffffff"
                      fontWeight="500"
                    >
                      {task.name}
                    </text>
                    
                    {/* Progress percentage */}
                    <text
                      x={barX + barWidth - 8}
                      y={rowY + 24}
                      fontSize="10"
                      fill="#ffffff"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {task.progress}%
                    </text>
                    
                    {/* Critical path indicator */}
                    {isCriticalTask && (
                      <text
                        x={barX + barWidth + 4}
                        y={rowY + 24}
                        fontSize="10"
                        fill={CRITICAL_COLOR}
                        fontWeight="600"
                      >
                        ⚡
                      </text>
                    )}
                    
                    {/* Resize handles (only when selected) */}
                    {isSelected && (
                      <>
                        {/* Left resize handle */}
                        <rect
                          x={barX - 2}
                          y={rowY + 8}
                          width={8}
                          height={24}
                          rx={2}
                          fill={taskColor}
                          className="cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-start')}
                        />
                        
                        {/* Right resize handle */}
                        <rect
                          x={barX + barWidth - 6}
                          y={rowY + 8}
                          width={8}
                          height={24}
                          rx={2}
                          fill={taskColor}
                          className="cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, task.id, 'resize-end')}
                        />
                      </>
                    )}
                    
                    {/* Milestone diamond */}
                    {task.milestone && (
                      <polygon
                        points={`${barX + barWidth / 2},${rowY + 4} ${barX + barWidth / 2 + 8},${rowY + 12} ${barX + barWidth / 2},${rowY + 20} ${barX + barWidth / 2 - 8},${rowY + 12}`}
                        fill={task.color || '#f59e0b'}
                      />
                    )}
                  </g>
                )}
                
                {/* Group summary bar */}
                {task.isGroup && (
                  <g
                    className="cursor-pointer"
                    onClick={() => setSelectedTask(task.id)}
                  >
                    <rect
                      x={barX}
                      y={rowY + 14}
                      width={barWidth}
                      height={12}
                      rx={2}
                      fill={taskColor}
                      opacity={0.3}
                    />
                    <rect
                      x={barX}
                      y={rowY + 14}
                      width={barWidth * (task.progress / 100)}
                      height={12}
                      rx={2}
                      fill={taskColor}
                      opacity={0.6}
                    />
                  </g>
                )}
              </g>
            );
          })}
          
          {/* Dependency arrows */}
          <g className="pointer-events-none">
            {renderDependencies()}
          </g>
          
          {/* Today line */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayOffset = diffDays(today, minDate);
            if (todayOffset >= 0 && todayOffset < totalDays) {
              return (
                <line
                  x1={TASK_NAME_WIDTH + todayOffset * dayWidth}
                  y1={HEADER_HEIGHT}
                  x2={TASK_NAME_WIDTH + todayOffset * dayWidth}
                  y2={chartHeight}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              );
            }
            return null;
          })()}
        </svg>
      </div>
      
      {/* Controls */}
      <div className="fixed bottom-4 right-4 flex gap-2 bg-white rounded-lg shadow-lg p-2 z-10">
        {/* Critical path toggle */}
        <button
          onClick={() => useGanttStore.getState().toggleCriticalPath()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            showCriticalPath ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Toggle Critical Path"
        >
          🔴 Critical
        </button>
        
        {/* Zoom controls */}
        <button
          onClick={() => useGanttStore.getState().setZoomLevel('day')}
          className={`px-3 py-1 rounded text-sm font-medium ${
            zoomLevel === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Day
        </button>
        <button
          onClick={() => useGanttStore.getState().setZoomLevel('week')}
          className={`px-3 py-1 rounded text-sm font-medium ${
            zoomLevel === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => useGanttStore.getState().setZoomLevel('month')}
          className={`px-3 py-1 rounded text-sm font-medium ${
            zoomLevel === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Month
        </button>
      </div>
      
      {/* Critical path legend */}
      {showCriticalPath && criticalPathResult && (
        <div className="fixed bottom-20 left-4 bg-white rounded-lg shadow-lg p-3 text-sm max-w-xs">
          <div className="font-semibold mb-2">Critical Path</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: CRITICAL_COLOR }}></div>
            <span>Critical ({criticalPathResult.path.length} tasks)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: SLACK_COLOR, opacity: 0.4 }}></div>
            <span>Slack/Float</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Duration: {criticalPathResult.duration} days
          </div>
        </div>
      )}
    </div>
  );
}
