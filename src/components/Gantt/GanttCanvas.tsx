import React, { useMemo, useState, useRef, useCallback } from 'react';
import { useGanttStore } from './ganttStore';
import type { GanttTask, GanttZoomLevel } from './types';

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
  const { tasks, selectedTaskId, zoomLevel, setSelectedTask, updateTask } = useGanttStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: string; type: 'move' | 'resize-start' | 'resize-end'; startX: number; originalTask: GanttTask } | null>(null);

  // Calculate date range
  const { minDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return { minDate: today, totalDays: 30 };
    }
    
    const dates = tasks.flatMap((t) => [t.startDate, t.endDate]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    
    // Add padding
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 7);
    
    return { minDate: min, totalDays: diffDays(max, min) };
  }, [tasks]);

  const dayWidth = ZOOM_WIDTHS[zoomLevel];
  const chartWidth = totalDays * dayWidth;
  const chartHeight = tasks.length * ROW_HEIGHT + HEADER_HEIGHT;

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
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    
    setSelectedTask(taskId);
    setDragging({
      taskId,
      type,
      startX: e.clientX,
      originalTask: { ...task },
    });
  }, [tasks, setSelectedTask]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    
    const deltaX = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaX / dayWidth);
    
    if (deltaDays === 0) return;
    
    const task = tasks.find((t) => t.id === dragging.taskId);
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
  }, [dragging, dayWidth, tasks, updateTask]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Draw dependency arrows
  const renderDependencies = () => {
    const arrows: React.ReactElement[] = [];
    
    tasks.forEach((task) => {
      task.dependencies.forEach((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        if (!depTask) return;
        
        const taskIndex = tasks.findIndex((t) => t.id === task.id);
        const depIndex = tasks.findIndex((t) => t.id === depId);
        
        const startX = TASK_NAME_WIDTH + diffDays(depTask.endDate, minDate) * dayWidth;
        const startY = HEADER_HEIGHT + depIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const endX = TASK_NAME_WIDTH + diffDays(task.startDate, minDate) * dayWidth;
        const endY = HEADER_HEIGHT + taskIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        
        // Create path
        const midX = (startX + endX) / 2;
        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        
        arrows.push(
          <g key={`${depId}-${task.id}`}>
            <path
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4,2"
            />
            <polygon
              points={`${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`}
              fill="#94a3b8"
            />
          </g>
        );
      });
    });
    
    return arrows;
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
          {tasks.map((task, index) => {
            const startIndex = diffDays(task.startDate, minDate);
            const duration = diffDays(task.endDate, task.startDate);
            const barX = TASK_NAME_WIDTH + startIndex * dayWidth;
            const barWidth = duration * dayWidth;
            const rowY = HEADER_HEIGHT + index * ROW_HEIGHT;
            const isSelected = selectedTaskId === task.id;
            
            return (
              <g key={task.id}>
                {/* Task name cell */}
                <rect
                  x={0}
                  y={rowY}
                  width={TASK_NAME_WIDTH}
                  height={ROW_HEIGHT}
                  fill={isSelected ? '#eff6ff' : '#ffffff'}
                  stroke="#e2e8f0"
                />
                <text
                  x={12}
                  y={rowY + 25}
                  fontSize="13"
                  fill="#1e293b"
                  fontWeight={isSelected ? '600' : '400'}
                >
                  {task.name}
                </text>
                <text
                  x={12}
                  y={rowY + 36}
                  fontSize="10"
                  fill="#94a3b8"
                >
                  {task.assignee || 'Unassigned'}
                </text>
                
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
                
                {/* Task bar */}
                <g
                  className="cursor-pointer"
                  onClick={() => setSelectedTask(task.id)}
                >
                  {/* Background bar */}
                  <rect
                    x={barX}
                    y={rowY + 8}
                    width={barWidth}
                    height={24}
                    rx={4}
                    fill={task.color || COLORS[index % COLORS.length]}
                    opacity={0.2}
                    stroke={task.color || COLORS[index % COLORS.length]}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  
                  {/* Progress bar */}
                  <rect
                    x={barX}
                    y={rowY + 8}
                    width={barWidth * (task.progress / 100)}
                    height={24}
                    rx={4}
                    fill={task.color || COLORS[index % COLORS.length]}
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
                        fill={task.color || COLORS[index % COLORS.length]}
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
                        fill={task.color || COLORS[index % COLORS.length]}
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
      
      {/* Zoom controls */}
      <div className="fixed bottom-4 right-4 flex gap-2 bg-white rounded-lg shadow-lg p-2">
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
    </div>
  );
}
