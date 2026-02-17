import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from './types';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ServiceNodeData;
  
  return (
    <div
      className={`
        px-4 py-3 rounded border-2 bg-white shadow-md
        ${selected ? 'border-electric-indigo shadow-lg' : 'border-slate-charcoal'}
        min-w-[180px]
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-charcoal" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-charcoal text-white text-xs font-bold">
          ⚙️
        </div>
        <div className="font-semibold text-sm text-deep-navy">{nodeData.label}</div>
      </div>
      
      {nodeData.tech && (
        <div className="text-xs text-slate-500 font-mono">{nodeData.tech}</div>
      )}
      
      {nodeData.type && (
        <div className="text-xs text-slate-400 mt-1 capitalize">{nodeData.type}</div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-slate-charcoal" />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
