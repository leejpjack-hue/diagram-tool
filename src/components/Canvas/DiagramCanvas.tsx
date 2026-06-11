import { useMemo, useEffect, useCallback, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, ReactFlowProvider, useReactFlow, BackgroundVariant, ViewportPortal } from '@xyflow/react';
import type { Node, Edge, Viewport, Connection } from '@xyflow/react';
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
import { C4LevelSwitcher } from './C4LevelSwitcher';
import { ZoomControls } from './ZoomControls';
import { ShapeLibrary } from '../Panel/ShapeLibrary';
import { useDiagramStore } from '../../store/diagramStore';
import type { FlowNode, C4Level, ServiceNode as ServiceNodeType, CloudNode as CloudNodeType, ClassNode as ClassNodeType } from '../../store/types';
import { calculateAutoLayout, resolveGroupOverlaps } from '../../utils/autoLayout';
import { addConnectionDSL } from '../../utils/connectDSL';
import { parseDiagram } from '../../parser/parser';
import { getHelperLines, type HelperLineResult } from './helperLines';
import { LayoutDirectionContext } from './layoutDirection';
import { Position } from '@xyflow/react';

const architectureNodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  cloud: CloudNode,
  class: ClassNode,
  groupcontainer: GroupContainerNode,
};

const flowNodeTypes = {
  flow: ProcessNode,
  start: StartEndNode,
  end: StartEndNode,
  decision: DecisionNode,
  data: DataNode,
  document: DocumentNode,
  manualinput: ManualInputNode,
  terminator: TerminatorNode,
  gatewayexclusive: GatewayExclusiveNode,
  gatewayparallel: GatewayParallelNode,
  gatewayinclusive: GatewayInclusiveNode,
  eventstart: EventStartNode,
  eventend: EventEndNode,
  eventtimer: EventTimerNode,
  eventmessage: EventMessageNode,
  subprocesscollapsed: SubprocessNode,
  subprocessexpanded: SubprocessExpandedNode,
  swimlane: SwimlaneNode,
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

function DiagramCanvasInternal() {
  const { parsedDiagram, diagramMode, setZoomLevel, setSelectedNode, dslText, setDslText, setParsedDiagram } = useDiagramStore();
  const { getZoom } = useReactFlow();
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

        const flowReactNodes: Node[] = parsedDiagram.nodes.map(node => {
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

          return {
            id: node.id,
            type,
            position: {
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

        return [...laneBandNodes, ...flowReactNodes];
      }

      // No lanes: stack along the active layout axis.
      // TB → vertical column; LR → horizontal row.
      let yOffset = 100;
      let xOffset = 100;
      return parsedDiagram.nodes.map((node) => {
        const { type, data } = flowNodeFor(node);
        let x: number;
        let y: number;
        if (isLR) {
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
    } else {
      // Architecture mode - apply C4 level filter and (optional) drill-down filter,
      // then auto-layout the visible subset.
      const visibleNodes = parsedDiagram.nodes.filter((node) => {
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

      let positions = calculateAutoLayout(visibleNodes, visibleEdges, layoutDirection);

      // If sub-system grouping containers exist, push overlapping groups
      // apart so their dashed bounding boxes don't cross through each other.
      const groupsForLayout = parsedDiagram.groups ?? [];
      if (groupsForLayout.length >= 2) {
        positions = resolveGroupOverlaps(
          positions,
          groupsForLayout,
          visibleIds,
          layoutDirection,
        );
      }

      const archNodes: Node[] = visibleNodes.map((node) => {
        const pos = positions.get(node.id) || { x: 100, y: 100 };

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

          groupNodes.push({
            id: `__group_${g.id}`,
            type: 'groupcontainer',
            position: { x: minX - PADDING, y: minY - PADDING - HEADER },
            data: {
              label: g.label ?? g.name,
              width: maxX - minX + PADDING * 2,
              height: maxY - minY + PADDING * 2 + HEADER,
              color: g.color,
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
  }, [parsedDiagram, diagramMode, c4Level, drillParent, layoutDirection, isLR, directionalNodeProps]);

  const initialEdges = useMemo((): Edge[] => {
    if (!parsedDiagram) return [];

    const getEdgeColor = (mode: string) => {
      // Flow connectors stay neutral (Figma-style) so the coloured lanes and
      // shapes carry the meaning; architecture keeps the brand violet.
      if (mode === 'flow') return '#64748b';
      return '#8B5CF6';
    };

    const edgeColor = getEdgeColor(diagramMode);

    // Filter edges by C4 level / drill-down so they don't dangle when nodes are hidden.
    let edges = parsedDiagram.edges;
    if (diagramMode !== 'flow' && (c4Level !== 'all' || drillParent)) {
      const visibleIds = new Set(
        parsedDiagram.nodes
          .filter(n => {
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

    return edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      animated: false,
      type: rfEdgeType,
      ...(rfEdgeType === 'smoothstep' ? { pathOptions: { borderRadius: 14 } } : {}),
      style: {
        stroke: edgeColor,
        strokeWidth: diagramMode === 'flow' ? 1.8 : 2,
      },
      labelStyle: { 
        fill: '#1E293B', 
        fontWeight: 600, 
        fontSize: 11,
        fontFamily: 'Inter, sans-serif'
      },
      labelBgStyle: { 
        fill: '#FDFDFD', 
        fillOpacity: 0.95,
        stroke: edgeColor,
        strokeOpacity: 0.3,
        strokeWidth: 1,
      },
      labelBgPadding: [6, 8] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    }));
  }, [parsedDiagram, diagramMode, c4Level, drillParent]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Alignment guides shown while dragging a node.
  const [helperLines, setHelperLines] = useState<HelperLineResult>({});

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
      onNodesChange(extra.length > 0 ? [...changes, ...extra] : changes);
    },
    [nodes, onNodesChange],
  );
  
  // Update nodes/edges when parsedDiagram changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Reset the C4 level filter and drill-down whenever a new diagram is loaded.
  useEffect(() => {
    setC4Level('all');
    setDrillParent(null);
    setDrillParentName('');
  }, [parsedDiagram]);

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
    <div className="w-full h-full bg-white relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[10, 10]}
        connectionRadius={28}
        connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6 4' }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#CBD5E1" gap={25} variant={BackgroundVariant.Dots} />
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

      {/* Shape library palette */}
      <ShapeLibrary />

      {/* Floating Zoom Controls */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 p-2 z-10">
        <ZoomControls />
      </div>

      {/* C4 Level Switcher (architecture mode, only when levels are present) */}
      {diagramMode !== 'flow' && (
        <C4LevelSwitcher
          current={c4Level}
          available={availableC4Levels}
          onChange={handleLevelChange}
        />
      )}

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
