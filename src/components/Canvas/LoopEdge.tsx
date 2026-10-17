import { BaseEdge, useInternalNode, type EdgeProps } from '@xyflow/react';
import { useLayoutDirection } from './layoutDirection';
import { loopReturnPath, type NodeBox } from './loopEdge';

function boxFrom(
  node: { measured?: { width?: number; height?: number }; internals?: { positionAbsolute?: { x: number; y: number } } } | undefined,
  fallbackX: number,
  fallbackY: number,
): NodeBox {
  const width = node?.measured?.width || 160;
  const height = node?.measured?.height || 64;
  const abs = node?.internals?.positionAbsolute;
  return {
    x: abs?.x ?? fallbackX,
    y: abs?.y ?? fallbackY,
    width,
    height,
  };
}

/** Back-edge drawn on the return channel so it misses the forward spine. */
export function LoopEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const layout = useLayoutDirection();
  const hinted = (data as { axis?: 'TB' | 'LR' } | undefined)?.axis;
  const axis = hinted ?? (layout === 'LR' ? 'LR' : 'TB');
  const { path, labelX, labelY } = loopReturnPath(
    boxFrom(sourceNode, sourceX, sourceY),
    boxFrom(targetNode, targetX, targetY),
    axis,
  );
  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
}
