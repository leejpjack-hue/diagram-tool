import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { FLOW_COLORS, paletteFromColor, TITLE_FONT } from './flowShapeStyle';
import { useLayoutHandles } from './layoutDirection';

// Decision diamond — a rotated square. Four connection points so a branch can
// always exit to the right place, but the primary target/source follow the
// current layout direction (TB → top/bottom, LR → left/right) so the diamond
// "points" along the flow axis. Without this, an LR diagram with TB-default
// anchors draws lines that hit the diamond's flat sides instead of its points.
// Pin a handle to the matching point of the diamond so its anchor sits exactly
// on the rotated square's corner. Without this, every handle would share one
// (left/top, right/bottom) axis and the LR-mode right-pointing handle would
// land at the wrong y, breaking the edge geometry.
function diamondHandleStyle(position: Position, color: string): React.CSSProperties {
  const base: React.CSSProperties = { background: color };
  switch (position) {
    case Position.Left:
      return { ...base, left: 0, top: '50%', transform: 'translateY(-50%)' };
    case Position.Right:
      return { ...base, right: 0, top: '50%', transform: 'translateY(-50%)' };
    case Position.Top:
      return { ...base, top: 0, left: '50%', transform: 'translateX(-50%)' };
    case Position.Bottom:
      return { ...base, bottom: 0, left: '50%', transform: 'translateX(-50%)' };
  }
}

export const DecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const C = nodeData.color ? paletteFromColor(nodeData.color) : FLOW_COLORS.amber;
  const { target, source, direction } = useLayoutHandles();
  const isLR = direction === 'LR';

  // Two primary handles sit on the layout axis:
  //   TB → target on Top,    source on Bottom (perpendicular exit = Right)
  //   LR → target on Left,   source on Right  (perpendicular exit = Bottom)
  // A second handle on the perpendicular axis (with an explicit id) acts as
  // the side branch so a labelled connection like `A -> Decision ->|No| B`
  // can still anchor to the diamond cleanly.
  const exitA = isLR ? Position.Right : Position.Bottom;
  const exitB = isLR ? Position.Bottom : Position.Right;

  return (
    <div
      className={`
        relative w-28 h-28 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-105'}
      `}
    >
      {/* Diamond shape — a rotated square inset so its points meet the node
          box edges (where the handles sit), matching the reference size. */}
      <div
        className="absolute transform rotate-45 transition-all duration-200"
        style={{
          inset: 15,
          background: '#ffffff',
          border: `1.5px solid ${selected ? C.text : C.border}`,
          borderRadius: 12,
          boxShadow: selected
            ? `0 0 0 3px color-mix(in srgb, ${C.text} 18%, transparent), 0 10px 20px -14px rgba(17,24,39,0.3)`
            : '0 1px 2px rgba(17,24,39,0.05), 0 10px 20px -14px rgba(17,24,39,0.3)',
        }}
      />

      {/* Text container (rotated back) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="transform -rotate-45 text-center px-2">
          <div className="font-semibold text-[11.5px] leading-tight" style={{ color: C.text, fontFamily: TITLE_FONT }}>
            {nodeData.label}
          </div>
        </div>
      </div>

      {/* Primary target — sits on the diamond's leading point along the flow. */}
      <Handle
        type="target"
        position={target}
        style={diamondHandleStyle(target, C.border)}
      />
      {/* Primary source — trailing point along the flow. */}
      <Handle
        type="source"
        position={source}
        style={diamondHandleStyle(source, C.border)}
      />
      {/* Exit A — natural continuation on the perpendicular axis. */}
      <Handle
        type="source"
        position={exitA}
        id="exit-a"
        style={diamondHandleStyle(exitA, C.border)}
      />
      {/* Exit B — the side branch. */}
      <Handle
        type="source"
        position={exitB}
        id="exit-b"
        style={diamondHandleStyle(exitB, C.border)}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
