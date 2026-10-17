import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, useNodesState, useEdgesState, MarkerType, ReactFlowProvider, useReactFlow, BackgroundVariant, ViewportPortal } from '@xyflow/react';
import type { Node, NodeChange, Edge as ReactFlowEdge, Viewport, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ServiceNode } from './ServiceNode';
import { DatabaseNode } from './DatabaseNode';
import { QueueNode } from './QueueNode';
import { CloudNode } from './CloudNode';
import { ClassNode } from './ClassNode';
import { ProcessNode } from './ProcessNode';
import { StartEndNode } from './StartEndNode';
import { DecisionNode } from './DecisionNode';
import { DataNode, DocumentNode, ManualInputNode, TerminatorNode } from './FlowShapeNodes';
import {
  GatewayExclusiveNode, GatewayParallelNode, GatewayInclusiveNode,
  EventStartNode, EventEndNode, EventTimerNode, EventMessageNode,
  SubprocessNode, SubprocessExpandedNode,
} from './BpmnShapes';
import { SwimlaneNode } from './SwimlaneOverlay';
import { GroupContainerNode } from './GroupContainer';
import { AnnotationNode } from './AnnotationNode';
import { C4LevelSwitcher } from './C4LevelSwitcher';
import { ZoomControls } from './ZoomControls';
import { ShapeLibrary } from '../Panel/ShapeLibrary';
import { ColorLegend, FlowStyleLegend } from './ColorLegend';
import { ICON_STYLES } from './iconStyles';
import { useDiagramStore } from '../../store/diagramStore';
import type { FlowNode, C4Level, ServiceNode as ServiceNodeType, CloudNode as CloudNodeType, ClassNode as ClassNodeType, AnnotationNode as AnnotationNodeType } from '../../store/types';
import { calculateAutoLayout, resolveGroupOverlaps } from '../../utils/autoLayout';
import { addConnectionDSL } from '../../utils/connectDSL';
import { setReverseDSL, setReverseMermaidDSL } from '../../utils/flowDSL';
import { applyCanvasPins, setGroupPin } from '../../utils/pinUtils';
import { applyBoardSource, renameNodeInSource } from '../../utils/sourceText';
import { isMermaidFlow } from '../../parser/mermaidFlow';
import { parseDiagram } from '../../parser/parser';
import { flowStepList, flowStepNumbers, type FlowStep } from '../../parser/flowToPlainSteps';
import { WalkThroughOverlay } from './WalkThroughOverlay';
import { NO_STEP_NUMBERS, StepNumberContext, withStepNumber } from './StepNumberBadge';
import { LoopEdge } from './LoopEdge';
import { isUpstreamEdge } from './loopEdge';
import { getHelperLines, type HelperLineResult } from './helperLines';
import { LayoutDirectionContext } from './layoutDirection';
import { Position } from '@xyflow/react';
import { type ArchitectureHandleSlots } from './ArchitectureHandles';
import { architectureHandleId } from './architectureHandleIds';
import type { ConnectionSide, Edge as DiagramEdge } from '../../store/types';

/** DT-AI-21 — mid readable opacity for walk-through session-path trail nodes. */
const WALK_TRAIL_NODE_OPACITY = 0.55;

const architectureNodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  cloud: CloudNode,
  class: ClassNode,
  groupcontainer: GroupContainerNode,
  annotation: AnnotationNode,
};

const flowEdgeTypes = { loop: LoopEdge };

const flowNodeTypes = {
  flow: withStepNumber(ProcessNode),
  start: withStepNumber(StartEndNode),
  end: withStepNumber(StartEndNode),
  decision: withStepNumber(DecisionNode),
  data: withStepNumber(DataNode),
  document: withStepNumber(DocumentNode),
  manualinput: withStepNumber(ManualInputNode),
  terminator: withStepNumber(TerminatorNode),
  gatewayexclusive: withStepNumber(GatewayExclusiveNode),
  gatewayparallel: withStepNumber(GatewayParallelNode),
  gatewayinclusive: withStepNumber(GatewayInclusiveNode),
  eventstart: withStepNumber(EventStartNode),
  eventend: withStepNumber(EventEndNode),
  eventtimer: withStepNumber(EventTimerNode),
  eventmessage: withStepNumber(EventMessageNode),
  subprocesscollapsed: withStepNumber(SubprocessNode),
  subprocessexpanded: withStepNumber(SubprocessExpandedNode),
  swimlane: SwimlaneNode,
  // Annotations are overlay nodes — registered in both architecture and flow
  // so a sticky note in either diagram type renders correctly.
  annotation: AnnotationNode,
};

// Lane layout constants — header strip matches SwimlaneNode's HEADER_W
const LANE_HEADER_W = 56;
const LANE_HEIGHT = 180;
const LANE_NODE_X_START = LANE_HEADER_W + 60;
const LANE_NODE_X_STEP = 210;

// C4 level ordering used for drill-down navigation (parent → next level).
const C4_ORDER: C4Level[] = ['context', 'container', 'component', 'code'];
const nextC4Level = (lvl: C4Level): C4Level | null => {
  const i = C4_ORDER.indexOf(lvl);
  return i >= 0 && i < C4_ORDER.length - 1 ? C4_ORDER[i + 1] : null;
};

function isEndedDragChange(change: NodeChange<Node>): change is NodeChange<Node> & {
  type: 'position';
  id: string;
  dragging: false;
  position: { x: number; y: number };
} {
  return change.type === 'position' && change.dragging === false && !!change.position;
}

interface ArchitectureEdgeRoute {
  sourceHandle: string;
  targetHandle: string;
}

interface ArchitectureRouting {
  edgeRoutes: Map<string, ArchitectureEdgeRoute>;
  nodeSlots: Map<string, ArchitectureHandleSlots>;
}

const EMPTY_ARCHITECTURE_ROUTING: ArchitectureRouting = {
  edgeRoutes: new Map(),
  nodeSlots: new Map(),
};

function oppositeSide(side: ConnectionSide): ConnectionSide {
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

function inferConnectionSides(edge: DiagramEdge, sourceNode: Node, targetNode: Node): { sourceSide: ConnectionSide; targetSide: ConnectionSide } {
  if (edge.sourceSide && edge.targetSide) {
    return { sourceSide: edge.sourceSide, targetSide: edge.targetSide };
  }
  if (edge.sourceSide) {
    return { sourceSide: edge.sourceSide, targetSide: oppositeSide(edge.sourceSide) };
  }
  if (edge.targetSide) {
    return { sourceSide: oppositeSide(edge.targetSide), targetSide: edge.targetSide };
  }

  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sourceSide: ConnectionSide = dx >= 0 ? 'right' : 'left';
    return { sourceSide, targetSide: oppositeSide(sourceSide) };
  }

  const sourceSide: ConnectionSide = dy >= 0 ? 'bottom' : 'top';
  return { sourceSide, targetSide: oppositeSide(sourceSide) };
}

function ensureSlotBucket(slots: Map<string, ArchitectureHandleSlots>, nodeId: string): ArchitectureHandleSlots {
  const existing = slots.get(nodeId);
  if (existing) return existing;
  const next: ArchitectureHandleSlots = { source: {}, target: {} };
  slots.set(nodeId, next);
  return next;
}

function computeArchitectureRouting(diagramMode: string, diagramEdges: DiagramEdge[], nodes: Node[]): ArchitectureRouting {
  if (diagramMode === 'flow' || diagramEdges.length === 0 || nodes.length === 0) {
    return EMPTY_ARCHITECTURE_ROUTING;
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const nextSlotByEndpoint = new Map<string, number>();
  const edgeRoutes = new Map<string, ArchitectureEdgeRoute>();
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

function DiagramCanvasInternal() {
  const { parsedDiagram, diagramMode, setZoomLevel, setSelectedNode, dslText, setDslText, setParsedDiagram, setError, selectedNodeId, isReadOnlyShared } = useDiagramStore();
  const iconStyle = useDiagramStore(s => s.iconStyle);
  const showStepNumbers = useDiagramStore(s => s.showStepNumbers);
  const flowTokens = ICON_STYLES[iconStyle];
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const { getZoom, fitView } = useReactFlow();
  const [c4Level, setC4Level] = useState<C4Level | 'all'>('all');
  // When the user clicks a parent node, we filter to its direct children.
  // drillParent stores the parent id; null means no drill is active.
  const [drillParent, setDrillParent] = useState<string | null>(null);
  const [drillParentName, setDrillParentName] = useState<string>('');

  // Architecture nodes can declare a C4 level; collect the unique set so the
  // switcher only offers levels actually present.
  const availableC4Levels = useMemo<C4Level[]>(() => {
    if (!parsedDiagram || diagramMode === 'flow') return [];
    const set = new Set<C4Level>();
    parsedDiagram.nodes.forEach(n => {
      if (n.type === 'service' || n.type === 'cloud' || n.type === 'class') {
        const lvl = (n as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.level;
        if (lvl) set.add(lvl);
      }
    });
    return Array.from(set);
  }, [parsedDiagram, diagramMode]);

  const nodeTypes = diagramMode === 'flow' ? flowNodeTypes : architectureNodeTypes;
  const stepNumbers = useMemo(() => {
    if (!showStepNumbers || diagramMode !== 'flow' || !parsedDiagram) return NO_STEP_NUMBERS;
    return flowStepNumbers(parsedDiagram);
  }, [showStepNumbers, diagramMode, parsedDiagram]);

  // Layout direction: pulled from DSL `direction:` keyword. Default vertical.
  const layoutDirection = parsedDiagram?.direction ?? 'TB';
  const isLR = layoutDirection === 'LR';
  // Stable props applied to every React Flow node — drives default edge
  // curvature anchors. Memoized so `initialNodes` doesn't re-derive on every
  // render (which would loop with the setNodes effect below).
  const directionalNodeProps = useMemo(
    () => (isLR
      ? { sourcePosition: Position.Right, targetPosition: Position.Left }
      : { sourcePosition: Position.Bottom, targetPosition: Position.Top }),
    [isLR],
  );

  // Persist a group resize (from NodeResizer) into the DSL.
  const onGroupResize = useCallback((groupId: string, x: number, y: number, w: number, h: number) => {
    if (!parsedDiagram) return;
    const group = parsedDiagram.groups?.find(g => g.id === groupId);
    if (!group) return;
    const next = setGroupPin(dslText, group.name, x, y, w, h);
    if (next === dslText) return;
    setDslText(next);
    try {
      setParsedDiagram(parseDiagram(next));
    } catch (err) {
      console.error('Resize parse error:', err);
    }
  }, [parsedDiagram, dslText, setDslText, setParsedDiagram]);

  const initialNodes = useMemo((): Node[] => {
    if (!parsedDiagram) {
      console.log('❌ No parsed diagram');
      return [];
    }

    console.log('✅ Parsed diagram:', parsedDiagram);
    console.log('📊 Mode:', diagramMode);
    console.log('📦 Nodes:', parsedDiagram.nodes.length);
    console.log('🔗 Edges:', parsedDiagram.edges.length);

    if (diagramMode === 'flow') {
      const lanes = parsedDiagram.lanes ?? [];
      const hasLanes = lanes.length > 0;

      // Annotation sticky notes float on top of the canvas and never participate
      // in the autolayout pass. We render them after the graph so the user can
      // drag them to taste without disturbing the layout below.
      const annotationNodes: Node[] = parsedDiagram.nodes
        .filter((n): n is AnnotationNodeType => n.type === 'annotation')
        .map((a, i) => ({
          id: a.id,
          type: 'annotation',
          position: { x: a.properties.x ?? 40, y: a.properties.y ?? 80 + i * 90 },
          data: {
            label: a.name,
            text: a.properties.text,
            color: a.properties.color,
          },
        }));

      const flowNodeFor = (node: typeof parsedDiagram.nodes[0]): { type: string; data: Record<string, unknown> } => {
        let nodeType = 'flow';
        const flowNode = node as FlowNode;
        const kind = flowNode.properties?.nodeType;
        if (flowNode.isStart && !kind) nodeType = 'start';
        else if (flowNode.isEnd && !kind) nodeType = 'end';
        else if (kind === 'decision') nodeType = 'decision';
        else if (kind === 'data') nodeType = 'data';
        else if (kind === 'document') nodeType = 'document';
        else if (kind === 'manualinput') nodeType = 'manualinput';
        else if (kind === 'terminator') nodeType = 'terminator';
        else if (kind === 'gatewayexclusive') nodeType = 'gatewayexclusive';
        else if (kind === 'gatewayparallel') nodeType = 'gatewayparallel';
        else if (kind === 'gatewayinclusive') nodeType = 'gatewayinclusive';
        else if (kind === 'eventstart') nodeType = 'eventstart';
        else if (kind === 'eventend') nodeType = 'eventend';
        else if (kind === 'eventtimer') nodeType = 'eventtimer';
        else if (kind === 'eventmessage') nodeType = 'eventmessage';
        else if (kind === 'subprocesscollapsed') nodeType = 'subprocesscollapsed';
        else if (kind === 'subprocessexpanded') nodeType = 'subprocessexpanded';

        return {
          type: nodeType,
          data: {
            label: node.name,
            ...node.properties,
            isStart: flowNode.isStart || false,
            isEnd: flowNode.isEnd || false,
          },
        };
      };

      if (hasLanes) {
        // Lane-based layout: each lane is a horizontal strip; nodes within a
        // lane are placed left-to-right by appearance order.
        const laneIndex = new Map<string, number>();
        lanes.forEach((l, i) => laneIndex.set(l.id, i));

        const perLaneCounter = new Map<string, number>();
        const orphanCounter = { v: 0 };
        const totalLanes = lanes.length;

        // Compute total width by max lane occupancy
        const occupancy = new Map<string, number>();
        parsedDiagram.nodes.forEach(n => {
          if (n.type === 'annotation') return;
          const flowN = n as FlowNode;
          const lid = flowN.properties?.lane;
          if (lid && laneIndex.has(lid)) {
            occupancy.set(lid, (occupancy.get(lid) ?? 0) + 1);
          }
        });
        const maxLaneCount = Math.max(1, ...Array.from(occupancy.values()));
        const totalWidth = LANE_HEADER_W + 80 + maxLaneCount * LANE_NODE_X_STEP;

        // Lane band nodes (zIndex behind real nodes). Lanes without an
        // explicit color cycle through the brand palette so every band
        // reads as a distinct role (Figma swimlane style).
        const LANE_FALLBACKS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899'];
        const laneBandNodes: Node[] = lanes.map((lane, i) => ({
          id: `__lane_${lane.id}`,
          type: 'swimlane',
          position: { x: 0, y: i * LANE_HEIGHT + 40 },
          data: {
            label: lane.name,
            color: lane.color || LANE_FALLBACKS[i % LANE_FALLBACKS.length],
            isFirst: i === 0,
            isLast: i === lanes.length - 1,
            width: totalWidth,
            height: LANE_HEIGHT,
          },
          draggable: false,
          selectable: false,
          zIndex: -1,
          style: { zIndex: -1 },
        }));

        const flowReactNodes: Node[] = parsedDiagram.nodes
          .filter(n => n.type !== 'annotation')
          .map(node => {
            const { type, data } = flowNodeFor(node);
            const flowN = node as FlowNode;
            const lid = flowN.properties?.lane;
            let row = 0;
            let col = 0;

            if (lid && laneIndex.has(lid)) {
              row = laneIndex.get(lid)!;
              col = perLaneCounter.get(lid) ?? 0;
              perLaneCounter.set(lid, col + 1);
            } else {
              // Place orphans in a virtual row below all lanes
              row = totalLanes;
              col = orphanCounter.v++;
            }

            const lanePin = parsedDiagram.pins?.[node.id];
            return {
              id: node.id,
              type,
              position: lanePin ?? {
                x: LANE_NODE_X_START + col * LANE_NODE_X_STEP,
                y: row * LANE_HEIGHT + 40 + (LANE_HEIGHT / 2 - 35),
              },
              data,
              // Lanes are intrinsically left→right, so always anchor edges
              // horizontally regardless of the global direction setting.
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            };
          });

        return [...laneBandNodes, ...flowReactNodes, ...annotationNodes];
      }

      // No lanes: stack along the active layout axis.
      // TB → vertical column; LR → horizontal row.
      let yOffset = 100;
      let xOffset = 100;
      const flowReactNodes = parsedDiagram.nodes
        .filter(n => n.type !== 'annotation')
        .map((node) => {
          const { type, data } = flowNodeFor(node);
          const pin = parsedDiagram.pins?.[node.id];
          let x: number;
          let y: number;
          if (pin) {
            x = pin.x;
            y = pin.y;
          } else if (isLR) {
            x = xOffset;
            y = 220;
            xOffset += 220;
          } else {
            x = 400;
            y = yOffset;
            yOffset += 120;
          }
          return {
            id: node.id,
            type,
            position: { x, y },
            data,
            ...directionalNodeProps,
          };
        });
      return [...flowReactNodes, ...annotationNodes];
    } else {
      // Architecture mode - apply C4 level filter and (optional) drill-down filter,
      // then auto-layout the visible subset.
      const visibleNodes = parsedDiagram.nodes.filter((node) => {
        // Annotations are overlays — they're never hidden by drill-down or C4 filtering.
        if (node.type === 'annotation') return true;
        // Drill-down: when a parent is selected, show only its direct children.
        if (drillParent) {
          if (node.type === 'service' || node.type === 'cloud' || node.type === 'class') {
            const parent = (node as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.parent;
            return parent === drillParent;
          }
          // database/queue: only include if connected to a visible child (resolved below)
          return false;
        }
        if (c4Level === 'all') return true;
        if (node.type === 'service' || node.type === 'cloud' || node.type === 'class') {
          const lvl = (node as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.level;
          // Untyped nodes are visible at every level (act as scaffolding)
          if (!lvl) return true;
          return lvl === c4Level;
        }
        return true; // database/queue: always visible
      });
      const visibleIds = new Set(visibleNodes.map(n => n.id));
      const visibleEdges = parsedDiagram.edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

      // Autolayout only runs on graph nodes — annotations sit outside the
      // graph and either honour their DSL `at:` coordinates or keep their
      // current canvas position.
      const graphNodesForLayout = visibleNodes.filter(n => n.type !== 'annotation');
      let positions = calculateAutoLayout(graphNodesForLayout, visibleEdges, layoutDirection);

      // Pinned `at:` coordinates override auto-layout for those nodes.
      const pins = parsedDiagram.pins;
      if (pins) {
        for (const [id, p] of Object.entries(pins)) positions.set(id, p);
      }

      // If sub-system grouping containers exist, push overlapping groups apart
      // so their bounding boxes don't cross — but only when nothing is pinned
      // (pins are authoritative, so we never shift them).
      const groupsForLayout = parsedDiagram.groups ?? [];
      if (groupsForLayout.length >= 2 && !pins) {
        positions = resolveGroupOverlaps(
          positions,
          groupsForLayout,
          visibleIds,
          layoutDirection,
        );
      }

      // Find an empty corner of the canvas for annotations that don't declare
      // explicit coordinates — this keeps them out of the way of the layout
      // and lets the user drag them to taste.
      const ANNOTATION_DEFAULT_X = 60;
      const ANNOTATION_DEFAULT_Y_STEP = 90;
      let annotationCursor = 60;

      const archNodes: Node[] = visibleNodes.map((node) => {
        if (node.type === 'annotation') {
          const a = node as AnnotationNodeType;
          const x = a.properties.x ?? ANNOTATION_DEFAULT_X;
          const y = a.properties.y ?? annotationCursor;
          annotationCursor += ANNOTATION_DEFAULT_Y_STEP;
          return {
            id: node.id,
            type: 'annotation',
            position: { x, y },
            data: {
              label: node.name,
              text: a.properties.text,
              color: a.properties.color,
            },
          };
        }
        // Pinned `at:` coordinates win over auto-layout.
        const pos = parsedDiagram.pins?.[node.id] ?? positions.get(node.id) ?? { x: 100, y: 100 };

        return {
          id: node.id,
          type: node.type,
          position: pos,
          data: {
            label: node.name,
            ...node.properties,
          },
          ...directionalNodeProps,
        };
      });

      // Sub-system grouping containers: dashed rectangles drawn behind any
      // declared `group` blocks. Bounding box is computed from the actual
      // post-layout positions of the contained nodes, then padded.
      const groupNodes: Node[] = [];
      const groups = parsedDiagram.groups ?? [];
      if (groups.length > 0) {
        // Approximate rendered node footprint — used to expand each member's
        // anchor point into a rectangle for the bounding-box union.
        const NODE_W = 200;
        const NODE_H = 100;
        const PADDING = 30;
        const HEADER = 28; // extra top space so the label badge has room

        groups.forEach((g) => {
          const memberIds = g.contains.filter((id) => visibleIds.has(id));
          if (memberIds.length === 0) return;

          // Pinned geometry (`at:` + `size:`) wins; otherwise compute the
          // bounding box from member positions and pad it.
          let gx: number, gy: number, gw: number, gh: number;
          if (g.x != null && g.y != null && g.width != null && g.height != null) {
            gx = g.x; gy = g.y; gw = g.width; gh = g.height;
          } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            memberIds.forEach((id) => {
              const p = positions.get(id);
              if (!p) return;
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x + NODE_W);
              maxY = Math.max(maxY, p.y + NODE_H);
            });
            if (!isFinite(minX)) return;
            gx = minX - PADDING;
            gy = minY - PADDING - HEADER;
            gw = maxX - minX + PADDING * 2;
            gh = maxY - minY + PADDING * 2 + HEADER;
          }

          groupNodes.push({
            id: `__group_${g.id}`,
            type: 'groupcontainer',
            position: { x: gx, y: gy },
            data: {
              label: g.label ?? g.name,
              width: gw,
              height: gh,
              color: g.color,
              groupId: g.id,
              onResize: onGroupResize,
              // Pre-bake the member id list so the drag-follow handler
              // (handleNodesChange below) can move them all in one batch.
              memberIds: g.contains.filter((id) => visibleIds.has(id)),
            },
            // Draggable + selectable so users can manually reposition a
            // sub-system region after auto-layout. zIndex stays negative so
            // the dashed rect paints behind the actual component nodes.
            draggable: true,
            selectable: true,
            zIndex: -1,
            style: { zIndex: -1 },
          });
        });
      }

      // Render groups first so they sit behind the actual component nodes.
      return [...groupNodes, ...archNodes];
    }
  }, [parsedDiagram, diagramMode, c4Level, drillParent, layoutDirection, isLR, directionalNodeProps, onGroupResize]);

  const architectureRouting = useMemo(
    () => computeArchitectureRouting(diagramMode, parsedDiagram?.edges ?? [], initialNodes),
    [diagramMode, parsedDiagram, initialNodes],
  );

  const routedNodes = useMemo((): Node[] => {
    if (diagramMode === 'flow' || architectureRouting.nodeSlots.size === 0) {
      return initialNodes;
    }

    return initialNodes.map((node) => {
      const connectionHandles = architectureRouting.nodeSlots.get(node.id);
      if (!connectionHandles) return node;
      return {
        ...node,
        data: {
          ...node.data,
          connectionHandles,
        },
      };
    });
  }, [diagramMode, initialNodes, architectureRouting]);

  const initialEdges = useMemo((): ReactFlowEdge[] => {
    if (!parsedDiagram) return [];
    // DT-AI-25: lanes are left→right even when the board direction is TB.
    const flowAxis: 'TB' | 'LR' = (parsedDiagram.lanes?.length ?? 0) > 0 || isLR ? 'LR' : 'TB';
    const nodePos = new Map(initialNodes.map(node => [node.id, node.position]));

    const getEdgeColor = (mode: string) => {
      // Neutral grey connectors (per the Diagram Kit reference) so the
      // coloured nodes, cylinders and groups carry the meaning.
      if (mode === 'flow') return '#64748b';
      return '#94a3b8';
    };

    const edgeColor = getEdgeColor(diagramMode);

    // Filter edges by C4 level / drill-down so they don't dangle when nodes are hidden.
    let edges = parsedDiagram.edges;
    // Annotation nodes are sticky notes — they don't participate in edges at all,
    // so any edge that happens to mention an annotation id is dropped.
    const annotationIds = new Set(
      parsedDiagram.nodes.filter(n => n.type === 'annotation').map(n => n.id)
    );
    if (annotationIds.size > 0) {
      edges = edges.filter(e => !annotationIds.has(e.from) && !annotationIds.has(e.to));
    }
    if (diagramMode !== 'flow' && (c4Level !== 'all' || drillParent)) {
      const visibleIds = new Set(
        parsedDiagram.nodes
          .filter(n => {
            if (n.type === 'annotation') return true;
            if (drillParent) {
              if (n.type === 'service' || n.type === 'cloud' || n.type === 'class') {
                return (n as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.parent === drillParent;
              }
              return false;
            }
            if (n.type === 'service' || n.type === 'cloud' || n.type === 'class') {
              const lvl = (n as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.level;
              return !lvl || lvl === c4Level;
            }
            return true;
          })
          .map(n => n.id)
      );
      edges = edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
    }

    // Translate the DSL edge-style keyword into React Flow's built-in edge
    // types. Flow mode defaults to rounded orthogonal connectors (the
    // standard flowchart look); architecture honours the keyword.
    const edgeStyle = parsedDiagram.edgeStyle ?? (diagramMode === 'flow' ? 'orthogonal' : 'curved');
    const rfEdgeType: string | undefined =
      edgeStyle === 'orthogonal' ? 'smoothstep' :
      edgeStyle === 'step' ? 'step' :
      edgeStyle === 'straight' ? 'straight' :
      undefined; // 'curved' uses React Flow's default bezier

// In flow mode, branch edges take on a semantic colour from their label:
  // positive paths (yes / </approve) go green, negative (no / ≥/reject) red,
  // everything else stays neutral — matching the reference workflow.
  const branchColor = (label?: string): string | null => {
    if (diagramMode !== 'flow' || !label) return null;
    const l = label.toLowerCase();
    if (/\b(yes|approve|approved|accept|ok|success|pass|valid|low)\b/.test(l) || l.includes('<')) return '#16a34a';
    if (/\b(no|reject|rejected|deny|denied|fail|failed|invalid|high)\b/.test(l) || l.includes('≥') || l.includes('>=') || l.includes('>')) return '#dc2626';
    return null;
  };

    return edges.map((edge) => {
      const branch = branchColor(edge.label);
      const stroke = edge.color ?? branch ?? edgeColor;
      const route = architectureRouting.edgeRoutes.get(edge.id);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        sourceHandle: route?.sourceHandle,
        targetHandle: route?.targetHandle,
        label: edge.label,
        animated: false,
        type: rfEdgeType,
        ...(rfEdgeType === 'smoothstep' ? { pathOptions: { borderRadius: 14 } } : {}),
        style: {
          stroke,
          strokeWidth: diagramMode === 'flow' ? 1.8 : 2,
        },
        labelClassName: 'flow-edge-label',
        labelStyle: {
          fill: branch ?? '#1E293B',
          fontWeight: 700,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
        },
        labelBgStyle: {
          fill: branch ? `color-mix(in srgb, ${branch} 12%, white)` : '#FDFDFD',
          fillOpacity: 0.97,
          stroke,
          strokeOpacity: 0.4,
          strokeWidth: 1,
        },
        labelBgPadding: [6, 8] as [number, number],
        labelBgBorderRadius: 6,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stroke,
        },
      };
    }).map(edge => {
      if (diagramMode !== 'flow' || iconStyle === 'clean') return edge;
      const tokens = flowTokens;
      const base = edge as {
        id: string;
        style?: { stroke?: string };
        label?: string;
      };
      const dslStroke = parsedDiagram.edges.find(item => item.id === base.id)?.color;
      const stroke = dslStroke || tokens.edge.color;
      return {
        ...edge,
        type: tokens.edge.route === 'step' ? 'step' : tokens.edge.route === 'smoothstep' ? 'smoothstep' : edge.type,
        style: {
          stroke,
          strokeWidth: tokens.edge.width,
          ...(tokens.edge.dash ? { strokeDasharray: tokens.edge.dash } : {}),
        },
        labelStyle: {
          fill: tokens.edge.labelColor,
          fontWeight: 700,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
        },
        labelBgStyle: {
          fill: tokens.edge.labelBg,
          fillOpacity: 0.97,
          stroke,
          strokeOpacity: 0.35,
          strokeWidth: 1,
        },
        labelBgPadding: [6, 8] as [number, number],
        labelBgBorderRadius: 999,
        markerEnd: {
          type: tokens.edge.marker === 'open' ? MarkerType.Arrow : MarkerType.ArrowClosed,
          color: stroke,
        },
      };
    }).map(edge => {
      if (diagramMode !== 'flow') return edge;
      if (!isUpstreamEdge(nodePos.get(edge.source), nodePos.get(edge.target), flowAxis)) return edge;
      return {
        ...edge,
        type: 'loop',
        data: { loop: true, axis: flowAxis },
      };
    });
  }, [parsedDiagram, diagramMode, c4Level, drillParent, architectureRouting, iconStyle, flowTokens, initialNodes, isLR]);

  const [nodes, setNodes, onNodesChange] = useNodesState(routedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const draggingNodeIds = useRef(new Set<string>());

  // Alignment guides shown while dragging a node.
  const [helperLines, setHelperLines] = useState<HelperLineResult>({});

  // DT-AI-14: read-only walk-through. Step order comes straight from the
  // Copy as steps serializer (flowStepList is the same ordered list that
  // flowToPlainSteps renders), so the two never disagree. Purely view state —
  // nodes, edges, positions, DSL and undo history are untouched.
  const walkThroughStep = useDiagramStore(s => s.walkThroughStep);
  const walkThroughStack = useDiagramStore(s => s.walkThroughStack);
  const setWalkThroughStep = useDiagramStore(s => s.setWalkThroughStep);
  const pushWalkThroughStep = useDiagramStore(s => s.pushWalkThroughStep);
  const popWalkThroughStep = useDiagramStore(s => s.popWalkThroughStep);
  const exitWalkThrough = useDiagramStore(s => s.exitWalkThrough);

  const walkSteps = useMemo((): FlowStep[] => {
    if (diagramMode !== 'flow' || !parsedDiagram) return [];
    try {
      return flowStepList(parsedDiagram);
    } catch {
      return [];
    }
  }, [diagramMode, parsedDiagram]);

  const walkActive = walkThroughStep !== null && walkSteps.length > 0;
  const walkIndex = walkActive ? Math.min(walkThroughStep!, walkSteps.length - 1) : 0;
  const currentWalkStep = walkActive ? walkSteps[walkIndex] : null;
  const walkCurrentId = currentWalkStep?.id ?? null;
  const currentWalkNode = currentWalkStep && parsedDiagram
    ? parsedDiagram.nodes.find(n => n.id === currentWalkStep.id)
    : null;
  const walkLabel = currentWalkNode && currentWalkNode.type === 'flow'
    ? (currentWalkNode.properties.label || currentWalkNode.name || currentWalkNode.id).trim() || currentWalkNode.id
    : currentWalkStep?.line ?? '';
  const walkRole = currentWalkNode && currentWalkNode.type === 'flow'
    ? currentWalkNode.properties.role
    : undefined;
  const walkNote = currentWalkNode && currentWalkNode.type === 'flow'
    ? currentWalkNode.properties.note?.trim() || undefined
    : undefined;

  // DT-AI-18 — fork / arrived-by caption lines, read-only views of edges that
  // are already on the board. Nothing is written back to the store or DSL.
  const flowLabelOf = (id: string): string => {
    const n = parsedDiagram?.nodes.find(n => n.id === id);
    return n && n.type === 'flow'
      ? (n.properties.label || n.name || n.id).trim() || n.id
      : n?.name ?? id;
  };
  const walkOutgoing = walkCurrentId && parsedDiagram
    ? parsedDiagram.edges.filter(e => e.from === walkCurrentId)
    : [];
  // DT-AI-26: a parallel fork's caption reads "in parallel" (the diamond label
  // may differ on a hand-drawn board). A join has one outgoing edge and keeps
  // its own label.
  const walkCaption = currentWalkNode?.type === 'flow'
    && currentWalkNode.properties.nodeType === 'gatewayparallel'
    && walkOutgoing.length >= 2
    ? 'in parallel'
    : walkLabel;
  const walkIncoming = walkCurrentId && parsedDiagram
    ? parsedDiagram.edges.filter(e => e.to === walkCurrentId)
    : [];

  // Fork line: a step with 2+ outgoing edges lists them as `<label> → <target>`,
  // in board edge order, capped at 3 with a `+N more` tail.
  const MAX_FORK_PATHS = 3;
  let walkPaths: string | undefined;
  if (walkOutgoing.length >= 2) {
    const parts = walkOutgoing.slice(0, MAX_FORK_PATHS).map(e => {
      const label = e.label?.trim();
      const target = flowLabelOf(e.to);
      return label ? `${label} → ${target}` : `→ ${target}`;
    });
    if (walkOutgoing.length > MAX_FORK_PATHS) {
      parts.push(`+${walkOutgoing.length - MAX_FORK_PATHS} more`);
    }
    walkPaths = parts.join(' · ');
  }

  // Arrived-by line: shown only when the single incoming edge is labelled and
  // comes from a step that itself has 2+ outgoing edges.
  let walkArrivedBy: string | undefined;
  if (walkIncoming.length === 1) {
    const edge = walkIncoming[0];
    const label = edge.label?.trim();
    const sourceOutgoing = parsedDiagram
      ? parsedDiagram.edges.filter(e => e.from === edge.from).length
      : 0;
    if (label && sourceOutgoing >= 2) {
      walkArrivedBy = `If “${flowLabelOf(edge.from)}”: ${label}`;
    }
  }

  // DT-AI-19 — choose controls: one button per outgoing edge, in board edge
  // order, mirroring the fork line's label rule (`label` or `→ <target>`).
  // The jump target is the edge target node's index in walkSteps — the same
  // walk-order index Prev/Next move through. Read-only: nothing is edited.
  // A parallel branch is drawn on the board but folded into the fork's one
  // Copy-as-steps line, so it has no walk index of its own. Follow its single
  // outgoing edge (the join, then the next step) so Choose still moves.
  const walkIndexOf = (targetId: string): number => {
    const direct = walkSteps.findIndex(s => s.id === targetId);
    if (direct >= 0 || !parsedDiagram) return direct;
    const seen = new Set<string>();
    let current = targetId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const idx = walkSteps.findIndex(s => s.id === current);
      if (idx >= 0) return idx;
      const outs = parsedDiagram.edges.filter(e => e.from === current);
      if (outs.length !== 1) return -1;
      current = outs[0].to;
    }
    return -1;
  };
  const walkChoices = walkOutgoing.length >= 2
    ? walkOutgoing.map(e => {
        const label = e.label?.trim();
        const text = label || `→ ${flowLabelOf(e.to)}`;
        return { label: text, index: walkIndexOf(e.to) };
      })
    : undefined;

  // DT-AI-20 — path highlights, derived read-only from the session state. The
  // session path is the start step, every index pushed onto the stack (Next /
  // Choose), then the current step; Prev pops, so the path follows the route
  // actually taken. A hop is a board edge only when one exists from the hop's
  // source to its target — so fork arms the walk never took stay untouched.
  const walkSessionPath = useMemo((): number[] => {
    if (!walkActive) return [];
    return [0, ...walkThroughStack, walkIndex];
  }, [walkActive, walkThroughStack, walkIndex]);

  const walkHopEdgeId = useCallback((fromIdx: number, toIdx: number): string | null => {
    const from = walkSteps[fromIdx]?.id;
    const to = walkSteps[toIdx]?.id;
    if (!from || !to || !parsedDiagram) return null;
    return parsedDiagram.edges.find(e => e.from === from && e.to === to)?.id ?? null;
  }, [walkSteps, parsedDiagram]);

  // Trail: every hop before the last one, softly highlighted for the session.
  const walkTrailEdgeIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    if (!walkActive) return ids;
    for (let i = 0; i < walkSessionPath.length - 2; i++) {
      const id = walkHopEdgeId(walkSessionPath[i], walkSessionPath[i + 1]);
      if (id) ids.add(id);
    }
    return ids;
  }, [walkActive, walkSessionPath, walkHopEdgeId]);

  // Active: the arrived-by edge of the current step (the session's last hop).
  const walkActiveEdgeId = useMemo((): string | null => {
    if (!walkActive || walkSessionPath.length < 2) return null;
    return walkHopEdgeId(
      walkSessionPath[walkSessionPath.length - 2],
      walkSessionPath[walkSessionPath.length - 1],
    );
  }, [walkActive, walkSessionPath, walkHopEdgeId]);

  // DT-AI-21 — trail nodes: unique node ids visited on the session path so
  // far (same stack/hops that feed walk-through-edge-trail), excluding the
  // current step. Mid opacity keeps walked labels readable while untaken
  // arms stay heavily dimmed.
  const walkTrailNodeIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    if (!walkActive) return ids;
    for (const stepIdx of walkSessionPath) {
      const id = walkSteps[stepIdx]?.id;
      if (id && id !== walkCurrentId) ids.add(id);
    }
    return ids;
  }, [walkActive, walkSessionPath, walkSteps, walkCurrentId]);

  // DT-AI-22 — Copy path text: one numbered line per session-path hop in walk
  // order (start · stack · current, consecutive duplicates collapsed), using
  // the caption's label rule. When a hop arrives via a labelled edge from a
  // fork (2+ outgoing edges on the source), the branch label is appended as
  // ` (label)`; untaken arms never appear.
  const walkCopyPathText = useMemo((): string | undefined => {
    if (!walkActive || !parsedDiagram) return undefined;
    const kept: number[] = [];
    let prevIdx = -1;
    for (const idx of walkSessionPath) {
      if (idx === prevIdx) continue;
      kept.push(idx);
      prevIdx = idx;
    }
    if (kept.length === 0) return undefined;
    // Same label rule as the caption's flowLabelOf (parsedDiagram is in deps).
    const labelOf = (id: string): string => {
      const n = parsedDiagram?.nodes.find(x => x.id === id);
      return n && n.type === 'flow' ? (n.properties.label || n.name || n.id).trim() || n.id : n?.name ?? id;
    };
    const sourceOutgoing = new Map<string, number>();
    for (const e of parsedDiagram.edges) sourceOutgoing.set(e.from, (sourceOutgoing.get(e.from) ?? 0) + 1);
    const lines: string[] = [];
    for (let i = 0; i < kept.length; i++) {
      const node = walkSteps[kept[i]];
      if (!node) return undefined;
      let text = labelOf(node.id);
      if (i > 0) {
        const edge = parsedDiagram.edges.find(e => e.from === walkSteps[kept[i - 1]].id && e.to === node.id);
        const label = edge?.label?.trim();
        if (edge && label && (sourceOutgoing.get(edge.from) ?? 0) >= 2) text = `${text} (${label})`;
      }
      lines.push(`${i + 1}. ${text}`);
    }
    return lines.join('\n');
  }, [walkActive, parsedDiagram, walkSessionPath, walkSteps]);

  // Guard: board emptied or mode switched while active → leave walk-through;
  // board shrank → clamp to the last step instead of showing a blank caption.
  useEffect(() => {
    if (walkThroughStep === null) return;
    if (walkSteps.length === 0) exitWalkThrough();
    else if (walkThroughStep >= walkSteps.length) setWalkThroughStep(walkSteps.length - 1);
  }, [walkThroughStep, walkSteps, exitWalkThrough, setWalkThroughStep]);

  // Keep the current step in view (pan/fit) on large boards.
  useEffect(() => {
    if (!walkCurrentId) return;
    fitView({ nodes: [{ id: walkCurrentId }], padding: 0.8, maxZoom: 1, duration: 300 });
  }, [walkCurrentId, fitView]);

  // View-only dimming (DT-AI-21): three opacity tiers while walk-through is
  // on — current = 1, session-path trail = mid readable, everything else =
  // heavy dim. Never written back to state.
  const displayNodes = useMemo((): Node[] => {
    if (!walkActive) return nodes;
    return nodes.map(n => {
      const isCurrent = n.id === walkCurrentId;
      const isTrail = walkTrailNodeIds.has(n.id);
      return {
        ...n,
        className: isTrail ? 'walk-through-node-trail' : n.className,
        style: {
          ...n.style,
          opacity: isCurrent ? 1 : isTrail ? WALK_TRAIL_NODE_OPACITY : 0.15,
          ...(isCurrent ? { boxShadow: `0 0 0 3px ${flowTokens.walk.highlight}`, borderRadius: 10 } : {}),
        },
      };
    });
  }, [nodes, walkActive, walkCurrentId, walkTrailNodeIds, flowTokens]);

  // View-only dimming: everything except the current step fades. Edges on the
  // path the human took are emphasized — the arrived-by edge of the current
  // step is active (indigo, matching the choose buttons), earlier hops keep a
  // softer trail. Never written back to state.
  const displayEdges = useMemo((): ReactFlowEdge[] => {
    if (!walkActive) return edges;
    return edges.map(e => {
      if (e.id === walkActiveEdgeId) {
        return {
          ...e,
          className: 'walk-through-edge-active',
          style: { ...e.style, strokeWidth: 3, stroke: flowTokens.walk.highlight },
          zIndex: 5,
        };
      }
      if (walkTrailEdgeIds.has(e.id)) {
        return {
          ...e,
          className: 'walk-through-edge-trail',
          style: { ...e.style, strokeWidth: 2.4, stroke: flowTokens.walk.trail },
          zIndex: 4,
        };
      }
      return {
        ...e,
        style: { ...e.style, opacity: 0.12 },
        labelStyle: { ...e.labelStyle, opacity: 0.12 },
        labelBgStyle: { ...e.labelBgStyle, opacity: 0.12 },
      };
    });
  }, [edges, walkActive, walkActiveEdgeId, walkTrailEdgeIds, flowTokens]);


  const persistCanvasPositions = useCallback((
    positions: Map<string, { x: number; y: number }>,
    group?: { name: string; x: number; y: number; w: number; h: number },
  ) => {
    if (!parsedDiagram) return;
    const next = applyCanvasPins(dslText, parsedDiagram.nodes, positions, {
      mode: diagramMode === 'flow' ? 'flow' : 'architecture',
      mermaidFlow: isMermaidFlow(dslText),
      group,
    });
    if (next === dslText) return;
    setDslText(next);
    try {
      setParsedDiagram(parseDiagram(next));
    } catch (err) {
      console.error('Pin parse error:', err);
    }
  }, [parsedDiagram, dslText, diagramMode, setDslText, setParsedDiagram]);

  // Drag-follow for group containers: when a `__group_*` node moves, apply
  // the same delta to its member nodes in the same change batch so the
  // dashed rectangle and the components inside it travel together.
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      // Alignment guides: a single dragged node snaps to other nodes'
      // edges/centers; the guide lines render via ViewportPortal below.
      if (
        changes.length === 1 &&
        changes[0].type === 'position' &&
        changes[0].position &&
        changes[0].dragging &&
        !changes[0].id.startsWith('__')
      ) {
        const c = changes[0];
        const guides = getHelperLines(c.id, c.position!, nodes);
        if (guides.snapX !== undefined) c.position!.x = guides.snapX;
        if (guides.snapY !== undefined) c.position!.y = guides.snapY;
        setHelperLines(guides);
      } else {
        setHelperLines(prev => (prev.horizontal !== undefined || prev.vertical !== undefined ? {} : prev));
      }

      const extra: typeof changes = [];
      for (const c of changes) {
        if (
          c.type === 'position' &&
          c.position &&
          typeof c.id === 'string' &&
          c.id.startsWith('__group_')
        ) {
          const groupNode = nodes.find(n => n.id === c.id);
          if (!groupNode) continue;
          const memberIds = (groupNode.data as { memberIds?: string[] })?.memberIds;
          if (!memberIds || memberIds.length === 0) continue;

          const dx = c.position.x - groupNode.position.x;
          const dy = c.position.y - groupNode.position.y;
          if (dx === 0 && dy === 0) continue;

          for (const mid of memberIds) {
            const m = nodes.find(n => n.id === mid);
            if (!m) continue;
            extra.push({
              type: 'position',
              id: mid,
              position: { x: m.position.x + dx, y: m.position.y + dy },
              dragging: c.dragging,
            });
          }
        }
      }

      const applied = extra.length > 0 ? [...changes, ...extra] : changes;
      for (const c of applied) {
        if (c.type === 'position' && typeof c.id === 'string') {
          if (c.dragging) draggingNodeIds.current.add(c.id);
          else draggingNodeIds.current.delete(c.id);
        }
      }

      onNodesChange(applied);

      const ended = applied.filter(isEndedDragChange);
      if (ended.length === 0 || !parsedDiagram) return;

      const positions = new Map<string, { x: number; y: number }>();
      for (const n of nodes) positions.set(n.id, n.position);
      for (const c of applied) {
        if (c.type === 'position' && c.position && typeof c.id === 'string') {
          positions.set(c.id, c.position);
        }
      }

      if (diagramMode === 'flow') {
        const dragged = new Map<string, { x: number; y: number }>();
        for (const c of ended) {
          if (!c.id.startsWith('__') && c.position) dragged.set(c.id, c.position);
        }
        if (dragged.size > 0) persistCanvasPositions(dragged);
        return;
      }

      const groupChange = ended.find(c => c.id.startsWith('__group_'));
      let group: { name: string; x: number; y: number; w: number; h: number } | undefined;
      if (groupChange?.position) {
        const gid = groupChange.id.slice('__group_'.length);
        const groupMeta = parsedDiagram.groups?.find(g => g.id === gid);
        const rf = nodes.find(n => n.id === groupChange.id);
        if (groupMeta) {
          const w = Number((rf?.data as { width?: number })?.width) || 200;
          const h = Number((rf?.data as { height?: number })?.height) || 120;
          group = { name: groupMeta.name, x: groupChange.position.x, y: groupChange.position.y, w, h };
        }
      }
      persistCanvasPositions(positions, group);
    },
    [nodes, onNodesChange, parsedDiagram, diagramMode, persistCanvasPositions],
  );

  // Rebuild RF nodes from the parsed source — but not while a drag is in
  // flight, and not on unrelated re-renders. `routedNodes` is a new array
  // every time its memo recomputes, which used to snap dragged nodes back
  // before pin writeback could run.
  const layoutSyncKey = `${diagramMode}\0${dslText}\0${c4Level}\0${drillParent ?? ''}\0${layoutDirection}\0${iconStyle}`;
  useEffect(() => {
    if (draggingNodeIds.current.size > 0) return;
    if (routedNodes.length > 0) {
      setNodes(routedNodes);
      setEdges(initialEdges);
    }
    // routedNodes / initialEdges are produced in the same render as this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSyncKey, setNodes, setEdges]);

  // Reset the C4 level filter and drill-down whenever a new diagram is loaded.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setC4Level('all');
      setDrillParent(null);
      setDrillParentName('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [parsedDiagram]);

  // Double-click a flow node to flip its input/output direction. Useful for
  // "return" paths in an LR diagram where the default left→right flow would
  // double back across the canvas and overlap the incoming edge.
  // The toggle is written back to the DSL (source of truth) and re-parsed.
  // For Mermaid-format flowcharts the toggle rides along as a `%% reverse <id>`
  // comment so it survives the Mermaid→native transpilation round-trip.
  const commitRename = useCallback((nodeId: string, nextName: string) => {
    if (!parsedDiagram) return;
    const meta = parsedDiagram.nodes.find(n => n.id === nodeId);
    if (!meta) return;
    const next = renameNodeInSource(dslText, meta, nextName);
    setRenameDraft(null);
    if (next === dslText) return;
    setDslText(next);
    const result = applyBoardSource(next, diagramMode === 'flow' ? 'flow' : 'architecture');
    if (result.ok) {
      setError(null);
      if (result.kind === 'diagram') setParsedDiagram(result.parsed);
    } else {
      setError(result.error);
    }
  }, [parsedDiagram, dslText, diagramMode, setDslText, setParsedDiagram, setError, setSelectedNode]);

  const onNodeDoubleClick = useCallback((_e: unknown, node: Node) => {
    if (diagramMode !== 'flow' && parsedDiagram) {
      const meta = parsedDiagram.nodes.find(n => n.id === node.id);
      if (meta && meta.type !== 'annotation') {
        setRenameDraft(meta.name);
        setSelectedNode(node.id);
        return;
      }
    }
    if (diagramMode !== 'flow' || !parsedDiagram) return;
    const clicked = parsedDiagram.nodes.find(n => n.id === node.id);
    if (!clicked || clicked.type !== 'flow') return;

    const next = !clicked.properties.reversed;
    // Prefer the Mermaid-aware setter so a Mermaid-format flowchart doesn't
    // have its reverse flag swallowed by the transpiler. Fall back to the
    // native setter if the input is mixed/ambiguous.
    const updated = setReverseMermaidDSL(dslText, clicked.name, next) ??
                    setReverseDSL(dslText, clicked.name, next);
    if (!updated) return;
    setDslText(updated);
    try {
      setParsedDiagram(parseDiagram(updated));
    } catch (err) {
      console.error('Reverse toggle parse error:', err);
    }
  }, [diagramMode, parsedDiagram, dslText, setDslText, setParsedDiagram, setSelectedNode]);

  // Click a parent node to drill into its children at the next C4 level.
  // No-op when there are no children with parent = clicked node id.
  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    if (diagramMode === 'flow' || !parsedDiagram) return;
    const clicked = parsedDiagram.nodes.find(n => n.id === node.id);
    if (!clicked) return;
    if (clicked.type !== 'service' && clicked.type !== 'cloud' && clicked.type !== 'class') return;

    // Find the level of the clicked node's children (all expected at the same next level).
    const children = parsedDiagram.nodes.filter(n => {
      if (n.type !== 'service' && n.type !== 'cloud' && n.type !== 'class') return false;
      return (n as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.parent === clicked.id;
    });
    if (children.length === 0) return; // leaf — no drill possible

    // Determine target level: prefer the children's declared level; otherwise next from clicked.
    let target: C4Level | null = null;
    for (const c of children) {
      const lvl = (c as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.level;
      if (lvl) { target = lvl; break; }
    }
    if (!target) {
      const clickedLvl = (clicked as ServiceNodeType | CloudNodeType | ClassNodeType).properties?.level;
      if (clickedLvl) target = nextC4Level(clickedLvl);
    }
    if (!target) return;

    setC4Level(target);
    setDrillParent(clicked.id);
    setDrillParentName(clicked.name);
  }, [parsedDiagram, diagramMode]);

  // Switching the C4 level via the pill bar exits drill-down.
  const handleLevelChange = useCallback((lvl: C4Level | 'all') => {
    setC4Level(lvl);
    setDrillParent(null);
    setDrillParentName('');
  }, []);

  // Track zoom level changes
  const handleMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    const zoomPercent = Math.round(viewport.zoom * 100);
    setZoomLevel(zoomPercent);
  }, [setZoomLevel]);

  // Update zoom level on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      const zoom = Math.round(getZoom() * 100);
      setZoomLevel(zoom);
    }, 100);
    return () => clearTimeout(timer);
  }, [getZoom, setZoomLevel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F2' || !selectedNodeId || !parsedDiagram) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const meta = parsedDiagram.nodes.find(n => n.id === selectedNodeId);
      if (!meta || meta.type === 'annotation') return;
      event.preventDefault();
      setRenameDraft(meta.name);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeId, parsedDiagram]);

  // Handle node selection for copy/paste
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length === 1) {
      setSelectedNode(selectedNodes[0].id);
    } else {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  // Drag-to-connect: dragging from one node's handle to another writes the
  // connection back into the DSL (the source of truth) and re-parses.
  const onConnect = useCallback((conn: Connection) => {
    if (!parsedDiagram || !conn.source || !conn.target) return;
    if (conn.source === conn.target) return;
    if (conn.source.startsWith('__') || conn.target.startsWith('__')) return; // lanes/groups
    const src = parsedDiagram.nodes.find(n => n.id === conn.source);
    const tgt = parsedDiagram.nodes.find(n => n.id === conn.target);
    if (!src || !tgt) return;
    // Annotation nodes are sticky notes — they don't accept or emit connections.
    if (src.type === 'annotation' || tgt.type === 'annotation') return;

    const next = addConnectionDSL(
      dslText,
      diagramMode === 'flow' ? 'flow' : 'architecture',
      src.name,
      tgt.name,
    );
    if (!next) return; // duplicate or source block not found
    setDslText(next);
    try {
      setParsedDiagram(parseDiagram(next));
    } catch (err) {
      console.error('Connect parse error:', err);
    }
  }, [parsedDiagram, dslText, diagramMode, setDslText, setParsedDiagram]);

  const onNodeDragStart = useCallback((_e: unknown, node: Node) => {
    draggingNodeIds.current.add(node.id);
  }, []);

  // Backup persist for the rare case the change-stream misses dragging:false.
  // handleNodesChange is the primary writeback and no-ops if pins already match.
  const onNodeDragStop = useCallback((_e: unknown, node: Node) => {
    draggingNodeIds.current.delete(node.id);
    if (!parsedDiagram) return;
    const positions = new Map<string, { x: number; y: number }>();
    for (const n of nodes) positions.set(n.id, n.position);
    positions.set(node.id, node.position);

    if (node.id.startsWith('__group_')) {
      const gid = node.id.slice('__group_'.length);
      const group = parsedDiagram.groups?.find(g => g.id === gid);
      if (!group) return;
      const w = Number((node.data as { width?: number }).width) || 200;
      const h = Number((node.data as { height?: number }).height) || 120;
      persistCanvasPositions(positions, { name: group.name, x: node.position.x, y: node.position.y, w, h });
      return;
    }

    const meta = parsedDiagram.nodes.find(n => n.id === node.id);
    if (!meta || meta.type === 'annotation') return;
    if (diagramMode === 'flow') {
      persistCanvasPositions(new Map([[node.id, node.position]]));
      return;
    }
    persistCanvasPositions(positions);
  }, [parsedDiagram, diagramMode, nodes, persistCanvasPositions]);

  if (!parsedDiagram) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas-white">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-lg">Start typing in the editor — your diagram draws itself</div>
        </div>
      </div>
    );
  }

  return (
    <LayoutDirectionContext.Provider value={layoutDirection}>
    <div
      className="w-full h-full overflow-hidden bg-white relative"
      data-canvas-target="primary"
      data-icon-style={diagramMode === 'flow' ? iconStyle : undefined}
      style={diagramMode === 'flow' && iconStyle === 'blueprint' ? { background: flowTokens.pane } : undefined}
    >
      {renameDraft !== null && selectedNodeId && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-indigo-200 bg-white px-3 py-2 shadow-md">
          <input
            autoFocus
            aria-label="Rename node"
            data-testid="canvas-rename-input"
            value={renameDraft}
            onChange={e => setRenameDraft(e.target.value)}
            onBlur={() => commitRename(selectedNodeId, renameDraft)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename(selectedNodeId, renameDraft);
              if (e.key === 'Escape') setRenameDraft(null);
            }}
            className="w-56 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      )}
      <StepNumberContext.Provider value={stepNumbers}>
      <ReactFlow
        style={diagramMode === 'flow' && iconStyle === 'blueprint' ? { background: flowTokens.pane } : undefined}
        nodes={displayNodes}
        edges={displayEdges}
        // DT-AI-14 / DT-SAVE-01: walk-through and shared view are read-only —
        // no dragging, connecting or selection while active.
        nodesDraggable={!walkActive && !isReadOnlyShared}
        nodesConnectable={!walkActive && !isReadOnlyShared}
        elementsSelectable={!walkActive && !isReadOnlyShared}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={flowEdgeTypes}
        snapToGrid
        snapGrid={[10, 10]}
        nodeDragThreshold={0}
        connectionRadius={28}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6 4' }}
        panActivationKeyCode={null}
        fitViewOptions={{ padding: 0.2 }}
        onInit={instance => { instance.fitView({ padding: 0.2 }); }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        {diagramMode === 'flow' && flowTokens.grid ? (
          <Background color={flowTokens.grid.color} gap={flowTokens.grid.gap} variant={BackgroundVariant.Lines} />
        ) : (
          <Background color="#CBD5E1" gap={25} variant={BackgroundVariant.Dots} />
        )}
        {(helperLines.horizontal !== undefined || helperLines.vertical !== undefined) && (
          <ViewportPortal>
            {helperLines.vertical !== undefined && (
              <div
                style={{
                  position: 'absolute',
                  left: helperLines.vertical,
                  top: -50000,
                  width: 1,
                  height: 100000,
                  background: '#f43f5e',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              />
            )}
            {helperLines.horizontal !== undefined && (
              <div
                style={{
                  position: 'absolute',
                  top: helperLines.horizontal,
                  left: -50000,
                  height: 1,
                  width: 100000,
                  background: '#f43f5e',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              />
            )}
          </ViewportPortal>
        )}
        <Controls className="bg-white border border-slate-200 rounded shadow-md" />
        {walkActive && currentWalkStep && (
          <WalkThroughOverlay
            step={walkIndex + 1}
            total={walkSteps.length}
            label={walkCaption}
            role={walkRole}
            note={walkNote}
            arrivedBy={walkArrivedBy}
            paths={walkPaths}
            choices={walkChoices}
            onChoose={index => {
              const choice = walkChoices?.[index];
              if (choice && choice.index >= 0) pushWalkThroughStep(choice.index);
            }}
            pathText={walkCopyPathText}
            onPrev={popWalkThroughStep}
            onNext={() => pushWalkThroughStep(Math.min(walkSteps.length - 1, walkIndex + 1))}
            onExit={exitWalkThrough}
          />
        )}
        <Panel position="bottom-left" className="!m-4 !ml-16">
          <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 p-2">
            <ZoomControls />
          </div>
        </Panel>
        <MiniMap
          className="bg-white border border-slate-200 rounded shadow-md"
          nodeColor={(node) => {
            switch (node.type) {
              case 'service':
                return '#A855F7';
              case 'database':
                return '#EC4899';
              case 'queue':
                return '#10B981';
              case 'cloud':
                return '#FB923C';
              case 'class':
                return '#0F766E';
              case 'data':
              case 'document':
              case 'manualinput':
                return '#3B82F6';
              case 'terminator':
                return '#64748B';
              case 'start':
              case 'eventstart':
                return '#10B981';
              case 'end':
              case 'eventend':
                return '#EF4444';
              case 'decision':
              case 'gatewayexclusive':
              case 'gatewayparallel':
              case 'gatewayinclusive':
                return '#F59E0B';
              case 'eventtimer':
              case 'eventmessage':
                return '#10B981';
              case 'swimlane':
                return 'transparent';
              default:
                return '#8B5CF6';
            }
          }}
          maskColor="rgba(15, 23, 42, 0.08)"
        />
      </ReactFlow>
      </StepNumberContext.Provider>

      {/* DT-AI-20 / DT-AI-21 — path-highlight markers keyed to walk-path
          edge and trail-node ids. Visible emphasis is on the canvas elements
          themselves; these zero-size keyed markers make active/trail edges
          and trail nodes addressable. Present only while walk-through is on. */}
      {walkActive && (
        <svg aria-hidden className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden">
          {walkActiveEdgeId && (
            <g data-testid="walk-through-edge-active" data-edge-id={walkActiveEdgeId} />
          )}
          {Array.from(walkTrailEdgeIds).map(id => (
            <g key={id} data-testid="walk-through-edge-trail" data-edge-id={id} />
          ))}
          {Array.from(walkTrailNodeIds).map(id => (
            <g key={id} data-testid="walk-through-node-trail" data-node-id={id} />
          ))}
        </svg>
      )}

      {/* Shape library palette */}
      {!isReadOnlyShared && <ShapeLibrary />}

      {/* C4 Level Switcher (architecture mode, only when levels are present) */}
      {diagramMode !== 'flow' && (
        <C4LevelSwitcher
          current={c4Level}
          available={availableC4Levels}
          onChange={handleLevelChange}
        />
      )}

      {/* Color-coded role legend at the top of the canvas. Mirrors the
          chip strip from the Diagram Kit reference — process / service /
          data / decision. Architecture mode only. */}
      {diagramMode !== 'flow' && <ColorLegend />}
      {diagramMode === 'flow' && <FlowStyleLegend />}

      {/* Drill-down breadcrumb (architecture mode, only when drilled in) */}
      {diagramMode !== 'flow' && drillParent && (
        <div className="absolute top-16 right-4 z-10 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => { setDrillParent(null); setDrillParentName(''); setC4Level('all'); }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            title="Exit drill-down"
          >
            ← All
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-900">{drillParentName}</span>
        </div>
      )}
    </div>
    </LayoutDirectionContext.Provider>
  );
}

export function DiagramCanvas() {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInternal />
    </ReactFlowProvider>
  );
}
