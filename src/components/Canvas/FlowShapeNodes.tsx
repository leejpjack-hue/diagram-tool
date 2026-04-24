import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';

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
const STROKE = '#3B82F6';
const FILL = '#DBEAFE';
const TEXT = '#1E40AF';

type ShapeProps = NodeProps;

function Wrapper({ children, selected }: { children: React.ReactNode; selected?: boolean }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        width: SIZE.w,
        height: SIZE.h,
        filter: selected ? 'drop-shadow(0 0 0 3px rgba(59,130,246,0.25))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))',
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
      {data.system && <div className="text-[10px] font-mono mt-0.5 opacity-80">{data.system}</div>}
    </div>
  );
}

export const DataNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
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
        <Handle type="target" position={Position.Top} style={{ background: STROKE, left: SIZE.w / 2 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: STROKE, left: SIZE.w / 2 }} />
      </div>
    </Wrapper>
  );
});
DataNode.displayName = 'DataNode';

export const DocumentNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const w = SIZE.w, h = SIZE.h;
  const path = `M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 12} Q ${(w * 0.75)} ${h + 2} ${w / 2} ${h - 10} Q ${w * 0.25} ${h - 18} 2 ${h - 10} Z`;
  return (
    <Wrapper selected={selected}>
      <div className="relative" style={{ width: w, height: h }}>
        <svg width={w} height={h + 6} style={{ display: 'block' }}>
          <path d={path} fill={FILL} stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
        </svg>
        <LabelLayer data={d} />
        <Handle type="target" position={Position.Top} style={{ background: STROKE, left: w / 2 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: STROKE, left: w / 2, top: h - 4 }} />
      </div>
    </Wrapper>
  );
});
DocumentNode.displayName = 'DocumentNode';

export const ManualInputNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  const w = SIZE.w, h = SIZE.h;
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
        <Handle type="target" position={Position.Top} style={{ background: STROKE, left: w / 2 }} />
        <Handle type="source" position={Position.Bottom} style={{ background: STROKE, left: w / 2 }} />
      </div>
    </Wrapper>
  );
});
ManualInputNode.displayName = 'ManualInputNode';

export const TerminatorNode = memo(({ data, selected }: ShapeProps) => {
  const d = data as unknown as FlowNodeData;
  return (
    <div
      className={`px-5 py-2 rounded-full border-2 shadow-md transition-all duration-200 ${
        selected ? 'scale-110 shadow-xl' : 'hover:shadow-lg hover:scale-105'
      }`}
      style={{
        background: '#F1F5F9',
        borderColor: '#64748B',
        boxShadow: selected ? '0 0 0 3px rgba(100,116,139,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#64748B' }} />
      <div className="font-semibold text-sm" style={{ color: '#334155' }}>{d.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#64748B' }} />
    </div>
  );
});
TerminatorNode.displayName = 'TerminatorNode';
