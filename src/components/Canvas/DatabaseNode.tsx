import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { DatabaseNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';
import { cardStyle, chipStyle, badgeStyle, TITLE_COLOR, MUTED_COLOR } from './cardStyle';

const DEFAULT_ACCENT = '#ec4899';

export const DatabaseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DatabaseNodeData;
  const { target, source } = useLayoutHandles();
  const accent = nodeData.color || DEFAULT_ACCENT;

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[160px]
      `}
      style={cardStyle(accent, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: accent }} />

      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold shrink-0"
          style={chipStyle(accent)}
        >
          {hasNodeIcon('database') ? (
            <NodeIcon name="database" size={24} />
          ) : (
            <span style={{ fontSize: 22, lineHeight: 1 }}>🗄️</span>
          )}
        </div>
        <div className="font-semibold text-[15px]" style={{ color: TITLE_COLOR }}>
          {nodeData.label}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5">
        {nodeData.type && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={badgeStyle(accent)}
          >
            {nodeData.type}
          </span>
        )}
        {nodeData.data && Array.isArray(nodeData.data) && (
          <span className="text-[11px]" style={{ color: MUTED_COLOR }}>
            {nodeData.data.slice(0, 2).join(', ')}
            {nodeData.data.length > 2 && ` +${nodeData.data.length - 2}`}
          </span>
        )}
      </div>

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
