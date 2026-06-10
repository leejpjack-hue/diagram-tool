import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { cardStyle, TITLE_COLOR, MUTED_COLOR } from './cardStyle';

const ACCENT = '#3b82f6';

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles();

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[140px]
      `}
      style={cardStyle(ACCENT, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: ACCENT }} />

      <div className="font-semibold text-sm text-center" style={{ color: TITLE_COLOR }}>
        {nodeData.label}
      </div>

      {nodeData.system && (
        <div className="text-[11px] font-mono text-center mt-1" style={{ color: ACCENT }}>
          {nodeData.system}
        </div>
      )}

      {nodeData.duration && (
        <div className="text-[11px] text-center mt-0.5" style={{ color: MUTED_COLOR }}>
          ⏱️ {nodeData.duration}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: ACCENT }} />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
