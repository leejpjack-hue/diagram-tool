import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { DatabaseNodeData } from './types';
import { TITLE_FONT, MONO_FONT, accentDark } from './cardStyle';
import { ArchitectureHandles, type ArchitectureHandleSlots } from './ArchitectureHandles';
import { useDiagramStore } from '../../store/diagramStore';
import { ArchitectureStyleCard } from './ArchitectureStyleCard';
import type { IconStyleId } from './iconStyles';

const DEFAULT_ACCENT = '#a855f7';

function connectionSlots(data: unknown): ArchitectureHandleSlots | undefined {
  return (data as { connectionHandles?: ArchitectureHandleSlots }).connectionHandles;
}

// Database node rendered as a 3-D cylinder (Diagram Kit reference): a tinted
// body with a darker top ellipse and a rounded bottom, the accent colour
// driving border + label. Title centred with a mono type sublabel.
export const DatabaseNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanDatabaseNode {...props} />;
  return <StyledDatabaseNode {...props} iconStyle={iconStyle} />;
});

DatabaseNode.displayName = 'DatabaseNode';

const CleanDatabaseNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DatabaseNodeData;
  const accent = nodeData.color || DEFAULT_ACCENT;
  const connectionHandles = connectionSlots(data);

  const W = 150;
  const H = 86;
  const CAP = 26; // ellipse height
  const body = `color-mix(in srgb, ${accent} 12%, white)`;
  const topCap = `color-mix(in srgb, ${accent} 24%, white)`;
  const border = `1.5px solid ${selected ? accent : `color-mix(in srgb, ${accent} 55%, white)`}`;

  return (
    <div
      className={`relative transition-all duration-200 ${selected ? 'scale-105' : 'hover:scale-102'}`}
      data-arch-kind="database"
      data-arch-style="clean"
      data-arch-treatment="chip"
      style={{
        width: W,
        height: H,
        filter: selected
          ? `drop-shadow(0 0 0 3px color-mix(in srgb, ${accent} 20%, transparent))`
          : 'drop-shadow(0 1px 2px rgba(17,24,39,0.05)) drop-shadow(0 8px 18px rgba(17,24,39,0.06))',
      }}
    >
      <ArchitectureHandles accent={accent} slots={connectionHandles} />

      {/* body + side borders */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: CAP / 2, bottom: 0, background: body, borderLeft: border, borderRight: border }} />
      {/* bottom rounded cap */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: CAP, background: body, border, borderRadius: '50%' }} />
      {/* top ellipse */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: CAP, background: topCap, border, borderRadius: '50%' }} />

      {/* labels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 9, lineHeight: 1 }}>
        <div className="font-semibold text-[13px]" style={{ color: accentDark(accent), fontFamily: TITLE_FONT }}>
          {nodeData.label}
        </div>
        {nodeData.type && (
          <div className="text-[9.5px] mt-1" style={{ color: `color-mix(in srgb, ${accent} 55%, #475569)`, fontFamily: MONO_FONT }}>
            {nodeData.type}
          </div>
        )}
      </div>
    </div>
  );
});

CleanDatabaseNode.displayName = 'CleanDatabaseNode';

const StyledDatabaseNode = memo(({ data, selected, iconStyle }: NodeProps & { iconStyle: Exclude<IconStyleId, 'clean'> }) => {
  const nodeData = data as unknown as DatabaseNodeData;
  return (
    <ArchitectureStyleCard
      iconStyle={iconStyle}
      kind="database"
      color={nodeData.color}
      selected={selected}
      label={nodeData.label}
      meta={nodeData.type}
      minWidth={150}
      slots={connectionSlots(data)}
    />
  );
});

StyledDatabaseNode.displayName = 'StyledDatabaseNode';
