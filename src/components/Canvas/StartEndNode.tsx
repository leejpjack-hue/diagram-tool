import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

export const StartEndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const isStart = nodeData.isStart;
  const isEnd = nodeData.isEnd;
  
  return (
    <div
      className={`
        px-5 py-2 rounded-full border-2 shadow-md
        ${isStart ? 'bg-success text-white border-success' : ''}
        ${isEnd ? 'bg-error text-white border-error' : ''}
        ${selected ? 'ring-2 ring-electric-indigo ring-offset-2' : ''}
      `}
    >
      {isStart && <Handle type="source" position={Position.Bottom} className="!bg-white" />}
      {isEnd && <Handle type="target" position={Position.Top} className="!bg-white" />}
      
      <div className="font-semibold text-sm">
        {nodeData.label}
      </div>
      
      {!isStart && !isEnd && (
        <>
          <Handle type="target" position={Position.Top} className="!bg-slate-charcoal" />
          <Handle type="source" position={Position.Bottom} className="!bg-slate-charcoal" />
        </>
      )}
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
