import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { FLOW_COLORS, flowShapeStyle } from './flowShapeStyle';

const C = FLOW_COLORS.blue;

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles();

  return (
    <div
      className={`
        px-5 py-3 rounded-xl transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[140px]
      `}
      style={flowShapeStyle(C, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: C.border }} />

      <div className="font-semibold text-sm text-center" style={{ color: C.text }}>
        {nodeData.label}
      </div>

      {nodeData.system && (
        <div className="text-[11px] font-mono text-center mt-1" style={{ color: C.border }}>
          {nodeData.system}
        </div>
      )}

      {nodeData.duration && (
        <div className="text-[11px] text-center mt-0.5" style={{ color: C.text, opacity: 0.7 }}>
          ⏱️ {nodeData.duration}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: C.border }} />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
