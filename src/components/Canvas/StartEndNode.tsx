import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { FLOW_COLORS, flowShapeStyle } from './flowShapeStyle';

export const StartEndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const isStart = nodeData.isStart;
  const isEnd = nodeData.isEnd;
  const { target, source } = useLayoutHandles();

  // Start = green stadium, end = red stadium, anything else neutral.
  const c = isStart ? FLOW_COLORS.green : isEnd ? FLOW_COLORS.red : FLOW_COLORS.slate;

  return (
    <div
      className={`
        px-6 py-2.5 rounded-full transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-105'}
        min-w-[110px] text-center
      `}
      style={flowShapeStyle(c, !!selected)}
    >
      {isStart && <Handle type="source" position={source} style={{ background: c.border }} />}
      {isEnd && <Handle type="target" position={target} style={{ background: c.border }} />}

      <div className="font-semibold text-sm" style={{ color: c.text }}>
        {nodeData.label}
      </div>

      {!isStart && !isEnd && (
        <>
          <Handle type="target" position={target} style={{ background: c.border }} />
          <Handle type="source" position={source} style={{ background: c.border }} />
        </>
      )}
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
