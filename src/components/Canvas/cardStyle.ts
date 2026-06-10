import type { CSSProperties } from 'react';

// Shared "pro card" design language for canvas nodes: near-white card with a
// subtle accent tint, top accent bar, soft layered shadow, and a gradient
// icon chip. Every node type passes its accent colour (or a custom DSL
// `color:`) through these builders so the whole canvas stays consistent.

export const TITLE_COLOR = '#0f172a';
export const MUTED_COLOR = '#64748b';

export function accentDark(accent: string): string {
  return `color-mix(in srgb, ${accent} 65%, #0f172a)`;
}

export function cardStyle(accent: string, selected: boolean): CSSProperties {
  return {
    background: `color-mix(in srgb, ${accent} 5%, white)`,
    border: selected ? `1px solid ${accent}` : '1px solid #e2e8f0',
    borderTop: `3px solid ${accent}`,
    borderRadius: 12,
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${accent} 18%, transparent), 0 8px 24px rgba(15,23,42,0.14)`
      : '0 1px 2px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.08)',
  };
}

export function chipStyle(accent: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, #0f172a))`,
    boxShadow: `0 2px 6px color-mix(in srgb, ${accent} 35%, transparent)`,
  };
}

export function badgeStyle(accent: string): CSSProperties {
  return {
    background: `color-mix(in srgb, ${accent} 12%, white)`,
    color: accentDark(accent),
  };
}
