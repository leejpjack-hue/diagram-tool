/**
 * Delay Impact Visualization Utilities
 * 
 * Visual helpers for showing delay impact on Gantt chart
 */

import type { AffectedTask } from './delayImpactUtils';

export interface VisualizationConfig {
  showOriginal: boolean;
  showImpact: boolean;
  animationDuration: number;
}

/**
 * Generate SVG elements for original task position (gray dashed)
 */
export function renderOriginalTask(
  x: number,
  y: number,
  width: number,
  height: number
): string {
  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      fill="none"
      stroke="#cbd5e1"
      stroke-width="1"
      stroke-dasharray="5,5"
      opacity="0.5"
    />
  `;
}

/**
 * Generate SVG for impact arrow
 */
export function renderImpactArrow(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string
): string {
  return `
    <path
      d="M ${fromX} ${fromY} L ${toX} ${toY}"
      stroke="${color}"
      stroke-width="2"
      stroke-dasharray="5,5"
      fill="none"
      marker-end="url(#arrowhead)"
    />
  `;
}

/**
 * Generate delay label
 */
export function renderDelayLabel(
  x: number,
  y: number,
  delayDays: number,
  color: string
): string {
  const text = delayDays > 0 ? `+${delayDays}d` : `${delayDays}d`;
  
  return `
    <text
      x="${x}"
      y="${y}"
      font-size="10"
      font-weight="600"
      fill="${color}"
      text-anchor="middle"
    >
      ${text}
    </text>
  `;
}

/**
 * Get impact level color
 */
export function getImpactLevelColor(level: 'none' | 'indirect' | 'direct'): string {
  switch (level) {
    case 'direct':
      return '#ef4444'; // red
    case 'indirect':
      return '#f59e0b'; // yellow/orange
    case 'none':
    default:
      return '#10b981'; // green
  }
}

/**
 * Calculate visualization coordinates
 */
export function calculateVisualizationCoords(
  originalStart: Date,
  newStart: Date,
  minDate: Date,
  dayWidth: number
): {
  originalX: number;
  deltaX: number;
} {
  const originalOffset = Math.floor((originalStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const newOffset = Math.floor((newStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const originalX = originalOffset * dayWidth;
  const deltaX = (newOffset - originalOffset) * dayWidth;
  
  return { originalX, deltaX };
}

/**
 * Generate complete visualization SVG for an affected task
 */
export function generateTaskVisualization(
  affectedTask: AffectedTask,
  minDate: Date,
  dayWidth: number,
  config: VisualizationConfig
): string {
  const svg: string[] = [];
  const color = getImpactLevelColor(affectedTask.impactLevel);
  
  // Calculate coordinates
  const { deltaX } = calculateVisualizationCoords(
    affectedTask.originalStart,
    affectedTask.newStart,
    minDate,
    dayWidth
  );
  
  // Render original position (if enabled)
  if (config.showOriginal && deltaX !== 0) {
    const originalOffset = Math.floor(
      (affectedTask.originalStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const originalX = 200 + (originalOffset * dayWidth);
    
    svg.push(renderOriginalTask(
      originalX,
      0, // barY will be passed by caller
      100, // placeholder width
      24 // barHeight
    ));
  }
  
  // Render delay label
  if (config.showImpact && deltaX !== 0) {
    svg.push(renderDelayLabel(
      0,
      0,
      affectedTask.delayDays,
      color
    ));
  }
  
  return svg.join('\n');
}
