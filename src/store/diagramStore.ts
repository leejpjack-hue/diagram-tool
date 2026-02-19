import { create } from 'zustand';
import type { DiagramMode, ParsedDiagram } from './types';

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
  
  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  // Initial state
  dslText: `diagram: architecture
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
}`,
  parsedDiagram: null,
  selectedNodeId: null,
  diagramMode: 'architecture',
  isLoading: false,
  error: null,
  zoomLevel: 100,
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
