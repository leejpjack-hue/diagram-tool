import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { applyGanttFilter, hasActiveGanttFilter, useGanttStore } from './ganttStore';
import type { GanttTask, GanttZoomLevel, Dependency } from './types';
import { isCritical } from './criticalPath';
import { BulkOperationsPanel } from './BulkOperationsPanel';
import { computeWbsCodes } from './wbsUtils';
import type { DelayImpactResult } from './delayImpactUtils';

// Constants
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const TASK_NAME_WIDTH = 200;

// Base pixels-per-day for each zoom level. The actual width is this value
// multiplied by the user-adjustable widthScale (+/- buttons).
//   day   -> one column per day
//   week  -> one column per week (labelled wk1..wk5 within each month)
//   month -> one wide column per calendar month
const ZOOM_WIDTHS: Record<GanttZoomLevel, number> = {
  day: 40,
  week: 16,
  month: 6,
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
    selectedTaskIds,
    zoomLevel,
    widthScale,
    showCriticalPath,
    criticalPathResult,
    filter,
    expandedGroups,
    setSelectedTask, 
    updateTask,
    toggleGroup,
    toggleTaskSelection,
    clearSelection,
    recalculateCriticalPath,
  } = useGanttStore();
  
  // State for delay impact visualization
  const [visualizationData, setVisualizationData] = useState<{
    enabled: boolean;
    result: DelayImpactResult;
  } | null>(() => {
    const data = localStorage.getItem('delayImpactVisualization');
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse visualization data:', e);
      }
    }
    return null;
  });
  
  // Listen for storage changes (from DelayImpactPanel)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'delayImpactVisualization') {
        if (e.newValue) {
          try {
            setVisualizationData(JSON.parse(e.newValue));
          } catch (err) {
            console.error('Failed to parse visualization data:', err);
          }
        } else {
          setVisualizationData(null);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Clear visualization function
  const clearVisualization = useCallback(() => {
    localStorage.removeItem('delayImpactVisualization');
    setVisualizationData(null);
  }, []);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: string; type: 'move' | 'resize-start' | 'resize-end'; startX: number; originalTask: GanttTask } | null>(null);

  // Recalculate critical path when tasks or dependencies change
  useEffect(() => {
    if (showCriticalPath) {
      recalculateCriticalPath();
    }
  }, [tasks, dependencies, showCriticalPath, recalculateCriticalPath]);

  // Filter out collapsed group children for display AND apply filter.
  // Keep parent groups visible when a child matches, so search results are not hidden.
  const visibleTasks = useMemo(() => {
    const filteredTasks = applyGanttFilter(tasks, filter, criticalPathResult);
    const filteredIds = new Set(filteredTasks.map(task => task.id));
    const hasFilter = hasActiveGanttFilter(filter);
    const childrenByParent = new Map<string | undefined, GanttTask[]>();

    tasks.forEach(task => {
      const siblings = childrenByParent.get(task.parentId) ?? [];
      siblings.push(task);
      childrenByParent.set(task.parentId, siblings);
    });

    const hasVisibleMatch = (task: GanttTask): boolean => {
      if (!hasFilter) return true;
      if (filteredIds.has(task.id)) return true;
      return (childrenByParent.get(task.id) ?? []).some(hasVisibleMatch);
    };

    const result: GanttTask[] = [];
    
    const addTask = (task: GanttTask) => {
      if (!hasVisibleMatch(task)) return;

      if (task.isGroup) {
        result.push(task);
        if ((expandedGroups.has(task.id) || hasFilter) && task.children) {
          task.children.forEach(childId => {
            const child = tasks.find(t => t.id === childId);
            if (child) addTask(child);
          });
        }
      } else if (!task.parentId || filteredIds.has(task.id)) {
        result.push(task);
      }
    };
    
    tasks.filter(t => !t.parentId).forEach(addTask);
    return result;
  }, [tasks, filter, criticalPathResult, expandedGroups]);

  // WBS codes for all tasks (e.g. "1", "1.2", "1.2.3")
  const wbsCodes = useMemo(() => computeWbsCodes(tasks), [tasks]);

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

  const dayWidth = ZOOM_WIDTHS[zoomLevel] * widthScale;
  const chartWidth = totalDays * dayWidth;
  const chartHeight = visibleTasks.length * ROW_HEIGHT + HEADER_HEIGHT;

  // Timeline columns (primary header row) + super band (coarser row above).
  // The granularity depends on the zoom level:
  //   day   -> column per day,  band = months
  //   week  -> column per week, band = months  (labels wk1..wk5 within a month)
  //   month -> column per month, band = years
  // Columns carry day offsets/spans so task bars (which use dayWidth) stay aligned.
  const { columns, superBand } = useMemo(() => {
    type Col = { offsetDays: number; days: number; label: string; shade: boolean };
    type Band = { offsetDays: number; days: number; label: string };
    const cols: Col[] = [];
    const band: Band[] = [];

    // group consecutive days into spans where keyOf(date) is constant
    const groupBy = (
      keyOf: (d: Date) => string,
      labelOf: (d: Date) => string,
      withShade: boolean,
    ): Col[] => {
      const out: Col[] = [];
      let i = 0;
      let alt = false;
      while (i < totalDays) {
        const start = addDays(minDate, i);
        const key = keyOf(start);
        let span = 1;
        while (i + span < totalDays && keyOf(addDays(minDate, i + span)) === key) span++;
        out.push({ offsetDays: i, days: span, label: labelOf(start), shade: withShade && alt });
        alt = !alt;
        i += span;
      }
      return out;
    };

    if (zoomLevel === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const date = addDays(minDate, i);
        const dow = date.getDay();
        cols.push({ offsetDays: i, days: 1, label: String(date.getDate()), shade: dow === 0 || dow === 6 });
      }
    } else if (zoomLevel === 'week') {
      // week-of-month: days 1-7 -> wk1, 8-14 -> wk2, ...
      cols.push(
        ...groupBy(
          (d) => `${d.getFullYear()}-${d.getMonth()}-${Math.ceil(d.getDate() / 7)}`,
          (d) => `wk${Math.ceil(d.getDate() / 7)}`,
          true,
        ),
      );
    } else {
      cols.push(
        ...groupBy(
          (d) => `${d.getFullYear()}-${d.getMonth()}`,
          (d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          true,
        ),
      );
    }

    // super band
    const bandCols =
      zoomLevel === 'month'
        ? groupBy((d) => String(d.getFullYear()), (d) => String(d.getFullYear()), false)
        : groupBy(
            (d) => `${d.getFullYear()}-${d.getMonth()}`,
            (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            false,
          );
    band.push(...bandCols.map(({ offsetDays, days, label }) => ({ offsetDays, days, label })));

    return { columns: cols, superBand: band };
  }, [zoomLevel, minDate, totalDays]);

  // Handle task bar interactions
  const handleMouseDown = useCallback((e: React.MouseEvent, task: GanttTask, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    if (task.isGroup) return;
    
    setSelectedTask(task.id);
    setDragging({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalTask: { ...task },
    });
  }, [setSelectedTask]);

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
      className="w-full h-full overflow-auto bg-white relative"
      data-canvas-target="primary"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={{ minWidth: chartWidth + TASK_NAME_WIDTH }}>
        <svg width={chartWidth + TASK_NAME_WIDTH} height={chartHeight} className="block">
          {/* Super band (months, or years in month view) */}
          <g>
            {superBand.map((seg, i) => (
              <g key={i}>
                <rect
                  x={TASK_NAME_WIDTH + seg.offsetDays * dayWidth}
                  y={0}
                  width={seg.days * dayWidth}
                  height={24}
                  fill="#f1f5f9"
                  stroke="#e2e8f0"
                />
                <text
                  x={TASK_NAME_WIDTH + seg.offsetDays * dayWidth + 8}
                  y={16}
                  fontSize="12"
                  fontWeight="600"
                  fill="#475569"
                >
                  {seg.label}
                </text>
              </g>
            ))}
          </g>

          {/* Primary column headers (days / weeks / months) */}
          <g transform={`translate(0, 24)`}>
            {columns.map((col, i) => (
              <g key={i}>
                <rect
                  x={TASK_NAME_WIDTH + col.offsetDays * dayWidth}
                  y={0}
                  width={col.days * dayWidth}
                  height={36}
                  fill={col.shade ? '#f8fafc' : '#ffffff'}
                  stroke="#e2e8f0"
                />
                <text
                  x={TASK_NAME_WIDTH + col.offsetDays * dayWidth + (col.days * dayWidth) / 2}
                  y={24}
                  fontSize="11"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {col.label}
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
            const isSelected = selectedTaskId === task.id || selectedTaskIds.has(task.id);
            const isCriticalTask = isTaskCritical(task.id);
            const slack = getTaskSlack(task.id);
            const slackWidth = slack * dayWidth;
            
            // Check if task is a milestone (manual or auto-detected zero-duration)
            const isMilestone = task.milestone === true || diffDays(task.endDate, task.startDate) === 0;
            
            // Debug logging
            if (task.milestone || isMilestone) {
              console.log(`[Milestone] Task: ${task.name}, milestone prop: ${task.milestone}, isMilestone: ${isMilestone}, days: ${diffDays(task.endDate, task.startDate)}`);
            }
            
            // Group styling
            const taskColor = task.isGroup 
              ? '#64748b' 
              : isCriticalTask 
                ? CRITICAL_COLOR 
                : task.color || COLORS[index % COLORS.length];
            
            return (
              <g key={task.id} data-testid={`gantt-task-row-${task.id}`} data-task-name={task.name}>
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
                      {wbsCodes.get(task.id) ? `${wbsCodes.get(task.id)}  ` : ''}{task.name}
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
                      {wbsCodes.get(task.id) ? `${wbsCodes.get(task.id)}  ` : ''}{task.name}
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
                {columns.map((col, i) => (
                  <rect
                    key={i}
                    x={TASK_NAME_WIDTH + col.offsetDays * dayWidth}
                    y={rowY}
                    width={col.days * dayWidth}
                    height={ROW_HEIGHT}
                    fill={col.shade ? '#f8fafc' : '#ffffff'}
                    stroke="#f1f5f9"
                    strokeWidth={0.5}
                  />
                ))}
                
                {/* Task bar (skip for groups and milestones) */}
                {!task.isGroup && !isMilestone && (
                  <g
                    className="cursor-pointer"
                    data-testid={`gantt-task-bar-${task.id}`}
                    data-task-name={task.name}
                    onClick={(e) => {
                      const isMultiSelect = e.ctrlKey || e.metaKey;
                      toggleTaskSelection(task.id, isMultiSelect);
                    }}
                    onMouseDown={(e) => handleMouseDown(e, task, 'move')}
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
                    
                    {/* Task name - show inside or outside bar based on width */}
                    {(() => {
                      // Calculate available space for task name
                      const progressTextWidth = 45; // Increased from 35 to 45 for better spacing
                      const leftPadding = 8;
                      const rightPadding = 8;
                      const minBarWidthForText = 100; // Minimum bar width to show text inside
                      const availableWidth = barWidth - progressTextWidth - leftPadding - rightPadding;
                      const textWidth = task.name.length * 7; // Increased from 6.5 to 7 for more accurate estimate
                      const showInside = textWidth < availableWidth && barWidth > minBarWidthForText;
                      
                      if (showInside) {
                        // Show inside bar (before progress %)
                        return (
                          <text
                            x={barX + leftPadding}
                            y={rowY + 24}
                            fontSize="11"
                            fill="#ffffff"
                            fontWeight="500"
                          >
                            {task.name}
                          </text>
                        );
                      } else {
                        // Show above bar
                        return (
                          <text
                            x={barX}
                            y={rowY + 4}
                            fontSize="10"
                            fill="#64748b"
                            fontWeight="500"
                          >
                            {task.name.length > 40 ? task.name.substring(0, 40) + '...' : task.name}
                          </text>
                        );
                      }
                    })()}
                    
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
                    
                    {/* Delay Impact Visualization */}
                    {visualizationData && visualizationData.enabled && 
                     visualizationData.result.affectedTasks.some((affected) => affected.task.id === task.id) && (() => {
                      const affectedTask = visualizationData.result.affectedTasks.find((affected) => affected.task.id === task.id);
                      if (!affectedTask || affectedTask.delayDays === 0) return null;
                      
                      const color = affectedTask.impactLevel === 'direct' ? '#ef4444' : 
                                    affectedTask.impactLevel === 'indirect' ? '#f59e0b' : '#10b981';
                      
                      return (
                        <g className="delay-impact-viz">
                          {/* Original position (gray dashed) */}
                          <rect
                            x={barX - (affectedTask.delayDays * dayWidth)}
                            y={rowY + 8}
                            width={barWidth}
                            height={24}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="5,5"
                            opacity="0.5"
                          />
                          
                          {/* Delay arrow */}
                          <path
                            d={`M ${barX - (affectedTask.delayDays * dayWidth) + barWidth/2} ${rowY + 20} 
                                L ${barX + barWidth/2} ${rowY + 20}`}
                            stroke={color}
                            strokeWidth="2"
                            strokeDasharray="5,5"
                            fill="none"
                            markerEnd="url(#delay-arrow)"
                          />
                          
                          {/* Delay label */}
                          <text
                            x={barX + barWidth/2}
                            y={rowY + 4}
                            fontSize="10"
                            fontWeight="600"
                            fill={color}
                            textAnchor="middle"
                          >
                            +{affectedTask.delayDays}d
                          </text>
                        </g>
                      );
                    })()}
                    
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
                          onMouseDown={(e) => handleMouseDown(e, task, 'resize-start')}
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
                          onMouseDown={(e) => handleMouseDown(e, task, 'resize-end')}
                        />
                      </>
                    )}
                  </g>
                )}
                
                {/* Milestone diamond (separate from task bar) - ONLY render for milestones */}
                {!task.isGroup && isMilestone && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      const isMultiSelect = e.ctrlKey || e.metaKey;
                      toggleTaskSelection(task.id, isMultiSelect);
                    }}
                  >
                    {/* Diamond shape - normal size */}
                    <polygon
                      points={`${barX + barWidth / 2},${rowY + 10} ${barX + barWidth / 2 + 10},${rowY + 20} ${barX + barWidth / 2},${rowY + 30} ${barX + barWidth / 2 - 10},${rowY + 20}`}
                      fill={taskColor}
                      stroke={isSelected ? '#1e40af' : isCriticalTask ? CRITICAL_COLOR : taskColor}
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={0.9}
                    />
                    {/* Milestone name above */}
                    <text
                      x={barX + barWidth / 2}
                      y={rowY + 4}
                      fontSize="10"
                      fill="#64748b"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {task.name.length > 30 ? task.name.substring(0, 30) + '...' : task.name}
                    </text>
                  </g>
                )}
                
                {/* Group summary bar */}
                {task.isGroup && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      const isMultiSelect = e.ctrlKey || e.metaKey;
                      toggleTaskSelection(task.id, isMultiSelect);
                    }}
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
      <div className="sticky bottom-4 float-right mr-4 mb-4 flex gap-2 bg-white rounded-lg shadow-lg p-2 z-10 w-fit">
        {/* Clear Visualization button (only show when visualization is active) */}
        {visualizationData && visualizationData.enabled && (
          <button
            onClick={clearVisualization}
            style={{
              backgroundColor: '#f97316',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
            title="Clear delay impact visualization"
          >
            🗑️ Clear Viz
          </button>
        )}
        
        {/* Auto-schedule button */}
        <button
          onClick={() => {
            const result = useGanttStore.getState().runAutoSchedule();
            console.log('Auto-schedule result:', result);
            alert(result.success 
              ? `✅ ${result.message} (${result.changed} tasks updated)`
              : `❌ ${result.message}`
            );
          }}
          style={{
            backgroundColor: '#a855f7',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: 'none',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#a855f7'}
          title="Auto-schedule tasks based on dependencies"
        >
          🤖 Auto-Schedule
        </button>
        
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

        {/* Manual column-width adjust */}
        <div className="flex items-center gap-1 ml-1 pl-2 border-l border-gray-200">
          <button
            onClick={() => {
              const s = useGanttStore.getState();
              s.setWidthScale(s.widthScale - 0.2);
            }}
            disabled={widthScale <= 0.4}
            className="w-7 h-7 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            title="Narrower columns"
          >
            −
          </button>
          <span className="text-xs font-medium text-gray-600 w-10 text-center tabular-nums" title="Column width">
            {Math.round(widthScale * 100)}%
          </span>
          <button
            onClick={() => {
              const s = useGanttStore.getState();
              s.setWidthScale(s.widthScale + 0.2);
            }}
            disabled={widthScale >= 3}
            className="w-7 h-7 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            title="Wider columns"
          >
            +
          </button>
        </div>
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
      
      {/* Sprint 10: Bulk Operations Panel */}
      {selectedTaskIds.size > 1 && (
        <div className="fixed top-20 right-4 z-20">
          <BulkOperationsPanel onClose={() => clearSelection()} />
        </div>
      )}
      
      {/* Selection count indicator */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2">
          <span className="font-semibold">{selectedTaskIds.size}</span>
          <span>selected</span>
          <button
            onClick={() => clearSelection()}
            className="ml-2 hover:bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
