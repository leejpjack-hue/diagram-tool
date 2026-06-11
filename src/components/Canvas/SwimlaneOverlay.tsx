import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface SwimlaneNodeData {
  label: string;
  color?: string;
  isFirst?: boolean;
  isLast?: boolean;
  width: number;
  height: number;
}

/**
 * Swimlane band rendered as a non-interactive React Flow node, styled after
 * Figma's swimlane flowchart reference: a softly tinted full-width band with
 * a crisp separator, and a solid colour header strip on the left carrying
 * the role name in white.
 */
export const SwimlaneNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as SwimlaneNodeData;
  const color = d.color || '#64748b';
  const HEADER_W = 56;
  const outerRadius = 14;

  return (
    <div
      className="relative pointer-events-none"
      style={{ width: d.width, height: d.height }}
    >
      {/* Full band — soft tint of the lane colour */}
      <div
        className="absolute inset-0"
        style={{
          background: `color-mix(in srgb, ${color} 7%, white)`,
          borderTop: d.isFirst ? `1px solid color-mix(in srgb, ${color} 30%, white)` : 'none',
          borderBottom: '1px solid rgba(15, 23, 42, 0.1)',
          borderRight: '1px solid rgba(15, 23, 42, 0.08)',
          borderTopRightRadius: d.isFirst ? outerRadius : 0,
          borderBottomRightRadius: d.isLast ? outerRadius : 0,
        }}
      />
      {/* Header strip — solid lane colour with white label */}
      <div
        className="absolute top-0 left-0 flex items-center justify-center"
        style={{
          width: HEADER_W,
          height: d.height,
          background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 80%, #0f172a))`,
          borderTopLeftRadius: d.isFirst ? outerRadius : 0,
          borderBottomLeftRadius: d.isLast ? outerRadius : 0,
          boxShadow: 'inset -1px 0 0 rgba(15, 23, 42, 0.12)',
        }}
      >
        <div
          className="text-[11px] font-bold uppercase"
          style={{
            color: '#ffffff',
            letterSpacing: '0.12em',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(15, 23, 42, 0.25)',
          }}
        >
          {d.label}
        </div>
      </div>
    </div>
  );
});

SwimlaneNode.displayName = 'SwimlaneNode';
