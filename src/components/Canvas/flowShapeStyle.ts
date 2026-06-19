import type { CSSProperties } from 'react';

// Flat flowchart shape language: a soft pastel fill, a 2px saturated border,
// dark readable label, and no heavy shadow — matching the clean reference
// design. Shared by every flow-mode shape so the canvas stays consistent.

export interface FlowPalette {
  fill: string;
  border: string;
  text: string;
}

export const FLOW_COLORS = {
  green: { fill: '#bbf7d0', border: '#22c55e', text: '#166534' },
  blue: { fill: '#bfdbfe', border: '#3b82f6', text: '#1e40af' },
  amber: { fill: '#fde68a', border: '#f59e0b', text: '#92400e' },
  red: { fill: '#fecaca', border: '#ef4444', text: '#991b1b' },
  slate: { fill: '#e2e8f0', border: '#94a3b8', text: '#334155' },
} as const satisfies Record<string, FlowPalette>;

// Outer-div style for box/pill shapes (process, terminator, start/end).
export function flowShapeStyle(p: FlowPalette, selected: boolean): CSSProperties {
  return {
    background: p.fill,
    border: `2px solid ${p.border}`,
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${p.border} 22%, transparent)`
      : '0 1px 2px rgba(15,23,42,0.06)',
  };
}
