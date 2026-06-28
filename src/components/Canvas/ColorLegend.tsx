import { memo } from 'react';

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