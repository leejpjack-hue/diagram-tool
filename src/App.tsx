import { useState, useEffect, useRef, useCallback } from 'react';
import { DSLEditor } from './components/Editor/DSLEditor';
import { UndoRedoControls } from './components/Editor/UndoRedoControls';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { GanttCanvas } from './components/Gantt/GanttCanvas';
import { GanttBoardView } from './components/Gantt/GanttBoardView';
import { SequenceCanvas } from './components/Sequence/SequenceCanvas';
import { GanttPanel } from './components/Gantt/GanttPanel';
import { GanttResourcePanel } from './components/Gantt/GanttResourcePanel';
import { GanttFilterBar } from './components/Gantt/GanttFilterBar';
import { DelayImpactPanel } from './components/Gantt/DelayImpactPanel';
import { MobileViewToggle } from './components/Gantt/MobileViewToggle';
import { PropertiesPanel } from './components/Panel/PropertiesPanel';
import { ExportPanel } from './components/Panel/ExportPanel';
import { ImportPanel } from './components/Panel/ImportPanel';
import { FileMenu } from './components/Panel/FileMenu';
import { TemplatePicker } from './components/TemplatePicker/TemplatePicker';
import type { DiagramTemplate } from './components/TemplatePicker/templates';
import { isWorkshopTemplateId } from './components/TemplatePicker/workshopTemplates';
import { parseDiagram } from './parser/parser';
import { ToastContainer } from './components/Toast/ToastContainer';
import { useDiagramStore } from './store/diagramStore';
import { useGanttStore } from './components/Gantt/ganttStore';
import { generateGanttDSL } from './components/Gantt/ganttGenerator';
import { applyBoardSource, extractBoardTitle } from './utils/sourceText';
import { exportGanttChart } from './components/Gantt/exportUtils';
import type { DelayImpactResult } from './components/Gantt/delayImpactUtils';
import { useExport } from './utils/useExport';
import { useToast } from './utils/useToast';
import { csvToDSL, csvToDiagram } from './utils/csvToDiagram';
import { saveManager, type SavedDiagram, type SavedDiagramMode } from './utils/saveManager';
import type { SimpleCSVRow } from './utils/csvParser';
import { extractNodeDSL, insertNodeDSL, duplicateNodeDSL } from './utils/clipboardUtils';
import { useMobile } from './hooks/useMobile';
import { BrandLogo } from './components/BrandLogo';
import { Dashboard, type DashboardCreateRequest } from './components/Dashboard/Dashboard';
import { PresentationCanvas } from './components/Dashboard/PresentationCanvas';
import { boardManager, toWorkspaceError, type Board, type BoardMode, type PresentationItem } from './utils/boardManager';
import { OfflineBanner, WorkspaceErrorBanner } from './components/Workspace/WorkspaceStatus';
import { BoardSizeMeter, BoardSizeWarnBanner, useBoardSizeSnapshot } from './components/Workspace/BoardSizeMeter';
import './styles/gantt-fixes.css';

const ARCHITECTURE_DSL = `diagram: architecture
title: Request Path — Services to Data
direction: LR
edges: orthogonal

service Client {
  icon: "USR"
  color: "#ec4899"
  tech: "client"
  at: 40, 312
  connects: CDN, Gateway
}

cloud CDN {
  icon: "CDN"
  color: "#f97316"
  tech: "static · cache"
  at: 290, 180
  connects: Gateway
}

cloud Gateway {
  icon: "GW"
  color: "#8b5cf6"
  tech: "tls · rate-limit"
  at: 285, 440
  connects: Auth, Orders, Payments
}

service Auth {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8081"
  at: 560, 120
  connects: Postgres
}

service Orders {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8082"
  at: 560, 300
  connects: Postgres, Redis, Events
}

service Payments {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8083"
  at: 560, 480
  connects: Postgres
}

database Postgres {
  color: "#a855f7"
  type: primary
  at: 840, 100
}

database Redis {
  color: "#06b6d4"
  type: cache
  at: 840, 260
}

queue Events {
  icon: "MQ"
  color: "#0ea5e9"
  topic: kafka
  at: 840, 430
  connects: Worker
}

service Worker {
  icon: "WK"
  color: "#3b82f6"
  tech: "consumer"
  at: 840, 580
  connects: ObjectStore, Analytics
}

cloud ObjectStore {
  icon: "S3"
  color: "#f97316"
  tech: "bucket"
  at: 1060, 240
}

cloud Analytics {
  icon: "AN"
  color: "#a855f7"
  tech: "warehouse"
  at: 1060, 420
}

group Edge {
  label: "Edge · cdn + ingress"
  color: "#f97316"
  at: 250, 150
  size: 260, 380
  contains: CDN, Gateway
}

group Services {
  label: "Services · k8s"
  color: "#3b82f6"
  at: 535, 85
  size: 215, 470
  contains: Auth, Orders, Payments
}

group Data {
  label: "Data & Processing"
  color: "#a855f7"
  at: 815, 75
  size: 405, 600
  contains: Postgres, Redis, Events, Worker, ObjectStore, Analytics
}

note "All ingress terminates TLS & is rate-limited at the gateway." {
  color: "#fbbf24"
  at: 280, 560
}

# Connector colour + connection-point demo:
# use color/colour plus from/to: top, right, bottom, or left.
edge Client -> CDN { label: "REST" color: "#ef4444" from: right to: left }
edge CDN -> Gateway { label: "dynamic" color: "#22c55e" from: bottom to: top }
edge Events -> Worker { label: "consume" colour: #f59e0b from: bottom to: top }`;

const FLOW_DSL = `diagram: flow
title: Order Approval
direction: LR

start Begin

Begin -> Submit
Submit -> InfoComplete
InfoComplete ->|No| Return
InfoComplete ->|Yes| AmountCheck
Return -> Submit
AmountCheck ->|< $5k| AutoApprove
AmountCheck ->|>= $5k| ManagerReview
AutoApprove -> Approved
ManagerReview -> ApprovedCheck
ApprovedCheck ->|Yes| Approved
ApprovedCheck ->|No| Rejected

end Approved
end Rejected

node Begin {
  label: Start
  at: 30, 268
}

node Submit {
  label: Submit Request
  at: 195, 262
}

node InfoComplete {
  type: decision
  label: "Info complete?"
  at: 400, 239
}

node Return {
  label: "Return to Customer"
  color: "#ef4444"
  at: 375, 80
}

node AmountCheck {
  type: decision
  label: "Amount > $5k?"
  at: 590, 239
}

node AutoApprove {
  label: Auto-Approve
  at: 770, 120
}

node ManagerReview {
  label: Manager Review
  at: 770, 420
}

node ApprovedCheck {
  type: decision
  label: "Approved?"
  at: 990, 395
}

node Approved {
  color: "#22c55e"
  at: 1095, 120
}

node Rejected {
  color: "#ef4444"
  at: 1095, 423
}

note "High-value orders route to a human for manual review." {
  color: "#fbbf24"
  at: 780, 510
}`;

const GANTT_DSL = `diagram: gantt
title: Project Timeline
start: 2026-02-23

group "Inception" {
  task Planning {
    start: 2026-02-23
    end: 2026-02-26
    assignee: Jack
    progress: 100
    color: #3b82f6
  }

  task Requirements {
    start: 2026-02-26
    end: 2026-03-02
    assignee: Sarah
    depends: Planning
    progress: 60
    color: #10b981
  }
}

group "Delivery" {
  task Design {
    start: 2026-03-02
    end: 2026-03-09
    assignee: Mike
    depends: Requirements
    progress: 20
    color: #f59e0b
  }

  task Development {
    start: 2026-03-05
    end: 2026-03-20
    assignee: Jack
    depends: Design
    progress: 0
    color: #8b5cf6
  }

  task Testing {
    start: 2026-03-15
    end: 2026-03-23
    assignee: Sarah
    depends: Development
    progress: 0
    color: #ec4899
  }
}

task Deployment {
  start: 2026-03-23
  end: 2026-03-25
  assignee: Mike
  depends: Testing
  milestone: true
  progress: 0
  color: #ef4444
}`;


const SEQUENCE_DSL = `sequenceDiagram
title Checkout — Payment Flow
participant U as Customer
participant W as Web App
participant P as Payment API
participant B as Bank

U->>W: Place order
W->>P: Create payment intent
P->>B: Authorise card
B-->>P: Authorised
P-->>W: Payment confirmed
Note over W,P: Receipt generated
W-->>U: Order confirmation

loop Every night
  P->>B: Settle captured payments
  B-->>P: Settlement report
end`;

function blankBoardDsl(mode: BoardMode): string {
  if (mode === 'architecture') {
    return `diagram: architecture
title: Untitled Architecture
direction: LR
edges: orthogonal

service FirstService {
  color: "#6366f1"
  tech: "edit this in the DSL"
}`;
  }
  if (mode === 'flow') {
    return `diagram: flow
title: Untitled Workflow
direction: LR

start Start
Start -> NextStep
NextStep -> Done
end Done`;
  }
  if (mode === 'sequence') {
    return `sequenceDiagram
title Untitled Sequence
participant A as Actor
participant B as System
A->>B: First message`;
  }
  return `diagram: gantt
title: Untitled Timeline
start: ${new Date().toISOString().slice(0, 10)}

task FirstTask {
  start: ${new Date().toISOString().slice(0, 10)}
  end: ${new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}
  progress: 0
  color: #6366f1
}`;
}

type PanelType = 'none' | 'properties' | 'import' | 'export';

function App() {
  const { 
    dslText, 
    setDslText, 
    diagramMode, 
    setDiagramMode, 
    parsedDiagram,
    setParsedDiagram,
    selectedNodeId,
    clipboard,
    setClipboard,
    setError,
  } = useDiagramStore();
  
  const { addTask, updateTask, setProject, tasks, dependencies } = useGanttStore();
  
  // Initialize activeTab from saved diagram if available
  const [activeTab, setActiveTab] = useState<'architecture' | 'flow' | 'sequence' | 'gantt'>(() => {
    const saved = saveManager.getCurrentDiagram();
    return (saved?.mode as 'architecture' | 'flow' | 'gantt') || 'architecture';
  });
  const [activePanel, setActivePanel] = useState<PanelType>('none');
  // Miro-style home: the board dashboard is the landing view; opening or
  // creating a board switches to the editor. A third view, `presentation`,
  // shows the per-board compose canvas for publication.
  const [view, setView] = useState<'dashboard' | 'editor' | 'presentation'>('dashboard');
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  // Board being presented and the freshly-rendered image of its diagram.
  const [presentationFor, setPresentationFor] = useState<Board | null>(null);
  const [deckItems, setDeckItems] = useState<PresentationItem[]>([]);
  const [currentDiagramImage, setCurrentDiagramImage] = useState<string | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const [showDelayImpactPanel, setShowDelayImpactPanel] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const [ganttView, setGanttView] = useState<'timeline' | 'board'>('timeline');
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const [editorWidth, setEditorWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [workspaceError, setWorkspaceError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const saved = saveManager.getCurrentDiagram();
    return saved ? new Date(saved.updatedAt) : null;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttCanvasRef = useRef<HTMLDivElement>(null);
  const thumbnailCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailCaptureInFlightRef = useRef(false);
  // This flag prevents the UI-to-DSL sync effect from writing old Gantt state
  // back over fresh editor text while a DSL parse is updating the Gantt store.
  const isUpdatingFromDSL = useRef(false);
  
  const { exportPNG, exportJPG, exportSVG, exportPDF, exportJSON, exportCSV } = useExport();
  const toast = useToast();

  useEffect(() => {
    return () => {
      if (thumbnailCaptureTimerRef.current) {
        clearTimeout(thumbnailCaptureTimerRef.current);
      }
    };
  }, []);
  
  // Parse Gantt DSL when it changes. Invalid source keeps the last good plan.
  useEffect(() => {
    if (activeTab !== 'gantt') return;
    const result = applyBoardSource(dslText, 'gantt');
    if (!result.ok || result.kind !== 'gantt') {
      setError(result.ok ? null : result.error);
      return;
    }
    setError(null);
    isUpdatingFromDSL.current = true;
    setProject(result.project.tasks, result.project.dependencies ?? []);
  }, [dslText, activeTab, setProject, setError]);
  
  // Sync DSL when tasks or dependencies change from UI
  // This ensures DSL is always the single source of truth
  useEffect(() => {
    // Don't sync if we're in non-gantt mode or if change came from DSL parsing
    if (activeTab !== 'gantt') {
      return;
    }

    if (isUpdatingFromDSL.current) {
      isUpdatingFromDSL.current = false;
      return;
    }
    
    // Only sync if we have tasks
    if (tasks.length === 0) {
      return;
    }
    
    // Generate DSL from current tasks and dependencies
    const title = extractBoardTitle(dslText, 'gantt') || 'Gantt Chart';
    const updatedDSL = generateGanttDSL(tasks, dependencies, title);
    
    // Update DSL text and mark as unsaved
    // This is a valid synchronization pattern - we're syncing UI state to DSL
    setDslText(updatedDSL);
    const timer = window.setTimeout(() => setSaveStatus('unsaved'), 0);
    return () => window.clearTimeout(timer);
    
    // Note: dslText is intentionally excluded to prevent infinite loops
    // extractBoardTitle is stable and setDslText/setSaveStatus are stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, dependencies, activeTab]);

  const handleTabChange = (tab: 'architecture' | 'flow' | 'sequence' | 'gantt') => {
    setActiveTab(tab);
    setDiagramMode(tab);

    const sampleDsl =
      tab === 'architecture' ? ARCHITECTURE_DSL :
      tab === 'flow' ? FLOW_DSL :
      tab === 'sequence' ? SEQUENCE_DSL :
      GANTT_DSL;
    setDslText(sampleDsl);
    // Parse immediately — Monaco's onChange doesn't fire for programmatic
    // value swaps, so without this the canvas keeps the previous diagram.
    // Gantt DSL is parsed by the gantt effect; sequence (Mermaid format)
    // is parsed inside SequenceCanvas.
    if (tab !== 'gantt' && tab !== 'sequence') {
      try {
        setParsedDiagram(parseDiagram(sampleDsl));
      } catch (err) {
        console.error('Sample parse error:', err);
      }
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
  const handleApplyDelayImpact = (result: DelayImpactResult) => {
    // Apply delay impact to tasks
    result.affectedTasks.forEach((affectedTask) => {
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
  
  const updateDSLWithDelay = (result: DelayImpactResult): string => {
    let updatedDSL = dslText;
    
    result.affectedTasks.forEach((affectedTask) => {
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

  const captureAndStoreBoardThumbnail = useCallback(async (boardId: string, mode: BoardMode) => {
    if (thumbnailCaptureInFlightRef.current) return;
    thumbnailCaptureInFlightRef.current = true;
    try {
      const thumbnail = await captureDiagramThumbnail(mode);
      if (thumbnail) {
        await boardManager.update(boardId, { thumbnail });
      }
    } catch (err) {
      console.warn('Dashboard thumbnail capture failed:', err);
    } finally {
      thumbnailCaptureInFlightRef.current = false;
    }
  }, []);

  const handleSave = useCallback(() => {
    setSaveStatus('saving');
    
    setTimeout(async () => {
      try {
        const title = extractBoardTitle(dslText, activeTab) || 'Untitled Diagram';
        const mode: SavedDiagramMode = (diagramMode === 'architecture' || diagramMode === 'flow') 
          ? diagramMode 
          : 'architecture';
        saveManager.saveDiagram({ title, dslText, mode });
        if (currentBoardId) {
          await boardManager.update(currentBoardId, boardPatchFromSource(dslText, activeTab));
          void captureAndStoreBoardThumbnail(currentBoardId, activeTab);
        }
        setWorkspaceError('');
        setSaveStatus('saved');
        setLastSaved(new Date());
        toast.success(`Saved: ${title}`);
      } catch (error) {
        const message = toWorkspaceError(error).message;
        setWorkspaceError(message);
        toast.error(message);
        setSaveStatus('unsaved');
      }
    }, 300);
  }, [dslText, diagramMode, currentBoardId, activeTab, captureAndStoreBoardThumbnail, toast]);

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
      
      // (Removed: bare-key 'P' shortcut to toggle properties. Monaco's
      // editor uses a contenteditable div, which the INPUT/TEXTAREA guard
      // above doesn't catch — so the shortcut intercepted every 'p' typed
      // in DSL. Use the toolbar Properties button instead.)
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [dslText, diagramMode, selectedNodeId, clipboard, setClipboard, setDslText, handleSave, toast]);

  // Auto-save setup
  useEffect(() => {
    saveManager.startAutosave(() => {
      if (!dslText || dslText.trim().length === 0) return null;
      
      const title = extractBoardTitle(dslText, activeTab) || 'Untitled Diagram';
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

  // ---- Board dashboard (Miro-style home) ----

  const openBoard = (board: Board) => {
    setCurrentBoardId(board.id);
    setDslText(board.dslText);
    setDiagramMode(board.mode);
    setActiveTab(board.mode);
    // Gantt parses via its own effect; sequence parses inside SequenceCanvas;
    // architecture/flow need an explicit re-parse (Monaco won't fire onChange).
    if (board.mode !== 'gantt' && board.mode !== 'sequence') {
      try {
        setParsedDiagram(parseDiagram(board.dslText));
      } catch (err) {
        console.error('Board parse error:', err);
        setParsedDiagram(null);
      }
    } else {
      setParsedDiagram(null);
    }
    setDeckItems(board.presentation?.items ?? []);
    if (board.presentation?.items.length && isWorkshopTemplateId(board.templateSourceId)) {
      setPresentationFor(board);
      setView('presentation');
      return;
    }
    setView('editor');
  };

  const createBoard = async (request: DashboardCreateRequest) => {
    try {
      const dslText = request.dslText ?? blankBoardDsl(request.mode);
      const board = await boardManager.create({
        title: extractBoardTitle(dslText, request.mode) || request.title?.trim() || `Untitled ${request.mode}`,
        mode: request.mode,
        dslText,
        templateSourceId: request.templateSourceId,
        spaceId: request.spaceId,
        presentation: request.presentation,
      });
      setWorkspaceError('');
      openBoard(board);
      toast.success('Board created');
    } catch (error) {
      const message = toWorkspaceError(error).message;
      setWorkspaceError(message);
      toast.error(message);
    }
  };

  const backToDashboard = async () => {
    // Flush the latest text into the board before leaving the editor.
    if (currentBoardId) {
      if (thumbnailCaptureTimerRef.current) {
        clearTimeout(thumbnailCaptureTimerRef.current);
        thumbnailCaptureTimerRef.current = null;
      }
      const thumbnail = await captureDiagramThumbnail(activeTab);
      await boardManager.update(currentBoardId, {
        ...boardPatchFromSource(dslText, activeTab),
        ...(thumbnail ? { thumbnail } : {}),
      });
    }
    setView('dashboard');
  };

  // Capture the current React Flow canvas → PNG → open the per-board
  // presentation deck with the image ready to drop. Used by both the
  // "View deck" button in the editor header and the Dashboard's
  // "Publish / present" menu entry.
  const openPresentation = async (board?: Board) => {
    let target: Board | undefined = board;
    if (!target && currentBoardId) {
      await boardManager.update(currentBoardId, boardPatchFromSource(dslText, activeTab));
      target = await boardManager.get(currentBoardId);
    }
    if (!target) {
      toast.error('Open a board first.');
      return;
    }

    // If we're already in the editor, capture the live canvas. If we got
    // here from the dashboard, there's no live canvas yet — the user can
    // click "Add current diagram" from the deck once they open the editor.
    let captured: string | null = null;
    if (view === 'editor') {
      // For ReactFlow modes (architecture / flow) capture the inner
      // `.react-flow__viewport` so we only get the diagram the user
      // actually sees, not the inflated coordinate-space wrapper that
      // ReactFlow uses internally. For other modes fall back to the
      // canvas target attribute.
      const target = getDiagramCaptureTarget(activeTab);
      if (target) {
        try {
          const { toPng } = await import('html-to-image');
          captured = await toPng(target, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            skipFonts: true,
          });
        } catch (err) {
          toast.error(err instanceof Error ? `Capture failed: ${err.message}` : 'Capture failed.');
        }
      } else {
        toast.error('No active canvas found to capture.');
      }
    }

    setPresentationFor(target);
    setDeckItems(target.presentation?.items ?? []);
    setCurrentDiagramImage(captured);
    setView('presentation');
    if (captured) toast.success('Captured the diagram — drag and resize on the deck.');
  };

  const closePresentation = () => {
    setPresentationFor(null);
    setCurrentDiagramImage(null);
    setView(currentBoardId ? 'editor' : 'dashboard');
  };

  // Live autosave: while editing a board, write changes back to it (debounced)
  // so the dashboard always holds the latest version — like Miro.
  useEffect(() => {
    if (view !== 'editor' || !currentBoardId) return;
    const t = setTimeout(() => {
      void boardManager.update(currentBoardId, boardPatchFromSource(dslText, activeTab))
        .then(() => boardManager.createVersion(currentBoardId, 'Automatic save', true))
        .then(() => setWorkspaceError(''))
        .catch(error => setWorkspaceError(toWorkspaceError(error).message));
      if (thumbnailCaptureTimerRef.current) {
        clearTimeout(thumbnailCaptureTimerRef.current);
      }
      thumbnailCaptureTimerRef.current = setTimeout(() => {
        void captureAndStoreBoardThumbnail(currentBoardId, activeTab);
      }, 1200);
    }, 800);
    return () => clearTimeout(t);
  }, [dslText, activeTab, currentBoardId, view, captureAndStoreBoardThumbnail]);

  const handleLoadDiagram = (diagram: SavedDiagram) => {
    setDslText(diagram.dslText);
    setDiagramMode(diagram.mode);
    setActiveTab(diagram.mode);
    // Monaco's onChange doesn't fire for programmatic value swaps, so re-parse
    // here or the canvas keeps the previous diagram. Saved diagrams are only
    // architecture/flow, both handled by the generic parser.
    try {
      setParsedDiagram(parseDiagram(diagram.dslText));
    } catch (err) {
      console.error('Load parse error:', err);
    }
    setLastSaved(new Date(diagram.updatedAt));
    setSaveStatus('saved');
    toast.success(`Loaded: ${diagram.title}`);
  };

  const handleNewDiagram = () => {
    setDslText(ARCHITECTURE_DSL);
    setDiagramMode('architecture');
    setActiveTab('architecture');
    try {
      setParsedDiagram(parseDiagram(ARCHITECTURE_DSL));
    } catch (err) {
      console.error('New diagram parse error:', err);
    }
    setSaveStatus('unsaved');
    toast.info('Created new diagram');
  };

  const handlePickTemplate = (tpl: DiagramTemplate) => {
    setDslText(tpl.dsl);
    setDiagramMode(tpl.mode);
    setActiveTab(tpl.mode);
    setSaveStatus('unsaved');
    // Gantt DSL is parsed by the gantt effect watching dslText; sequence
    // (Mermaid format) is parsed inside SequenceCanvas. The generic parser
    // only understands architecture/flow DSL.
    if (tpl.mode !== 'gantt' && tpl.mode !== 'sequence') {
      try {
        setParsedDiagram(parseDiagram(tpl.dsl));
      } catch (err) {
        console.error('Template parse error:', err);
      }
    }
    if (tpl.presentation?.length) {
      setDeckItems(tpl.presentation);
      if (currentBoardId) {
        void boardManager.setPresentation(currentBoardId, tpl.presentation);
      }
    }
    toast.success(`Loaded template: ${tpl.name}`);
  };

  const handleExport = (format: 'png' | 'svg' | 'jpg' | 'pdf' | 'json' | 'csv', quality = 3) => {
    // On the Gantt tab the Flow canvas (.react-flow) doesn't exist, so the
    // image formats need to be generated from the Gantt SVG chart directly.
    // JSON/CSV work the same on every tab.
    if (activeTab === 'gantt' && (format === 'png' || format === 'svg' || format === 'jpg' || format === 'pdf')) {
      if (!ganttCanvasRef.current) {
        toast.error('Could not find chart to export');
        return;
      }
      const title = extractBoardTitle(dslText, 'gantt') || 'Gantt Chart';
      exportGanttChart(
        ganttCanvasRef.current,
        { format, includeTaskList: true, dateRange: 'current' },
        title
      )
        .then(() => toast.success(`Exported as ${format.toUpperCase()}`))
        .catch((err) => {
          console.error('Export failed:', err);
          toast.error('Export failed. Please try again.');
        });
      return;
    }

    if (format === 'png') exportPNG(quality);
    else if (format === 'svg') exportSVG();
    else if (format === 'jpg') exportJPG(quality);
    else if (format === 'pdf') exportPDF(quality);
    else if (format === 'json') exportJSON();
    else if (format === 'csv') exportCSV();
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
  const boardSize = useBoardSizeSnapshot(
    parsedDiagram?.nodes.length ?? 0,
    parsedDiagram?.edges.length ?? 0,
    deckItems,
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <OfflineBanner />
      {(view === 'editor' || view === 'presentation') && <BoardSizeWarnBanner snapshot={boardSize} />}
      {workspaceError && view === 'editor' && (
        <div className="px-4 pt-3">
          <WorkspaceErrorBanner message={workspaceError} onRetry={handleSave} />
        </div>
      )}
      {/* Header */}
      {view === 'editor' && <header className="professional-header">
        {/* Logo & Title */}
        <a
          href="#"
          className="header-logo"
          onClick={(e) => { e.preventDefault(); if (view === 'editor') backToDashboard(); }}
          title="Back to your boards"
        >
          <BrandLogo size={32} />
          <span className="header-logo-text">
            DiagramTool
            <span className="header-logo-tagline">Diagrams from text</span>
          </span>
        </a>

        {view === 'editor' && (
        <button
          onClick={backToDashboard}
          className="btn btn-secondary"
          title="Back to the board dashboard"
        >
          ⌂ Boards
        </button>
        )}

        {view === 'editor' && currentBoardId && (
          <button
            onClick={() => openPresentation()}
            className="btn btn-secondary"
            title="Capture this diagram and open the per-board presentation deck"
          >
            📊 View deck
          </button>
        )}

        {view === 'editor' && (
        <>
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
            onClick={() => handleTabChange('sequence')}
            className={`tab-button ${activeTab === 'sequence' ? 'active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M7 8h10M17 14H7" />
            </svg>
            Sequence
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="status-badge badge-primary">
            <span className="capitalize">{diagramMode} Mode</span>
          </span>
          <BoardSizeMeter snapshot={boardSize} />
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
            notify={(type, msg) => (type === 'success' ? toast.success(msg) : toast.error(msg))}
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
            onClick={() => setIsTemplatePickerOpen(true)}
            className="btn btn-secondary"
            title="Browse pre-built diagram templates"
          >
            Templates
          </button>

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
          
          {/* Gantt/sequence have no node selection; this panel reads the diagram store */}
          {activeTab !== 'gantt' && activeTab !== 'sequence' && (
            <button
              onClick={() => togglePanel('properties')}
              className={`btn ${activePanel === 'properties' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Properties
            </button>
          )}
        </div>
        </>
        )}
      </header>}

      {/* Board dashboard (home) */}
      {view === 'dashboard' && (
        <Dashboard
          onOpen={openBoard}
          onCreate={createBoard}
          onPublish={openPresentation}
          notify={(type, msg) => (type === 'success' ? toast.success(msg) : toast.error(msg))}
        />
      )}

      {view === 'presentation' && presentationFor && (
        <PresentationCanvas
          board={presentationFor}
          currentDiagramImage={currentDiagramImage}
          onCaptureCurrentDiagram={() => {
            // After the user clicks "Add current diagram", the screenshot is
            // already in state; nothing more to do here — keep the trigger
            // hook so the host can react later if needed.
          }}
          onItemsChange={(items) => {
            setDeckItems(items);
          }}
          onClose={closePresentation}
          notify={(type, msg) => (type === 'success' ? toast.success(msg) : toast.error(msg))}
        />
      )}

      {/* Main Content */}
      {view === 'editor' && (
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
        {showEditor && (!isMobile || mobileView === 'editor') && (
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
        {!isMobile && showEditor && (
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
              
              {/* View + panel controls */}
              <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200">
                {/* Timeline / Board view switch */}
                <div className="flex rounded-md bg-gray-100 p-0.5">
                  <button
                    onClick={() => setGanttView('timeline')}
                    className={`px-3 py-1 rounded text-[13px] font-medium transition-colors ${
                      ganttView === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="Show tasks on a timeline"
                  >
                    📊 Timeline
                  </button>
                  <button
                    onClick={() => setGanttView('board')}
                    className={`px-3 py-1 rounded text-[13px] font-medium transition-colors ${
                      ganttView === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="Show tasks as a status board"
                  >
                    🗂️ Board
                  </button>
                </div>

                <div className="w-px h-5 bg-gray-200" />

                <button
                  onClick={() => setShowEditor(!showEditor)}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                    showEditor ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Show or hide the text editor"
                >
                  📝 Editor
                </button>
                <button
                  onClick={() => setShowTaskPanel(!showTaskPanel)}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                    showTaskPanel ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Show or hide the task list"
                >
                  📋 Tasks
                </button>
                <button
                  onClick={() => setShowResourcePanel(!showResourcePanel)}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                    showResourcePanel ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Show team workload and utilisation"
                >
                  👥 Workload
                </button>
                <button
                  onClick={() => setShowDelayImpactPanel(!showDelayImpactPanel)}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${
                    showDelayImpactPanel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Model what happens when a task slips"
                >
                  ⚡ Delay Impact
                </button>
              </div>
            </>
          )}
          <div ref={activeTab === 'gantt' ? ganttCanvasRef : undefined} className="flex-1 overflow-auto">
            {activeTab === 'gantt' ? (
              (!isMobile || mobileView === 'timeline')
                ? (ganttView === 'board' ? <GanttBoardView /> : <GanttCanvas />)
                : null
            ) : activeTab === 'sequence' ? (
              <SequenceCanvas />
            ) : (
              <DiagramCanvas />
            )}
          </div>
        </div>
        
        {/* Side Panel - shared across all tabs, including Gantt */}
        {activePanel !== 'none' && !(activePanel === 'properties' && (activeTab === 'gantt' || activeTab === 'sequence')) && (
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
        
        {/* Reopen the task panel when both side panels are hidden */}
        {activeTab === 'gantt' && (!isMobile || mobileView === 'tasks') && !showTaskPanel && !showResourcePanel && (
          <button
            onClick={() => setShowTaskPanel(true)}
            className="absolute right-0 top-20 z-10 w-8 h-24 bg-blue-500 hover:bg-blue-600 text-white rounded-l-md flex flex-col items-center justify-center gap-1 shadow-lg"
            title="Show the task list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs font-medium" style={{ writingMode: 'vertical-rl' }}>Tasks</span>
          </button>
        )}
      </div>
      )}

      {/* Footer - Minimal */}
      {view === 'editor' && (
      <footer className="app-footer">
        <span className="font-semibold text-gray-900">{diagramMode.charAt(0).toUpperCase() + diagramMode.slice(1)} Mode</span>
      </footer>
      )}
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* Template Picker Modal */}
      <TemplatePicker
        open={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onPick={handlePickTemplate}
      />
    </div>
  );
}

function boardPatchFromSource(dslText: string, mode: BoardMode) {
  const title = extractBoardTitle(dslText, mode);
  return {
    dslText,
    mode,
    ...(title ? { title } : {}),
  };
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

function getDiagramCaptureTarget(mode: BoardMode): HTMLElement | null {
  if (mode === 'sequence') {
    return (
      document.querySelector('.sequence-canvas svg')
      ?? document.querySelector('[data-canvas-target="primary"]')
    ) as HTMLElement | null;
  }

  if (mode === 'gantt') {
    return (
      document.querySelector('[data-canvas-target="primary"] svg')
      ?? document.querySelector('[data-canvas-target="primary"]')
    ) as HTMLElement | null;
  }

  return (
    document.querySelector('.react-flow__viewport')
    ?? document.querySelector('.react-flow')
  ) as HTMLElement | null;
}

async function captureDiagramThumbnail(mode: BoardMode): Promise<string | null> {
  const target = getDiagramCaptureTarget(mode);
  if (!target) return null;

  await waitForPaint();
  const restoreChrome = hideReactFlowChrome();

  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(target, {
      backgroundColor: '#ffffff',
      pixelRatio: mode === 'gantt' ? 1 : 1.5,
      cacheBust: true,
      skipFonts: true,
      filter: node => {
        const el = node as HTMLElement;
        return !(
          el.classList?.contains('react-flow__controls')
          || el.classList?.contains('react-flow__minimap')
          || el.classList?.contains('react-flow__attribution')
        );
      },
    });
    return await downscaleDataUrl(dataUrl, 720, 450);
  } finally {
    restoreChrome();
  }
}

function hideReactFlowChrome(): () => void {
  const selectors = ['.react-flow__controls', '.react-flow__minimap', '.react-flow__attribution'];
  const previous: Array<[HTMLElement, string]> = [];

  selectors.forEach(selector => {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      previous.push([el, el.style.display]);
      el.style.display = 'none';
    });
  });

  return () => {
    previous.forEach(([el, display]) => {
      el.style.display = display;
    });
  };
}

function waitForPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function downscaleDataUrl(dataUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export default App;
