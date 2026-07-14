import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ClassNodeData } from './types';
import { cardStyle, TITLE_COLOR, TITLE_FONT, MONO_FONT, accentDark } from './cardStyle';
import { ArchitectureHandles, type ArchitectureHandleSlots } from './ArchitectureHandles';

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
  // A `color:` in the DSL overrides the default teal accent.
  const accent = d.color || '#0d9488';
  const connectionHandles = (data as { connectionHandles?: ArchitectureHandleSlots }).connectionHandles;

  return (
    <div
      className={`overflow-hidden transition-all duration-200 ${
        selected ? 'scale-105' : ''
      }`}
      style={{ ...cardStyle(accent, !!selected), minWidth: 200 }}
    >
      <ArchitectureHandles accent={accent} slots={connectionHandles} />

      <div className="px-3 py-2 text-center" style={{ background: `color-mix(in srgb, ${accent} 8%, white)`, borderBottom: `1px solid color-mix(in srgb, ${accent} 30%, white)` }}>
        {d.stereotype && (
          <div className="text-[10px] italic" style={{ color: accentDark(accent), fontFamily: MONO_FONT }}>
            «{d.stereotype}»
          </div>
        )}
        <div className="font-bold text-sm" style={{ color: TITLE_COLOR, fontFamily: TITLE_FONT }}>{d.label}</div>
      </div>

      {attrs.length > 0 && (
        <div className="px-3 py-1.5 text-xs" style={{ color: '#475569', fontFamily: MONO_FONT, borderBottom: methods.length ? '1px solid #e2e8f0' : 'none' }}>
          {attrs.map((a, i) => (
            <div key={i} className="leading-snug">{a}</div>
          ))}
        </div>
      )}

      {methods.length > 0 && (
        <div className="px-3 py-1.5 text-xs" style={{ color: '#475569', fontFamily: MONO_FONT }}>
          {methods.map((m, i) => (
            <div key={i} className="leading-snug">{m}</div>
          ))}
        </div>
      )}
    </div>
  );
});

ClassNode.displayName = 'ClassNode';
