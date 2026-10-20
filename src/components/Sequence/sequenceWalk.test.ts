import { describe, expect, it } from 'vitest';
import { parseSequenceDiagram } from './sequenceParser';
import {
  sequenceCanWalk,
  sequenceWalkFromSource,
  sequenceWalkSessionText,
  sequenceWalkSteps,
} from './sequenceWalk';

const FRAMED = `sequenceDiagram
participant A as Agent
participant S as Search tool
participant U as User
A->>S: search flights
Note over A: waiting
alt Success
  S-->>A: results
  Note left of S: cached
else Failure
  S-)A: notify
  S--xU: timeout
end
loop until results
  A->>A: retry
end
opt
  A->U: ping
end
par One
  A->>U: side
and Two
  A->>S: other
end
`;

describe('sequenceWalkSteps', () => {
  const steps = sequenceWalkFromSource(FRAMED);

  it('walks messages and notes in order, with reply, async, failed, and enclosing frames', () => {
    expect(steps.map(step => step.caption)).toEqual([
      '1 · Agent → Search tool: search flights',
      'Note over Agent: waiting',
      '3 · Search tool → Agent: results reply (inside ALT: Success)',
      'Note left of Search tool: cached (inside ALT: Success)',
      '5 · Search tool → Agent: notify async (inside ALT: Failure)',
      '6 · Search tool → User: timeout reply failed (inside ALT: Failure)',
      '7 · Agent → Agent: retry (inside LOOP: until results)',
      '8 · Agent → User: ping (inside OPT)',
      '9 · Agent → User: side (inside PAR: One)',
      '10 · Agent → Search tool: other (inside PAR: Two)',
    ]);
    expect(steps.map(step => step.kind)).toEqual([
      'message', 'note', 'message', 'note', 'message', 'message', 'message', 'message', 'message', 'message',
    ]);
    expect(steps.every((step, index) => step.index === index && step.step === index + 1)).toBe(true);
  });

  it('nests frames outermost first and keeps a note over several participants', () => {
    const nested = sequenceWalkFromSource(`sequenceDiagram
participant A as Agent
participant B as Search tool
loop until results
  alt Success
    Note over A,B: both
    A-->>B: go
  end
end
Note right of A: after`);
    expect(nested.map(step => step.caption)).toEqual([
      'Note over Agent, Search tool: both (inside LOOP: until results) (inside ALT: Success)',
      '2 · Agent → Search tool: go reply (inside LOOP: until results) (inside ALT: Success)',
      'Note right of Agent: after',
    ]);
    expect(nested[1].participantIds).toEqual(['A', 'B']);
    expect(nested[0].participantIds).toEqual(['A', 'B']);
  });

  it('uses an empty else as the section label and ignores a bare else', () => {
    const model = parseSequenceDiagram(`sequenceDiagram
A->>B: before
alt
  A->>B: inside
else
  A-)B: other
end
A-xB: lost
else Nowhere
A->>B: after`);
    expect(sequenceWalkSteps(model).map(step => step.caption)).toEqual([
      '1 · A → B: before',
      '2 · A → B: inside (inside ALT)',
      '3 · A → B: other async (inside ALT: else)',
      '4 · A → B: lost failed',
      '5 · A → B: after',
    ]);
  });

  it('skips create and destroy rows and still walks the messages around them', () => {
    const steps = sequenceWalkFromSource(`sequenceDiagram
participant U as User
U->>U: before
create participant W as Worker
U->>W: start
destroy W
U->>U: after`);
    expect(steps.map(step => step.caption)).toEqual([
      '1 · User → User: before',
      '2 · User → Worker: start',
      '3 · User → User: after',
    ]);
    expect(steps.map(step => step.kind)).toEqual(['message', 'message', 'message']);
  });

  it('returns no steps for an empty board and does not walk notes alone', () => {
    expect(sequenceWalkSteps(null)).toEqual([]);
    expect(sequenceWalkSteps(parseSequenceDiagram('sequenceDiagram\nparticipant A'))).toEqual([]);
    const notesOnly = parseSequenceDiagram('sequenceDiagram\nparticipant A\nNote over A: hi');
    expect(sequenceWalkSteps(notesOnly)).toHaveLength(1);
    expect(sequenceCanWalk(notesOnly)).toBe(false);
    expect(sequenceCanWalk(parseSequenceDiagram('sequenceDiagram\nA->>B: hi'))).toBe(true);
    expect(sequenceCanWalk(null)).toBe(false);
  });

  it('copies the visited captions, dropping a repeated index', () => {
    const text = sequenceWalkSessionText(steps, [0, 0, 1, 2]);
    expect(text).toBe([
      '1 · Agent → Search tool: search flights',
      'Note over Agent: waiting',
      '3 · Search tool → Agent: results reply (inside ALT: Success)',
    ].join('\n'));
    expect(sequenceWalkSessionText(steps, [])).toBeUndefined();
    expect(sequenceWalkSessionText(steps, [-1, 99])).toBeUndefined();
  });
});
