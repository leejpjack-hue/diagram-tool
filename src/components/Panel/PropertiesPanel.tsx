import { useDiagramStore } from '../../store/diagramStore';

export function PropertiesPanel() {
  const { parsedDiagram, selectedNodeId } = useDiagramStore();

  const selectedNode = parsedDiagram?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">📋 Properties</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedNode ? (
          <div>
            {/* Node Name */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                Selected Node
              </label>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-bold text-gray-900">{selectedNode.name}</div>
              </div>
            </div>

            {/* Node Type */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                Type
              </label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-sm font-semibold ${
                  selectedNode.type === 'service' ? 'bg-blue-100 text-blue-900' :
                  selectedNode.type === 'database' ? 'bg-pink-100 text-pink-900' :
                  selectedNode.type === 'queue' ? 'bg-green-100 text-green-900' :
                  'bg-gray-100 text-gray-900'
                }`}>
                  {selectedNode.type === 'service' && '🔵'}
                  {selectedNode.type === 'database' && '🩷'}
                  {selectedNode.type === 'queue' && '🟢'}
                  <span className="capitalize">{selectedNode.type}</span>
                </span>
              </div>
            </div>

            {/* Properties */}
            {'properties' in selectedNode && Object.entries(selectedNode.properties).length > 0 && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Properties
                </label>
                <div className="space-y-2">
                  {Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="text-xs text-gray-500 capitalize mb-1">{key}</div>
                      <div className="text-sm font-medium text-gray-900">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connections */}
            {'connections' in selectedNode && selectedNode.connections.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Connections
                </label>
                <div className="space-y-2">
                  {selectedNode.connections.map((conn, i) => (
                    <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                      → {conn}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-gray-500">
              Click a node to see its properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
