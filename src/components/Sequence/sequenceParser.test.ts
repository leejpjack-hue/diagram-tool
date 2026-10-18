import { describe, it, expect } from 'vitest';
import { activationSpans, guessSequenceRole, messageLineIndices, parseSequenceDiagram, parseSequenceSource, resolveSequenceRole } from './sequenceParser';

const SAMPLE = `sequenceDiagram
title Checkout
participant U as User
participant A as API
actor S as Support

U->>A: GET /orders
A-->>U: 200 OK
U->U: Validate locally
Note over U,A: Cached for 5 min

loop Nightly
  A->>A: Cleanup
end

alt Success
  A-->>U: Done
else Failure
  A-->>S: Escalate
end`;

describe('parseSequenceDiagram', () => {
  const model = parseSequenceDiagram(SAMPLE);

  it('reads the title', () => {
    expect(model.title).toBe('Checkout');
  });

  it('collects participants with aliases and actor flag', () => {
    expect(model.participants.map(p => p.id)).toEqual(['U', 'A', 'S']);
    expect(model.participants[0].name).toBe('User');
    expect(model.participants[2].actor).toBe(true);
  });

  it('parses solid and dashed messages', () => {
    const msgs = model.items.filter(i => i.kind === 'message');
    expect(msgs[0]).toMatchObject({ from: 'U', to: 'A', text: 'GET /orders', dashed: false });
    expect(msgs[1]).toMatchObject({ from: 'A', to: 'U', text: '200 OK', dashed: true });
  });

  it('parses self messages', () => {
    const self = model.items.find(i => i.kind === 'message' && i.from === i.to && i.from === 'U');
    expect(self).toBeTruthy();
  });

  it('parses notes', () => {
    const note = model.items.find(i => i.kind === 'note');
    expect(note).toMatchObject({ targets: ['U', 'A'], position: 'over', text: 'Cached for 5 min' });
  });

  it('parses loop and alt frames with else', () => {
    const starts = model.items.filter(i => i.kind === 'frameStart');
    expect(starts.map(f => (f as { frameType: string }).frameType)).toEqual(['loop', 'alt']);
    expect(model.items.filter(i => i.kind === 'frameElse')).toHaveLength(1);
    expect(model.items.filter(i => i.kind === 'frameEnd')).toHaveLength(2);
  });

  it('reports leftover arrow lines instead of dropping them silently', () => {
    const result = parseSequenceSource(`sequenceDiagram
participant A as Alice
A -> B
`);
    expect(result.error).toMatch(/Unrecognized sequence message/i);
  });

  it('implicitly declares participants seen in messages', () => {
    const m = parseSequenceDiagram('sequenceDiagram\nX->>Y: hi');
    expect(m.participants.map(p => p.id)).toEqual(['X', 'Y']);
  });

  it('leaves autonumber off and arrow sync when the keywords are absent', () => {
    expect(model.autonumber).toBeNull();
    const msgs = model.items.filter(i => i.kind === 'message');
    expect(msgs[0]).toMatchObject({ arrow: 'sync', dashed: false });
    expect(msgs[0]).not.toHaveProperty('activate');
    expect(msgs[0]).not.toHaveProperty('deactivate');
    expect(msgs.find(i => i.kind === 'message' && i.from === 'U' && i.to === 'U')).toMatchObject({
      arrow: 'open',
      dashed: false,
    });
  });

  it('keeps messageLineIndices on the message lines only', () => {
    expect(messageLineIndices(SAMPLE)).toEqual([6, 7, 8, 12, 16, 18]);
    const rich = `sequenceDiagram
autonumber 10 5
participant A
activate A
A->>+B: one
Note over A: n
B-->>-A: two
deactivate A
A-)B: later`;
    expect(messageLineIndices(rich)).toEqual([4, 6, 8]);
  });
});

describe('sequence arrow, activation, and autonumber', () => {
  const src = `sequenceDiagram
autonumber 10 5
participant A
A->>B: sync
A-->>B: dashed sync
A->B: open
A-->B: dashed open
A-)B: async
A--)B: dashed async
A-xB: lost
A--XB: dashed lost
A->>+B: call
B-->>-A: reply
activate B
A->>B: still
deactivate B
deactivate A`;

  const model = parseSequenceDiagram(src);
  const msgs = model.items.filter(i => i.kind === 'message');

  it('reads each arrow type and keeps dashed separate', () => {
    expect(msgs.map(m => m.kind === 'message' ? { arrow: m.arrow, dashed: m.dashed, text: m.text } : null)).toEqual([
      { arrow: 'sync', dashed: false, text: 'sync' },
      { arrow: 'sync', dashed: true, text: 'dashed sync' },
      { arrow: 'open', dashed: false, text: 'open' },
      { arrow: 'open', dashed: true, text: 'dashed open' },
      { arrow: 'async', dashed: false, text: 'async' },
      { arrow: 'async', dashed: true, text: 'dashed async' },
      { arrow: 'lost', dashed: false, text: 'lost' },
      { arrow: 'lost', dashed: true, text: 'dashed lost' },
      { arrow: 'sync', dashed: false, text: 'call' },
      { arrow: 'sync', dashed: true, text: 'reply' },
      { arrow: 'sync', dashed: false, text: 'still' },
    ]);
  });

  it('reads + and - on the message', () => {
    const call = msgs.find(m => m.kind === 'message' && m.text === 'call');
    const reply = msgs.find(m => m.kind === 'message' && m.text === 'reply');
    expect(call).toMatchObject({ activate: true, from: 'A', to: 'B' });
    expect(call).not.toHaveProperty('deactivate');
    expect(reply).toMatchObject({ deactivate: true, from: 'B', to: 'A' });
    expect(reply).not.toHaveProperty('activate');
  });

  it('reads activate and deactivate lines', () => {
    expect(model.items.filter(i => i.kind === 'activate')).toEqual([{ kind: 'activate', id: 'B' }]);
    expect(model.items.filter(i => i.kind === 'deactivate')).toEqual([
      { kind: 'deactivate', id: 'B' },
      { kind: 'deactivate', id: 'A' },
    ]);
  });

  it('reads autonumber start and step', () => {
    expect(parseSequenceDiagram('sequenceDiagram\nautonumber\nA->>B: a').autonumber).toEqual({ start: 1, step: 1 });
    expect(parseSequenceDiagram('sequenceDiagram\nautonumber 10\nA->>B: a').autonumber).toEqual({ start: 10, step: 1 });
    expect(model.autonumber).toEqual({ start: 10, step: 5 });
    expect(parseSequenceDiagram('sequenceDiagram\nautonumber off\nA->>B: a').autonumber).toBeNull();
  });

  it('stacks activations, ignores a stray deactivate, and leaves an unclosed bar on the last row', () => {
    const stacked = parseSequenceDiagram(`sequenceDiagram
A->>+B: one
A->>+B: two
B-->>-A: three
B-->>-A: four`);
    expect(activationSpans(stacked.items)).toEqual([
      { id: 'B', from: 1, to: 2, depth: 1, open: false },
      { id: 'B', from: 0, to: 3, depth: 0, open: false },
    ]);

    const stray = parseSequenceDiagram(`sequenceDiagram
deactivate A
A->>B: hi`);
    expect(activationSpans(stray.items)).toEqual([]);

    const unclosed = parseSequenceDiagram(`sequenceDiagram
A->>+B: hi
B->>A: later`);
    expect(activationSpans(unclosed.items)).toEqual([
      { id: 'B', from: 0, to: 1, depth: 0, open: true },
    ]);

    const explicit = parseSequenceDiagram(`sequenceDiagram
activate B
A->>B: hi
deactivate B`);
    expect(activationSpans(explicit.items)).toEqual([
      { id: 'B', from: 0, to: 2, depth: 0, open: false },
    ]);
  });
});

describe('sequence participant roles', () => {
  it('resolves comment, then actor, then a name guess', () => {
    const model = parseSequenceDiagram(`sequenceDiagram
%% role A ai
actor A as Vector DB
participant B as Agent
actor C as GPT
participant D as Nora
%% role E human
%% role E data
participant E as GPT
participant F as Search tool
participant G as My API
participant H as Redis Cache
`);
    const role = (id: string) => model.participants.find(p => p.id === id)?.role;
    expect(role('A')).toBe('ai');
    expect(role('B')).toBe('ai');
    expect(role('C')).toBe('human');
    expect(role('D')).toBeUndefined();
    expect(model.participants.find(p => p.id === 'D')).not.toHaveProperty('role');
    expect(role('E')).toBe('data');
    expect(role('F')).toBe('tool');
    expect(role('G')).toBe('tool');
    expect(role('H')).toBe('data');
  });

  it('gives an unknown name no role, and ignores an unknown comment word', () => {
    const model = parseSequenceDiagram(`sequenceDiagram
%% role N robot
participant N as Nora
participant P as Checkout
N->>P: hi
`);
    expect(model.participants.find(p => p.id === 'N')?.role).toBeUndefined();
    expect(model.participants.find(p => p.id === 'P')?.role).toBeUndefined();
    expect(guessSequenceRole('Nora')).toBeUndefined();
    expect(guessSequenceRole('Database')).toBeUndefined();
    expect(resolveSequenceRole({ commentRole: 'check', actor: true, name: 'Agent' })).toBe('check');
    expect(resolveSequenceRole({ actor: true, name: 'Vector DB' })).toBe('human');
    expect(resolveSequenceRole({ name: 'LLM' })).toBe('ai');
    expect(resolveSequenceRole({ name: 'GPT-4' })).toBe('ai');
    expect(resolveSequenceRole({ name: 'the Store' })).toBe('data');
  });

  it('accepts a role comment in any case and does not treat it as a message', () => {
    const text = `sequenceDiagram
%% ROLE A AI
participant A
A->>A: think`;
    const model = parseSequenceDiagram(text);
    expect(model.participants[0].role).toBe('ai');
    expect(messageLineIndices(text)).toEqual([3]);
  });
});
