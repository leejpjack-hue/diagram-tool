import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { FLOW_COLORS, paletteFromColor, TITLE_FONT } from './flowShapeStyle';
import { RoleChip } from './RoleChip';
import { useDiagramStore } from '../../store/diagramStore';
import { faceBoxShadow, ICON_STYLES, resolveFace, type IconStyleId } from './iconStyles';
import { FlowGlyph } from './FlowGlyph';
import { FlowHandles } from './FlowHandles';
import { readFlowHandleSlots } from './connectionRouting';

export const DecisionNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanDecisionNode {...props} />;
  return <StyledDecisionNode {...props} iconStyle={iconStyle} />;
});

const CleanDecisionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const C = nodeData.color ? paletteFromColor(nodeData.color) : FLOW_COLORS.amber;

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

      {/* Role chip (DT-AI-03) — top-right corner; handles sit on centre lines/points. */}
      <RoleChip role={nodeData.role} />

      {/* Label sits on the unrotated node box so decision text stays horizontal. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-2">
          <div className="font-semibold text-[11.5px] leading-tight" style={{ color: C.text, fontFamily: TITLE_FONT }}>
            {nodeData.label}
          </div>
        </div>
      </div>

      <FlowHandles accent={C.border} slots={readFlowHandleSlots(data)} />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';
CleanDecisionNode.displayName = 'CleanDecisionNode';

const StyledDecisionNode = memo(({ data, selected, iconStyle }: NodeProps & { iconStyle: IconStyleId }) => {
  const nodeData = data as unknown as FlowNodeData;
  const face = resolveFace(iconStyle, { ...nodeData, nodeType: nodeData.nodeType ?? 'decision' }, 'diamond');
  const tokens = ICON_STYLES[iconStyle];
  const handleColor = face.borderWidth ? face.borderColor : face.labelColor;
  const shadow = faceBoxShadow(face);
  return (
    <div className="relative w-28 h-28" data-style-kind={face.kind}>
      <div
        className="absolute transform rotate-45"
        style={{
          inset: 15,
          background: face.fill,
          border: face.borderWidth ? `${face.borderWidth}px solid ${face.borderColor}` : 'none',
          borderRadius: face.radius,
          boxShadow: shadow,
          outline: selected ? `${tokens.selection.width}px solid ${tokens.selection.color}` : undefined,
          outlineOffset: selected ? tokens.selection.offset : undefined,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center justify-center text-center px-2" style={{ gap: 4, maxWidth: 96 }}>
          <FlowGlyph face={{ ...face, iconSize: Math.min(face.iconSize, 14) }} />
          <div className="leading-tight" style={{ color: face.labelColor, fontFamily: face.fontFamily, fontWeight: face.fontWeight, fontSize: 11 }}>
            {nodeData.label}
          </div>
        </div>
      </div>
      <FlowHandles accent={handleColor} slots={readFlowHandleSlots(data)} />
    </div>
  );
});
StyledDecisionNode.displayName = 'StyledDecisionNode';
