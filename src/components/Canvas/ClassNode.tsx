import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ClassNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';

/**
 * UML class diagram node — three-section box:
 *   ┌──────────────────┐
 *   │   <<stereotype>> │
 *   │     ClassName    │   ← title section
 *   ├──────────────────┤
 *   │ + name: string   │   ← attributes
 *   │ - age: int       │
 *   ├──────────────────┤
 *   │ + greet(): void  │   ← methods
 *   └──────────────────┘
 */
export const ClassNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ClassNodeData;
  const attrs = d.attributes ?? [];
  const methods = d.methods ?? [];
  const { target, source } = useLayoutHandles();

  return (
    <div
      className={`bg-white border-2 rounded shadow-md transition-all duration-200 ${
        selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg'
      }`}
      style={{
        borderColor: '#0F766E',
        minWidth: 200,
        boxShadow: selected ? '0 0 0 3px rgba(15,118,110,0.25)' : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={target} style={{ background: '#0F766E' }} />

      <div className="px-3 py-2 text-center" style={{ background: '#CCFBF1', borderBottom: '1px solid #0F766E' }}>
        {d.stereotype && (
          <div className="text-[10px] italic font-mono" style={{ color: '#115E59' }}>
            «{d.stereotype}»
          </div>
        )}
        <div className="font-bold text-sm" style={{ color: '#134E4A' }}>{d.label}</div>
      </div>

      {attrs.length > 0 && (
        <div className="px-3 py-1.5 text-xs font-mono" style={{ color: '#115E59', borderBottom: methods.length ? '1px solid #99F6E4' : 'none' }}>
          {attrs.map((a, i) => (
            <div key={i} className="leading-snug">{a}</div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="px-3 py-1.5 text-xs font-mono" style={{ color: '#115E59' }}>
          {methods.map((m, i) => (
            <div key={i} className="leading-snug">{m}</div>
          ))}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: '#0F766E' }} />
    </div>
  );
});

ClassNode.displayName = 'ClassNode';
