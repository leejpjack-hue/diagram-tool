import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { QueueNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';

export const QueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QueueNodeData;
  const { target, source } = useLayoutHandles();

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[160px]
      `}
      style={{
        background: '#D1FAE5',
        borderColor: selected ? '#10B981' : '#10B981',
        boxShadow: selected 
          ? '0 0 0 3px rgba(16, 185, 129, 0.2)'
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle type="target" position={target} style={{ background: '#10B981' }} />
      
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
          style={{
            background: '#10B981',
            fontSize: 26,
            lineHeight: 1,
            boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
          }}
        >
          {hasNodeIcon('queue') ? (
            <NodeIcon name="queue" size={28} />
          ) : (
            '📨'
          )}
        </div>
        <div
          className="font-semibold text-base"
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
      
      <Handle type="source" position={source} style={{ background: '#10B981' }} />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
