import { create } from 'zustand';
import type { DiagramMode, ParsedDiagram, ClipboardNode } from './types';
import { resolveIconStyle, type IconStyleId } from '../components/Canvas/iconStyles';

const MAX_HISTORY = 50;

interface HistoryEntry {
  dslText: string;
  diagramMode: DiagramMode;
  iconStyle: IconStyleId;
  showStepNumbers: boolean;
}

interface DiagramStore {
  // State
  dslText: string;
  parsedDiagram: ParsedDiagram | null;
  selectedNodeId: string | null;
  diagramMode: DiagramMode;
  isLoading: boolean;
  error: string | null;
  /** Non-blocking Gantt source notice, such as an unknown after: name. */
  sourceWarning: string | null;
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
  setSourceWarning: (warning: string | null) => void;
  setLoading: (loading: boolean) => void;
  setZoomLevel: (zoom: number) => void;
  
  // DT-AI-09: one-shot seed payload for the Type steps panel (template pick).
  typeStepsSeed: { payload: string; nonce: number } | null;
  queueTypeStepsSeed: (payload: string) => void;
  clearTypeStepsSeed: () => void;

  // DT-SAVE-01: transient read-only mode when viewing a shared diagram link (?share=<token>).
  isReadOnlyShared: boolean;
  sharedBoardTitle: string | null;
  setReadOnlyShared: (readOnly: boolean, title?: string | null) => void;

  // DT-STYLE-01: Flow icon style. Clean is the default and today's rendering.
  // Persisted on the board, not in the DSL. One undo step per change.
  iconStyle: IconStyleId;
  setIconStyle: (style: unknown, trackHistory?: boolean) => void;

  // DT-AI-29: Flow step numbers. Off when the board omits the field.
  // Persisted on the board, not in the DSL. One undo step per change.
  showStepNumbers: boolean;
  setShowStepNumbers: (on: boolean, trackHistory?: boolean) => void;

  // DT-AI-14: transient walk-through state — current step index, or null = off.
  // Pure view state: never persisted, never written to undo history.
  // DT-AI-19: session stack of visited step indices for Prev — pushed on every
  // Next or Choose, cleared when a walk session starts/ends.
  walkThroughStep: number | null;
  walkThroughStack: number[];
  enterWalkThrough: () => void;
  setWalkThroughStep: (step: number) => void;
  pushWalkThroughStep: (step: number) => void;
  popWalkThroughStep: () => void;
  exitWalkThrough: () => void;

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
  contains: Auth, Orders, Payments, Worker
}

group Data {
  label: "Data & Processing"
  color: "#a855f7"
  at: 815, 75
  size: 405, 600
  contains: Postgres, Redis, Events, ObjectStore, Analytics
}

note "All ingress terminates TLS & is rate-limited at the gateway." {
  color: "#fbbf24"
  at: 280, 560
}

# Connector colour + connection-point demo:
# use color/colour plus from/to: top, right, bottom, or left.
edge Client -> CDN { label: "REST" color: "#ef4444" from: right to: left }
edge CDN -> Gateway { label: "dynamic" color: "#22c55e" from: bottom to: top }
edge Events -> Worker { label: "consume" colour: #f59e0b from: bottom to: top }`,
  parsedDiagram: null,
  selectedNodeId: null,
  diagramMode: 'architecture',
  isLoading: false,
  error: null,
  sourceWarning: null,
  zoomLevel: 100,
  clipboard: [],
  typeStepsSeed: null,
  iconStyle: 'clean',
  showStepNumbers: false,
  history: [],
  historyIndex: -1,

  // Actions
  setDslText: (text, trackHistory = true) => {
    if (!trackHistory) {
      set({ dslText: text });
      return;
    }
    if (text === get().dslText) return;
    commitHistory(set, get, { dslText: text });
  },

  setIconStyle: (style, trackHistory = true) => {
    const next = resolveIconStyle(style);
    if (next === get().iconStyle) return;
    if (!trackHistory) {
      set({ iconStyle: next });
      return;
    }
    if (get().isReadOnlyShared) return;
    commitHistory(set, get, { iconStyle: next });
  },

  setShowStepNumbers: (on, trackHistory = true) => {
    const next = on === true;
    if (next === get().showStepNumbers) return;
    if (!trackHistory) {
      set({ showStepNumbers: next });
      return;
    }
    if (get().isReadOnlyShared) return;
    commitHistory(set, get, { showStepNumbers: next });
  },
  
  setParsedDiagram: (diagram) => set({ parsedDiagram: diagram, diagramMode: diagram?.mode || 'architecture' }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setDiagramMode: (mode) => {
    if (get().diagramMode === mode) return;
    set({ diagramMode: mode });
  },
  setError: (error) => set({ error }),
  setSourceWarning: (sourceWarning) => set({ sourceWarning }),
  setLoading: (loading) => set({ isLoading: loading }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
  
  // Clipboard actions
  setClipboard: (nodes) => set({ clipboard: nodes }),
  clearClipboard: () => set({ clipboard: [] }),

  // DT-AI-09: bump nonce so repeat seeds always retrigger the DSLEditor effect.
  queueTypeStepsSeed: (payload) =>
    set(state => ({ typeStepsSeed: { payload, nonce: (state.typeStepsSeed?.nonce ?? 0) + 1 } })),
  clearTypeStepsSeed: () => set({ typeStepsSeed: null }),

  isReadOnlyShared: false,
  sharedBoardTitle: null,
  setReadOnlyShared: (readOnly, title = null) =>
    set({ isReadOnlyShared: readOnly, sharedBoardTitle: readOnly ? title : null }),

  walkThroughStep: null,
  walkThroughStack: [],
  enterWalkThrough: () => set({ walkThroughStep: 0, walkThroughStack: [] }),
  setWalkThroughStep: (step) => set({ walkThroughStep: step }),
  // DT-AI-19: Next/Choose record where the walk came from so Prev follows the
  // path actually taken, not the board's topological order.
  pushWalkThroughStep: (step) =>
    set(state => {
      if (state.walkThroughStep === null) return { walkThroughStep: step, walkThroughStack: [] };
      return {
        walkThroughStep: step,
        walkThroughStack: [...state.walkThroughStack, state.walkThroughStep],
      };
    }),
  popWalkThroughStep: () =>
    set(state => {
      if (state.walkThroughStep === null) return state;
      if (state.walkThroughStack.length === 0) {
        // No session history (e.g. state seeded by an older path): keep the
        // pre-DT-AI-19 linear Prev behaviour rather than doing nothing.
        return { walkThroughStep: Math.max(0, state.walkThroughStep - 1), walkThroughStack: [] };
      }
      const stack = state.walkThroughStack.slice();
      const prev = stack.pop()!;
      return { walkThroughStep: prev, walkThroughStack: stack };
    }),
  exitWalkThrough: () => set({ walkThroughStep: null, walkThroughStack: [] }),
  
  // Undo/Redo implementation. History stores full snapshots, including the
  // live one at historyIndex, so one style or text edit is a single step
  // that both undo and redo can restore.
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const entry = history[historyIndex - 1];
    set({
      dslText: entry.dslText,
      diagramMode: entry.diagramMode,
      iconStyle: entry.iconStyle ?? 'clean',
      showStepNumbers: entry.showStepNumbers === true,
      historyIndex: historyIndex - 1,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    set({
      dslText: entry.dslText,
      diagramMode: entry.diagramMode,
      iconStyle: entry.iconStyle ?? 'clean',
      showStepNumbers: entry.showStepNumbers === true,
      historyIndex: historyIndex + 1,
    });
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },
  
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
  
  clearHistory: () => set({ history: [], historyIndex: -1 }),
}));

function snapshot(state: {
  dslText: string;
  diagramMode: DiagramMode;
  iconStyle?: IconStyleId;
  showStepNumbers?: boolean;
}): HistoryEntry {
  return {
    dslText: state.dslText,
    diagramMode: state.diagramMode,
    iconStyle: state.iconStyle ?? 'clean',
    showStepNumbers: state.showStepNumbers === true,
  };
}

function commitHistory(
  set: (partial: Partial<DiagramStore>) => void,
  get: () => DiagramStore,
  partial: Partial<HistoryEntry>,
) {
  const state = get();
  const current = snapshot(state);
  const next: HistoryEntry = { ...current, ...partial };
  if (
    next.dslText === current.dslText
    && next.diagramMode === current.diagramMode
    && next.iconStyle === current.iconStyle
    && next.showStepNumbers === current.showStepNumbers
  ) {
    return;
  }
  let history = state.history.slice(0, Math.max(0, state.historyIndex + 1));
  const tip = history[history.length - 1];
  const tipMatches = !!tip
    && tip.dslText === current.dslText
    && tip.diagramMode === current.diagramMode
    && (tip.iconStyle ?? 'clean') === current.iconStyle
    && (tip.showStepNumbers === true) === current.showStepNumbers;
  if (!tipMatches) history.push(current);
  history.push(next);
  if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
  set({ ...partial, history, historyIndex: history.length - 1 });
}
