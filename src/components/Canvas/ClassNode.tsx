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
      className={`bg-white overflow-hidden transition-all duration-200 ${
        selected ? 'scale-105' : ''
      }`}
      style={{
        border: selected ? '1px solid #0d9488' : '1px solid #e2e8f0',
        borderTop: '3px solid #0d9488',
        borderRadius: 12,
        minWidth: 200,
        boxShadow: selected
          ? '0 0 0 3px rgba(13,148,136,0.18), 0 8px 24px rgba(15,23,42,0.14)'
          : '0 1px 2px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.08)',
      }}
    >
      <Handle type="target" position={target} style={{ background: '#0d9488' }} />

      <div className="px-3 py-2 text-center" style={{ background: 'color-mix(in srgb, #0d9488 7%, white)', borderBottom: '1px solid #e2e8f0' }}>
        {d.stereotype && (
          <div className="text-[10px] italic font-mono" style={{ color: '#0f766e' }}>
            «{d.stereotype}»
          </div>
        )}
        <div className="font-bold text-sm" style={{ color: '#0f172a' }}>{d.label}</div>
      </div>

      {attrs.length > 0 && (
        <div className="px-3 py-1.5 text-xs font-mono" style={{ color: '#475569', borderBottom: methods.length ? '1px solid #e2e8f0' : 'none' }}>
          {attrs.map((a, i) => (
            <div key={i} className="leading-snug">{a}</div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="px-3 py-1.5 text-xs font-mono" style={{ color: '#475569' }}>
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
