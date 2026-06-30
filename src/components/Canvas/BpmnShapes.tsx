import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';

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

function GatewayShell({ glyph, selected, label, reversed }: { glyph: string; selected?: boolean; label?: string; reversed?: boolean }) {
  const s = GATE.size;
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
        filter: selected ? 'drop-shadow(0 0 0 3px rgba(245,158,11,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
      }}
    >
      <svg width={s} height={s} style={{ display: 'block' }}>
        <polygon
          points={`${s / 2},2 ${s - 2},${s / 2} ${s / 2},${s - 2} 2,${s / 2}`}
          fill={GATE.fill}
          stroke={GATE.stroke}
          strokeWidth={2}
        />
        <text
          x={s / 2}
          y={s / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={28}
          fontWeight={700}
          fill={GATE.text}
        >
          {glyph}
        </text>
      </svg>
      {label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold"
          style={{ top: s + 4, color: GATE.text }}
        >
          {label}
        </div>
      )}
      <Handle
        type="target"
        position={target}
        style={{ background: GATE.stroke, ...(isLR ? { top: s / 2 } : { left: s / 2 }) }}
      />
      <Handle
        type="source"
        position={source}
        style={{ background: GATE.stroke, ...(isLR ? { top: s / 2 } : { left: s / 2 }) }}
      />
      {/* Branch handles on the two perpendicular sides */}
      {isLR ? (
        <>
          <Handle type="source" position={Position.Top} id="top" style={{ background: GATE.stroke, left: s / 2 }} />
          <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: GATE.stroke, left: s / 2 }} />
        </>
      ) : (
        <>
          <Handle type="source" position={Position.Right} id="right" style={{ background: GATE.stroke, top: s / 2 }} />
          <Handle type="source" position={Position.Left} id="left" style={{ background: GATE.stroke, top: s / 2 }} />
        </>
      )}
    </div>
  );
}

export const GatewayExclusiveNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="✕" selected={selected} label={d.label} reversed={!!d.reversed} />;
});
GatewayExclusiveNode.displayName = 'GatewayExclusiveNode';

export const GatewayParallelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="+" selected={selected} label={d.label} reversed={!!d.reversed} />;
});
GatewayParallelNode.displayName = 'GatewayParallelNode';

export const GatewayInclusiveNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <GatewayShell glyph="○" selected={selected} label={d.label} reversed={!!d.reversed} />;
});
GatewayInclusiveNode.displayName = 'GatewayInclusiveNode';

function EventShell({
  glyph, selected, label, ringWidth = 2, reversed = false,
}: { glyph: string; selected?: boolean; label?: string; ringWidth?: number; reversed?: boolean }) {
  const s = EVT.size;
  const { target, source, centerStyle } = useLayoutHandles(reversed);
  return (
    <div
      className="relative transition-all duration-200"
      style={{
        width: s,
        height: s,
        transform: selected ? 'scale(1.08)' : undefined,
        filter: selected ? 'drop-shadow(0 0 0 3px rgba(16,185,129,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
      }}
    >
      <svg width={s} height={s} style={{ display: 'block' }}>
        <circle cx={s / 2} cy={s / 2} r={s / 2 - ringWidth - 1} fill={EVT.fill} stroke={EVT.stroke} strokeWidth={ringWidth} />
        <text
          x={s / 2}
          y={s / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={20}
          fill={EVT.text}
        >
          {glyph}
        </text>
      </svg>
      {label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold"
          style={{ top: s + 4, color: EVT.text }}
        >
          {label}
        </div>
      )}
      <Handle type="target" position={target} style={{ background: EVT.stroke, ...centerStyle(s, s) }} />
      <Handle type="source" position={source} style={{ background: EVT.stroke, ...centerStyle(s, s) }} />
    </div>
  );
}

export const EventStartNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} />;
});
EventStartNode.displayName = 'EventStartNode';

export const EventEndNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="" selected={selected} label={d.label} ringWidth={5} reversed={!!d.reversed} />;
});
EventEndNode.displayName = 'EventEndNode';

export const EventTimerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="⏱" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} />;
});
EventTimerNode.displayName = 'EventTimerNode';

export const EventMessageNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <EventShell glyph="✉" selected={selected} label={d.label} ringWidth={2} reversed={!!d.reversed} />;
});
EventMessageNode.displayName = 'EventMessageNode';

/**
 * BPMN Subprocess: rectangle with rounded corners and a small marker badge
 * on the bottom edge. A "+" badge means collapsed (drillable into details);
 * "−" means expanded. The shape itself otherwise behaves like a process box.
 */
const SUB = { w: 180, h: 80, stroke: '#3B82F6', fill: '#EFF6FF', text: '#1E40AF' };

function SubprocessShell({ glyph, selected, label, system, reversed = false }: { glyph: '+' | '−'; selected?: boolean; label?: string; system?: string; reversed?: boolean }) {
  const { target, source, direction } = useLayoutHandles(reversed);
  // Source handle hangs slightly below the box edge in TB so the marker badge
  // doesn't visually swallow it; in LR we let it sit flush on the right edge.
  const sourceStyle = direction === 'LR'
    ? { background: SUB.stroke }
    : { background: SUB.stroke, bottom: -16 };
  return (
    <div
      className="relative transition-all duration-200"
      style={{
        width: SUB.w,
        height: SUB.h,
        transform: selected ? 'scale(1.04)' : undefined,
        filter: selected ? 'drop-shadow(0 0 0 3px rgba(59,130,246,0.3))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
      }}
    >
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
        style={{
          background: SUB.fill,
          border: `2px solid ${SUB.stroke}`,
          borderRadius: 12,
          color: SUB.text,
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
          background: 'white',
          border: `1.5px solid ${SUB.stroke}`,
          borderRadius: 3,
          color: SUB.stroke,
          transform: 'translate(-50%, 50%)',
          lineHeight: 1,
        }}
      >
        {glyph}
      </div>
      <Handle type="target" position={target} style={{ background: SUB.stroke }} />
      <Handle type="source" position={source} style={sourceStyle} />
    </div>
  );
}

export const SubprocessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <SubprocessShell glyph="+" selected={selected} label={d.label} system={d.system} reversed={!!d.reversed} />;
});
SubprocessNode.displayName = 'SubprocessNode';

export const SubprocessExpandedNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as FlowNodeData;
  return <SubprocessShell glyph="−" selected={selected} label={d.label} system={d.system} reversed={!!d.reversed} />;
});
SubprocessExpandedNode.displayName = 'SubprocessExpandedNode';
