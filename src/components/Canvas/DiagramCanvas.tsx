import { useMemo, useEffect, useCallback, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, ReactFlowProvider, useReactFlow, BackgroundVariant } from '@xyflow/react';
import type { Node, Edge, Viewport } from '@xyflow/react';
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
} from './BpmnShapes';
import { SwimlaneNode } from './SwimlaneOverlay';
import { C4LevelSwitcher } from './C4LevelSwitcher';
import { ZoomControls } from './ZoomControls';
import { useDiagramStore } from '../../store/diagramStore';
import type { FlowNode, C4Level, ServiceNode as ServiceNodeType, CloudNode as CloudNodeType, ClassNode as ClassNodeType } from '../../store/types';
import { calculateAutoLayout } from '../../utils/autoLayout';

const architectureNodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  cloud: CloudNode,
  class: ClassNode,
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
  swimlane: SwimlaneNode,
};

// Lane layout constants
const LANE_HEADER_W = 120;
const LANE_HEIGHT = 180;
const LANE_NODE_X_START = LANE_HEADER_W + 40;
const LANE_NODE_X_STEP = 200;

function DiagramCanvasInternal() {
  const { parsedDiagram, diagramMode, setZoomLevel, setSelectedNode } = useDiagramStore();
  const { getZoom } = useReactFlow();
  const [c4Level, setC4Level] = useState<C4Level | 'all'>('all');

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

        // Lane band nodes (zIndex behind real nodes)
        const laneBandNodes: Node[] = lanes.map((lane, i) => ({
          id: `__lane_${lane.id}`,
          type: 'swimlane',
          position: { x: 0, y: i * LANE_HEIGHT + 40 },
          data: {
            label: lane.name,
            color: lane.color,
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
          };
        });

        return [...laneBandNodes, ...flowReactNodes];
      }

      // No lanes: vertical stack as before
      let yOffset = 100;
      return parsedDiagram.nodes.map((node) => {
        const { type, data } = flowNodeFor(node);
        const x = 400;
        const y = yOffset;
        yOffset += 120;
        return {
          id: node.id,
          type,
          position: { x, y },
          data,
        };
      });
    } else {
      // Architecture mode - apply C4 level filter, then auto-layout the visible subset.
      const visibleNodes = parsedDiagram.nodes.filter((node) => {
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

      const positions = calculateAutoLayout(visibleNodes, visibleEdges);

      return visibleNodes.map((node) => {
        const pos = positions.get(node.id) || { x: 100, y: 100 };

        return {
          id: node.id,
          type: node.type,
          position: pos,
          data: {
            label: node.name,
            ...node.properties,
          },
        };
      });
    }
  }, [parsedDiagram, diagramMode, c4Level]);

  const initialEdges = useMemo((): Edge[] => {
    if (!parsedDiagram) return [];

    const getEdgeColor = (mode: string) => {
      if (mode === 'flow') return '#3B82F6';
      return '#8B5CF6';
    };

    const edgeColor = getEdgeColor(diagramMode);

    // Filter edges by C4 level so they don't dangle when architecture nodes are hidden.
    let edges = parsedDiagram.edges;
    if (diagramMode !== 'flow' && c4Level !== 'all') {
      const visibleIds = new Set(
        parsedDiagram.nodes
          .filter(n => {
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

    return edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      animated: diagramMode === 'flow',
      style: { 
        stroke: edgeColor, 
        strokeWidth: 2,
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
  }, [parsedDiagram, diagramMode, c4Level]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Update nodes/edges when parsedDiagram changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Reset the C4 level filter whenever a new diagram is loaded.
  useEffect(() => {
    setC4Level('all');
  }, [parsedDiagram]);

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

  if (!parsedDiagram) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-canvas-white">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-lg">Enter DSL to generate diagram</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0F172A] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#334155" gap={25} variant={BackgroundVariant.Dots} />
        <Controls className="bg-[#1E293B] border-white/10 rounded shadow-2xl" />
        <MiniMap 
          className="bg-[#1E293B] border-white/10 rounded shadow-2xl"
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
          maskColor="rgba(0, 0, 0, 0.3)"
        />
      </ReactFlow>
      
      {/* Floating Zoom Controls */}
      <div className="absolute bottom-4 left-4 bg-[#1E293B]/80 backdrop-blur-md rounded-lg shadow-2xl border border-white/10 p-2 z-10">
        <ZoomControls />
      </div>

      {/* C4 Level Switcher (architecture mode, only when levels are present) */}
      {diagramMode !== 'flow' && (
        <C4LevelSwitcher
          current={c4Level}
          available={availableC4Levels}
          onChange={setC4Level}
        />
      )}
    </div>
  );
}

export function DiagramCanvas() {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInternal />
    </ReactFlowProvider>
  );
}
