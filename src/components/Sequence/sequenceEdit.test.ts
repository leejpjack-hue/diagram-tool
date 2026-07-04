import { describe, it, expect } from 'vitest';
import { renameParticipant, editMessageText, toggleMessageDashed } from './sequenceEdit';
import { parseSequenceDiagram } from './sequenceParser';

const SAMPLE = `sequenceDiagram
title Checkout
participant U as User
participant A as API

U->>A: GET /orders
A-->>U: 200 OK
Note over U,A: cached
U->>A: POST /orders`;

describe('renameParticipant', () => {
  it('updates an existing alias', () => {
    const out = renameParticipant(SAMPLE, 'U', 'Customer');
    expect(out).toContain('participant U as Customer');
    expect(parseSequenceDiagram(out).participants.find(p => p.id === 'U')?.name).toBe('Customer');
  });

  it('adds an alias to a bare declaration', () => {
    const src = 'sequenceDiagram\nactor S\nS->>S: think';
    const out = renameParticipant(src, 'S', 'Support');
    expect(out).toContain('actor S as Support');
    const p = parseSequenceDiagram(out).participants.find(x => x.id === 'S');
    expect(p?.name).toBe('Support');
    expect(p?.actor).toBe(true);
  });

  it('inserts a declaration for an implicit participant', () => {
    const src = 'sequenceDiagram\nX->>Y: hi';
    const out = renameParticipant(src, 'Y', 'Gateway');
    expect(out).toContain('participant Y as Gateway');
    expect(parseSequenceDiagram(out).participants.find(p => p.id === 'Y')?.name).toBe('Gateway');
  });

  it('ignores empty names', () => {
    expect(renameParticipant(SAMPLE, 'U', '  ')).toBe(SAMPLE);
  });
});

describe('editMessageText', () => {
  it('rewrites the nth message text, skipping notes', () => {
    const out = editMessageText(SAMPLE, 2, 'POST /orders (retry)');
    expect(out).toContain('U->>A: POST /orders (retry)');
    const msgs = parseSequenceDiagram(out).items.filter(i => i.kind === 'message');
    expect(msgs[2]).toMatchObject({ text: 'POST /orders (retry)' });
    // Other messages untouched
    expect(msgs[0]).toMatchObject({ text: 'GET /orders' });
  });

  it('is a no-op for an out-of-range index', () => {
    expect(editMessageText(SAMPLE, 99, 'nope')).toBe(SAMPLE);
  });
});

describe('toggleMessageDashed', () => {
  it('turns a solid message dashed and back', () => {
    const dashed = toggleMessageDashed(SAMPLE, 0);
    expect(dashed).toContain('U-->>A: GET /orders');
    const back = toggleMessageDashed(dashed, 0);
    expect(back).toContain('U->>A: GET /orders');
  });

  it('round-trips through the parser', () => {
    const out = toggleMessageDashed(SAMPLE, 1); // A-->>U becomes solid
    const msgs = parseSequenceDiagram(out).items.filter(i => i.kind === 'message');
    expect(msgs[1]).toMatchObject({ dashed: false });
  });
});
