import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { useLayoutHandles } from './layoutDirection';
import { FLOW_COLORS, flowShapeStyle, paletteFromColor, TITLE_FONT, MONO_FONT } from './flowShapeStyle';
import { RoleChip } from './RoleChip';
import { useDiagramStore } from '../../store/diagramStore';
import { faceBoxShadow, ICON_STYLES, resolveFace, type IconStyleId } from './iconStyles';
import { FlowGlyph } from './FlowGlyph';

export const ProcessNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanProcessNode {...props} />;
  return <StyledProcessNode {...props} iconStyle={iconStyle} />;
});

function CleanProcessNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles(!!nodeData.reversed);
  const C = nodeData.color ? paletteFromColor(nodeData.color) : FLOW_COLORS.blue;

  return (
    <div
      className={`
        relative px-5 py-3 rounded-xl transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[150px]
      `}
      style={flowShapeStyle(C, !!selected)}
    >
      <RoleChip role={nodeData.role} />
      <Handle type="target" position={target} style={{ background: C.border }} />

      <div className="font-semibold text-[13px] text-center" style={{ color: C.text, fontFamily: TITLE_FONT }}>
        {nodeData.label}
      </div>

      {nodeData.system && (
        <div className="text-[10px] text-center mt-1" style={{ color: C.text, opacity: 0.7, fontFamily: MONO_FONT }}>
          {nodeData.system}
        </div>
      )}

      {nodeData.duration && (
        <div className="text-[10px] text-center mt-0.5" style={{ color: '#64748b', fontFamily: MONO_FONT }}>
          ⏱️ {nodeData.duration}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: C.border }} />
    </div>
  );
}

ProcessNode.displayName = 'ProcessNode';

function StyledProcessNode({ data, selected, iconStyle }: NodeProps & { iconStyle: IconStyleId }) {
  const nodeData = data as unknown as FlowNodeData;
  const { target, source } = useLayoutHandles(!!nodeData.reversed);
  const face = resolveFace(iconStyle, nodeData, 'card');
  const tokens = ICON_STYLES[iconStyle];
  const shadow = faceBoxShadow(face);
  return (
    <div
      className="relative px-5 py-3 min-w-[150px]"
      data-style-kind={face.kind}
      style={{
        background: face.fill,
        border: face.borderWidth ? `${face.borderWidth}px solid ${face.borderColor}` : 'none',
        borderRadius: face.radius,
        boxShadow: shadow,
        outline: selected ? `${tokens.selection.width}px solid ${tokens.selection.color}` : undefined,
        outlineOffset: selected ? tokens.selection.offset : undefined,
      }}
    >
      <Handle type="target" position={target} style={{ background: face.borderWidth ? face.borderColor : face.labelColor }} />
      <div className="flex items-center justify-center" style={{ gap: 8 }}>
        <FlowGlyph face={face} />
        <div className="text-[13px] text-center" style={{ color: face.labelColor, fontFamily: face.fontFamily, fontWeight: face.fontWeight }}>
          {nodeData.label}
        </div>
      </div>
      {nodeData.system && (
        <div className="text-[10px] text-center mt-1" style={{ color: face.labelColor, opacity: 0.75, fontFamily: MONO_FONT }}>
          {nodeData.system}
        </div>
      )}
      {nodeData.duration && (
        <div className="text-[10px] text-center mt-0.5" style={{ color: face.labelColor, opacity: 0.75, fontFamily: MONO_FONT }}>
          {nodeData.duration}
        </div>
      )}
      <Handle type="source" position={source} style={{ background: face.borderWidth ? face.borderColor : face.labelColor }} />
    </div>
  );
}
