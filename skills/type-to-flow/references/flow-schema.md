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
  ambiguities: Array<{ id: string; sentence: string }>; // one sentence per inferred decision, named by node id
};
```

IDs are unique, edges reference existing IDs, and each decision has at least two labeled outgoing edges. If there is no distinct alternate destination, both labeled paths can lead to the same end; the warning asks the user to review the inference. Each entry in `ambiguities` names that decision id and states, in one sentence, the spike rule's assumed yes and no targets. DiagramTool shows that list and does not write those decision edges until the person confirms or edits them. The adapter maps starts/ends to terminators, steps to process nodes, decisions to decision nodes, and retains edge labels.
