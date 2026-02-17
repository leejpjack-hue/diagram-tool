import { useDiagramStore } from '../../store/diagramStore';

export function PropertiesPanel() {
  const { parsedDiagram, selectedNodeId } = useDiagramStore();

  const selectedNode = parsedDiagram?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="w-sidebar-w bg-panel-light border-l border-border-gray flex flex-col">
      <div className="px-4 py-3 bg-white border-b border-border-gray">
        <h2 className="text-sm font-semibold text-deep-navy font-mono">PROPERTIES</h2>
      </div>
      
      <div className="flex-1 p-4">
        {selectedNode ? (
          <div>
            <div className="mb-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Selected Node</div>
              <div className="font-semibold text-deep-navy">{selectedNode.name}</div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">Type</div>
                <div className="text-sm text-deep-navy capitalize">{selectedNode.type}</div>
              </div>
              
              {'properties' in selectedNode && Object.entries(selectedNode.properties).map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs text-slate-500 mb-1 capitalize">{key}</div>
                  <div className="text-sm text-deep-navy">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </div>
                </div>
              ))}
              
              {'connections' in selectedNode && selectedNode.connections.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Connections</div>
                  <div className="text-sm text-deep-navy">
                    {selectedNode.connections.map((conn, i) => (
                      <div key={i}>• {conn}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 text-center mt-8">
            <div className="mb-2">No node selected</div>
            <div className="text-xs">Click a node to view properties</div>
          </div>
        )}
      </div>
      
      <div className="px-4 py-3 border-t border-border-gray bg-white">
        <div className="text-xs text-slate-500">
          {parsedDiagram ? (
            <div>
              <div>{parsedDiagram.nodes.length} nodes</div>
              <div>{parsedDiagram.edges.length} edges</div>
            </div>
          ) : (
            <div>No diagram loaded</div>
          )}
        </div>
      </div>
    </div>
  );
}
