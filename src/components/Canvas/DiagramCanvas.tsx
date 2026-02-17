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

export function DiagramCanvas() {
  const { parsedDiagram, diagramMode } = useDiagramStore();

  const nodeTypes = diagramMode === 'flow' ? flowNodeTypes : architectureNodeTypes;

  const initialNodes = useMemo((): Node[] => {
    if (!parsedDiagram) {
      console.log('No parsed diagram');
      return [];
    }

    console.log('Parsed diagram:', parsedDiagram);
    console.log('Mode:', diagramMode);
    console.log('Nodes count:', parsedDiagram.nodes.length);
    console.log('Edges count:', parsedDiagram.edges.length);

    if (diagramMode === 'flow') {
      // Flow mode - vertical layout
      let yOffset = 100;
      
      return parsedDiagram.nodes.map((node) => {
        // Determine node type
        let nodeType = 'flow';
        const flowNode = node as any;
        if (flowNode.isStart) nodeType = 'start';
        else if (flowNode.isEnd) nodeType = 'end';
        else if (flowNode.properties?.nodeType === 'decision') nodeType = 'decision';
        
        // Position nodes vertically
        const x = 300;
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
          position: { x: col * 250 + 100, y: row * 150 + 100 },
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

    return parsedDiagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.label,
      animated: diagramMode === 'flow',
      style: { stroke: diagramMode === 'flow' ? '#6366F1' : '#64748B', strokeWidth: 2 },
      labelStyle: { fill: '#1E293B', fontWeight: 600, fontSize: 11 },
      labelBgStyle: { fill: '#FDFDFD', fillOpacity: 0.9 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: diagramMode === 'flow' ? '#6366F1' : '#64748B',
      },
    }));
  }, [parsedDiagram, diagramMode]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  
  // Debug logging
  useEffect(() => {
    console.log('Rendered nodes:', nodes);
    console.log('Rendered edges:', edges);
  }, [nodes, edges]);

  if (!parsedDiagram) {
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-white">
        <div className="text-center text-slate-400">
          <div className="text-4xl mb-4">📊</div>
          <div className="text-lg">Enter DSL to generate diagram</div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex-1 bg-canvas-white" style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          style={{ width: '100%', height: '100%' }}
        >
          <Background color="#E2E8F0" gap={20} />
          <Controls className="bg-white border border-border-gray rounded shadow-md" />
          <MiniMap 
            className="bg-white border border-border-gray rounded"
            nodeColor={(node) => {
              switch (node.type) {
                case 'service':
                  return '#334155';
                case 'database':
                  return '#6366F1';
                case 'queue':
                  return '#8B5CF6';
                case 'start':
                  return '#10B981';
                case 'end':
                  return '#EF4444';
                case 'decision':
                  return '#F59E0B';
                default:
                  return '#64748B';
              }
            }}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
