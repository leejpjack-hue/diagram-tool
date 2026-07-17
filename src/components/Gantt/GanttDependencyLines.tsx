/**
 * Gantt Dependency Lines Component
 * 
 * Visualizes task dependencies as arrows/lines connecting tasks
 * Inspired by Monday.com and MS Project dependency visualization
 */

import React, { useMemo } from 'react';
import type { GanttTask, Dependency, DependencyType } from './types';

interface Props {
  tasks: GanttTask[];
  dependencies: Dependency[];
  dateToX: (date: Date) => number;
  taskToY: (taskId: string) => number;
  taskHeight: number;
  dayWidth: number;
  showLabels?: boolean;
  criticalPathTaskIds?: string[];
}

interface DependencyLine {
  id: string;
  points: string;
  color: string;
  isCritical: boolean;
  label?: string;
}

/**
 * Generate SVG path for dependency arrow
 */
function generateDependencyPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  type: DependencyType,
  dayWidth: number
): string {
  const gap = 8; // Gap between task bar and arrow start/end
  const arrowSize = 6;
  
  // Calculate actual start/end points
  const x1 = startX + gap;
  const y1 = startY;
  const x2 = endX - gap - arrowSize;
  const y2 = endY;
  
  // Generate path based on dependency type
  switch (type) {
    case 'FS': // Finish-to-Start: predecessor end → successor start
      return generateFSPath(x1, y1, x2, y2, dayWidth);
    case 'SS': // Start-to-Start: predecessor start → successor start
      return generateSSPath(startX - gap, y1, x2, y2, dayWidth);
    case 'FF': // Finish-to-Finish: predecessor end → successor end
      return generateFFPath(x1, y1, endX + gap, y2, dayWidth);
    case 'SF': // Start-to-Finish: predecessor start → successor end
      return generateSFPath(startX - gap, y1, endX + gap, y2);
    default:
      return generateFSPath(x1, y1, x2, y2, dayWidth);
  }
}

function generateFSPath(x1: number, y1: number, x2: number, y2: number, dayWidth: number): string {
  const midX = x1 + dayWidth / 2;
  
  if (Math.abs(y1 - y2) < 10) {
    // Same row - simple curve
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }
  
  // Different rows - step pattern
  const stepX = x1 + dayWidth * 0.4;
  return `M ${x1} ${y1} L ${stepX} ${y1} L ${stepX} ${y2} L ${x2} ${y2}`;
}

function generateSSPath(x1: number, y1: number, x2: number, y2: number, dayWidth: number): string {
  const leftX = Math.min(x1, x2) - dayWidth * 0.3;
  return `M ${x1} ${y1} L ${leftX} ${y1} L ${leftX} ${y2} L ${x2} ${y2}`;
}

function generateFFPath(x1: number, y1: number, x2: number, y2: number, dayWidth: number): string {
  const rightX = Math.max(x1, x2) + dayWidth * 0.3;
  return `M ${x1} ${y1} L ${rightX} ${y1} L ${rightX} ${y2} L ${x2} ${y2}`;
}

function generateSFPath(x1: number, y1: number, x2: number, y2: number): string {
  // Rarely used - simple diagonal
  return `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
}

export const GanttDependencyLines: React.FC<Props> = ({
  tasks,
  dependencies,
  dateToX,
  taskToY,
  taskHeight,
  dayWidth,
  showLabels = false,
  criticalPathTaskIds = [],
}) => {
  const lines = useMemo(() => {
    const result: DependencyLine[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    dependencies.forEach(dep => {
      const predecessor = taskMap.get(dep.predecessorId);
      const successor = taskMap.get(dep.successorId);
      
      if (!predecessor || !successor) return;
      
      const isCritical = 
        criticalPathTaskIds.includes(dep.predecessorId) && 
        criticalPathTaskIds.includes(dep.successorId);
      
      // Calculate positions
      const startX = dateToX(predecessor.endDate);
      const startY = taskToY(predecessor.id) + taskHeight / 2;
      const endX = dateToX(successor.startDate);
      const endY = taskToY(successor.id) + taskHeight / 2;
      
      const points = generateDependencyPath(startX, startY, endX, endY, dep.type, dayWidth);
      
      result.push({
        id: `${dep.predecessorId}-${dep.successorId}`,
        points,
        color: isCritical ? '#ef4444' : '#94a3b8',
        isCritical,
        label: dep.type !== 'FS' ? dep.type : undefined,
      });
    });
    
    return result;
  }, [tasks, dependencies, dateToX, taskToY, taskHeight, dayWidth, criticalPathTaskIds]);
  
  if (lines.length === 0) return null;
  
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
        <marker
          id="arrowhead-critical"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
      </defs>
      
      {lines.map(line => (
        <g key={line.id}>
          <path
            d={line.points}
            fill="none"
            stroke={line.color}
            strokeWidth={line.isCritical ? 2 : 1.5}
            strokeDasharray={line.isCritical ? 'none' : '4,2'}
            markerEnd={`url(#arrowhead${line.isCritical ? '-critical' : ''})`}
            className="transition-colors duration-200"
          />
          {showLabels && line.label && (
            <text
              x={0}
              y={0}
              fontSize="10"
              fill={line.color}
              fontWeight="medium"
            >
              {line.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export default GanttDependencyLines;
