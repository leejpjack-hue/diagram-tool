import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { FLOW_COLORS } from './flowShapeStyle';

const C = FLOW_COLORS.amber;

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;

  return (
    <div
      className={`
        relative w-28 h-28 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-105'}
      `}
    >
      {/* Diamond shape — flat pastel fill with a 2px border */}
      <div
        className="absolute inset-0 transform rotate-45 transition-all duration-200"
        style={{
          background: C.fill,
          border: `2px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: selected
            ? `0 0 0 3px color-mix(in srgb, ${C.border} 22%, transparent)`
            : '0 1px 2px rgba(15,23,42,0.06)',
        }}
      />

      {/* Text container (rotated back) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="transform -rotate-45 text-center px-1">
          <div className="font-semibold text-xs" style={{ color: C.text }}>
            {nodeData.label}
          </div>
        </div>
      </div>

      {/* Handles on diamond points */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: C.border, top: 0, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: C.border, bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: C.border, left: 0, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: C.border, right: 0, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
