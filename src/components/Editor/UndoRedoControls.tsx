import { useEffect, useCallback } from 'react';
import { useDiagramStore } from '../../store/diagramStore';

interface UndoRedoControlsProps {
  className?: string;
}

export function UndoRedoControls({ className = '' }: UndoRedoControlsProps) {
  const { undo, redo, canUndo, canRedo } = useDiagramStore();
  
  const handleUndo = useCallback(() => {
    if (canUndo()) {
      undo();
    }
  }, [undo, canUndo]);
  
  const handleRedo = useCallback(() => {
    if (canRedo()) {
      redo();
    }
  }, [redo, canRedo]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      
      // Ctrl+Y or Cmd+Y for redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);
  
  const undoDisabled = !canUndo();
  const redoDisabled = !canRedo();
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Undo Button */}
      <button
        onClick={handleUndo}
        disabled={undoDisabled}
        className={`p-1.5 rounded transition-colors ${
          undoDisabled 
            ? 'text-gray-300 cursor-not-allowed' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      
      {/* Redo Button */}
      <button
        onClick={handleRedo}
        disabled={redoDisabled}
        className={`p-1.5 rounded transition-colors ${
          redoDisabled 
            ? 'text-gray-300 cursor-not-allowed' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
        </svg>
      </button>
    </div>
  );
}
