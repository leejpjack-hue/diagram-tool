import { memo } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { ICON_STYLES, STYLE_KIND_LABEL, STYLE_KIND_ROLE, STYLE_NODE_KINDS } from './iconStyles';
import { StyleIcon } from './icons/styles/StyleIcon';

// Color legend tag row at the top of the canvas. Mirrors the chip strip in
// the Diagram Kit reference: a quick way for viewers to decode the colour
// vocabulary (process / service / data / decision) without scrolling.
//
// Each tag is a small chip with a coloured dot and a lowercase label — the
// legend itself is purely informational and doesn't interact with the canvas.

interface LegendTag {
  label: string;
  color: string;
}

const LEGEND: LegendTag[] = [
  { label: 'process', color: '#22c55e' }, // oklch(0.62 0.15 150) green
  { label: 'service', color: '#3b82f6' }, // oklch(0.6 0.15 255) blue
  { label: 'data', color: '#a855f7' },    // oklch(0.58 0.16 300) purple
  { label: 'decision', color: '#f59e0b' }, // oklch(0.7 0.15 80) amber
];

export const ColorLegend = memo(() => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap gap-1.5 justify-center pointer-events-none">
      {LEGEND.map((t) => (
        <span
          key={t.label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 bg-white shadow-sm"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: '#64748b',
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ background: t.color }}
          />
          {t.label}
        </span>
      ))}
    </div>
  );
});

ColorLegend.displayName = 'ColorLegend';

/** Flow boards: the active style's icon and colour for each node type. */
export const FlowStyleLegend = memo(() => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  const tokens = ICON_STYLES[iconStyle];
  const dark = iconStyle === 'blueprint';
  return (
    <div
      data-testid="flow-style-legend"
      className="absolute top-3 left-1/2 z-10 flex max-w-[92%] -translate-x-1/2 flex-wrap justify-center gap-1 pointer-events-none"
    >
      {STYLE_NODE_KINDS.map(kind => {
        const type = tokens.types[kind];
        const role = STYLE_KIND_ROLE[kind];
        const swatch = tokens.shape.fill === 'solid' ? type.color : tokens.shape.fill === 'canvas' ? tokens.canvas : '#ffffff';
        const border = tokens.shape.fill === 'solid' ? 'transparent' : tokens.shape.fill === 'canvas' ? type.color : '#cbd5e1';
        return (
          <span
            key={kind}
            data-legend-kind={kind}
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm"
            style={{
              fontFamily: tokens.label.font,
              color: dark ? '#e0f2fe' : '#334155',
              background: dark ? '#0b1f3a' : '#ffffff',
              borderColor: dark ? '#12305a' : '#e2e8f0',
            }}
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 14,
                height: 14,
                borderRadius: tokens.shape.radius > 12 ? 4 : Math.min(tokens.shape.radius, 4),
                background: swatch,
                border: `1px solid ${border}`,
                color: tokens.icon.color === 'white' ? '#ffffff' : type.color,
              }}
            >
              <StyleIcon
                name={type.icon}
                size={10}
                strokeWidth={1.5}
                filled={tokens.icon.filled}
                markColor={tokens.icon.filled ? type.color : undefined}
                role={role}
                kind={kind}
                decorative
              />
            </span>
            {STYLE_KIND_LABEL[kind]}
          </span>
        );
      })}
    </div>
  );
});

FlowStyleLegend.displayName = 'FlowStyleLegend';