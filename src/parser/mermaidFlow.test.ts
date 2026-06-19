import { describe, it, expect } from 'vitest';
import { isMermaidFlow } from './mermaidFlow';
import { parseDiagram } from './parser';

describe('isMermaidFlow', () => {
  it('detects flowchart and graph headers', () => {
    expect(isMermaidFlow('flowchart TD\nA-->B')).toBe(true);
    expect(isMermaidFlow('graph LR\nA-->B')).toBe(true);
    expect(isMermaidFlow('%% note\n\nflowchart TD\nA-->B')).toBe(true);
  });
  it('ignores native DSL and sequence', () => {
    expect(isMermaidFlow('diagram: flow\nA -> B')).toBe(false);
    expect(isMermaidFlow('sequenceDiagram\nA->>B: hi')).toBe(false);
  });
});

describe('mermaidFlowToDSL → parseDiagram', () => {
  it('parses shapes, labels, and direction', () => {
    const mermaid = `flowchart LR
  A[Start] --> B{Is it valid?}
  B -->|Yes| C[Process]
  B -->|No| D([Reject])
  C --> E([Done])
  D --> E`;
    const parsed = parseDiagram(mermaid);
    expect(parsed.mode).toBe('flow');
    expect(parsed.direction).toBe('LR');

    const byId = Object.fromEntries(parsed.nodes.map(n => [n.id, n]));
    // Decision shape carried through
    expect((byId['b'] as { properties: { nodeType?: string } }).properties.nodeType).toBe('decision');
    // Terminator shape
    expect((byId['e'] as { properties: { nodeType?: string } }).properties.nodeType).toBe('terminator');
    // Label preserved with punctuation
    expect((byId['b'] as { properties: { label?: string } }).properties.label).toBe('Is it valid?');

    // Labelled edges
    const yes = parsed.edges.find(e => e.from === 'b' && e.to === 'c');
    expect(yes?.label).toBe('Yes');
  });

  it('maps subgraphs to swimlanes', () => {
    const mermaid = `flowchart TD
  subgraph Customer
    A[Order] --> B[Pay]
  end
  subgraph Warehouse
    C[Pack] --> D[Ship]
  end
  B --> C`;
    const parsed = parseDiagram(mermaid);
    expect(parsed.lanes?.length).toBe(2);
    const customer = parsed.lanes?.find(l => l.name === 'Customer');
    expect(customer?.contains).toEqual(expect.arrayContaining(['a', 'b']));
    expect(parsed.edges.find(e => e.from === 'b' && e.to === 'c')).toBeTruthy();
  });

  it('handles fan-out with &', () => {
    const parsed = parseDiagram('flowchart TD\n  A --> B & C');
    expect(parsed.edges.find(e => e.from === 'a' && e.to === 'b')).toBeTruthy();
    expect(parsed.edges.find(e => e.from === 'a' && e.to === 'c')).toBeTruthy();
  });

  it('supports inline edge labels', () => {
    const parsed = parseDiagram('flowchart LR\n  A -- submits --> B');
    expect(parsed.edges.find(e => e.from === 'a' && e.to === 'b')?.label).toBe('submits');
  });
});
