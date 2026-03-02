import React from 'react';
import { GANTT_SHORTCUTS } from '../../hooks/useGanttKeyboardShortcuts';

interface GanttShortcutsHelpProps {
  onClose: () => void;
}

export function GanttShortcutsHelp({ onClose }: GanttShortcutsHelpProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Shortcuts List */}
        <div className="p-6">
          <div className="space-y-2">
            {GANTT_SHORTCUTS.map((shortcut, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm text-gray-700">{shortcut.description}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded shadow-sm">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-400">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Tip: Use <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded">Ctrl</kbd> on Windows/Linux or <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded">⌘</kbd> on Mac for shortcuts.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline shortcuts help for tooltips
 */
export function ShortcutsTooltip() {
  return (
    <div className="text-xs text-gray-500 space-y-1">
      <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+Z</kbd> Undo</div>
      <div><kbd className="px-1 bg-gray-100 rounded">Del</kbd> Delete selected</div>
      <div><kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> Select all</div>
      <div><kbd className="px-1 bg-gray-100 rounded">?</kbd> Show all shortcuts</div>
    </div>
  );
}
