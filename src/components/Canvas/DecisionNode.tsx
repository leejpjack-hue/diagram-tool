import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  
  return (
    <div
      className={`
        relative w-28 h-28
        ${selected ? 'ring-2 ring-electric-indigo ring-offset-2' : ''}
      `}
    >
      {/* Diamond shape using CSS */}
      <div
        className={`
          absolute inset-0 transform rotate-45
          border-2 bg-amber-50 shadow-md
          ${selected ? 'border-electric-indigo' : 'border-amber-500'}
        `}
      />
      
      {/* Text container (rotated back) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="transform -rotate-45 text-center">
          <div className="font-semibold text-xs text-deep-navy">
            {nodeData.label}
          </div>
        </div>
      </div>
      
      {/* Handles on diamond points */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-amber-600 !top-0 !left-1/2 !transform !-translate-x-1/2" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-amber-600 !bottom-0 !left-1/2 !transform !-translate-x-1/2"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left"
        className="!bg-amber-600 !left-0 !top-1/2 !transform !-translate-y-1/2"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
        className="!bg-amber-600 !right-0 !top-1/2 !transform !-translate-y-1/2"
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
