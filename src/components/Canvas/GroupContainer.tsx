import { memo } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagramStore';
import { ICON_STYLES, resolveArchFace, type IconStyleId } from './iconStyles';
import { StyleIcon } from './icons/styles/StyleIcon';

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

export const GroupContainerNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanGroupContainer {...props} />;
  return <StyledGroupContainer {...props} iconStyle={iconStyle} />;
});

GroupContainerNode.displayName = 'GroupContainerNode';

const CleanGroupContainer = memo(({ data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps) => {
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
      data-arch-kind="group"
      data-arch-style="clean"
      data-arch-treatment="chip"
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

CleanGroupContainer.displayName = 'CleanGroupContainer';

const StyledGroupContainer = memo(({ data, selected, positionAbsoluteX, positionAbsoluteY, iconStyle }: NodeProps & { iconStyle: Exclude<IconStyleId, 'clean'> }) => {
  const d = data as unknown as GroupContainerData;
  const face = resolveArchFace(iconStyle, 'group', d.color);
  const tokens = ICON_STYLES[iconStyle];
  const width = Number.isFinite(d.width) ? d.width : 320;
  const height = Number.isFinite(d.height) ? d.height : 200;
  const x = Number.isFinite(positionAbsoluteX) ? positionAbsoluteX : 0;
  const y = Number.isFinite(positionAbsoluteY) ? positionAbsoluteY : 0;
  const borderWidth = iconStyle === 'bold' ? tokens.edge.width : face.borderWidth;
  const borderStyle = iconStyle === 'blueprint' ? 'dashed' : 'solid';
  const fill = iconStyle === 'blueprint'
    ? 'transparent'
    : iconStyle === 'bold'
      ? `color-mix(in srgb, ${face.color} 22%, white)`
      : `color-mix(in srgb, ${face.color} 8%, white)`;
  const badgeBg = iconStyle === 'bold' ? face.color : iconStyle === 'blueprint' ? face.canvas : '#ffffff';
  const badgeColor = iconStyle === 'bold' ? '#ffffff' : face.labelColor;
  const ring = selected
    ? { outline: `${tokens.selection.width}px solid ${tokens.selection.color}`, outlineOffset: tokens.selection.offset }
    : {};

  return (
    <>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        lineStyle={{ borderColor: face.color }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: badgeBg, border: `1.5px solid ${face.color}` }}
        onResizeEnd={(_e, params) => {
          if (d.groupId && d.onResize) {
            d.onResize(d.groupId, x, y, params.width, params.height);
          }
        }}
      />
      <div
        data-arch-kind="group"
        data-arch-style={iconStyle}
        data-arch-treatment={face.treatment}
        style={{
          width,
          height,
          border: `${borderWidth}px ${borderStyle} ${face.borderColor}`,
          borderRadius: face.radius,
          background: fill,
          position: 'relative',
          pointerEvents: 'all',
          cursor: 'grab',
          ...ring,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: badgeBg,
            border: `1.2px solid ${iconStyle === 'bold' ? face.color : face.borderColor}`,
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: face.fontWeight,
            color: badgeColor,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            lineHeight: '16px',
            borderRadius: iconStyle === 'blueprint' ? 2 : 8,
            fontFamily: face.fontFamily,
          }}
        >
          <StyleIcon
            name={face.icon}
            size={12}
            strokeWidth={face.iconStroke}
            filled={face.iconFilled}
            color={face.iconColor}
            kind="group"
            decorative
          />
          {d.label}
        </div>
      </div>
    </>
  );
});

StyledGroupContainer.displayName = 'StyledGroupContainer';

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
