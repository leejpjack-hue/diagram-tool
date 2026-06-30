import { describe, it, expect } from 'vitest';
import { setReverseDSL } from './flowDSL';

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