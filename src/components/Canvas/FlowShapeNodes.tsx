import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { FLOW_COLORS, TITLE_FONT, MONO_FONT } from './flowShapeStyle';

/**
 * Standard flowchart shapes beyond process/decision/start/end.
 *
 * - Data (parallelogram) — represents input/output data
 * - Document (rectangle with wavy bottom) — report/document artifact
 * - Manual Input (trapezoid) — keyboard/manual input step
 * - Terminator (rounded pill) — generic terminator (neutral color)
 *
 * White card with a soft colour border + saturated label, matching the
 * process node (blue) so the flowchart reads consistently.
 */

const SIZE = { w: 160, h: 60 };
const STROKE = FLOW_COLORS.blue.border;
const FILL = '#ffffff';
const TEXT = FLOW_COLORS.blue.text;

type ShapeProps = NodeProps;

function Wrapper({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        width: SIZE.w,
        height: SIZE.h,
        filter: selected
          ? 'drop-shadow(0 0 5px rgba(59,130,246,0.4))'
          : 'drop-shadow(0 1px 1px rgba(15,23,42,0.06))',
        transform: selected ? 'scale(1.05)' : undefined,
      }}
    >
      {children}
    </div>
  );
}

function LabelLayer({ data }: { data: FlowNodeData }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none"
      style={{ color: TEXT }}
    >
      <div className="font-semibold text-[13px] leading-tight" style={{ fontFamily: TITLE_FONT }}>{data.label}</div>
      {data.system && <div className="text-[10px] mt-0.5" style={{ color: '#64748b', fontFamily: MONO_FONT }}>{data.system}</div>}
    </div>
  );
}

export const DataNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const { target, source, centerStyle } = useLayoutHandles(!!d.reversed);
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: SIZE.w, height: SIZE.h }}>
        <svg width={SIZE.w} height={SIZE.h} style={{ display: 'block' }}>
          <polygon
            points={`20,2 ${SIZE.w - 2},2 ${SIZE.w - 20},${SIZE.h - 2} 2,${SIZE.h - 2}`}
            fill={FILL}
            stroke={STROKE}
            strokeWidth={2}
          />
        </svg>
        <LabelLayer data={d} />
        <Handle type="target" position={target} style={{ background: STROKE, ...centerStyle(SIZE.w, SIZE.h) }} />
        <Handle type="source" position={source} style={{ background: STROKE, ...centerStyle(SIZE.w, SIZE.h) }} />
      </div>
    </Wrapper>
  );
});
DataNode.displayName = 'DataNode';

export const DocumentNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const w = SIZE.w, h = SIZE.h;
  const path = `M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 12} Q ${(w * 0.75)} ${h + 2} ${w / 2} ${h - 10} Q ${w * 0.25} ${h - 18} 2 ${h - 10} Z`;
  const { target, source, centerStyle, direction } = useLayoutHandles(!!d.reversed);
  // The wavy bottom drops a few px below baseline; in TB we pin the source
  // handle slightly higher so it sits on the wave's apex. In LR the source
  // is on the right edge and that adjustment doesn't apply.
  const sourceStyle = direction === 'LR'
    ? { background: STROKE, ...centerStyle(w, h) }
    : { background: STROKE, left: w / 2, top: h - 4 };
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: w, height: h }}>
        <svg width={w} height={h + 6} style={{ display: 'block' }}>
          <path d={path} fill={FILL} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
        </svg>
        <LabelLayer data={d} />
        <Handle type="target" position={target} style={{ background: STROKE, ...centerStyle(w, h) }} />
        <Handle type="source" position={source} style={sourceStyle} />
      </div>
    </Wrapper>
  );
});
DocumentNode.displayName = 'DocumentNode';

export const ManualInputNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const w = SIZE.w, h = SIZE.h;
  const { target, source, centerStyle } = useLayoutHandles(!!d.reversed);
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: w, height: h }}>
        <svg width={w} height={h} style={{ display: 'block' }}>
          <polygon
            points={`2,20 ${w - 2},2 ${w - 2},${h - 2} 2,${h - 2}`}
            fill={FILL}
            stroke={STROKE}
            strokeWidth={2}
          />
        </svg>
        <LabelLayer data={d} />
        <Handle type="target" position={target} style={{ background: STROKE, ...centerStyle(w, h) }} />
        <Handle type="source" position={source} style={{ background: STROKE, ...centerStyle(w, h) }} />
      </div>
    </Wrapper>
  );
});
ManualInputNode.displayName = 'ManualInputNode';

export const TerminatorNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles(!!d.reversed);
  return (
    <div
      className={`px-6 py-2.5 rounded-full transition-all duration-200 ${
        selected ? 'scale-105' : 'hover:scale-105'
      }`}
      style={{
        background: FLOW_COLORS.slate.tint,
        border: `1.5px solid ${selected ? FLOW_COLORS.slate.text : FLOW_COLORS.slate.border}`,
        boxShadow: selected
          ? `0 0 0 3px color-mix(in srgb, ${FLOW_COLORS.slate.text} 18%, transparent), 0 8px 18px -12px rgba(17,24,39,0.25)`
          : '0 1px 2px rgba(17,24,39,0.05), 0 8px 18px -12px rgba(17,24,39,0.25)',
      }}
    >
      <Handle type="target" position={target} style={{ background: FLOW_COLORS.slate.border }} />
      <div className="font-semibold text-[13px]" style={{ color: FLOW_COLORS.slate.text, fontFamily: TITLE_FONT }}>{d.label}</div>
      <Handle type="source" position={source} style={{ background: FLOW_COLORS.slate.border }} />
    </div>
  );
});
TerminatorNode.displayName = 'TerminatorNode';
