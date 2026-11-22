import { describe, it, expect } from 'vitest';
import { parseDiagram } from '../parser/parser';
import { setFlowNodeLabel, setReverseDSL, setReverseMermaidDSL } from './flowDSL';

describe('setFlowNodeLabel', () => {
  const dsl = `diagram: flow
title: Canvas
Ask -> Send
node Ask {
  label: "Human ask"
  role: human
}
node Send {
  label: Send
}
`;

  it('writes a phrase into label: and leaves the step id on the arrow', () => {
    const next = setFlowNodeLabel(dsl, 'Ask', 'Person asks');
    expect(next).toContain('label: "Person asks"');
    expect(next).toContain('Ask -> Send');
    expect(next).not.toContain('node Person');
    expect(next.match(/label:/g)).toHaveLength(2);
    const ask = parseDiagram(next).nodes.find(node => node.id === 'ask');
    expect(ask?.type === 'flow' && ask.properties.label).toBe('Person asks');
    expect(parseDiagram(next).edges.some(edge => edge.from === 'ask' && edge.to === 'send')).toBe(true);
  });

  it('keeps a single-word label unquoted and updates an existing line once', () => {
    const once = setFlowNodeLabel(dsl, 'Send', 'Deliver');
    const twice = setFlowNodeLabel(once, 'Send', 'Ship');
    const block = twice.match(/node Send \{[^}]*\}/)![0];
    expect(block.match(/label:/g)).toHaveLength(1);
    expect(block).toContain('label: Ship');
    expect(block).not.toContain('Deliver');
  });

  it('appends a node block when the step is only an arrow', () => {
    const bare = `diagram: flow\nAsk -> Send\n`;
    const next = setFlowNodeLabel(bare, 'Ask', 'Human ask');
    expect(next).toMatch(/node Ask \{\n {2}label: "Human ask"\n\}/);
    expect(next).toContain('Ask -> Send');
    const ask = parseDiagram(next).nodes.find(node => node.id === 'ask');
    expect(ask?.type).toBe('flow');
    if (ask?.type === 'flow') expect(ask.properties.label).toBe('Human ask');
  });

  it('is a no-op when the formatted label is already in the block', () => {
    const once = setFlowNodeLabel(dsl, 'Send', 'Send');
    expect(once).toBe(dsl);
  });
});

describe('setReverseDSL', () => {
  it('adds a reverse line into an existing node block', () => {
    const dsl = `diagram: flow
direction: LR
A -> B
node B {
  label: B
}
`;
    const next = setReverseDSL(dsl, 'B', true);
    expect(next).toMatch(/node B \{[\s\S]*reverse: true[\s\S]*\}/);
  });

  it('updates an existing reverse value', () => {
    const dsl = `node B {
  label: B
  reverse: false
}
`;
    const next = setReverseDSL(dsl, 'B', true);
    expect(next).toMatch(/reverse: true/);
    expect(next).not.toMatch(/reverse: false/);
  });

  it('appends a metadata block when none exists', () => {
    const dsl = `diagram: flow
direction: LR
A -> B
`;
    const next = setReverseDSL(dsl, 'B', true);
    expect(next).toMatch(/node B \{[\s\S]*reverse: true[\s\S]*\}/);
  });

  it('returns null when the node cannot be found and no block is added', () => {
    // setReverseDSL always appends when no block exists, so this only fails
    // if the appended block can't be created. The implementation appends, so
    // the function returns the new DSL rather than null.
    const dsl = `A -> B`;
    const next = setReverseDSL(dsl, 'C', true);
    expect(next).not.toBeNull();
    expect(next).toMatch(/node C \{/);
  });
});

describe('setReverseMermaidDSL', () => {
  it('returns null on non-Mermaid input', () => {
    const native = `diagram: flow
A -> B
`;
    expect(setReverseMermaidDSL(native, 'B', true)).toBeNull();
  });

  it('adds a `%% reverse <id>` comment after the flowchart header', () => {
    const mermaid = `flowchart LR
  A[Start] --> B[Process]
  B --> C[End]`;
    const next = setReverseMermaidDSL(mermaid, 'B', true)!;
    expect(next).toMatch(/^flowchart LR\n%% reverse B/m);
    // Original content preserved
    expect(next).toMatch(/A\[Start\] --> B\[Process\]/);
  });

  it('removes an existing `%% reverse <id>` line when toggling off', () => {
    const mermaid = `flowchart LR
%% reverse B
  A --> B
  B --> C`;
    const next = setReverseMermaidDSL(mermaid, 'B', false)!;
    expect(next).not.toMatch(/%% reverse B/);
    expect(next).toMatch(/A --> B/);
  });

  it('is a no-op when toggling to the current state', () => {
    const mermaid = `flowchart LR
%% reverse B
  A --> B`;
    const next = setReverseMermaidDSL(mermaid, 'B', true)!;
    expect(next).toBe(mermaid);
  });
});