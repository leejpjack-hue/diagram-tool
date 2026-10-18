import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { QueueNodeData } from './types';
import { NodeIcon } from './icons';
import { hasNodeIcon } from './icons/registry';
import { cardStyle, chipStyle, badgeStyle, isCode, TITLE_COLOR, MUTED_COLOR, TITLE_FONT, MONO_FONT } from './cardStyle';
import { ArchitectureHandles, type ArchitectureHandleSlots } from './ArchitectureHandles';
import { useDiagramStore } from '../../store/diagramStore';
import { ArchitectureStyleCard } from './ArchitectureStyleCard';
import type { IconStyleId } from './iconStyles';

const DEFAULT_ACCENT = '#10b981';

function connectionSlots(data: unknown): ArchitectureHandleSlots | undefined {
  return (data as { connectionHandles?: ArchitectureHandleSlots }).connectionHandles;
}

export const QueueNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanQueueNode {...props} />;
  return <StyledQueueNode {...props} iconStyle={iconStyle} />;
});

QueueNode.displayName = 'QueueNode';

const CleanQueueNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as QueueNodeData;
  const accent = nodeData.color || DEFAULT_ACCENT;
  const connectionHandles = connectionSlots(data);

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[160px]
      `}
      data-arch-kind="queue"
      data-arch-style="clean"
      data-arch-treatment="chip"
      style={cardStyle(accent, !!selected)}
    >
      <ArchitectureHandles accent={accent} slots={connectionHandles} />

      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-[9px] flex items-center justify-center font-bold shrink-0"
          style={chipStyle(accent)}
        >
          {nodeData.icon ? (
            isCode(nodeData.icon) ? (
              <span style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: nodeData.icon.length > 2 ? 10 : 13, lineHeight: 1 }}>{nodeData.icon}</span>
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1 }}>{nodeData.icon}</span>
            )
          ) : hasNodeIcon('queue') ? (
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
    </div>
  );
});

CleanQueueNode.displayName = 'CleanQueueNode';

const StyledQueueNode = memo(({ data, selected, iconStyle }: NodeProps & { iconStyle: Exclude<IconStyleId, 'clean'> }) => {
  const nodeData = data as unknown as QueueNodeData;
  const meta = [nodeData.type, nodeData.topic].filter(Boolean).join(' · ');
  return (
    <ArchitectureStyleCard
      iconStyle={iconStyle}
      kind="queue"
      color={nodeData.color}
      selected={selected}
      label={nodeData.label}
      meta={meta || undefined}
      minWidth={160}
      slots={connectionSlots(data)}
    />
  );
});

StyledQueueNode.displayName = 'StyledQueueNode';
