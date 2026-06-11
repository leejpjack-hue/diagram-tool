import { describe, it, expect } from 'vitest';
import { parseSequenceDiagram } from './sequenceParser';

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

  it('implicitly declares participants seen in messages', () => {
    const m = parseSequenceDiagram('sequenceDiagram\nX->>Y: hi');
    expect(m.participants.map(p => p.id)).toEqual(['X', 'Y']);
  });

  it('ignores activation markers and autonumber', () => {
    const m = parseSequenceDiagram('sequenceDiagram\nautonumber\nA->>+B: call\nB-->>-A: reply\nactivate B');
    const msgs = m.items.filter(i => i.kind === 'message');
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ from: 'A', to: 'B', text: 'call' });
  });
});
