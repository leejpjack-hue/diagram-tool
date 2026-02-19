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
    const diagram = csvToDiagram(rows, filename);
    setParsedDiagram(diagram);
    setDiagramMode('architecture');
    setActiveTab('architecture');
    const dsl = csvToDSL(rows, filename);
    setDslText(dsl);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="app-header px-6 flex items-center">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="app-logo">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="app-title">DiagramTool</h1>
        </div>
        
        {/* Mode Tabs */}
        <div className="ml-8 mode-tabs">
          <button
            onClick={() => handleTabChange('architecture')}
            className={`btn-tab ${activeTab === 'architecture' ? 'btn-tab-active' : 'btn-tab-inactive'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Architecture
          </button>
          <button
            onClick={() => handleTabChange('flow')}
            className={`btn-tab ${activeTab === 'flow' ? 'btn-tab-active' : 'btn-tab-inactive'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Flow
          </button>
        </div>
        
        {/* Divider */}
        <div className="divider"></div>
        
        {/* Status */}
        <div className="ml-4">
          <span className="status-badge bg-blue-100 text-blue-800">
            <span className="capitalize">{diagramMode} Mode</span>
          </span>
        </div>
        
        {/* Actions */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import CSV
          </button>
          
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`btn ${showProperties ? 'btn-primary' : 'btn-secondary'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {showProperties ? 'Hide Panel' : 'Show Panel'}
          </button>
          
          <button className="btn btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
          
          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-success"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
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
          className={`w-1.5 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center transition-colors group ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          style={{ userSelect: 'none' }}
        >
          <div className="w-0.5 h-12 bg-gray-300 group-hover:bg-blue-400 rounded transition-colors" />
        </div>
        
        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-white">
          <DiagramCanvas />
        </div>
        
        {/* Properties Panel - Collapsible */}
        {showProperties && (
          <div className="w-sidebar-w flex-shrink-0 border-l border-gray-200 bg-white transition-all duration-300">
            <PropertiesPanel />
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="app-footer">
        <span className="font-semibold text-gray-900">{diagramMode.charAt(0).toUpperCase() + diagramMode.slice(1)} Mode</span>
        <span className="mx-2 text-gray-400">•</span>
        <span>Editor: {editorWidth}px</span>
        <span className="mx-2 text-gray-400">•</span>
        <span className="flex items-center gap-1">
          Press <kbd className="kbd">P</kbd> to toggle panel
        </span>
        <span className="mx-2 text-gray-400">•</span>
        <span className="flex items-center gap-1">
          Press <kbd className="kbd">⌘ E</kbd> to export
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500">Zoom:</span>
          <span className="font-semibold text-gray-900">100%</span>
        </div>
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
