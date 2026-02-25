interface MobileViewToggleProps {
  currentView: 'editor' | 'timeline' | 'tasks';
  onViewChange: (view: 'editor' | 'timeline' | 'tasks') => void;
}

export function MobileViewToggle({ currentView, onViewChange }: MobileViewToggleProps) {
  return (
    <div className="mobile-view-toggle flex items-center gap-2 bg-gray-100 p-1 rounded-lg mb-3">
      <button
        onClick={() => onViewChange('editor')}
        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          currentView === 'editor'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Editor
        </span>
      </button>
      
      <button
        onClick={() => onViewChange('timeline')}
        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          currentView === 'timeline'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Timeline
        </span>
      </button>
      
      <button
        onClick={() => onViewChange('tasks')}
        className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          currentView === 'tasks'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Tasks
        </span>
      </button>
    </div>
  );
}
