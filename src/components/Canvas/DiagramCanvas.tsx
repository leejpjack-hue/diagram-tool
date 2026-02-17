import { useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, ReactFlowProvider } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ServiceNode } from './ServiceNode';
import { DatabaseNode } from './DatabaseNode';
import { QueueNode } from './QueueNode';
import { ProcessNode } from './ProcessNode';
import { StartEndNode } from './StartEndNode';
import { DecisionNode } from './DecisionNode';
import { useDiagramStore } from '../../store/diagramStore';

const architectureNodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
};

const flowNodeTypes = {
  flow: ProcessNode,
  start: StartEndNode,
  end: StartEndNode,
  decision: DecisionNode,
};

function DiagramCanvasInternal() {
  const { parsedDiagram, diagramMode } = useDiagramStore();

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
      // Flow mode - vertical layout
      let yOffset = 100;
      
      return parsedDiagram.nodes.map((node) => {
        let nodeType = 'flow';
        const flowNode = node as any;
        if (flowNode.isStart) nodeType = 'start';
        else if (flowNode.isEnd) nodeType = 'end';
        else if (flowNode.properties?.nodeType === 'decision') nodeType = 'decision';
        
        const x = 400;
        const y = yOffset;
        yOffset += 120;
        
        return {
          id: node.id,
          type: nodeType,
          position: { x, y },
          data: {
            label: node.name,
            ...node.properties,
            isStart: flowNode.isStart || false,
            isEnd: flowNode.isEnd || false,
          },
        };
      });
    } else {
      // Architecture mode - grid layout
      return parsedDiagram.nodes.map((node, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        
        return {
          id: node.id,
          type: node.type,
          position: { x: col * 250 + 150, y: row * 150 + 100 },
          data: {
            label: node.name,
            ...node.properties,
          },
        };
      });
    }
  }, [parsedDiagram, diagramMode]);

  const initialEdges = useMemo((): Edge[] => {
    if (!parsedDiagram) return [];

    const getEdgeColor = (mode: string) => {
      if (mode === 'flow') return '#3B82F6';
      return '#8B5CF6';
    };

    const edgeColor = getEdgeColor(diagramMode);

    return parsedDiagram.edges.map((edge) => ({
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
  }, [parsedDiagram, diagramMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Update nodes/edges when parsedDiagram changes
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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
    <div className="w-full h-full bg-canvas-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#E2E8F0" gap={20} />
        <Controls className="bg-white border border-border-gray rounded shadow-md" />
        <MiniMap 
          className="bg-white border border-border-gray rounded"
          nodeColor={(node) => {
            switch (node.type) {
              case 'service':
                return '#3B82F6';
              case 'database':
                return '#EC4899';
              case 'queue':
                return '#10B981';
              case 'start':
                return '#10B981';
              case 'end':
                return '#EF4444';
              case 'decision':
                return '#F59E0B';
              default:
                return '#8B5CF6';
            }
          }}
        />
      </ReactFlow>
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
