import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 bg-white shadow-md
        ${selected ? 'border-electric-indigo shadow-lg' : 'border-slate-charcoal'}
        min-w-[140px]
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-charcoal" />
      
      <div className="font-semibold text-sm text-deep-navy text-center">
        {nodeData.label}
      </div>
      
      {nodeData.system && (
        <div className="text-xs text-slate-500 font-mono text-center mt-1">
          {nodeData.system}
        </div>
      )}
      
      {nodeData.duration && (
        <div className="text-xs text-slate-400 text-center mt-0.5">
          ⏱️ {nodeData.duration}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-slate-charcoal" />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
