import { useState } from 'react';

interface MobileBottomNavProps {
  activeTab: 'architecture' | 'flow';
  onTabChange: (tab: 'architecture' | 'flow') => void;
  activePanel: 'none' | 'properties' | 'import' | 'export';
  onPanelChange: (panel: 'none' | 'properties' | 'import' | 'export') => void;
  editorVisible: boolean;
  onEditorToggle: () => void;
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  activePanel,
  onPanelChange,
  editorVisible,
  onEditorToggle,
}: MobileBottomNavProps) {
  const [showTabMenu, setShowTabMenu] = useState(false);

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 lg:hidden shadow-lg">
        <div className="flex items-center justify-around h-16 px-2">
          {/* Editor Toggle */}
          <button
            onClick={onEditorToggle}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              editorVisible ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-label={editorVisible ? 'Hide Editor' : 'Show Editor'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="text-xs mt-1 font-medium">Editor</span>
          </button>

          {/* Mode Tab - Shows current mode, tapping opens selector */}
          <button
            onClick={() => setShowTabMenu(!showTabMenu)}
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Change Mode"
          >
            {activeTab === 'architecture' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
            <span className="text-xs mt-1 font-medium capitalize">{activeTab}</span>
          </button>

          {/* Import */}
          <button
            onClick={() => onPanelChange(activePanel === 'import' ? 'none' : 'import')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'import' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Import CSV"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span className="text-xs mt-1 font-medium">Import</span>
          </button>

          {/* Export */}
          <button
            onClick={() => onPanelChange(activePanel === 'export' ? 'none' : 'export')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'export' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Export"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="text-xs mt-1 font-medium">Export</span>
          </button>

          {/* Properties */}
          <button
            onClick={() => onPanelChange(activePanel === 'properties' ? 'none' : 'properties')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'properties' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
            aria-label="Properties"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-xs mt-1 font-medium">Props</span>
          </button>
        </div>
      </nav>

      {/* Mode Selector Popup */}
      {showTabMenu && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowTabMenu(false)}
          />
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[200px] animate-fade-in">
            <button
              onClick={() => {
                onTabChange('architecture');
                setShowTabMenu(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                activeTab === 'architecture'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="font-medium">Architecture</span>
            </button>
            <button
              onClick={() => {
                onTabChange('flow');
                setShowTabMenu(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                activeTab === 'flow'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="font-medium">Flow</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
