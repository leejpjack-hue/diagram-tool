import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';

/**
 * Standard flowchart shapes beyond process/decision/start/end.
 *
 * - Data (parallelogram) — represents input/output data
 * - Document (rectangle with wavy bottom) — report/document artifact
 * - Manual Input (trapezoid) — keyboard/manual input step
 * - Terminator (rounded pill) — generic terminator (neutral color)
 *
 * All share the same palette as ProcessNode (blue) for visual consistency
 * with the rest of the flowchart.
 */

const SIZE = { w: 160, h: 60 };
const STROKE = '#3b82f6';
const FILL = 'color-mix(in srgb, #3b82f6 7%, white)';
const TEXT = '#0f172a';

type ShapeProps = NodeProps;

function Wrapper({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        width: SIZE.w,
        height: SIZE.h,
        filter: selected
          ? 'drop-shadow(0 0 6px rgba(59,130,246,0.35))'
          : 'drop-shadow(0 1px 2px rgba(15,23,42,0.06)) drop-shadow(0 4px 10px rgba(15,23,42,0.08))',
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
      <div className="font-semibold text-sm leading-tight">{data.label}</div>
      {data.system && <div className="text-[10px] font-mono mt-0.5" style={{ color: '#64748b' }}>{data.system}</div>}
    </div>
  );
}

export const DataNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const { target, source, centerStyle } = useLayoutHandles();
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: SIZE.w, height: SIZE.h }}>
        <svg width={SIZE.w} height={SIZE.h} style={{ display: 'block' }}>
          <polygon
            points={`20,2 ${SIZE.w - 2},2 ${SIZE.w - 20},${SIZE.h - 2} 2,${SIZE.h - 2}`}
            fill={FILL}
            stroke={STROKE}
            strokeWidth={1.5}
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
  const { target, source, centerStyle, direction } = useLayoutHandles();
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
          <path d={path} fill={FILL} stroke={STROKE} strokeWidth={1.5} strokeLinejoin="round" />
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
  const { target, source, centerStyle } = useLayoutHandles();
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: w, height: h }}>
        <svg width={w} height={h} style={{ display: 'block' }}>
          <polygon
            points={`2,20 ${w - 2},2 ${w - 2},${h - 2} 2,${h - 2}`}
            fill={FILL}
            stroke={STROKE}
            strokeWidth={1.5}
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
  const { target, source } = useLayoutHandles();
  return (
    <div
      className={`px-5 py-2 rounded-full transition-all duration-200 ${
        selected ? 'scale-110' : 'hover:scale-105'
      }`}
      style={{
        background: 'color-mix(in srgb, #64748b 7%, white)',
        border: '1.5px solid #94a3b8',
        boxShadow: selected
          ? '0 0 0 3px rgba(100,116,139,0.2), 0 8px 20px rgba(15,23,42,0.12)'
          : '0 1px 2px rgba(15,23,42,0.06), 0 4px 10px rgba(15,23,42,0.08)',
      }}
    >
      <Handle type="target" position={target} style={{ background: '#64748b' }} />
      <div className="font-semibold text-sm" style={{ color: '#0f172a' }}>{d.label}</div>
      <Handle type="source" position={source} style={{ background: '#64748b' }} />
    </div>
  );
});
TerminatorNode.displayName = 'TerminatorNode';
