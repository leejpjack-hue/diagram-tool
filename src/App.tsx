import { DSLEditor } from './components/Editor/DSLEditor';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';

function App() {
  return (
    <div className="h-screen flex flex-col bg-canvas-white">
      {/* Header */}
      <header className="h-header-h bg-white border-b border-border-gray flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-deep-navy rounded-sm"></div>
          <h1 className="text-lg font-semibold text-deep-navy">DiagramTool</h1>
          <span className="text-xs text-slate-500 border border-border-gray px-2 py-0.5 rounded">
            Architecture Mode
          </span>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-border-gray rounded hover:bg-panel-light transition">
            Save
          </button>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-electric-indigo rounded hover:bg-indigo-600 transition">
            Export PNG
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-panel-w">
          <DSLEditor />
        </div>
        
        {/* Canvas */}
        <DiagramCanvas />
        
        {/* Properties Panel */}
        <PropertiesPanel />
      </div>
      
      {/* Footer */}
      <footer className="h-toolbar-h bg-white border-t border-border-gray flex items-center px-6 text-xs text-slate-500">
        <div>Ready</div>
        <div className="ml-auto">Zoom: 100%</div>
      </footer>
    </div>
  );
}

export default App;
