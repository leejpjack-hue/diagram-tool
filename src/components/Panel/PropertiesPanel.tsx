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
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                Selected Node
              </label>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl">
                <div className="font-bold text-gray-900 text-lg">{selectedNode.name}</div>
              </div>
            </div>

            {/* Node Type */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                Type
              </label>
              <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  selectedNode.type === 'service' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                  selectedNode.type === 'database' ? 'bg-pink-100 text-pink-900 border border-pink-200' :
                  selectedNode.type === 'queue' ? 'bg-green-100 text-green-900 border border-green-200' :
                  'bg-gray-100 text-gray-900 border border-gray-200'
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
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Properties
                </label>
                <div className="space-y-2">
                  {Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{key}</div>
                      <div className="text-sm font-semibold text-gray-900">
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
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Connections
                </label>
                <div className="space-y-2">
                  {selectedNode.connections.map((conn, i) => (
                    <div key={i} className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-xl text-sm font-medium hover:border-blue-300 transition-colors">
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
