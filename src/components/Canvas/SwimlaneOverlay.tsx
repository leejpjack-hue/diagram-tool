import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

interface SwimlaneNodeData {
  label: string;
  color?: string;
  width: number;
  height: number;
}

/**
 * Lane band rendered as a non-interactive React Flow node.
 * Drawn behind flow content (low zIndex) with a left-side header strip.
 */
export const SwimlaneNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as SwimlaneNodeData;
  const color = d.color || '#F1F5F9';
  const HEADER_W = 120;

  return (
    <div
      className="relative pointer-events-none"
      style={{ width: d.width, height: d.height }}
    >
      {/* Full band */}
      <div
        className="absolute inset-0"
        style={{
          background: color,
          opacity: 0.4,
          border: '1px solid rgba(0,0,0,0.18)',
          borderRadius: 4,
        }}
      />
      {/* Header strip */}
      <div
        className="absolute top-0 left-0 flex items-center justify-center"
        style={{
          width: HEADER_W,
          height: d.height,
          background: color,
          opacity: 0.95,
          borderRight: '2px solid rgba(0,0,0,0.22)',
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        }}
      >
        <div
          className="text-xs font-bold uppercase tracking-wider"
          style={{
            color: '#1E293B',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
          }}
        >
          {d.label}
        </div>
      </div>
    </div>
  );
});

SwimlaneNode.displayName = 'SwimlaneNode';
