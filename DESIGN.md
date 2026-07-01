# diagram-tool — Design Document

This document describes the **diagram-tool** codebase for new contributors. The two diagrams below are written in the tool's own DSL, so you can copy the contents of any code block into the editor on the left of the running app and see the diagram render on the right.

The diagrams are kept up to date with the code — both are verified with `verify_diagram` from the bundled MCP server (`mcp-server/`) before each commit.

## 1. System Architecture

The tool is a single-page React app with a clear layering: **frontend** (what the user sees) → **state** (Zustand) → **parser** (the source of truth) → **utils** (layout / persistence / DSL helpers). An out-of-process MCP server exposes the same parser to AI agents over stdio.

```
diagram: architecture
title: diagram-tool — System Architecture
direction: TB

# =========================================================================
# Frontend (React SPA) — every component the user sees and interacts with
# =========================================================================
cloud Browser {
  icon: "UI"
  color: "#3b82f6"
  tech: "React 19 + Vite + Tailwind 4"
}

service DSLEditor {
  icon: "ED"
  color: "#3b82f6"
  tech: "@monaco-editor/react"
  connects: Parser
}

service Canvas {
  icon: "CV"
  color: "#3b82f6"
  tech: "@xyflow/react + custom nodes"
  connects: DiagramStore
}

service PropertiesPanel {
  icon: "PP"
  color: "#3b82f6"
  tech: "right-rail panel"
  connects: DiagramStore
}

service TemplatePicker {
  icon: "TP"
  color: "#3b82f6"
  tech: "20+ built-in templates"
  connects: DiagramStore
}

service ExportPanel {
  icon: "EX"
  color: "#3b82f6"
  tech: "PNG / JPG / PDF / JSON / CSV"
  connects: Canvas
}

# =========================================================================
# State — Zustand stores, single source of truth
# =========================================================================
service DiagramStore {
  icon: "ST"
  color: "#22c55e"
  tech: "Zustand · dslText + parsedDiagram"
}

service GanttStore {
  icon: "ST"
  color: "#22c55e"
  tech: "Zustand · tasks + dependencies"
}

# =========================================================================
# Parser pipeline — DSL → AST
# =========================================================================
service Lexer {
  icon: "LX"
  color: "#a855f7"
  tech: "tokenise DSL text"
  connects: Parser
}

service Parser {
  icon: "PR"
  color: "#a855f7"
  tech: "Parser class + Mermaid transpiler"
  connects: DiagramStore
}

# =========================================================================
# Layout / persistence / utils
# =========================================================================
service AutoLayout {
  icon: "AL"
  color: "#f59e0b"
  tech: "hierarchical + force-directed"
  connects: Canvas
}

service SaveManager {
  icon: "SV"
  color: "#f59e0b"
  tech: "localStorage autosave"
  connects: DiagramStore
}

service DSLHelpers {
  icon: "DH"
  color: "#f59e0b"
  tech: "addConnection / setReverse / etc."
  connects: DiagramStore
}

# =========================================================================
# External integrations
# =========================================================================
cloud LocalStorage {
  icon: "LS"
  color: "#64748b"
  tech: "browser storage"
}

cloud MCPClient {
  icon: "AI"
  color: "#ec4899"
  tech: "opencode / claude code / Claude Desktop"
}

# Cross-pipeline edges with meaningful labels
edge Browser -> DSLEditor { label: "hosts" }
edge Browser -> Canvas { label: "hosts" }
edge Browser -> PropertiesPanel { label: "hosts" }
edge Browser -> TemplatePicker { label: "hosts" }
edge Browser -> ExportPanel { label: "hosts" }
edge DSLEditor -> Parser { label: "parse(text)" }
edge Parser -> DiagramStore { label: "setParsedDiagram" }
edge DSLHelpers -> DiagramStore { label: "mutate dslText" }
edge DiagramStore -> Canvas { label: "nodes / edges" }
edge DiagramStore -> PropertiesPanel { label: "selectedNode" }
edge TemplatePicker -> DiagramStore { label: "load DSL" }
edge ExportPanel -> Canvas { label: "html-to-image" }
edge Canvas -> AutoLayout { label: "positions" }
edge SaveManager -> LocalStorage { label: "autosave" }
edge SaveManager -> DiagramStore { label: "load current" }
edge MCPClient -> MCPClient { label: "MCP stdio (separate process)" }

# Group containers
group Frontend {
  label: "Frontend · React SPA"
  color: "#3b82f6"
  contains: DSLEditor, Canvas, PropertiesPanel, TemplatePicker, ExportPanel
}

group State {
  label: "State · Zustand"
  color: "#22c55e"
  contains: DiagramStore, GanttStore
}

group Parser {
  label: "Parser Pipeline"
  color: "#a855f7"
  contains: Lexer, Parser
}

group Utils {
  label: "Utils · Layout / Save / DSL"
  color: "#f59e0b"
  contains: AutoLayout, SaveManager, DSLHelpers
}

# Annotations
note "Parser is the single source of truth — every edit writes dslText then re-parses." {
  color: "#fbbf24"
  at: 380, 760
}

note "Browser ↔ MCPClient is an out-of-process stdio link to a separate Node server (../mcp-server/)." {
  color: "#fbbf24"
  at: 380, 800
}
```

### Key takeaways for contributors

- **DSL is the source of truth.** Every code path that mutates a diagram writes `dslText` and re-parses. The UI is a projection of `parsedDiagram`, not the other way around.
- **`src/parser/`** is the heart of the tool. `lexer.ts` tokenises, `parser.ts` builds the AST, and `mermaidFlow.ts` transpiles Mermaid syntax into the same AST.
- **`src/store/diagramStore.ts`** (Zustand) holds the two pieces of state that drive rendering: `dslText` and `parsedDiagram`. Every other piece of UI reads from here.
- **`src/utils/`** holds the side-effecty code that mutates the DSL: `connectDSL.ts` (architecture connections), `flowDSL.ts` (flow reverse toggle, Mermaid-aware), `autoLayout.ts` (hierarchical + force-directed), `saveManager.ts` (localStorage).
- **`mcp-server/`** is a sibling directory with its own `package.json` and an MCP server that exposes the same parser to AI agents. It has no runtime dependency on the web app — it imports the parser source via relative paths.

## 2. DSL → Render Flow

How a user action becomes a rendered diagram. Every interactive path funnels through the same `setDslText → parse → setParsedDiagram → re-render` cycle, which is why the rest of the code can be agnostic to who is editing (a human, a template loader, or an AI agent).

```
diagram: flow
title: diagram-tool — DSL to Render Flow
direction: LR

# App startup: open browser → load state → show IDE
start OpenBrowser

OpenBrowser -> LoadState
LoadState -> ShowIDE

# Main loop: edit DSL → (maybe transpile) → parse → update store → re-render
# Re-render triggers autosave, then we settle back into the IDE.
ShowIDE -> UserEditsDSL
UserEditsDSL -> IsMermaid
IsMermaid ->|Yes| TranspileMermaid
IsMermaid ->|No|  ParseNative
TranspileMermaid -> ParseNative
ParseNative -> UpdateStore
UpdateStore -> ReRender
ReRender -> Persist
Persist -> ShowIDE

# User interaction branch: drag, connect, double-click, template, export, MCP
# All of these also funnel through UpdateStore so the same render path applies.
ShowIDE -> UserAction
UserAction ->|drag node|     MoveNode
UserAction ->|drag edge|     AddConnection
UserAction ->|double-click|  FlipReverse
UserAction ->|click template| LoadTemplate
UserAction ->|export|        ExportImage
UserAction ->|MCP tool|      AIEdit

MoveNode     -> UpdateStore
AddConnection -> UpdateStore
FlipReverse   -> UpdateStore
LoadTemplate  -> ParseNative
ExportImage   -> Download
AIEdit        -> UpdateStore

end DiagramReady

# Node metadata
node OpenBrowser {
  label: "User opens the app"
}

node LoadState {
  label: "SaveManager loads current"
}

node ShowIDE {
  label: "Render editor + canvas"
}

node UserEditsDSL {
  label: "User types / pastes DSL"
}

node IsMermaid {
  type: decision
  label: "Mermaid syntax?"
}

node TranspileMermaid {
  label: "mermaidFlowToDSL"
  color: "#a855f7"
}

node ParseNative {
  label: "Parser.parse(text)"
  color: "#a855f7"
}

node UpdateStore {
  label: "DiagramStore.setParsedDiagram"
  color: "#22c55e"
}

node ReRender {
  label: "React Flow re-renders"
}

node UserAction {
  type: decision
  label: "User interaction?"
}

node MoveNode {
  label: "Update node position"
}

node AddConnection {
  label: "addConnectionDSL"
  color: "#f59e0b"
}

node FlipReverse {
  label: "setReverseDSL"
  color: "#f59e0b"
}

node LoadTemplate {
  label: "TemplatePicker loads DSL"
  color: "#3b82f6"
}

node ExportImage {
  label: "html2canvas / jspdf"
}

node AIEdit {
  label: "MCP tool: add_node / ..."
  color: "#ec4899"
}

node Persist {
  label: "Autosave to localStorage"
  color: "#22c55e"
}

node Download {
  label: "Download PNG / PDF"
}

# Annotation
note "Every write path funnels through DiagramStore.setDslText → Parser.parse → setParsedDiagram. The DSL is the single source of truth — UI and MCP edits both go through it." {
  color: "#fbbf24"
  at: 280, 580
}
```

### Why the funnel matters

- **One direction of data flow.** UI events and MCP calls both produce a new `dslText`, which is parsed, which produces a new `parsedDiagram`, which causes React Flow to re-render. There is no second "edit graph" path.
- **Undo/redo is free.** Since every change is a string diff against `dslText`, the existing undo/redo stack works for every edit type (typing, dragging, template loads, MCP tool calls) without per-feature wiring.
- **Autosave is reliable.** `SaveManager` subscribes to `dslText` changes, so any path that updates the DSL also persists it.
- **Mermaid and native look the same to the rest of the app.** The Mermaid transpiler is just a pre-parse step; once transpiled, the rest of the pipeline doesn't know the input was Mermaid.

## 3. File map (where to look)

| Concern | Path | Notes |
| --- | --- | --- |
| DSL syntax | `src/parser/parser.ts` | The grammar; the rest of the codebase bends to what this produces. |
| Mermaid support | `src/parser/mermaidFlow.ts` | `isMermaidFlow` + `mermaidFlowToDSL`. |
| State | `src/store/diagramStore.ts` | `dslText`, `parsedDiagram`, `selectedNodeId`, undo/redo history. |
| Canvas | `src/components/Canvas/DiagramCanvas.tsx` | ReactFlow + custom node type registry. |
| Node shapes | `src/components/Canvas/{Service,Database,Queue,Cloud,Class,GroupContainer,Annotation}Node.tsx` | One component per shape; each consumes `useLayoutHandles(reversed)`. |
| DSL mutations | `src/utils/connectDSL.ts`, `src/utils/flowDSL.ts` | Helpers called by the canvas on user events and by the MCP server. |
| Templates | `src/components/TemplatePicker/templates.ts` | Array of starter diagrams, consumed by the picker and the MCP `list_templates` tool. |
| AI integration | `mcp-server/src/server.ts` | Standalone stdio server, 11 tools. See its own README for wiring. |
| Tests | `src/parser/parser.test.ts`, `src/utils/*.test.ts`, `mcp-server/src/server.test.ts` | 100+ tests; `npm test` runs them all. |
