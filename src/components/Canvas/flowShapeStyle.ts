import type { CSSProperties } from 'react';

// Workflow shape language (Diagram Kit reference): process/decision shapes are
// white cards with a soft colour-coded border and a saturated, darkened label;
// terminators are lightly tinted pills with an uppercase label. Shared by the
// flow-mode shapes so the canvas reads consistently.

export const TITLE_FONT = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
export const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

export interface FlowPalette {
  /** soft border colour */
  border: string;
  /** saturated, darkened text colour */
  text: string;
  /** very light fill for terminator pills */
  tint: string;
}

export const FLOW_COLORS = {
  green: { border: '#86efac', text: '#15803d', tint: '#f0fdf4' },
  blue: { border: '#93c5fd', text: '#1d4ed8', tint: '#eff6ff' },
  amber: { border: '#fcd34d', text: '#b45309', tint: '#fffbeb' },
  red: { border: '#fca5a5', text: '#b91c1c', tint: '#fef2f2' },
  slate: { border: '#cbd5e1', text: '#334155', tint: '#f8fafc' },
} as const satisfies Record<string, FlowPalette>;

const SHADOW = '0 1px 2px rgba(17,24,39,0.05), 0 8px 18px -12px rgba(17,24,39,0.25)';

// White card with a soft colour border — process, decision, data, etc.
export function flowShapeStyle(p: FlowPalette, selected: boolean): CSSProperties {
  return {
    background: '#ffffff',
    border: `1.5px solid ${selected ? p.text : p.border}`,
    boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${p.text} 18%, transparent), ${SHADOW}` : SHADOW,
  };
}

// Lightly tinted pill — start / end terminators.
export function flowPillStyle(p: FlowPalette, selected: boolean): CSSProperties {
  return {
    background: p.tint,
    border: `1.5px solid ${selected ? p.text : p.border}`,
    boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${p.text} 18%, transparent), ${SHADOW}` : SHADOW,
  };
}
