import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  
  return (
    <div
      className={`
        relative w-28 h-28 transition-all duration-200
        ${selected ? 'scale-110' : 'hover:scale-105'}
      `}
      style={{
        filter: selected ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))' : 'none'
      }}
    >
      {/* Diamond shape using CSS */}
      <div
        className={`
          absolute inset-0 transform rotate-45
          border-2 transition-all duration-200
        `}
        style={{
          background: 'color-mix(in srgb, #f59e0b 8%, white)',
          borderColor: '#f59e0b',
          borderRadius: 10,
          boxShadow: selected
            ? '0 0 0 3px rgba(245, 158, 11, 0.2), 0 8px 24px rgba(15,23,42,0.14)'
            : '0 1px 2px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.08)'
        }}
      />
      
      {/* Text container (rotated back) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="transform -rotate-45 text-center">
          <div
            className="font-semibold text-xs"
            style={{ color: '#0f172a' }}
          >
            {nodeData.label}
          </div>
        </div>
      </div>
      
      {/* Handles on diamond points */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#F59E0B', top: 0, left: '50%', transform: 'translateX(-50%)' }} 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#F59E0B', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        id="left"
        style={{ background: '#F59E0B', left: 0, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="right"
        style={{ background: '#F59E0B', right: 0, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
