import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { DatabaseNodeData } from './types';

export const DatabaseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DatabaseNodeData;
  
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[160px]
      `}
      style={{
        background: '#FCE7F3',
        borderColor: selected ? '#EC4899' : '#EC4899',
        boxShadow: selected 
          ? '0 0 0 3px rgba(236, 72, 153, 0.2)'
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#EC4899' }} />
      
      <div className="flex items-center gap-2 mb-1">
        <div 
          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{ background: '#EC4899' }}
        >
          🗄️
        </div>
        <div 
          className="font-semibold text-sm"
          style={{ color: '#9D174D' }}
        >
          {nodeData.label}
        </div>
      </div>
      
      {nodeData.type && (
        <div 
          className="text-xs font-mono capitalize"
          style={{ color: '#EC4899' }}
        >
          {nodeData.type}
        </div>
      )}
      
      {nodeData.data && Array.isArray(nodeData.data) && (
        <div className="text-xs mt-1" style={{ color: '#9D174D', opacity: 0.7 }}>
          {nodeData.data.slice(0, 2).join(', ')}
          {nodeData.data.length > 2 && ` +${nodeData.data.length - 2}`}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#EC4899' }} />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
