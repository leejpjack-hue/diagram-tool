import { useState, useEffect, useRef, useCallback } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { UndoRedoControls } from './components/Editor/UndoRedoControls';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { ExportPanel } from './components/Panel/ExportPanel';
import { ImportPanel } from './components/Panel/ImportPanel';
import { FileMenu } from './components/Panel/FileMenu';
import { ToastContainer } from './components/Toast/ToastContainer';
import { MobileBottomNav } from './components/Toolbar/MobileBottomNav';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [editorVisible, setEditorVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dslText, diagramMode, selectedNodeId, clipboard, setClipboard, setDslText]); // handleSave and toast are stable or intentionally excluded

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only effect - setState functions are stable

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
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header - HIDDEN on mobile (< 640px), only show on tablet+ */}
      <header className="hidden sm:flex h-14 lg:h-16 bg-white border-b border-gray-200 items-center px-3 lg:px-6 gap-2 lg:gap-6 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="app-logo">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="app-title">DiagramTool</h1>
        </div>
        
        {/* Mode Tabs */}
        <div className="mode-tabs flex-shrink-0 flex">
          <button
            onClick={() => handleTabChange('architecture')}
            className={`btn-tab ${activeTab === 'architecture' ? 'btn-tab-active' : 'btn-tab-inactive'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="hidden lg:inline ml-1">Architecture</span>
          </button>
          <button
            onClick={() => handleTabChange('flow')}
            className={`btn-tab ${activeTab === 'flow' ? 'btn-tab-active' : 'btn-tab-inactive'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden lg:inline ml-1">Flow</span>
          </button>
        </div>
        
        {/* Status - Desktop only */}
        <div className="flex-shrink-0 hidden lg:flex">
          <span className="status-badge bg-blue-100 text-blue-800">
            <span className="capitalize">{diagramMode} Mode</span>
          </span>
        </div>
        
        {/* Actions */}
        <div className="ml-auto flex items-center gap-2 lg:gap-3">
          <UndoRedoControls />
          
          <div className="hidden lg:block w-px h-6 bg-gray-300" />
          
          <FileMenu
            currentDsl={dslText}
            mode={(diagramMode === 'architecture' || diagramMode === 'flow') ? diagramMode : 'architecture'}
            onLoad={handleLoadDiagram}
            onNew={handleNewDiagram}
          />
          
          {lastSaved && (
            <span className="hidden lg:block text-xs text-gray-500">
              {saveStatus === 'saving' ? 'Saving...' : 
               saveStatus === 'saved' ? `Saved ${formatTimeAgo(lastSaved)}` : 
               'Unsaved'}
            </span>
          )}
          
          {/* Desktop buttons */}
          <button
            onClick={() => togglePanel('import')}
            className={`btn hidden lg:flex ${activePanel === 'import' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Import
          </button>
          
          <button
            onClick={() => togglePanel('export')}
            className={`btn hidden lg:flex ${activePanel === 'export' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Export
          </button>
          
          <button
            onClick={() => togglePanel('properties')}
            className={`btn hidden lg:flex ${activePanel === 'properties' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Properties
          </button>
          
          {/* Tablet hamburger menu */}
          <div className="lg:hidden relative" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn btn-secondary p-2 min-h-[44px]"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {mobileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => togglePanel('import')}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 active:bg-gray-200 flex items-center gap-2 min-h-[44px] ${activePanel === 'import' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                >
                  Import
                </button>
                <button
                  onClick={() => togglePanel('export')}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 active:bg-gray-200 flex items-center gap-2 min-h-[44px] ${activePanel === 'export' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                >
                  Export
                </button>
                <button
                  onClick={() => togglePanel('properties')}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 active:bg-gray-200 flex items-center gap-2 min-h-[44px] ${activePanel === 'properties' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}`}
                >
                  Properties
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content - Full screen on mobile */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Canvas - Always visible */}
        <div className={`flex-1 overflow-hidden bg-white ${isMobile ? 'absolute inset-0' : ''}`}>
          <DiagramCanvas />
        </div>
        
        {/* Editor Panel - Full screen overlay on mobile */}
        {(!isMobile || editorVisible) && (
          <div 
            style={{ 
              width: isMobile ? '100%' : editorWidth, 
              minWidth: isTablet ? 250 : 300, 
              maxWidth: isMobile ? '100%' : isTablet ? 600 : 800 
            }} 
            className={`flex-shrink-0 ${isMobile ? 'fixed inset-0 z-10 bg-gray-50 pb-14' : ''}`}
          >
            <DSLEditor />
          </div>
        )}
        
        {/* Resize Handle - Hidden on mobile */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            className={`w-1.5 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center transition-colors group ${
              isResizing ? 'bg-blue-500' : ''
            }`}
            style={{ userSelect: 'none' }}
          >
            <div className="w-0.5 h-12 bg-gray-300 group-hover:bg-blue-400 rounded transition-colors" />
          </div>
        )}
        
        {/* Side Panel - Slide up from bottom on mobile */}
        {activePanel !== 'none' && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 z-20"
              onClick={() => setActivePanel('none')}
            />
            {/* Panel - Full height on desktop, bottom sheet on mobile */}
            <div className={`
              ${isMobile ? 'fixed bottom-14 left-0 right-0 top-0 z-30' : ''}
              ${isTablet ? 'fixed inset-y-0 right-0 z-30 w-64' : ''}
              ${!isMobile && !isTablet ? 'w-80 border-l border-gray-200' : ''}
              flex-shrink-0 bg-white flex flex-col
              ${isMobile ? 'animate-slide-up' : ''}
            `}>
              {/* Mobile panel header */}
              {isMobile && (
                <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white flex-shrink-0">
                  <span className="font-semibold text-gray-900">
                    {activePanel === 'properties' && '📋 Properties'}
                    {activePanel === 'import' && '📥 Import CSV'}
                    {activePanel === 'export' && '📤 Export'}
                  </span>
                  <button
                    onClick={() => setActivePanel('none')}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {activePanel === 'properties' && <PropertiesPanel />}
                {activePanel === 'import' && <ImportPanel onImport={handleCSVImport} />}
                {activePanel === 'export' && <ExportPanel onExport={handleExport} />}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Footer - Hidden on mobile, simplified on tablet */}
      {!isMobile && (
        <footer className={`app-footer ${isTablet ? 'text-xs' : ''}`}>
          <span className="font-semibold text-gray-900">{diagramMode.charAt(0).toUpperCase() + diagramMode.slice(1)} Mode</span>
          {!isTablet && (
            <>
              <span className="mx-2 text-gray-400">•</span>
              <span>Editor: {editorWidth}px</span>
              <span className="mx-2 text-gray-400">•</span>
              <span className="flex items-center gap-1">
                Press <kbd className="kbd">P</kbd> for Properties
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-gray-500">Zoom:</span>
            <span className="font-semibold text-gray-900">100%</span>
          </div>
        </footer>
      )}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        editorVisible={editorVisible}
        onEditorToggle={() => setEditorVisible(!editorVisible)}
      />
      
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
