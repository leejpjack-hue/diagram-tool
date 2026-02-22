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
        px-4 py-2.5 sm:px-5 sm:py-2 rounded-full border-2 shadow-md transition-all duration-200
        min-h-[44px] sm:min-h-0
        ${selected ? 'scale-110 shadow-xl' : 'hover:shadow-lg active:scale-100'}
      `}
      style={{
        background: bgColor,
        borderColor: bgColor,
        boxShadow: selected 
          ? `0 0 0 3px ${ringColor}`
          : '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      {isStart && (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
          style={{ background: 'white' }} 
        />
      )}
      {isEnd && (
        <Handle 
          type="target" 
          position={Position.Top} 
          className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
          style={{ background: 'white' }} 
        />
      )}
      
      <div className="font-semibold text-base sm:text-sm text-white">
        {nodeData.label}
      </div>
      
      {!isStart && !isEnd && (
        <>
          <Handle 
            type="target" 
            position={Position.Top} 
            className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
            style={{ background: bgColor }} 
          />
          <Handle 
            type="source" 
            position={Position.Bottom} 
            className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
            style={{ background: bgColor }} 
          />
        </>
      )}
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
