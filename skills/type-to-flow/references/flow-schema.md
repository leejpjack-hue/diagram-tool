# Typed flow envelope

```ts
type TypeToFlowResult = {
  flow: {
    title: string;
    nodes: Array<{ id: string; kind: 'start' | 'step' | 'decision' | 'end'; label: string }>;
    edges: Array<{ from: string; to: string; label?: string }>;
  };
  mermaid: string; // Mermaid flowchart TD for the same nodes and edges
  warnings: string[];
};
```

IDs are unique, edges reference existing IDs, and each decision has at least two labeled outgoing edges. If there is no distinct alternate destination, both labeled paths can lead to the same end; the warning asks the user to review the inference. The DiagramTool adapter maps starts/ends to terminators, steps to process nodes, decisions to decision nodes, and retains edge labels.
