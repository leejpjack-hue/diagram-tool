import type { ConnectionSide, Edge as DiagramEdge } from '../../store/types';
import type { ArchitectureHandleSlots } from './ArchitectureHandles';
import { architectureHandleId, sideFromHandleId } from './architectureHandleIds';

/**
 * Shared side picker for Architecture and Flow.
 *
 * The rule is the one Architecture already used: a stored side wins; otherwise
 * the dominant axis of the two node anchors picks a pair of opposite sides.
 * Horizontal neighbours attach left/right. Vertical neighbours attach
 * top/bottom. That is the short orthogonal (Manhattan) attachment.
 * Nodes without an explicit width still use their top-left anchor, which is
 * what Architecture routing did before this helper was extracted.
 */
export interface RoutedNode {
  id: string;
  position: { x: number; y: number };
  /** Optional box size. When both nodes have one, anchors are box centers. */
  width?: number;
  height?: number;
}

/** Approximate Flow node boxes so side picking uses centers, not only the top-left pin. */
const FLOW_BOXES: Record<string, { w: number; h: number }> = {
  flow: { w: 170, h: 64 },
  start: { w: 130, h: 42 },
  end: { w: 130, h: 42 },
  decision: { w: 112, h: 112 },
  data: { w: 160, h: 60 },
  document: { w: 160, h: 60 },
  manualinput: { w: 160, h: 60 },
  terminator: { w: 140, h: 44 },
  gatewayexclusive: { w: 80, h: 80 },
  gatewayparallel: { w: 80, h: 80 },
  gatewayinclusive: { w: 80, h: 80 },
  eventstart: { w: 64, h: 64 },
  eventend: { w: 64, h: 64 },
  eventtimer: { w: 64, h: 64 },
  eventmessage: { w: 64, h: 64 },
  subprocesscollapsed: { w: 180, h: 80 },
  subprocessexpanded: { w: 180, h: 80 },
};

export function readFlowHandleSlots(data: unknown): ArchitectureHandleSlots | undefined {
  if (!data || typeof data !== 'object') return undefined;
  return (data as { connectionHandles?: ArchitectureHandleSlots }).connectionHandles;
}

export function flowRoutingBox(nodeType: string | undefined): { w: number; h: number } | undefined {
  if (!nodeType) return undefined;
  return FLOW_BOXES[nodeType];
}

export interface ConnectionRoute {
  sourceHandle: string;
  targetHandle: string;
}

export interface ConnectionRouting {
  edgeRoutes: Map<string, ConnectionRoute>;
  nodeSlots: Map<string, ArchitectureHandleSlots>;
}

export const EMPTY_CONNECTION_ROUTING: ConnectionRouting = {
  edgeRoutes: new Map(),
  nodeSlots: new Map(),
};

export function oppositeSide(side: ConnectionSide): ConnectionSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

function anchor(node: RoutedNode): { x: number; y: number } {
  const width = node.width ?? 0;
  const height = node.height ?? 0;
  if (width <= 0 || height <= 0) return node.position;
  return { x: node.position.x + width / 2, y: node.position.y + height / 2 };
}

export function inferConnectionSides(
  edge: { sourceSide?: ConnectionSide; targetSide?: ConnectionSide },
  sourceNode: RoutedNode,
  targetNode: RoutedNode,
): { sourceSide: ConnectionSide; targetSide: ConnectionSide } {
  if (edge.sourceSide && edge.targetSide) {
    return { sourceSide: edge.sourceSide, targetSide: edge.targetSide };
  }
  if (edge.sourceSide) {
    return { sourceSide: edge.sourceSide, targetSide: oppositeSide(edge.sourceSide) };
  }
  if (edge.targetSide) {
    return { sourceSide: oppositeSide(edge.targetSide), targetSide: edge.targetSide };
  }

  const source = anchor(sourceNode);
  const target = anchor(targetNode);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sourceSide: ConnectionSide = dx >= 0 ? 'right' : 'left';
    return { sourceSide, targetSide: oppositeSide(sourceSide) };
  }

  const sourceSide: ConnectionSide = dy >= 0 ? 'bottom' : 'top';
  return { sourceSide, targetSide: oppositeSide(sourceSide) };
}

/**
 * Sides for a drag-connect or reconnect. A handle the user actually grabbed
 * wins. The other end falls back to the short-path inference.
 */
export function sidesForConnection(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
  sourceNode: RoutedNode,
  targetNode: RoutedNode,
): { sourceSide: ConnectionSide; targetSide: ConnectionSide } {
  const draggedSource = sideFromHandleId(sourceHandle);
  const draggedTarget = sideFromHandleId(targetHandle);
  const inferred = inferConnectionSides({}, sourceNode, targetNode);
  return {
    sourceSide: draggedSource ?? inferred.sourceSide,
    targetSide: draggedTarget ?? inferred.targetSide,
  };
}

function ensureSlotBucket(slots: Map<string, ArchitectureHandleSlots>, nodeId: string): ArchitectureHandleSlots {
  const existing = slots.get(nodeId);
  if (existing) return existing;
  const next: ArchitectureHandleSlots = { source: {}, target: {} };
  slots.set(nodeId, next);
  return next;
}

export function computeConnectionRouting(diagramEdges: DiagramEdge[], nodes: RoutedNode[]): ConnectionRouting {
  if (diagramEdges.length === 0 || nodes.length === 0) {
    return EMPTY_CONNECTION_ROUTING;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const nextSlotByEndpoint = new Map<string, number>();
  const edgeRoutes = new Map<string, ConnectionRoute>();
  const nodeSlots = new Map<string, ArchitectureHandleSlots>();

  const takeSlot = (nodeId: string, kind: 'source' | 'target', side: ConnectionSide) => {
    const key = `${nodeId}:${kind}:${side}`;
    const slot = nextSlotByEndpoint.get(key) ?? 0;
    nextSlotByEndpoint.set(key, slot + 1);

    const bucket = ensureSlotBucket(nodeSlots, nodeId);
    const sideCounts = bucket[kind] ?? {};
    sideCounts[side] = Math.max(sideCounts[side] ?? 0, slot + 1);
    bucket[kind] = sideCounts;

    return slot;
  };

  for (const edge of diagramEdges) {
    const sourceNode = nodesById.get(edge.from);
    const targetNode = nodesById.get(edge.to);
    if (!sourceNode || !targetNode) continue;

    const { sourceSide, targetSide } = inferConnectionSides(edge, sourceNode, targetNode);
    const sourceSlot = takeSlot(edge.from, 'source', sourceSide);
    const targetSlot = takeSlot(edge.to, 'target', targetSide);
    edgeRoutes.set(edge.id, {
      sourceHandle: architectureHandleId('source', sourceSide, sourceSlot),
      targetHandle: architectureHandleId('target', targetSide, targetSlot),
    });
  }

  return { edgeRoutes, nodeSlots };
}
