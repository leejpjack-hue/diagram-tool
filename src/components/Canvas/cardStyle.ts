import type { CSSProperties } from 'react';

// Shared node design language (Diagram Kit reference): a clean white card with
// a soft colour-coded border, a layered drop shadow, and a light-tinted icon
// chip whose glyph is the saturated accent colour. Titles use Plus Jakarta
// Sans; codes/meta use JetBrains Mono. Every node passes its accent colour
// (or a custom DSL `color:`) through these builders for a consistent canvas.

export const TITLE_COLOR = '#1e293b';
export const MUTED_COLOR = '#64748b';
export const TITLE_FONT = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
export const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

// Layered shadow from the reference: a tight contact shadow plus a soft,
// far-reaching ambient one.
const CARD_SHADOW = '0 1px 2px rgba(17,24,39,0.05), 0 8px 18px -12px rgba(17,24,39,0.25)';

export function accentDark(accent: string): string {
  return `color-mix(in srgb, ${accent} 65%, #0f172a)`;
}

export function cardStyle(accent: string, selected: boolean): CSSProperties {
  return {
    background: '#ffffff',
    // Soft pastel border by default; the full accent on selection.
    border: `1.5px solid ${selected ? accent : `color-mix(in srgb, ${accent} 50%, white)`}`,
    borderRadius: 12,
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${accent} 20%, transparent), ${CARD_SHADOW}`
      : CARD_SHADOW,
  };
}

// Light-tinted square chip; the glyph inherits `color` (icons use currentColor).
export function chipStyle(accent: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${accent} 16%, white)`,
    color: accent,
  };
}

export function badgeStyle(accent: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${accent} 12%, white)`,
    color: accentDark(accent),
  };
}
