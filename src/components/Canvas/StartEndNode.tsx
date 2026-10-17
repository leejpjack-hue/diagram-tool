import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { FlowNodeData } from './types';
import { FLOW_COLORS, flowPillStyle, paletteFromColor, TITLE_FONT } from './flowShapeStyle';
import { FlowHandles } from './FlowHandles';
import { readFlowHandleSlots } from './connectionRouting';
import { useDiagramStore } from '../../store/diagramStore';
import { faceBoxShadow, ICON_STYLES, resolveFace, type IconStyleId } from './iconStyles';
import { FlowGlyph } from './FlowGlyph';

export const StartEndNode = memo((props: NodeProps) => {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (iconStyle === 'clean') return <CleanStartEndNode {...props} />;
  return <StyledStartEndNode {...props} iconStyle={iconStyle} />;
});

const CleanStartEndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as FlowNodeData;
  const isStart = nodeData.isStart;
  const isEnd = nodeData.isEnd;

  // A `color:` override wins; otherwise start = green, end = red, else neutral.
  const c = nodeData.color
    ? paletteFromColor(nodeData.color)
    : isStart ? FLOW_COLORS.green : isEnd ? FLOW_COLORS.red : FLOW_COLORS.slate;

  return (
    <div
      className={`
        px-6 py-2.5 rounded-full transition-all duration-200
        relative ${selected ? 'scale-105' : 'hover:scale-105'}
        min-w-[110px] text-center
      `}
      style={flowPillStyle(c, !!selected)}
    >
      <div
        className="font-bold text-[12px] uppercase"
        style={{ color: c.text, fontFamily: TITLE_FONT, letterSpacing: '0.05em' }}
      >
        {nodeData.label}
      </div>

      <FlowHandles accent={c.border} slots={readFlowHandleSlots(data)} />
    </div>
  );
});

StartEndNode.displayName = 'StartEndNode';
CleanStartEndNode.displayName = 'CleanStartEndNode';

const StyledStartEndNode = memo(({ data, selected, iconStyle }: NodeProps & { iconStyle: IconStyleId }) => {
  const nodeData = data as unknown as FlowNodeData;
  const isStart = nodeData.isStart;
  const isEnd = nodeData.isEnd;
  const face = resolveFace(iconStyle, {
    ...nodeData,
    isStart: isStart || (!isEnd && !nodeData.role),
    isEnd,
  }, 'pill');
  const tokens = ICON_STYLES[iconStyle];
  const handleColor = face.borderWidth ? face.borderColor : face.labelColor;
  return (
    <div
      data-style-kind={face.kind}
      className="relative px-6 py-2.5 min-w-[110px] text-center"
      style={{
        background: face.fill,
        border: face.borderWidth ? `${face.borderWidth}px solid ${face.borderColor}` : 'none',
        borderRadius: face.radius,
        boxShadow: faceBoxShadow(face),
        outline: selected ? `${tokens.selection.width}px solid ${tokens.selection.color}` : undefined,
        outlineOffset: selected ? tokens.selection.offset : undefined,
      }}
    >
      <div className="inline-flex items-center justify-center" style={{ gap: 8 }}>
        <FlowGlyph face={face} />
        <div style={{ color: face.labelColor, fontFamily: face.fontFamily, fontWeight: face.fontWeight, fontSize: 12, letterSpacing: '0.04em' }}>
          {nodeData.label}
        </div>
      </div>
      <FlowHandles accent={handleColor} slots={readFlowHandleSlots(data)} />
    </div>
  );
});
StyledStartEndNode.displayName = 'StyledStartEndNode';
