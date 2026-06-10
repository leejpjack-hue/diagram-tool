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
  // A `color:` in the DSL overrides the default teal accent.
  const accent = d.color || '#0d9488';

  return (
    <div
      className={`bg-white overflow-hidden transition-all duration-200 ${
        selected ? 'scale-105' : ''
      }`}
      style={{
        border: selected ? `1px solid ${accent}` : '1px solid #e2e8f0',
        borderTop: `3px solid ${accent}`,
        borderRadius: 12,
        minWidth: 200,
        boxShadow: selected
          ? `0 0 0 3px color-mix(in srgb, ${accent} 18%, transparent), 0 8px 24px rgba(15,23,42,0.14)`
          : '0 1px 2px rgba(15,23,42,0.05), 0 4px 14px rgba(15,23,42,0.08)',
      }}
    >
      <Handle type="target" position={target} style={{ background: accent }} />

      <div className="px-3 py-2 text-center" style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, borderBottom: '1px solid #e2e8f0' }}>
        {d.stereotype && (
          <div className="text-[10px] italic font-mono" style={{ color: `color-mix(in srgb, ${accent} 65%, #0f172a)` }}>
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

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

ClassNode.displayName = 'ClassNode';
