// DT-AI-25 — return-edge geometry.
//
// A back-edge leaves the side opposite the forward spine so it does not sit
// on top of the TB column or the LR row. TB flows top→bottom, so the return
// channel is to the left. LR flows left→right, so the return channel is above.
// That is the same idea as a reversed handle (the edge does not leave the
// forward source side) applied per edge, so a node that also continues
// forward keeps its forward handles.

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LoopReturnGeometry {
  path: string;
  labelX: number;
  labelY: number;
  /** Coordinate of the return channel (x for TB, y for LR). */
  channel: number;
}

const RETURN_GAP = 40;

export function loopReturnPath(source: NodeBox, target: NodeBox, axis: 'TB' | 'LR'): LoopReturnGeometry {
  if (axis === 'LR') {
    const channel = Math.min(source.y, target.y) - RETURN_GAP;
    const sx = source.x + source.width / 2;
    const tx = target.x + target.width / 2;
    const path = `M ${sx} ${source.y} V ${channel} H ${tx} V ${target.y}`;
    return { path, labelX: (sx + tx) / 2, labelY: channel, channel };
  }
  const channel = Math.min(source.x, target.x) - RETURN_GAP;
  const sy = source.y + source.height / 2;
  const ty = target.y + target.height / 2;
  const path = `M ${source.x} ${sy} H ${channel} V ${ty} H ${target.x}`;
  return { path, labelX: channel, labelY: (sy + ty) / 2, channel };
}

/** Target sits clearly upstream of source along the flow axis. */
export function isUpstreamEdge(
  source: { x: number; y: number } | undefined,
  target: { x: number; y: number } | undefined,
  axis: 'TB' | 'LR',
): boolean {
  if (!source || !target) return false;
  return axis === 'LR' ? target.x + 24 < source.x : target.y + 24 < source.y;
}
