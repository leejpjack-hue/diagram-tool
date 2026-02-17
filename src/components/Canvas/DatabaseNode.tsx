import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { DatabaseNodeData } from './types';

export const DatabaseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DatabaseNodeData;
  
  return (
    <div
      className={`
        px-4 py-3 rounded border-2 shadow-md
        ${selected ? 'border-electric-indigo shadow-lg' : 'border-electric-indigo'}
        min-w-[160px] bg-blue-50
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-electric-indigo" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-electric-indigo text-white text-xs font-bold">
          🗄️
        </div>
        <div className="font-semibold text-sm text-deep-navy">{nodeData.label}</div>
      </div>
      
      {nodeData.type && (
        <div className="text-xs text-indigo-600 font-mono capitalize">{nodeData.type}</div>
      )}
      
      {nodeData.data && Array.isArray(nodeData.data) && (
        <div className="text-xs text-slate-400 mt-1">
          {nodeData.data.slice(0, 2).join(', ')}
          {nodeData.data.length > 2 && ` +${nodeData.data.length - 2}`}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-electric-indigo" />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
