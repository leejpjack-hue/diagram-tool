import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ServiceNodeData;
  const isAPI = nodeData.type === 'api';
  const iconKey = isAPI ? 'api' : 'service';
  
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[180px]
      `}
      style={{
        background: isAPI ? '#DBEAFE' : '#E9D5FF',
        borderColor: selected ? (isAPI ? '#3B82F6' : '#8B5CF6') : (isAPI ? '#3B82F6' : '#8B5CF6'),
        boxShadow: selected 
          ? (isAPI ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : '0 0 0 3px rgba(139, 92, 246, 0.2)')
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-electric-blue" />
      
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
          style={{
            background: isAPI ? '#3B82F6' : '#8B5CF6',
            fontSize: 26,
            lineHeight: 1,
            boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
          }}
        >
          {hasNodeIcon(iconKey) ? (
            <NodeIcon name={iconKey} size={28} />
          ) : (
            isAPI ? '⚡' : '⚙️'
          )}
        </div>
        <div
          className="font-semibold text-base"
          style={{ color: isAPI ? '#1E40AF' : '#6B21A8' }}
        >
          {nodeData.label}
        </div>
      </div>
      
      {nodeData.tech && (
        <div 
          className="text-xs font-mono"
          style={{ color: isAPI ? '#3B82F6' : '#8B5CF6' }}
        >
          {nodeData.tech}
        </div>
      )}
      
      {nodeData.type && (
        <div 
          className="text-xs mt-1 capitalize"
          style={{ color: isAPI ? '#1E40AF' : '#6B21A8', opacity: 0.7 }}
        >
          {nodeData.type}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ background: isAPI ? '#3B82F6' : '#8B5CF6' }} />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
