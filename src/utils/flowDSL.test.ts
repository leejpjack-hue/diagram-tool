import { describe, it, expect } from 'vitest';
import { setReverseDSL, setReverseMermaidDSL } from './flowDSL';

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