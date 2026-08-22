import { useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { applyBoardSource, renameNodeInSource } from '../../utils/sourceText';
import type { BoardMode } from '../../utils/boardManager';

export function PropertiesPanel() {
  const { parsedDiagram, selectedNodeId, dslText, setDslText, setParsedDiagram, setError, diagramMode } = useDiagramStore();
  const selectedNode = parsedDiagram?.nodes.find(n => n.id === selectedNodeId);
  const [nameDraft, setNameDraft] = useState(selectedNode?.name ?? '');
  const [draftForId, setDraftForId] = useState(selectedNode?.id ?? '');
  if ((selectedNode?.id ?? '') !== draftForId) {
    setDraftForId(selectedNode?.id ?? '');
    setNameDraft(selectedNode?.name ?? '');
  }

  const commitRename = () => {
    if (!selectedNode) return;
    const next = renameNodeInSource(dslText, selectedNode, nameDraft);
    if (next === dslText) return;
    setDslText(next);
    const result = applyBoardSource(next, (diagramMode === 'flow' || diagramMode === 'sequence' || diagramMode === 'gantt' ? diagramMode : 'architecture') as BoardMode);
    if (result.ok) {
      setError(null);
      if (result.kind === 'diagram') setParsedDiagram(result.parsed);
    } else {
      setError(result.error);
    }
  };

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
                <input
                  aria-label="Rename node"
                  data-testid="rename-node-input"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setNameDraft(selectedNode.name);
                  }}
                  className="card-title w-full bg-transparent outline-none"
                />
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
