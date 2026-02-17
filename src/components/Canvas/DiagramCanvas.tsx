import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ServiceNode } from './ServiceNode';
import { DatabaseNode } from './DatabaseNode';
import { QueueNode } from './QueueNode';
import { useDiagramStore } from '../../store/diagramStore';

const nodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
};

export function DiagramCanvas() {
  const { parsedDiagram } = useDiagramStore();

  const initialNodes = useMemo(() => {
    if (!parsedDiagram) return [];

    return parsedDiagram.nodes.map((node, index) => {
      // Simple layout - arrange in grid
      const col = index % 3;
      const row = Math.floor(index / 3);
      
      return {
        id: node.id,
        type: node.type,
        position: { x: col * 250 + 100, y: row * 150 + 100 },
        data: {
          label: node.name,
          ...('properties' in node ? node.properties : {}),
        },
      };
    });
  }, [parsedDiagram]);

  const initialEdges = useMemo(() => {
    if (!parsedDiagram) return [];

    return parsedDiagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      animated: false,
      style: { stroke: '#64748B', strokeWidth: 2 },
    }));
  }, [parsedDiagram]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
    <div className="flex-1 bg-canvas-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
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
              default:
                return '#64748B';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
