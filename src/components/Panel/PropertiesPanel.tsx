import { useDiagramStore } from '../../store/diagramStore';

export function PropertiesPanel() {
  const { parsedDiagram, selectedNodeId } = useDiagramStore();

  const selectedNode = parsedDiagram?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">📋 Properties</span>
      </div>

      {/* Body */}
      <div className="panel-content">
        {selectedNode ? (
          <div>
            {/* Node Name */}
            <div className="property-group">
              <div className="property-label">Selected Node</div>
              <div className="card">
                <div className="card-title">{selectedNode.name}</div>
              </div>
            </div>

            {/* Node Type */}
            <div className="property-group">
              <div className="property-label">Type</div>
              <div className="card">
                <span className={`status-badge ${
                  selectedNode.type === 'service' ? 'badge-primary' :
                  selectedNode.type === 'database' ? 'badge-danger' :
                  selectedNode.type === 'queue' ? 'badge-success' :
                  'badge-neutral'
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
              <div className="property-group">
                <div className="property-label">Properties</div>
                <div className="space-y-2">
                  {Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key} className="card">
                      <div className="property-label">{key}</div>
                      <div className="card-title">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connections */}
            {'connections' in selectedNode && selectedNode.connections.length > 0 && (
              <div className="property-group">
                <div className="property-label">Connections</div>
                <div className="space-y-2">
                  {selectedNode.connections.map((conn, i) => (
                    <div key={i} className="card">
                      → {conn}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center" style={{ padding: '48px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
            <div className="text-secondary">
              Click a node to see its properties
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
