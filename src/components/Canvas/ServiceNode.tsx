import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';
import { cardStyle, chipStyle, badgeStyle, TITLE_COLOR, MUTED_COLOR, TITLE_FONT, MONO_FONT } from './cardStyle';

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ServiceNodeData;
  const isAPI = nodeData.type === 'api';
  const iconKey = isAPI ? 'api' : 'service';
  const { target, source } = useLayoutHandles();

  // Presentation-style accent: a `color:` in the DSL overrides the default
  // api/service palette; `icon:` swaps the SVG glyph for an emoji.
  const accent = nodeData.color || (isAPI ? '#3b82f6' : '#8b5cf6');

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[180px]
      `}
      style={cardStyle(accent, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: accent }} />

      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center font-bold shrink-0"
          style={chipStyle(accent)}
        >
          {nodeData.icon ? (
            <span style={{ fontSize: 20, lineHeight: 1 }}>{nodeData.icon}</span>
          ) : hasNodeIcon(iconKey) ? (
            <NodeIcon name={iconKey} size={22} />
          ) : (
            <span style={{ fontSize: 20, lineHeight: 1 }}>{isAPI ? '⚡' : '⚙️'}</span>
          )}
        </div>
        <div className="font-semibold text-[14px]" style={{ color: TITLE_COLOR, fontFamily: TITLE_FONT }}>
          {nodeData.label}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5">
        {nodeData.type && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ ...badgeStyle(accent), fontFamily: MONO_FONT }}
          >
            {nodeData.type}
          </span>
        )}
        {nodeData.tech && (
          <span className="text-[11px]" style={{ color: MUTED_COLOR, fontFamily: MONO_FONT }}>
            {nodeData.tech}
          </span>
        )}
      </div>

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

ServiceNode.displayName = 'ServiceNode';
