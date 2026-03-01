import { useState, useEffect, useRef, useCallback } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { UndoRedoControls } from './components/Editor/UndoRedoControls';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { GanttCanvas } from './components/Gantt/GanttCanvas';
import { GanttPanel } from './components/Gantt/GanttPanel';
import { GanttResourcePanel } from './components/Gantt/GanttResourcePanel';
import { GanttFilterBar } from './components/Gantt/GanttFilterBar';
import { GanttExportDialog } from './components/Gantt/GanttExportDialog';
import { DelayImpactPanel } from './components/Gantt/DelayImpactPanel';
import { MobileViewToggle } from './components/Gantt/MobileViewToggle';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { ExportPanel } from './components/Panel/ExportPanel';
import { ImportPanel } from './components/Panel/ImportPanel';
import { FileMenu } from './components/Panel/FileMenu';
import { ToastContainer } from './components/Toast/ToastContainer';
import { useDiagramStore } from './store/diagramStore';
import { useGanttStore } from './components/Gantt/ganttStore';
import { parseGanttDSL } from './components/Gantt/ganttParser';
import { generateGanttDSL } from './components/Gantt/ganttGenerator';
import { exportGanttChart } from './components/Gantt/exportUtils';
import { useExport } from './utils/useExport';
import { useToast } from './utils/useToast';
import { csvToDSL, csvToDiagram } from './utils/csvToDiagram';
import { saveManager, type SavedDiagram, type SavedDiagramMode } from './utils/saveManager';
import type { SimpleCSVRow } from './utils/csvParser';
import { extractNodeDSL, insertNodeDSL, duplicateNodeDSL } from './utils/clipboardUtils';
import type { GanttExportOptions } from './components/Gantt/types';
import { useMobile } from './hooks/useMobile';
import './styles/gantt-fixes.css';

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

const GANTT_DSL = `diagram: gantt
title: Project Timeline
start: 2026-02-23

task Planning {
  start: 2026-02-23
  end: 2026-02-26
  assignee: Jack
  progress: 100
}

task Requirements {
  start: 2026-02-26
  end: 2026-03-02
  assignee: Sarah
  depends: Planning
  progress: 60
}

task Design {
  start: 2026-03-02
  end: 2026-03-09
  assignee: Mike
  depends: Requirements
  progress: 20
}

task Development {
  start: 2026-03-05
  end: 2026-03-20
  assignee: Jack
  depends: Design
  progress: 0
}

task Testing {
  start: 2026-03-15
  end: 2026-03-23
  assignee: Sarah
  depends: Development
  progress: 0
}

task Deployment {
  start: 2026-03-23
  end: 2026-03-25
  assignee: Mike
  depends: Testing
  milestone: true
  progress: 0
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
  
  const { setTasks, addTask, updateTask, setDependencies, tasks, dependencies } = useGanttStore();
  
  // Initialize activeTab from saved diagram if available
  const [activeTab, setActiveTab] = useState<'architecture' | 'flow' | 'gantt'>(() => {
    const saved = saveManager.getCurrentDiagram();
    return (saved?.mode as 'architecture' | 'flow' | 'gantt') || 'architecture';
  });
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  const [showGanttExport, setShowGanttExport] = useState(false);
  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const [showDelayImpactPanel, setShowDelayImpactPanel] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const [editorWidth, setEditorWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const saved = saveManager.getCurrentDiagram();
    return saved ? new Date(saved.updatedAt) : null;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttCanvasRef = useRef<HTMLDivElement>(null);
  
  const { exportPNG, exportSVG, exportJSON } = useExport();
  const toast = useToast();
  
  // Parse Gantt DSL when it changes
  useEffect(() => {
    if (diagramMode === 'gantt' && dslText.includes('diagram: gantt')) {
      isUpdatingFromDSL.current = true;
      const project = parseGanttDSL(dslText);
      if (project && project.tasks.length > 0) {
        setTasks(project.tasks);
        if (project.dependencies && project.dependencies.length > 0) {
          setDependencies(project.dependencies);
        }
      }
      // Reset flag after a short delay to allow the state update to complete
      setTimeout(() => {
        isUpdatingFromDSL.current = false;
      }, 100);
    }
  }, [dslText, diagramMode, setTasks, setDependencies]);
  
  // Sync DSL when tasks or dependencies change from UI
  // This ensures DSL is always the single source of truth
  const isUpdatingFromDSL = useRef(false);
  
  useEffect(() => {
    // Don't sync if we're in non-gantt mode or if change came from DSL parsing
    if (diagramMode !== 'gantt' || isUpdatingFromDSL.current) {
      return;
    }
    
    // Only sync if we have tasks
    if (tasks.length === 0) {
      return;
    }
    
    // Generate DSL from current tasks and dependencies
    const title = extractTitle(dslText) || 'Gantt Chart';
    const updatedDSL = generateGanttDSL(tasks, dependencies, title);
    
    // Update DSL text and mark as unsaved
    // This is a valid synchronization pattern - we're syncing UI state to DSL
    setDslText(updatedDSL);
    setSaveStatus('unsaved');
    
    // Note: dslText is intentionally excluded to prevent infinite loops
    // extractTitle is stable and setDslText/setSaveStatus are stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dependencies, diagramMode]);

  const handleTabChange = (tab: 'architecture' | 'flow' | 'gantt') => {
    setActiveTab(tab);
    setDiagramMode(tab);
    
    if (tab === 'architecture') {
      setDslText(ARCHITECTURE_DSL);
    } else if (tab === 'flow') {
      setDslText(FLOW_DSL);
    } else if (tab === 'gantt') {
      setDslText(GANTT_DSL);
    }
  };
  
  // Handle adding task from GanttPanel
  const handleAddGanttTask = (taskData: Partial<{ name: string; startDate: Date; endDate: Date; assignee: string }>) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    const newTask = {
      id: `task-${Date.now()}`,
      name: taskData.name || 'New Task',
      startDate: taskData.startDate || new Date(),
      endDate: taskData.endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      progress: 0,
      assignee: taskData.assignee,
      color: colors[tasks.length % colors.length],
      dependencies: [],
    };
    addTask(newTask);
    // DSL will be automatically updated by the useEffect that watches tasks
    toast.success(`Added: ${newTask.name}`);
  };
  
  // Handle delay impact apply
  const handleApplyDelayImpact = (result: any) => {
    // Apply delay impact to tasks
    result.affectedTasks.forEach((affectedTask: any) => {
      if (affectedTask.delayDays > 0) {
        const task = tasks.find(t => t.id === affectedTask.task.id);
        if (task) {
          const newStartDate = new Date(task.startDate);
          newStartDate.setDate(newStartDate.getDate() + affectedTask.delayDays);
          const newEndDate = new Date(task.endDate);
          newEndDate.setDate(newEndDate.getDate() + affectedTask.delayDays);
          
          updateTask(task.id, {
            startDate: newStartDate,
            endDate: newEndDate,
          });
        }
      }
    });
    
    // Update DSL text
    const newDSL = updateDSLWithDelay(result);
    setDslText(newDSL);
    
    // Clear visualization
    localStorage.removeItem('delayImpactVisualization');
    
    toast.success('✅ Delay impact applied! Tasks updated.');
  };
  
  const updateDSLWithDelay = (result: any): string => {
    let updatedDSL = dslText;
    
    result.affectedTasks.forEach((affectedTask: any) => {
      if (affectedTask.delayDays > 0) {
        const task = affectedTask.task;
        const newStartDate = new Date(task.startDate);
        newStartDate.setDate(newStartDate.getDate() + affectedTask.delayDays);
        const newEndDate = new Date(task.endDate);
        newEndDate.setDate(newEndDate.getDate() + affectedTask.delayDays);
        
        // Update start date in DSL
        const startDateRegex = new RegExp(
          `(task "${escapeRegex(task.name)}"[^}]*start: )\\d{4}-\\d{2}-\\d{2}`,
          's'
        );
        updatedDSL = updatedDSL.replace(startDateRegex, `$1${formatDate(newStartDate)}`);
        
        // Update end date in DSL
        const endDateRegex = new RegExp(
          `(task "${escapeRegex(task.name)}"[^}]*end: )\\d{4}-\\d{2}-\\d{2}`,
          's'
        );
        updatedDSL = updatedDSL.replace(endDateRegex, `$1${formatDate(newEndDate)}`);
      }
    });
    
    return updatedDSL;
  };
  
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle Gantt export
  const handleGanttExport = async (options: GanttExportOptions) => {
    if (!ganttCanvasRef.current) {
      toast.error('Could not find chart to export');
      return;
    }
    
    try {
      const title = extractTitle(dslText) || 'Gantt Chart';
      await exportGanttChart(ganttCanvasRef.current, options, title);
      toast.success(`Exported as ${options.format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
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

  const handleSave = useCallback(() => {
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
  }, [dslText, diagramMode, toast]);

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
  }, [dslText, diagramMode, selectedNodeId, clipboard, setClipboard, setDslText, handleSave, toast]);

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
    }
  }, [setDslText, setDiagramMode]);

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

  const handleLoadMVPSprint = () => {
    // Load MVP Sprint DSL with correct dependencies
    const mvpDSL = `# Diagram Tool MVP Sprint - 2026-02-27

diagram: gantt
title: Diagram Tool MVP Sprint
start: 2026-02-24

task "Sprint 1: Today Marker" {
  start: 2026-02-24
  end: 2026-02-24
  assignee: "Jack"
  progress: 100
  color: "#10b981"
}

task "Sprint 2: Milestone Marking" {
  start: 2026-02-27
  end: 2026-02-27
  assignee: "Jack"
  progress: 100
  color: "#10b981"
  depends: "Sprint 1: Today Marker"
}

task "Sprint 3: Export All Tasks" {
  start: 2026-02-27
  end: 2026-02-27
  assignee: "Jack"
  progress: 100
  color: "#10b981"
  depends: "Sprint 2: Milestone Marking"
}

task "UI Improvements" {
  start: 2026-02-27
  end: 2026-02-27
  assignee: "Jack"
  progress: 100
  color: "#10b981"
  depends: "Sprint 3: Export All Tasks"
}

task "Delay Impact Research" {
  start: 2026-02-27
  end: 2026-02-27
  assignee: "Jack"
  progress: 100
  color: "#10b981"
  depends: "UI Improvements"
}

task "Delay Impact MVP" {
  start: 2026-02-28
  end: 2026-03-01
  assignee: "Jack"
  progress: 0
  color: "#3b82f6"
  depends: "Delay Impact Research"
}

task "Visualization Timeline" {
  start: 2026-03-01
  end: 2026-03-01
  assignee: "Jack"
  progress: 0
  color: "#8b5cf6"
  depends: "Delay Impact MVP"
}

task "What-If Analysis" {
  start: 2026-03-02
  end: 2026-03-03
  assignee: "Jack"
  progress: 0
  color: "#8b5cf6"
  depends: "Visualization Timeline"
}

task "Risk Scoring" {
  start: 2026-03-04
  end: 2026-03-05
  assignee: "Jack"
  progress: 0
  color: "#f59e0b"
  depends: "What-If Analysis"
}

task "AI Suggestions" {
  start: 2026-03-06
  end: 2026-03-07
  assignee: "Jack"
  progress: 0
  color: "#ec4899"
  depends: "Risk Scoring"
}

task "Testing & Docs" {
  start: 2026-03-07
  end: 2026-03-07
  assignee: "Jack"
  progress: 0
  color: "#06b6d4"
  milestone: true
  depends: "AI Suggestions"
}`;
    
    setDslText(mvpDSL);
    setDiagramMode('gantt');
    setActiveTab('gantt');
    setSaveStatus('unsaved');
    toast.success('🚀 Loaded MVP Sprint with correct dependencies!');
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

  const { isMobile } = useMobile();
  const [mobileView, setMobileView] = useState<'editor' | 'timeline' | 'tasks'>('timeline');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="professional-header">
        {/* Logo & Title */}
        <a href="#" className="header-logo">
          <div className="header-logo-icon">D</div>
          <span>DiagramTool</span>
        </a>
        
        {/* Mode Tabs */}
        <div className="tab-group">
          <button
            onClick={() => handleTabChange('architecture')}
            className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Architecture
          </button>
          <button
            onClick={() => handleTabChange('flow')}
            className={`tab-button ${activeTab === 'flow' ? 'active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Flow
          </button>
          <button
            onClick={() => handleTabChange('gantt')}
            className={`tab-button ${activeTab === 'gantt' ? 'active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Gantt
          </button>
        </div>
        
        {/* Status */}
        <div className="flex-shrink-0">
          <span className="status-badge badge-primary">
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
            onLoadMVP={handleLoadMVPSprint}
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
      <div 
        ref={containerRef} 
        className="flex-1 flex overflow-hidden" 
        style={{ 
          height: 'calc(100vh - 64px)',
          minHeight: 'calc(100vh - 64px)',
          maxHeight: 'calc(100vh - 64px)'
        }}
      >
        {/* Editor Panel - Resizable */}
        {(!isMobile || mobileView === 'editor') && (
          <div 
            style={{ 
              width: isMobile ? '100%' : editorWidth, 
              minWidth: 300, 
              maxWidth: 800,
              height: '100%',
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column'
            }} 
            className="flex-shrink-0"
          >
            <DSLEditor />
          </div>
        )}
        
        {/* Resize Handle - Hide on mobile */}
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
        
        {/* Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {activeTab === 'gantt' && (
            <>
              {/* Mobile View Toggle */}
              {isMobile && (
                <div className="px-4 py-3 border-b border-gray-200">
                  <MobileViewToggle
                    currentView={mobileView}
                    onViewChange={setMobileView}
                  />
                </div>
              )}
              <GanttFilterBar />
              
              {/* Delay Impact Button */}
              <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <button
                  onClick={() => setShowDelayImpactPanel(!showDelayImpactPanel)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    showDelayImpactPanel
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ⚡ Delay Impact
                </button>
              </div>
            </>
          )}
          <div ref={activeTab === 'gantt' ? ganttCanvasRef : undefined} className="flex-1 overflow-auto">
            {activeTab === 'gantt' ? (
              (!isMobile || mobileView === 'timeline') ? <GanttCanvas /> : null
            ) : (
              <DiagramCanvas />
            )}
          </div>
        </div>
        
        {/* Side Panel - No Overlap! */}
        {activePanel !== 'none' && activeTab !== 'gantt' && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
            {activePanel === 'properties' && <PropertiesPanel />}
            {activePanel === 'import' && <ImportPanel onImport={handleCSVImport} />}
            {activePanel === 'export' && <ExportPanel onExport={handleExport} />}
          </div>
        )}
        
        {/* Gantt Panel - Show when in gantt mode and (not mobile OR in tasks view) */}
        {activeTab === 'gantt' && (!isMobile || mobileView === 'tasks') && (showTaskPanel || showResourcePanel) && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col relative">
            {/* Collapse Button */}
            <button
              onClick={() => {
                setShowTaskPanel(false);
                setShowResourcePanel(false);
              }}
              className="absolute -left-3 top-4 z-10 w-6 h-12 bg-white border border-gray-300 rounded-l-md flex items-center justify-center hover:bg-gray-100 text-gray-600 hover:text-gray-900 shadow-sm"
              title="Hide panels"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Panel Toggle */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {
                  setShowTaskPanel(true);
                  setShowResourcePanel(false);
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  showTaskPanel
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Tasks
              </button>
              <button
                onClick={() => {
                  setShowResourcePanel(true);
                  setShowTaskPanel(false);
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  showResourcePanel
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                👥 Resources
              </button>
              <button
                onClick={() => setShowGanttExport(true)}
                className="px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                title="Export"
              >
                📤
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {showTaskPanel && <GanttPanel onAddTask={handleAddGanttTask} />}
              {showResourcePanel && <GanttResourcePanel />}
            </div>
          </div>
        )}
        
        {/* Delay Impact Panel */}
        {activeTab === 'gantt' && showDelayImpactPanel && (
          <div className="w-96 flex-shrink-0 border-l border-gray-200 bg-white relative">
            {/* Close Button */}
            <button
              onClick={() => setShowDelayImpactPanel(false)}
              className="absolute -left-3 top-4 z-10 w-6 h-12 bg-white border border-gray-300 rounded-l-md flex items-center justify-center hover:bg-gray-100 text-gray-600 hover:text-gray-900 shadow-sm"
              title="Close delay impact panel"
            >
              ◀
            </button>
            
            <DelayImpactPanel
              tasks={tasks}
              dependencies={dependencies}
              onApply={handleApplyDelayImpact}
            />
          </div>
        )}
        
        {/* Show Task Panel Button (when hidden) */}
        {activeTab === 'gantt' && !showTaskPanel && !showResourcePanel && (
          <button
            onClick={() => setShowTaskPanel(true)}
            className="absolute right-0 top-4 z-10 w-8 h-12 bg-white border border-gray-300 rounded-l-md flex items-center justify-center hover:bg-gray-100 text-gray-600 hover:text-gray-900 shadow-md"
            title="Show task panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {activeTab === 'gantt' && (!isMobile || mobileView === 'tasks') && !showTaskPanel && (
          <button
            onClick={() => setShowTaskPanel(true)}
            className="absolute right-4 top-20 z-10 w-8 h-24 bg-blue-500 text-white rounded-l-md flex items-center justify-center gap-1 hover:bg-blue-600 shadow-lg"
            title="Show task panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-medium">Tasks</span>
          </button>
        )}
      </div>
      
      {/* Footer - Minimal */}
      <footer className="app-footer">
        <span className="font-semibold text-gray-900">{diagramMode.charAt(0).toUpperCase() + diagramMode.slice(1)} Mode</span>
      </footer>
      
      {/* Gantt Export Dialog */}
      <GanttExportDialog
        isOpen={showGanttExport}
        onClose={() => setShowGanttExport(false)}
        onExport={handleGanttExport}
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
