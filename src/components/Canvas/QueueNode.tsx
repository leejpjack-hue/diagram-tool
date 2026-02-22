import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { QueueNodeData } from './types';

export const QueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QueueNodeData;
  
  return (
    <div
      className={`
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg active:scale-95'}
        min-w-[140px] sm:min-w-[160px] min-h-[44px] sm:min-h-0
      `}
      style={{
        background: '#D1FAE5',
        borderColor: selected ? '#10B981' : '#10B981',
        boxShadow: selected 
          ? '0 0 0 3px rgba(16, 185, 129, 0.2)'
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
        style={{ background: '#10B981' }} 
      />
      
      <div className="flex items-center gap-2 mb-1">
        <div 
          className="w-7 h-7 sm:w-6 sm:h-6 rounded flex items-center justify-center text-white text-sm sm:text-xs font-bold"
          style={{ background: '#10B981' }}
        >
          📨
        </div>
        <div 
          className="font-semibold text-base sm:text-sm"
          style={{ color: '#065F46' }}
        >
          {nodeData.label}
        </div>
      </div>
      
      {nodeData.type && (
        <div 
          className="text-xs font-mono capitalize"
          style={{ color: '#10B981' }}
        >
          {nodeData.type}
        </div>
      )}
      
      {nodeData.topic && (
        <div className="text-xs mt-1 font-mono" style={{ color: '#065F46', opacity: 0.7 }}>
          {nodeData.topic}
        </div>
      )}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-3 !h-3 sm:!w-2.5 sm:!h-2.5"
        style={{ background: '#10B981' }} 
      />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
