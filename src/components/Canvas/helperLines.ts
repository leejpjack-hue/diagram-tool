import type { Node } from '@xyflow/react';

// Alignment helper lines: while dragging a node, find other nodes whose
// edges or centers line up within the threshold, snap the dragged node to
// them, and report the line coordinates for the overlay to draw.

export interface HelperLineResult {
  horizontal?: number; // y coordinate (flow space) of the horizontal guide
  vertical?: number; // x coordinate of the vertical guide
  snapX?: number; // adjusted position.x for the dragged node
  snapY?: number; // adjusted position.y
}

const THRESHOLD = 6;

export function getHelperLines(
  id: string,
  position: { x: number; y: number },
  nodes: Node[],
): HelperLineResult {
  const moving = nodes.find(n => n.id === id);
  if (!moving) return {};

  const w = moving.measured?.width ?? 180;
  const h = moving.measured?.height ?? 80;

  const movingXs = [position.x, position.x + w / 2, position.x + w]; // left, center, right
  const movingYs = [position.y, position.y + h / 2, position.y + h]; // top, middle, bottom

  let bestV: { dist: number; line: number; snapX: number } | null = null;
  let bestH: { dist: number; line: number; snapY: number } | null = null;

  for (const other of nodes) {
    if (other.id === id || other.id.startsWith('__')) continue;
    const ow = other.measured?.width ?? 180;
    const oh = other.measured?.height ?? 80;
    const otherXs = [other.position.x, other.position.x + ow / 2, other.position.x + ow];
    const otherYs = [other.position.y, other.position.y + oh / 2, other.position.y + oh];

    for (let mi = 0; mi < 3; mi++) {
      for (const ox of otherXs) {
        const dist = Math.abs(movingXs[mi] - ox);
        if (dist < THRESHOLD && (!bestV || dist < bestV.dist)) {
          bestV = { dist, line: ox, snapX: ox - [0, w / 2, w][mi] };
        }
      }
      for (const oy of otherYs) {
        const dist = Math.abs(movingYs[mi] - oy);
        if (dist < THRESHOLD && (!bestH || dist < bestH.dist)) {
          bestH = { dist, line: oy, snapY: oy - [0, h / 2, h][mi] };
        }
      }
    }
  }

  return {
    vertical: bestV?.line,
    snapX: bestV?.snapX,
    horizontal: bestH?.line,
    snapY: bestH?.snapY,
  };
}
