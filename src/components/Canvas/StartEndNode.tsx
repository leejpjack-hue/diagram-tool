import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

export const StartEndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const isStart = nodeData.isStart;
  const isEnd = nodeData.isEnd;
  
  const bgColor = isStart ? '#10B981' : '#EF4444';
  const ringColor = isStart ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
  
  return (
    <div
      className={`
        px-5 py-2 rounded-full border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-110 shadow-xl' : 'hover:shadow-lg hover:scale-105'}
      `}
      style={{
        background: bgColor,
        borderColor: bgColor,
        boxShadow: selected 
          ? `0 0 0 3px ${ringColor}`
          : '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      {isStart && <Handle type="source" position={Position.Bottom} style={{ background: 'white' }} />}
      {isEnd && <Handle type="target" position={Position.Top} style={{ background: 'white' }} />}
      
      <div className="font-semibold text-sm text-white">
        {nodeData.label}
      </div>
      
      {!isStart && !isEnd && (
        <>
          <Handle type="target" position={Position.Top} style={{ background: bgColor }} />
          <Handle type="source" position={Position.Bottom} style={{ background: bgColor }} />
        </>
      )}
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
