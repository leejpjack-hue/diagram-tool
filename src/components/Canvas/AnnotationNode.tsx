import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { NodeProps } from '@xyflow/react';
import { TITLE_FONT } from './cardStyle';

// Annotation sticky note — a free-floating callout that sits on top of the
// canvas to highlight a decision, a risk, or a piece of context. Mirrors the
// yellow note from the Diagram Kit reference: rounded bottom-right corners,
// a sharp top-left corner, and a soft drop shadow.
//
// Annotations have no edges, no autolayout, and no connection handles — they
// are purely decorative overlays.

export interface AnnotationNodeData {
  label?: string;
  text: string;
  color?: string;
}

const DEFAULT_ACCENT = '#fbbf24'; // amber-400, matches the design

export const AnnotationNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationNodeData;
  const accent = d.color || DEFAULT_ACCENT;

  // Tints derived from the accent: a creamy fill, a saturated text colour,
  // and a slightly darker border that matches the design's callout style.
  const fill = `color-mix(in srgb, ${accent} 18%, white)`;
  const border = `color-mix(in srgb, ${accent} 50%, white)`;
  const text = `color-mix(in srgb, ${accent} 70%, #422006)`;

  // The accent corner radius asymmetry mimics a torn sticky note — three
  // gentle rounds plus a sharper top-left so the note "points" at what it's
  // annotating.
  const cornerRadius: CSSProperties = {
    borderRadius: '3px 12px 12px 12px',
  };

  return (
    <div
      className={`relative max-w-[240px] px-3.5 py-2.5 text-left transition-all duration-200 ${
        selected ? 'scale-[1.02]' : ''
      }`}
      style={{
        ...cornerRadius,
        background: fill,
        border: `1px solid ${border}`,
        boxShadow: selected
          ? `0 0 0 3px color-mix(in srgb, ${accent} 25%, transparent), 0 8px 18px -12px rgba(0,0,0,0.35)`
          : '0 8px 18px -12px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="text-[11px] leading-snug"
        style={{ color: text, fontFamily: TITLE_FONT, fontWeight: 500 }}
      >
        {d.text || d.label || 'Add a note…'}
      </div>
    </div>
  );
});

AnnotationNode.displayName = 'AnnotationNode';