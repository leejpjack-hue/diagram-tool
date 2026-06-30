import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { FLOW_COLORS, flowShapeStyle, paletteFromColor, TITLE_FONT, MONO_FONT } from './flowShapeStyle';

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles(!!nodeData.reversed);
  const C = nodeData.color ? paletteFromColor(nodeData.color) : FLOW_COLORS.blue;

  return (
    <div
      className={`
        px-5 py-3 rounded-xl transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[150px]
      `}
      style={flowShapeStyle(C, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: C.border }} />

      <div className="font-semibold text-[13px] text-center" style={{ color: C.text, fontFamily: TITLE_FONT }}>
        {nodeData.label}
      </div>

      {nodeData.system && (
        <div className="text-[10px] text-center mt-1" style={{ color: C.text, opacity: 0.7, fontFamily: MONO_FONT }}>
          {nodeData.system}
        </div>
      )}

      {nodeData.duration && (
        <div className="text-[10px] text-center mt-0.5" style={{ color: '#64748b', fontFamily: MONO_FONT }}>
          ⏱️ {nodeData.duration}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: C.border }} />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
