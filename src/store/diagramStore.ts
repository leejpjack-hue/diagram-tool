import { create } from 'zustand';
import type { DiagramMode, ParsedDiagram, ClipboardNode } from './types';

const MAX_HISTORY = 50;

interface HistoryEntry {
  dslText: string;
  diagramMode: DiagramMode;
}

interface DiagramStore {
  // State
  dslText: string;
  parsedDiagram: ParsedDiagram | null;
  selectedNodeId: string | null;
  diagramMode: DiagramMode;
  isLoading: boolean;
  error: string | null;
  zoomLevel: number;
  
  // Clipboard state
  clipboard: ClipboardNode[];
  
  // History state
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  setDslText: (text: string, trackHistory?: boolean) => void;
  setParsedDiagram: (diagram: ParsedDiagram | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setDiagramMode: (mode: DiagramMode) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  
  // Clipboard actions
  setClipboard: (nodes: ClipboardNode[]) => void;
  clearClipboard: () => void;
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  // Initial state — the Diagram Kit reference sample (Web/Mobile → CDN → Gateway
  // → Services → Data). Loaded the first time the app runs, before autosave
  // restores any user-saved diagram.
  dslText: `diagram: architecture
title: Request Path — Services to Data
direction: LR
edges: orthogonal

service Client {
  icon: "USR"
  color: "#ec4899"
  tech: "client"
  connects: CDN, Gateway
}

cloud CDN {
  icon: "CDN"
  color: "#f97316"
  tech: "static · cache"
  connects: Gateway
}

cloud Gateway {
  icon: "GW"
  color: "#8b5cf6"
  tech: "tls · rate-limit"
  connects: Auth, Orders, Payments
}

service Auth {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8081"
  connects: Postgres
}

service Orders {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8082"
  connects: Postgres, Redis, Events
}

service Payments {
  icon: "API"
  color: "#3b82f6"
  tech: "svc · :8083"
  connects: Postgres
}

database Postgres {
  color: "#a855f7"
  type: primary
}

database Redis {
  color: "#06b6d4"
  type: cache
}

queue Events {
  icon: "MQ"
  color: "#0ea5e9"
  topic: kafka
  connects: Worker
}

service Worker {
  icon: "WK"
  color: "#3b82f6"
  tech: "consumer"
  connects: ObjectStore, Analytics
}

cloud ObjectStore {
  icon: "S3"
  color: "#f97316"
  tech: "bucket"
}

cloud Analytics {
  icon: "AN"
  color: "#a855f7"
  tech: "warehouse"
}

group Edge {
  label: "Edge · cdn + ingress"
  color: "#f97316"
  contains: CDN, Gateway
}

group Services {
  label: "Services · k8s"
  color: "#3b82f6"
  contains: Auth, Orders, Payments, Worker
}

group Data {
  label: "Data & Processing"
  color: "#a855f7"
  contains: Postgres, Redis, Events, ObjectStore, Analytics
}

note "All ingress terminates TLS & is rate-limited at the gateway." {
  color: "#fbbf24"
  at: 280, 560
}

# Labelled edges — pull a few specific connections out of the diagram so they
# carry a meaningful verb (REST / dynamic / consume) instead of an anonymous
# arrow. The other connections stay declared inline on each node.
edge Client -> CDN { label: "REST" }
edge CDN -> Gateway { label: "dynamic" }
edge Events -> Worker { label: "consume" }`,
  parsedDiagram: null,
  selectedNodeId: null,
  diagramMode: 'architecture',
  isLoading: false,
  error: null,
  zoomLevel: 100,
  clipboard: [],
  history: [],
  historyIndex: -1,

  // Actions
  setDslText: (text, trackHistory = true) => {
    if (trackHistory) {
      const { dslText, diagramMode, history, historyIndex } = get();
      
      // Don't add to history if text hasn't changed
      if (text === dslText) return;
      
      // Truncate future history if we're not at the end
      const newHistory = history.slice(0, historyIndex + 1);
      
      // Add current state to history
      newHistory.push({ dslText, diagramMode });
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      
      set({ 
        dslText: text, 
        history: newHistory, 
        historyIndex: newHistory.length - 1 
      });
    } else {
      set({ dslText: text });
    }
  },
  
  setParsedDiagram: (diagram) => set({ parsedDiagram: diagram, diagramMode: diagram?.mode || 'architecture' }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setDiagramMode: (mode) => set({ diagramMode: mode }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ isLoading: loading }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
  
  // Clipboard actions
  setClipboard: (nodes) => set({ clipboard: nodes }),
  clearClipboard: () => set({ clipboard: [] }),
  
  // Undo/Redo implementation
  undo: () => {
    const { history, historyIndex } = get();
    
    if (historyIndex < 0) return;
    
    const previousEntry = history[historyIndex];
    
    // Move index back
    const newIndex = historyIndex - 1;
    
    // Restore previous state (without tracking history to avoid loops)
    set({ 
      dslText: previousEntry.dslText, 
      diagramMode: previousEntry.diagramMode,
      historyIndex: newIndex 
    });
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const nextEntry = history[newIndex];
    
    // Restore next state (without tracking history to avoid loops)
    set({ 
      dslText: nextEntry.dslText, 
      diagramMode: nextEntry.diagramMode,
      historyIndex: newIndex 
    });
  },
  
  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex >= 0;
  },
  
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
  
  clearHistory: () => set({ history: [], historyIndex: -1 }),
}));
