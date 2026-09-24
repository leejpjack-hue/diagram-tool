import { describe, it, expect } from 'vitest';
import { plainStepsFromBoardSource, applyLoadedPlainSteps } from './boardToPlainSteps';
import { flowToPlainSteps } from './flowToPlainSteps';
import { parseDiagram } from './parser';

describe('boardToPlainSteps (DT-AI-07 Load steps)', () => {
  const dsl = `diagram: flow
title: "Load demo"
Ask -> Model
node Ask {
  label: "ask the question"
  role: human
}
node Model {
  label: "draft reply"
  role: model
}
`;

  it('plainStepsFromBoardSource matches flowToPlainSteps on the same board', () => {
    const viaHelper = plainStepsFromBoardSource(dsl);
    const viaDirect = flowToPlainSteps(parseDiagram(dsl));
    expect(viaHelper).toBe(viaDirect);
    expect(viaHelper).toBe('Human: ask the question\nModel: draft reply');
  });

  it('applyLoadedPlainSteps puts serializer output into textarea state and opens panel', () => {
    const payload = plainStepsFromBoardSource(dsl);
    const prev = '';
    const next = applyLoadedPlainSteps(prev, payload);
    expect(next.stepsText).toBe(payload);
    expect(next.showSteps).toBe(true);
    // empty-board failure path leaves textarea unchanged (caller catches)
    expect(prev).toBe('');
  });

  it('throws teachable error on empty board (textarea caller leaves unchanged)', () => {
    const empty = `diagram: flow
title: "Empty"
`;
    expect(() => plainStepsFromBoardSource(empty)).toThrow(/No steps on this board/);
  });
});
