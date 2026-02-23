import { useState, useEffect, useRef, useCallback } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { UndoRedoControls } from './components/Editor/UndoRedoControls';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { ExportPanel } from './components/Panel/ExportPanel';
import { ImportPanel } from './components/Panel/ImportPanel';
import { FileMenu } from './components/Panel/FileMenu';
import { ToastContainer } from './components/Toast/ToastContainer';
import { useDiagramStore } from './store/diagramStore';
import { useExport } from './utils/useExport';
import { useToast } from './utils/useToast';
import { csvToDSL, csvToDiagram } from './utils/csvToDiagram';
import { saveManager, type SavedDiagram, type SavedDiagramMode } from './utils/saveManager';
import type { SimpleCSVRow } from './utils/csvParser';
import { extractNodeDSL, insertNodeDSL, duplicateNodeDSL } from './utils/clipboardUtils';

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

type PanelType = 'none' | 'properties' | 'import' | 'export';

function App() {
  const { 
    dslText, 
    setDslText, 
    diagramMode, 
    setDiagramMode, 
    setParsedDiagram,
    selectedNodeId,
    clipboard,
    setClipboard 
  } = useDiagramStore();
  const [activeTab, setActiveTab] = useState<'architecture' | 'flow'>('architecture');
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [editorWidth, setEditorWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { exportPNG, exportSVG, exportJSON } = useExport();
  const toast = useToast();

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

  const handleSave = () => {
    setSaveStatus('saving');
    
    setTimeout(() => {
      try {
        const title = extractTitle(dslText) || 'Untitled Diagram';
        const mode: SavedDiagramMode = (diagramMode === 'architecture' || diagramMode === 'flow') 
          ? diagramMode 
          : 'architecture';
        saveManager.saveDiagram({ title, dslText, mode });
        setSaveStatus('saved');
        setLastSaved(new Date());
        toast.success(`Saved: ${title}`);
      } catch {
        toast.error('Failed to save diagram');
        setSaveStatus('unsaved');
      }
    }, 300);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S for save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl+C for copy node
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Only copy if we have a selected node and not in text input
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && selectedNodeId) {
          const nodeDSL = extractNodeDSL(dslText, selectedNodeId);
          if (nodeDSL) {
            setClipboard([{ id: selectedNodeId, type: 'copied', name: selectedNodeId, properties: { dsl: nodeDSL } }]);
            toast.success(`Copied: ${selectedNodeId}`);
          }
        }
      }
      
      // Ctrl+V for paste node
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && clipboard.length > 0) {
          const copiedNode = clipboard[0];
          const nodeDSL = copiedNode.properties?.dsl as string;
          if (nodeDSL) {
            const newNodeDSL = duplicateNodeDSL(dslText, nodeDSL, copiedNode.name);
            const updatedDSL = insertNodeDSL(dslText, newNodeDSL);
            setDslText(updatedDSL);
            toast.success('Pasted node');
          }
        }
      }
      
      // Ctrl+D for duplicate node
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && selectedNodeId) {
          const nodeDSL = extractNodeDSL(dslText, selectedNodeId);
          if (nodeDSL) {
            const newNodeDSL = duplicateNodeDSL(dslText, nodeDSL, selectedNodeId);
            const updatedDSL = insertNodeDSL(dslText, newNodeDSL);
            setDslText(updatedDSL);
            toast.success(`Duplicated: ${selectedNodeId}`);
          }
        }
      }
      
      // P for properties toggle
      if (e.key === 'p' || e.key === 'P') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            setActivePanel(prev => prev === 'properties' ? 'none' : 'properties');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [dslText, diagramMode, selectedNodeId, clipboard, setClipboard, setDslText]);

  // Auto-save setup
  useEffect(() => {
    saveManager.startAutosave(() => {
      if (!dslText || dslText.trim().length === 0) return null;
      
      const title = extractTitle(dslText) || 'Untitled Diagram';
      const mode: SavedDiagramMode = (diagramMode === 'architecture' || diagramMode === 'flow') 
        ? diagramMode 
        : 'architecture';
      return { title, dslText, mode };
    });

    return () => saveManager.stopAutosave();
  }, [dslText, diagramMode]);

  // Load saved diagram on mount
  useEffect(() => {
    const saved = saveManager.getCurrentDiagram();
    if (saved) {
      setDslText(saved.dslText);
      setDiagramMode(saved.mode);
      setActiveTab(saved.mode);
      setLastSaved(new Date(saved.updatedAt));
    }
  }, []);

  const handleLoadDiagram = (diagram: SavedDiagram) => {
    setDslText(diagram.dslText);
    setDiagramMode(diagram.mode);
    setActiveTab(diagram.mode);
    setLastSaved(new Date(diagram.updatedAt));
    setSaveStatus('saved');
    toast.success(`Loaded: ${diagram.title}`);
  };

  const handleNewDiagram = () => {
    setDslText(ARCHITECTURE_DSL);
    setDiagramMode('architecture');
    setActiveTab('architecture');
    setSaveStatus('unsaved');
    toast.info('Created new diagram');
  };

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
    setActivePanel('none'); // Close panel after import
  };

  const togglePanel = (panel: PanelType) => {
    setActivePanel(prev => prev === panel ? 'none' : panel);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-6">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="app-logo">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="app-title">DiagramTool</h1>
        </div>
        
        {/* Mode Tabs */}
        <div className="mode-tabs flex-shrink-0">
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
        
        {/* Status */}
        <div className="flex-shrink-0">
          <span className="status-badge bg-blue-100 text-blue-800">
            <span className="capitalize">{diagramMode} Mode</span>
          </span>
        </div>
        
        {/* Actions */}
        <div className="ml-auto flex items-center gap-3">
          {/* Undo/Redo Controls */}
          <UndoRedoControls />
          
          {/* Divider */}
          <div className="w-px h-6 bg-gray-300" />
          
          {/* File Menu */}
          <FileMenu
            currentDsl={dslText}
            mode={(diagramMode === 'architecture' || diagramMode === 'flow') ? diagramMode : 'architecture'}
            onLoad={handleLoadDiagram}
            onNew={handleNewDiagram}
          />
          
          {/* Save Status */}
          {lastSaved && (
            <span className="text-xs text-gray-500">
              {saveStatus === 'saving' ? 'Saving...' : 
               saveStatus === 'saved' ? `Saved ${formatTimeAgo(lastSaved)}` : 
               'Unsaved'}
            </span>
          )}
          
          <button
            onClick={() => togglePanel('import')}
            className={`btn ${activePanel === 'import' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Import CSV
          </button>
          
          <button
            onClick={() => togglePanel('export')}
            className={`btn ${activePanel === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Export
          </button>
          
          <button
            onClick={() => togglePanel('properties')}
            className={`btn ${activePanel === 'properties' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Properties
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
        
        {/* Side Panel - No Overlap! */}
        {activePanel !== 'none' && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
            {activePanel === 'properties' && <PropertiesPanel />}
            {activePanel === 'import' && <ImportPanel onImport={handleCSVImport} />}
            {activePanel === 'export' && <ExportPanel onExport={handleExport} />}
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
          Press <kbd className="kbd">P</kbd> for Properties
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500">Zoom:</span>
          <span className="font-semibold text-gray-900">100%</span>
        </div>
      </footer>
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

// Helper functions
function extractTitle(dsl: string): string | null {
  const match = dsl.match(/title:\s*(.+)/);
  return match ? match[1].trim() : null;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 120) return '1h ago';
  
  return date.toLocaleTimeString();
}

export default App;
