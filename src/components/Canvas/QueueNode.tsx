import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { QueueNodeData } from './types';

export const QueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QueueNodeData;
  
  return (
    <div
      className={`
        px-4 py-3 rounded border-2 shadow-md
        ${selected ? 'border-purple-500 shadow-lg' : 'border-purple-600'}
        min-w-[160px] bg-purple-50
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-600" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-purple-600 text-white text-xs font-bold">
          📨
        </div>
        <div className="font-semibold text-sm text-deep-navy">{nodeData.label}</div>
      </div>
      
      {nodeData.type && (
        <div className="text-xs text-purple-600 font-mono capitalize">{nodeData.type}</div>
      )}
      
      {nodeData.topic && (
        <div className="text-xs text-slate-400 mt-1 font-mono">{nodeData.topic}</div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-purple-600" />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
