import { useState, useRef } from 'react';
import { saveManager, type SavedDiagram, type SavedDiagramMode } from '../../utils/saveManager';

interface FileMenuProps {
  currentDsl: string;
  mode: SavedDiagramMode;
  onLoad: (diagram: SavedDiagram) => void;
  onNew: () => void;
  onLoadMVP?: () => void;
}

export function FileMenu({ currentDsl, mode, onLoad, onNew, onLoadMVP }: FileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentDiagrams, setRecentDiagrams] = useState<SavedDiagram[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpen = () => {
    setRecentDiagrams(saveManager.getRecentDiagrams());
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleNew = () => {
    if (saveManager.hasUnsavedChanges(currentDsl)) {
      if (!confirm('You have unsaved changes. Create new diagram anyway?')) {
        return;
      }
    }
    onNew();
    handleClose();
  };

  const handleSave = () => {
    const saved = saveManager.saveDiagram({
      title: extractTitle(currentDsl) || 'Untitled Diagram',
      dslText: currentDsl,
      mode,
    });
    alert(`Saved: ${saved.title}`);
    handleClose();
  };

  const handleExport = () => {
    const saved = saveManager.saveDiagram({
      title: extractTitle(currentDsl) || 'Untitled Diagram',
      dslText: currentDsl,
      mode,
    });
    saveManager.exportToFile(saved);
    handleClose();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
    handleClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const diagram = await saveManager.importFromFile(file);
      onLoad(diagram);
      alert(`Imported: ${diagram.title}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import file');
    }

    // Reset input
    e.target.value = '';
  };

  const handleLoadRecent = (diagram: SavedDiagram) => {
    if (saveManager.hasUnsavedChanges(currentDsl)) {
      if (!confirm('You have unsaved changes. Load anyway?')) {
        return;
      }
    }
    onLoad(diagram);
    handleClose();
  };

  const handleClearRecent = () => {
    if (confirm('Clear all recent diagrams from history?')) {
      saveManager.clearRecent();
      setRecentDiagrams([]);
    }
  };

  // Close on outside click
  const handleBlur = (e: React.FocusEvent) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      handleClose();
    }
  };

  return (
    <div className="relative" ref={menuRef} onBlur={handleBlur}>
      {/* Menu Button */}
      <button
        onClick={handleOpen}
        className="btn btn-secondary"
      >
        📄 File
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleNew}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📄</span>
              <span>New Diagram</span>
            </button>

            {onLoadMVP && (
              <button
                onClick={() => {
                  onLoadMVP();
                  handleClose();
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-600 font-medium"
              >
                <span>🚀</span>
                <span>Load MVP Sprint</span>
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">NEW</span>
              </button>
            )}

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>💾</span>
              <span>Save</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+S</span>
            </button>

            <button
              onClick={handleExport}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📥</span>
              <span>Export to File</span>
            </button>

            <button
              onClick={handleImport}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📤</span>
              <span>Import from File</span>
            </button>
          </div>

          {/* Divider */}
          {recentDiagrams.length > 0 && (
            <>
              <div className="border-t border-gray-200" />
              
              {/* Recent Diagrams */}
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">
                  Recent Diagrams
                </div>
                
                {recentDiagrams.map((diagram) => (
                  <button
                    key={diagram.id}
                    onClick={() => handleLoadRecent(diagram)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{diagram.title}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(diagram.updatedAt)}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 capitalize ml-2">
                      {diagram.mode}
                    </span>
                  </button>
                ))}

                <button
                  onClick={handleClearRecent}
                  className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                >
                  Clear Recent History
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".diagram,.json"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Helper functions
function extractTitle(dsl: string): string | null {
  const match = dsl.match(/title:\s*(.+)/);
  return match ? match[1].trim() : null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
