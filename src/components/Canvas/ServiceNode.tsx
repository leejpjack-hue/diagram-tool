import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ServiceNodeData;
  const isAPI = nodeData.type === 'api';
  const iconKey = isAPI ? 'api' : 'service';
  const { target, source } = useLayoutHandles();

  // Presentation-style accent: a `color:` in the DSL overrides the default
  // api/service palette; `icon:` swaps the SVG glyph for an emoji.
  const accent = nodeData.color || (isAPI ? '#3B82F6' : '#8B5CF6');
  const softBg = nodeData.color
    ? `color-mix(in srgb, ${accent} 12%, white)`
    : (isAPI ? '#DBEAFE' : '#E9D5FF');
  const titleColor = nodeData.color
    ? `color-mix(in srgb, ${accent} 70%, black)`
    : (isAPI ? '#1E40AF' : '#6B21A8');

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[180px]
      `}
      style={{
        background: softBg,
        borderColor: accent,
        boxShadow: selected
          ? `0 0 0 3px color-mix(in srgb, ${accent} 20%, transparent)`
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Handle type="target" position={target} className="!bg-electric-blue" />

      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
          style={{
            background: accent,
            fontSize: 26,
            lineHeight: 1,
            boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
          }}
        >
          {nodeData.icon ? (
            <span style={{ fontSize: 24 }}>{nodeData.icon}</span>
          ) : hasNodeIcon(iconKey) ? (
            <NodeIcon name={iconKey} size={28} />
          ) : (
            isAPI ? '⚡' : '⚙️'
          )}
        </div>
        <div
          className="font-semibold text-base"
          style={{ color: titleColor }}
        >
          {nodeData.label}
        </div>
      </div>

      {nodeData.tech && (
        <div
          className="text-xs font-mono"
          style={{ color: accent }}
        >
          {nodeData.tech}
        </div>
      )}

      {nodeData.type && (
        <div
          className="text-xs mt-1 capitalize"
          style={{ color: titleColor, opacity: 0.7 }}
        >
          {nodeData.type}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
