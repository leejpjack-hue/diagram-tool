import { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

/**
 * Sub-system grouping container — a dashed rectangle drawn behind a set of
 * architecture nodes. Rendered as a non-interactive React Flow node with a
 * negative zIndex so the contained components paint on top.
 *
 * Driven by the DSL `group` block:
 *
 *   group Backend {
 *     label: Backend Services       # optional, defaults to the group name
 *     color: '#3B82F6'              # optional, defaults to slate
 *     contains: AuthApi, OrdersApi, OrdersDb
 *   }
 *
 * Visual treatment mirrors the Diagram Kit reference: a soft dashed outline,
 * a 5%-tinted fill, and a pill-shaped monospace label badge pinned to the
 * top-left corner that reads like "EDGE · cdn + ingress".
 */
export type GroupContainerData = {
  label: string;
  width: number;
  height: number;
  color?: string;
  groupId?: string;
  // Persist a resize back into the DSL (`at:` + `size:`).
  onResize?: (groupId: string, x: number, y: number, w: number, h: number) => void;
};

export const GroupContainerNode = memo(({ data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) => {
  const d = data as unknown as GroupContainerData;
  const color = d.color ?? '#64748B';
  // Tint the fill very lightly so the area reads as a region without
  // overwhelming the contained nodes.
  const fill = hexWithAlpha(color, 0.06);

  // Defensive defaults — the data is built in DiagramCanvas where width and
  // height are computed from member positions, but if those calculations
  // fail (e.g. pins-only diagrams) we still need finite numbers for the
  // <NodeResizer>'s internal SVG to render. Without this fallback the
  // resizer's path d="..." attributes come out as "MNaN,NaN…" and React
  // throws a flood of attribute errors that block the whole container from
  // painting.
  const width = Number.isFinite(d.width) ? d.width : 320;
  const height = Number.isFinite(d.height) ? d.height : 200;
  const x = Number.isFinite(positionAbsoluteX) ? positionAbsoluteX : 0;
  const y = Number.isFinite(positionAbsoluteY) ? positionAbsoluteY : 0;

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        lineStyle={{ borderColor: hexWithAlpha(color, 0.6) }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: '#fff', border: `1.5px solid ${hexWithAlpha(color, 0.8)}` }}
        onResizeEnd={(_e, params) => {
          if (d.groupId && d.onResize) {
            d.onResize(d.groupId, x, y, params.width, params.height);
          }
        }}
      />
    <div
      style={{
        width,
        height,
        border: `1.4px dashed ${hexWithAlpha(color, 0.45)}`,
        borderRadius: 16,
        background: fill,
        position: 'relative',
        // Pointer events stay on the outer rect so the user can grab it for
        // dragging — the contained component nodes paint on top with their
        // own zIndex and capture clicks before the rect sees them.
        pointerEvents: 'all',
        cursor: 'grab',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -11,
          left: 18,
          background: 'white',
          border: `1.2px solid ${hexWithAlpha(color, 0.45)}`,
          padding: '3px 10px',
          fontSize: 10,
          fontWeight: 600,
          color: hexWithAlpha(color, 0.95),
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          lineHeight: '16px',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}
      >
        {d.label}
      </div>
    </div>
    </>
  );
});

GroupContainerNode.displayName = 'GroupContainerNode';

// Convert a #RRGGBB or named color to rgba(...) at the given alpha. Falls
// back to a low-opacity neutral if parsing fails.
function hexWithAlpha(input: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  if (!m) return `rgba(100, 116, 139, ${alpha})`;
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
