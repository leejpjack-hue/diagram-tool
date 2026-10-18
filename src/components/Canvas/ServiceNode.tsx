import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ServiceNodeData } from './types';
import { NodeIcon } from './icons';
import { hasNodeIcon } from './icons/registry';
import { cardStyle, chipStyle, badgeStyle, isCode, TITLE_COLOR, MUTED_COLOR, TITLE_FONT, MONO_FONT } from './cardStyle';
import { ArchitectureHandles, type ArchitectureHandleSlots } from './ArchitectureHandles';
import { useDiagramStore } from '../../store/diagramStore';
import { ArchitectureStyleCard } from './ArchitectureStyleCard';
import type { IconStyleId } from './iconStyles';

function partMark(icon?: string): 'AI' | 'tool' | 'user' | undefined {
  if (icon === 'AI') return 'AI';
  if (icon === '🔧') return 'tool';
  if (icon === '👤') return 'user';
  return undefined;
}

function connectionSlots(data: unknown): ArchitectureHandleSlots | undefined {
  return (data as { connectionHandles?: ArchitectureHandleSlots }).connectionHandles;
}

export const ServiceNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanServiceNode {...props} />;
  return <StyledServiceNode {...props} iconStyle={iconStyle} />;
});

ServiceNode.displayName = 'ServiceNode';

const CleanServiceNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ServiceNodeData;
  const isAPI = nodeData.type === 'api';
  const iconKey = isAPI ? 'api' : 'service';
  const mark = partMark(nodeData.icon);

  // Presentation-style accent: a `color:` in the DSL overrides the default
  // api/service palette; `icon:` swaps the SVG glyph for an emoji.
  const accent = nodeData.color || (isAPI ? '#3b82f6' : '#8b5cf6');
  const connectionHandles = connectionSlots(data);

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[180px]
      `}
      data-arch-kind="service"
      data-arch-style="clean"
      data-arch-treatment="chip"
      data-part-mark={mark}
      style={cardStyle(accent, !!selected)}
    >
      <ArchitectureHandles accent={accent} slots={connectionHandles} />

      <div className="flex items-center gap-3 mb-1">
        <div
          className={`w-9 h-9 flex items-center justify-center font-bold shrink-0 ${mark === 'user' ? 'rounded-full' : 'rounded-[9px]'}`}
          style={chipStyle(accent)}
        >
          {nodeData.icon ? (
            isCode(nodeData.icon) ? (
              <span style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: nodeData.icon.length > 2 ? 10 : 13, lineHeight: 1 }}>{nodeData.icon}</span>
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1 }}>{nodeData.icon}</span>
            )
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
        {mark && !nodeData.type && (
          <span
            data-testid="service-part-badge"
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ ...badgeStyle(accent), fontFamily: MONO_FONT }}
          >
            {mark}
          </span>
        )}
        {nodeData.tech && (
          <span className="text-[11px]" style={{ color: MUTED_COLOR, fontFamily: MONO_FONT }}>
            {nodeData.tech}
          </span>
        )}
      </div>
    </div>
  );
});

CleanServiceNode.displayName = 'CleanServiceNode';

const StyledServiceNode = memo(({ data, selected, iconStyle }: NodeProps & { iconStyle: Exclude<IconStyleId, 'clean'> }) => {
  const nodeData = data as unknown as ServiceNodeData;
  const mark = partMark(nodeData.icon);
  const meta = [nodeData.type, mark && !nodeData.type ? mark : undefined, nodeData.tech].filter(Boolean).join(' · ');
  return (
    <ArchitectureStyleCard
      iconStyle={iconStyle}
      kind="service"
      color={nodeData.color}
      selected={selected}
      label={nodeData.label}
      meta={meta || undefined}
      mark={mark}
      slots={connectionSlots(data)}
    />
  );
});

StyledServiceNode.displayName = 'StyledServiceNode';
