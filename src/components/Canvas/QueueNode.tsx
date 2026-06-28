import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { QueueNodeData } from './types';
import { NodeIcon, hasNodeIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';
import { cardStyle, chipStyle, badgeStyle, TITLE_COLOR, MUTED_COLOR, TITLE_FONT, MONO_FONT } from './cardStyle';

const DEFAULT_ACCENT = '#10b981';

export const QueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QueueNodeData;
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
          className="w-9 h-9 rounded-[9px] flex items-center justify-center font-bold shrink-0"
          style={chipStyle(accent)}
        >
          {hasNodeIcon('queue') ? (
            <NodeIcon name="queue" size={22} />
          ) : (
            <span style={{ fontSize: 20, lineHeight: 1 }}>📨</span>
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
        {nodeData.topic && (
          <span className="text-[11px]" style={{ color: MUTED_COLOR, fontFamily: MONO_FONT }}>
            {nodeData.topic}
          </span>
        )}
      </div>

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
