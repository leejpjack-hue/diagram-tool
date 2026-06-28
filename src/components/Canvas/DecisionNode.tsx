import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { FLOW_COLORS, paletteFromColor, TITLE_FONT } from './flowShapeStyle';

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const C = nodeData.color ? paletteFromColor(nodeData.color) : FLOW_COLORS.amber;

  return (
    <div
      className={`
        relative w-28 h-28 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-105'}
      `}
    >
      {/* Diamond shape — a rotated square inset so its points meet the node
          box edges (where the handles sit), matching the reference size. */}
      <div
        className="absolute transform rotate-45 transition-all duration-200"
        style={{
          inset: 15,
          background: '#ffffff',
          border: `1.5px solid ${selected ? C.text : C.border}`,
          borderRadius: 12,
          boxShadow: selected
            ? `0 0 0 3px color-mix(in srgb, ${C.text} 18%, transparent), 0 10px 20px -14px rgba(17,24,39,0.3)`
            : '0 1px 2px rgba(17,24,39,0.05), 0 10px 20px -14px rgba(17,24,39,0.3)',
        }}
      />

      {/* Text container (rotated back) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="transform -rotate-45 text-center px-2">
          <div className="font-semibold text-[11.5px] leading-tight" style={{ color: C.text, fontFamily: TITLE_FONT }}>
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
