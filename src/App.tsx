import { useState, useEffect, useRef, useCallback } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { ExportModal } from './components/Export/ExportModal';
import { ImportCSVModal } from './components/Import/ImportCSVModal';
import { useDiagramStore } from './store/diagramStore';
import { useExport } from './utils/useExport';
import { csvToDSL, csvToDiagram } from './utils/csvToDiagram';
import type { SimpleCSVRow } from './utils/csvParser';

const ARCHITECTURE_DSL = `diagram: architecture
title: Insurance Claims Platform

service ClaimsAPI {
  type: api
  tech: Node.js
  port: 3000
  connects: ClaimsService, PolicyService
}

service ClaimsService {
  type: microservice
  tech: Java
  replicas: 3
  connects: ClaimsDB, EventQueue
}

service PolicyService {
  type: microservice
  tech: Python
  connects: PolicyDB
}

database ClaimsDB {
  type: postgresql
  data: claims, claim_events
}

database PolicyDB {
  type: mongodb
  data: policies, customers
}

queue EventQueue {
  type: kafka
  topic: claim-events
}`;

const FLOW_DSL = `diagram: flow
title: Claims Processing Flow

start FNOL

FNOL -> Intake
Intake -> Assignment
Assignment -> Investigation

Investigation ->|Fraud Detected| SpecialInvestigation
Investigation ->|No Fraud| Evaluation

SpecialInvestigation -> Evaluation

Evaluation ->|Approved| Settlement
Evaluation ->|Denied| Closure

Settlement -> Payment -> Closure

end Closure

node FNOL {
  label: First Notice of Loss
  system: ClaimsAPI
  duration: 1d
}

node Investigation {
  assignee: ClaimsAdjuster
  duration: 5d
}

node Payment {
  system: PaymentGateway
  type: external
}`;

function App() {
  const { setDslText, diagramMode, setDiagramMode, setParsedDiagram } = useDiagramStore();
  const [activeTab, setActiveTab] = useState<'architecture' | 'flow'>('architecture');
  const [showProperties, setShowProperties] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editorWidth, setEditorWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { exportPNG, exportSVG, exportJSON } = useExport();

  const handleTabChange = (tab: 'architecture' | 'flow') => {
    setActiveTab(tab);
    setDiagramMode(tab);
    
    if (tab === 'architecture') {
      setDslText(ARCHITECTURE_DSL);
    } else {
      setDslText(FLOW_DSL);
    }
  };

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 300 && newWidth <= 800) {
      setEditorWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            setShowProperties(prev => !prev);
          }
        }
      }
      if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowExportModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleExport = (format: 'png' | 'svg' | 'json') => {
    if (format === 'png') exportPNG();
    else if (format === 'svg') exportSVG();
    else if (format === 'json') exportJSON();
  };

  const handleCSVImport = (rows: SimpleCSVRow[], filename: string) => {
    // Generate diagram from CSV
    const diagram = csvToDiagram(rows, filename);
    
    // Update store
    setParsedDiagram(diagram);
    setDiagramMode('architecture');
    setActiveTab('architecture');
    
    // Also generate DSL and update editor
    const dsl = csvToDSL(rows, filename);
    setDslText(dsl);
    
    console.log('✅ CSV imported successfully:', diagram);
  };

  return (
    <div className="h-screen flex flex-col bg-canvas-white">
      {/* Header */}
      <header className="h-header-h bg-white border-b border-border-gray flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-electric-blue rounded-sm"></div>
          <h1 className="text-lg font-semibold text-deep-navy">DiagramTool</h1>
        </div>
        
        {/* Mode Tabs */}
        <div className="ml-6 flex gap-1">
          <button
            onClick={() => handleTabChange('architecture')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'architecture'
                ? 'bg-electric-blue text-white'
                : 'text-slate-600 border border-border-gray hover:bg-panel-light'
            }`}
          >
            🏗️ Architecture
          </button>
          <button
            onClick={() => handleTabChange('flow')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === 'flow'
                ? 'bg-electric-blue text-white'
                : 'text-slate-600 border border-border-gray hover:bg-panel-light'
            }`}
          >
            🔄 Flow
          </button>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-border-gray rounded hover:bg-panel-light transition"
          >
            📥 Import CSV
          </button>
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              showProperties
                ? 'bg-vivid-purple text-white'
                : 'text-slate-600 border border-border-gray hover:bg-panel-light'
            }`}
          >
            {showProperties ? '📋 Hide Panel' : '📋 Show Panel'}
          </button>
          <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-border-gray rounded hover:bg-panel-light transition">
            💾 Save
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald rounded hover:scale-105 transition"
          >
            📤 Export PNG
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Editor Panel - Resizable */}
        <div style={{ width: editorWidth, minWidth: 300, maxWidth: 800 }} className="flex-shrink-0">
          <DSLEditor />
        </div>
        
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-1.5 bg-border-gray hover:bg-electric-blue cursor-col-resize flex items-center justify-center transition-colors ${
            isResizing ? 'bg-electric-blue' : ''
          }`}
          style={{ userSelect: 'none' }}
        >
          <div className="w-0.5 h-12 bg-slate-300 rounded" />
        </div>
        
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <DiagramCanvas />
        </div>
        
        {/* Properties Panel - Collapsible */}
        {showProperties && (
          <div className="w-sidebar-w flex-shrink-0 transition-all duration-300">
            <PropertiesPanel />
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="h-toolbar-h bg-white border-t border-border-gray flex items-center px-6 text-xs text-slate-500">
        <div className="capitalize">{diagramMode} Mode</div>
        <div className="ml-4 text-slate-400">|</div>
        <div className="ml-4">Editor: {editorWidth}px</div>
        <div className="ml-4 text-slate-400">|</div>
        <div className="ml-4">Press <kbd className="px-1.5 py-0.5 bg-panel-light rounded text-xs font-mono">P</kbd> to toggle panel</div>
        <div className="ml-4 text-slate-400">|</div>
        <div className="ml-4">Press <kbd className="px-1.5 py-0.5 bg-panel-light rounded text-xs font-mono">Cmd+E</kbd> to export</div>
        <div className="ml-auto">Zoom: 100%</div>
      </footer>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleCSVImport}
      />
    </div>
  );
}

export default App;
