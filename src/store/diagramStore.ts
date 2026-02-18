import { create } from 'zustand';
import type { DiagramMode, ParsedDiagram } from './types';

interface DiagramStore {
  // State
  dslText: string;
  parsedDiagram: ParsedDiagram | null;
  selectedNodeId: string | null;
  diagramMode: DiagramMode;
  isLoading: boolean;
  error: string | null;
  zoomLevel: number;

  // Actions
  setDslText: (text: string) => void;
  setParsedDiagram: (diagram: ParsedDiagram | null) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setDiagramMode: (mode: DiagramMode) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setZoomLevel: (zoom: number) => void;
}

export const useDiagramStore = create<DiagramStore>((set) => ({
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

  // Actions
  setDslText: (text) => set({ dslText: text }),
  setParsedDiagram: (diagram) => set({ parsedDiagram: diagram, diagramMode: diagram?.mode || 'architecture' }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setDiagramMode: (mode) => set({ diagramMode: mode }),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ isLoading: loading }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
}));
