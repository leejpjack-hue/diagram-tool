import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { useDiagramStore } from '../../store/diagramStore';
import { ICON_STYLES, resolveFace } from './iconStyles';
import { FlowGlyph } from './FlowGlyph';

/**
 * BPMN-style symbols:
 *  - Gateways: diamond with inner glyph
 *      • exclusive (X)   — XOR / decision
 *      • parallel  (+)   — AND / fork-join
 *      • inclusive (O)   — OR
 *  - Events: circle with inner glyph
 *      • start    (thin)  – plain
 *      • end      (thick) – plain
 *      • timer    (clock)
 *      • message  (envelope)
 */

const GATE = { size: 80, stroke: '#F59E0B', fill: '#FEF3C7', text: '#92400E' };
const EVT = { size: 64, stroke: '#10B981', fill: '#D1FAE5', text: '#065F46' };

function useFlowPaint(
  data: FlowNodeData | undefined,
  fallback: { stroke: string; fill: string; text: string },
  shape: 'card' | 'pill' | 'diamond' = 'diamond',
) {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (!data || iconStyle === 'clean') return { ...fallback, iconStyle, face: null as ReturnType<typeof resolveFace> | null };
  const face = resolveFace(iconStyle, data, shape);
  return {
    stroke: face.borderWidth ? face.borderColor : face.color,
    fill: face.fill,
    text: face.labelColor,
    iconStyle,
    face,
  };
}

function GatewayShell({ glyph, selected, label, reversed, data }: { glyph: string; selected?: boolean; label?: string; reversed?: boolean; data?: FlowNodeData }) {
  const s = GATE.size;
  const paint = useFlowPaint(data ? { ...data, nodeType: data.nodeType ?? 'gatewayexclusive' } : undefined, GATE);
  const { target, source, direction } = useLayoutHandles(reversed);
  // Auxiliary branch handles — the two perpendicular sides keep Y/N branches
  // accessible by id ('left'/'right' in TB, 'top'/'bottom' in LR).
  const isLR = direction === 'LR';
  return (
    <div
      className="relative transition-all duration-200"
      style={{
        width: s,
        height: s,
        transform: selected ? 'scale(1.08)' : undefined,
        filter: paint.iconStyle === 'clean'
          ? (selected ? 'drop-shadow(0 0 0 3px rgba(245,158,11,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))')
          : undefined,
        outline: paint.iconStyle !== 'clean' && selected
          ? `${ICON_STYLES[paint.iconStyle].selection.width}px solid ${ICON_STYLES[paint.iconStyle].selection.color}`
          : undefined,
        outlineOffset: paint.iconStyle !== 'clean' && selected ? ICON_STYLES[paint.iconStyle].selection.offset : undefined,
      }}
    >
      <svg width={s} height={s} style={{ display: 'block' }}>
        <polygon
          points={`${s / 2},2 ${s - 2},${s / 2} ${s / 2},${s - 2} 2,${s / 2}`}
          fill={paint.fill}
          stroke={paint.stroke}
          strokeWidth={paint.iconStyle === 'clean' ? 2 : (ICON_STYLES[paint.iconStyle].shape.borderWidth || 1.5)}
        />
        <text
          x={s / 2}
          y={s / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={28}
          fontWeight={700}
          fill={paint.iconStyle === 'bold' ? '#ffffff' : paint.text}
        >
          {glyph}
        </text>
      </svg>
      {label && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold ${paint.face?.showIcon ? 'inline-flex items-center gap-1' : ''}`}
          style={{ top: s + 4, color: paint.text, fontFamily: paint.face?.fontFamily }}
        >
          {paint.face?.showIcon && <FlowGlyph face={{ ...paint.face, iconSize: 14 }} />}
          {label}
        </div>
      )}
      <Handle
        type="target"
        position={target}
        style={{ background: paint.stroke, ...(isLR ? { top: s / 2 } : { left: s / 2 }) }}
      />
      <Handle
        type="source"
        position={source}
        style={{ background: paint.stroke, ...(isLR ? { top: s / 2 } : { left: s / 2 }) }}
      />
      {/* Branch handles on the two perpendicular sides */}
      {isLR ? (
        <>
          <Handle type="source" position={Position.Top} id="top" style={{ background: paint.stroke, left: s / 2 }} />
          <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: paint.stroke, left: s / 2 }} />
        </>
      ) : (
        <>
          <Handle type="source" position={Position.Right} id="right" style={{ background: paint.stroke, top: s / 2 }} />
          <Handle type="source" position={Position.Left} id="left" style={{ background: paint.stroke, top: s / 2 }} />
        </>
      )}
    </div>
  );
}

export const GatewayExclusiveNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="✕" selected={selected} label={d.label} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'gatewayexclusive' }} />;
});
GatewayExclusiveNode.displayName = 'GatewayExclusiveNode';

export const GatewayParallelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="+" selected={selected} label={d.label} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'gatewayparallel' }} />;
});
GatewayParallelNode.displayName = 'GatewayParallelNode';

export const GatewayInclusiveNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="○" selected={selected} label={d.label} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'gatewayinclusive' }} />;
});
GatewayInclusiveNode.displayName = 'GatewayInclusiveNode';

function EventShell({
  glyph, selected, label, ringWidth = 2, reversed = false, data,
}: { glyph: string; selected?: boolean; label?: string; ringWidth?: number; reversed?: boolean; data?: FlowNodeData }) {
  const s = EVT.size;
  const paint = useFlowPaint(data, EVT, 'pill');
  const { target, source, centerStyle } = useLayoutHandles(reversed);
  const strokeWidth = paint.iconStyle === 'clean' ? ringWidth : (data?.isEnd || data?.nodeType === 'eventend' ? 3.5 : ICON_STYLES[paint.iconStyle].shape.borderWidth || 1.5);
  return (
    <div
      className="relative transition-all duration-200"
      style={{
        width: s,
        height: s,
        transform: paint.iconStyle === 'clean' && selected ? 'scale(1.08)' : undefined,
        filter: paint.iconStyle === 'clean'
          ? (selected ? 'drop-shadow(0 0 0 3px rgba(16,185,129,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))')
          : undefined,
        outline: paint.iconStyle !== 'clean' && selected
          ? `${ICON_STYLES[paint.iconStyle].selection.width}px solid ${ICON_STYLES[paint.iconStyle].selection.color}`
          : undefined,
        outlineOffset: paint.iconStyle !== 'clean' && selected ? ICON_STYLES[paint.iconStyle].selection.offset : undefined,
      }}
    >
      <svg width={s} height={s} style={{ display: 'block' }}>
        <circle cx={s / 2} cy={s / 2} r={s / 2 - strokeWidth - 1} fill={paint.fill} stroke={paint.stroke} strokeWidth={strokeWidth} />
        {paint.iconStyle === 'blueprint' && (
          <circle cx={s / 2} cy={s / 2} r={s / 2 - strokeWidth - 5} fill="none" stroke={paint.stroke} strokeWidth={1.5} />
        )}
        <text
          x={s / 2}
          y={s / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={20}
          fill={paint.iconStyle === 'bold' ? '#ffffff' : paint.text}
        >
          {glyph}
        </text>
      </svg>
      {label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold"
          style={{ top: s + 4, color: paint.text, fontFamily: paint.face?.fontFamily }}
        >
          {label}
        </div>
      )}
      <Handle type="target" position={target} style={{ background: paint.stroke, ...centerStyle(s, s) }} />
      <Handle type="source" position={source} style={{ background: paint.stroke, ...centerStyle(s, s) }} />
    </div>
  );
}

export const EventStartNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'eventstart', isStart: true }} />;
});
EventStartNode.displayName = 'EventStartNode';

export const EventEndNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="" selected={selected} label={d.label} ringWidth={5} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'eventend', isEnd: true }} />;
});
EventEndNode.displayName = 'EventEndNode';

export const EventTimerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="⏱" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'eventtimer' }} />;
});
EventTimerNode.displayName = 'EventTimerNode';

export const EventMessageNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="✉" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} data={{ ...d, nodeType: d.nodeType ?? 'eventmessage' }} />;
});
EventMessageNode.displayName = 'EventMessageNode';

/**
 * BPMN Subprocess: rectangle with rounded corners and a small marker badge
 * on the bottom edge. A "+" badge means collapsed (drillable into details);
 * "−" means expanded. The shape itself otherwise behaves like a process box.
 */
const SUB = { w: 180, h: 80, stroke: '#3B82F6', fill: '#EFF6FF', text: '#1E40AF' };

function SubprocessShell({ glyph, selected, label, system, reversed = false, data }: { glyph: '+' | '−'; selected?: boolean; label?: string; system?: string; reversed?: boolean; data?: FlowNodeData }) {
  const paint = useFlowPaint(data, SUB, 'card');
  const { target, source, direction } = useLayoutHandles(reversed);
  const borderW = paint.iconStyle === 'clean' ? 2 : (ICON_STYLES[paint.iconStyle].shape.borderWidth || 1.5);
  const radius = paint.iconStyle === 'clean' ? 12 : ICON_STYLES[paint.iconStyle].shape.radius;
  // Source handle hangs slightly below the box edge in TB so the marker badge
  // doesn't visually swallow it; in LR we let it sit flush on the right edge.
  const sourceStyle = direction === 'LR'
    ? { background: paint.stroke }
    : { background: paint.stroke, bottom: -16 };
  return (
    <div
      className="relative transition-all duration-200"
      style={{
        width: SUB.w,
        height: SUB.h,
        transform: paint.iconStyle === 'clean' && selected ? 'scale(1.04)' : undefined,
        filter: paint.iconStyle === 'clean'
          ? (selected ? 'drop-shadow(0 0 0 3px rgba(59,130,246,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))')
          : undefined,
        outline: paint.iconStyle !== 'clean' && selected
          ? `${ICON_STYLES[paint.iconStyle].selection.width}px solid ${ICON_STYLES[paint.iconStyle].selection.color}`
          : undefined,
        outlineOffset: paint.iconStyle !== 'clean' && selected ? ICON_STYLES[paint.iconStyle].selection.offset : undefined,
      }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
        style={{
          background: paint.fill,
          border: borderW ? `${borderW}px solid ${paint.stroke}` : 'none',
          borderRadius: radius,
          color: paint.text,
          fontFamily: paint.face?.fontFamily,
        }}
      >
        <div className="font-semibold text-sm leading-tight">{label}</div>
        {system && <div className="text-[10px] font-mono mt-0.5 opacity-80">{system}</div>}
      </div>
      {/* Marker badge on bottom edge */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center font-bold"
        style={{
          bottom: -1,
          width: 18,
          height: 18,
          fontSize: 14,
          background: paint.iconStyle === 'bold' ? paint.fill : 'white',
          border: `1.5px solid ${paint.stroke}`,
          borderRadius: 3,
          color: paint.iconStyle === 'bold' ? '#ffffff' : paint.stroke,
          transform: 'translate(-50%, 50%)',
          lineHeight: 1,
        }}
      >
        {glyph}
      </div>
      <Handle type="target" position={target} style={{ background: paint.stroke }} />
      <Handle type="source" position={source} style={sourceStyle} />
    </div>
  );
}

export const SubprocessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <SubprocessShell glyph="+" selected={selected} label={d.label} system={d.system} reversed={!!d.reversed} data={d} />;
});
SubprocessNode.displayName = 'SubprocessNode';

export const SubprocessExpandedNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <SubprocessShell glyph="−" selected={selected} label={d.label} system={d.system} reversed={!!d.reversed} data={d} />;
});
SubprocessExpandedNode.displayName = 'SubprocessExpandedNode';
