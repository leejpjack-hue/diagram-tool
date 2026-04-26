import { memo } from 'react';
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
 */
export type GroupContainerData = {
  label: string;
  width: number;
  height: number;
  color?: string;
};

export const GroupContainerNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as GroupContainerData;
  const color = d.color ?? '#64748B';
  // Tint the fill very lightly so the area reads as a region without
  // overwhelming the contained nodes.
  const fill = hexWithAlpha(color, 0.06);

  return (
    <div
      style={{
        width: d.width,
        height: d.height,
        border: `2px dashed ${color}`,
        borderRadius: 12,
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
          top: -10,
          left: 16,
          background: 'white',
          padding: '0 8px',
          fontSize: 12,
          fontWeight: 600,
          color,
          letterSpacing: 0.2,
          lineHeight: '20px',
          borderRadius: 4,
        }}
      >
        {d.label}
      </div>
    </div>
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
