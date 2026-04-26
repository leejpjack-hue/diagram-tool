import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles();

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[140px]
      `}
      style={{
        background: '#DBEAFE',
        borderColor: selected ? '#3B82F6' : '#3B82F6',
        boxShadow: selected 
          ? '0 0 0 3px rgba(59, 130, 246, 0.2)'
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle type="target" position={target} style={{ background: '#3B82F6' }} />
      
      <div 
        className="font-semibold text-sm text-center"
        style={{ color: '#1E40AF' }}
      >
        {nodeData.label}
      </div>
      
      {nodeData.system && (
        <div 
          className="text-xs font-mono text-center mt-1"
          style={{ color: '#3B82F6' }}
        >
          {nodeData.system}
        </div>
      )}
      
      {nodeData.duration && (
        <div className="text-xs text-center mt-0.5" style={{ color: '#1E40AF', opacity: 0.7 }}>
          ⏱️ {nodeData.duration}
        </div>
      )}
      
      <Handle type="source" position={source} style={{ background: '#3B82F6' }} />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';
