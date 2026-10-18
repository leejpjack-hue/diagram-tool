import { describe, expect, it } from 'vitest';
import { parseSequenceDiagram, parseSequenceSource } from '../components/Sequence/sequenceParser';
import type { SequenceItem } from '../components/Sequence/sequenceParser';
import {
  plainMessagesFromBoardSource,
  plainSequenceToMermaid,
  typeMessagesPreviewRows,
  type PlainSequenceLine,
} from './plainSequence';

const GOAL = [
  'User asks Agent: plan my trip',
  'Agent calls Search tool: flights',
  'Search tool replies Agent: 3 options',
  'if no flights:',
  'Agent tells User: try other dates',
  'else:',
  'Agent tells User: book it',
  'end',
].join('\n');

function built(text: string, understood?: PlainSequenceLine[]) {
  const source = plainSequenceToMermaid(text, { understood });
  const parsed = parseSequenceSource(source);
  expect(parsed.error, source).toBeNull();
  return { source, model: parsed.model };
}

function messages(items: SequenceItem[]) {
  return items.filter(item => item.kind === 'message');
}

describe('plainSequenceToMermaid', () => {
  it('turns the goal path into participants, a dashed reply, and an alt frame', () => {
    const understood: PlainSequenceLine[] = [];
    const { source, model } = built(GOAL, understood);
    expect(model.participants.map(item => item.name)).toEqual(['User', 'Agent', 'Search tool']);
    const found = messages(model.items);
    expect(found.map(item => item.kind === 'message' ? item.text : '')).toEqual([
      'plan my trip',
      'flights',
      '3 options',
      'try other dates',
      'book it',
    ]);
    expect(found[2]).toMatchObject({ dashed: true, arrow: 'sync', from: 'Search_tool', to: 'Agent' });
    expect(source).toContain('Search_tool-->>Agent: 3 options');
    expect(source).toContain('participant Search_tool as Search tool');
    const alt = model.items.find(item => item.kind === 'frameStart');
    expect(alt).toMatchObject({ frameType: 'alt', label: 'no flights' });
    expect(understood[0].summary).toBe('User → Agent (call) "plan my trip"');
    expect(understood[2].summary).toBe('Search tool → Agent (reply) "3 options"');
    expect(understood[3].summary).toBe('alt no flights');
    expect(plainMessagesFromBoardSource(source)).toBe(GOAL);
  });

  it('maps every verb class and both arrow spellings', () => {
    for (const verb of ['asks', 'calls', 'sends', 'tells', 'uses']) {
      const { source, model } = built(`User ${verb} Agent: hi`);
      expect(source).toContain('User->>Agent: hi');
      expect(messages(model.items)[0]).toMatchObject({ dashed: false, arrow: 'sync', text: 'hi' });
    }
    for (const verb of ['replies', 'returns', 'answers', 'responds']) {
      const { source, model } = built(`User ${verb} Agent: hi`);
      expect(source).toContain('User-->>Agent: hi');
      expect(messages(model.items)[0]).toMatchObject({ dashed: true, arrow: 'sync' });
    }
    for (const verb of ['notifies', 'fires', 'emits']) {
      const { source, model } = built(`User ${verb} Agent: hi`);
      expect(source).toContain('User-)Agent: hi');
      expect(messages(model.items)[0]).toMatchObject({ dashed: false, arrow: 'async' });
    }
    expect(built('User -> Agent: hi').source).toContain('User->>Agent: hi');
    expect(built('User => Agent: hi').source).toContain('User->>Agent: hi');
    expect(built('User=>Agent: hi').source).not.toContain('-->>');
    expect(built('USER ASKS Agent: Hi').model.participants.map(item => item.id)).toEqual(['USER', 'Agent']);
  });

  it('maps every frame', () => {
    const { model } = built([
      'if no flights:',
      'User asks Agent: a',
      'else:',
      'User asks Agent: b',
      'end',
      'repeat every minute:',
      'User asks Agent: c',
      'end',
      'maybe later:',
      'User asks Agent: d',
      'end',
      'at the same time:',
      'User asks Agent: e',
      'and:',
      'Agent asks Tool: f',
      'end',
    ].join('\n'));
    const frames = model.items.filter(item => item.kind === 'frameStart' || item.kind === 'frameElse' || item.kind === 'frameEnd');
    expect(frames).toEqual([
      { kind: 'frameStart', frameType: 'alt', label: 'no flights' },
      { kind: 'frameElse', label: '' },
      { kind: 'frameEnd' },
      { kind: 'frameStart', frameType: 'loop', label: 'every minute' },
      { kind: 'frameEnd' },
      { kind: 'frameStart', frameType: 'opt', label: 'later' },
      { kind: 'frameEnd' },
      { kind: 'frameStart', frameType: 'par', label: '' },
      { kind: 'frameElse', label: '' },
      { kind: 'frameEnd' },
    ]);
  });

  it('nests frames and closes a frame the user left open', () => {
    const text = [
      'if outer:',
      'repeat inner:',
      'User asks Agent: tick',
      'end',
      'else:',
      'maybe skip:',
      'Agent replies User: done',
      'end',
    ].join('\n');
    const { source, model } = built(text);
    expect(model.items.map(item => {
      if (item.kind === 'frameStart') return item.frameType;
      if (item.kind === 'frameElse') return 'else';
      if (item.kind === 'frameEnd') return 'end';
      if (item.kind === 'message') return item.text;
      return item.kind;
    })).toEqual(['alt', 'loop', 'tick', 'end', 'else', 'opt', 'done', 'end', 'end']);
    expect(source.trim().endsWith('end')).toBe(true);
    expect(plainMessagesFromBoardSource(source)).toBe(text);
  });

  it('stores a role comment on the first mention only', () => {
    const { source, model } = built([
      'Human: User asks AI: Agent: plan my trip',
      'Tool: Search tool replies Agent: 3 options',
      'Data: Store notifies User: saved',
      'Tool: User tells Agent: again',
      'note on User: bring a passport',
    ].join('\n'));
    expect(source).toContain('%% role User human');
    expect(source).toContain('%% role Agent ai');
    expect(source).toContain('%% role Search_tool tool');
    expect(source).toContain('%% role Store data');
    expect(source.match(/%% role User /g)).toHaveLength(1);
    expect(source).not.toContain('%% role User tool');
    expect(model.participants.map(item => item.name)).toEqual(['User', 'Agent', 'Search tool', 'Store']);
    const note = model.items.find(item => item.kind === 'note');
    expect(note).toMatchObject({ text: 'bring a passport', targets: ['User'] });
    const asyncMessage = messages(model.items).find(item => item.kind === 'message' && item.text === 'saved');
    expect(asyncMessage).toMatchObject({ arrow: 'async', from: 'Store', to: 'User' });
  });

  it('does not invent a role when the prefix shows up after the first mention', () => {
    const { source } = built('User asks Agent: hi\nHuman: User tells Agent: later');
    expect(source).not.toContain('%% role');
  });

  it('flags a garbage line and leaves it out of the diagram', () => {
    const understood: PlainSequenceLine[] = [];
    const text = 'User asks Agent: hi\nhello there\nif no flights';
    const { model } = built(text, understood);
    expect(messages(model.items)).toHaveLength(1);
    expect(understood[1].warning).toMatch(/wasn't understood/);
    expect(understood[2].warning).toMatch(/wasn't understood/);
    expect(understood[0].warning).toBeUndefined();
    expect(plainMessagesFromBoardSource(plainSequenceToMermaid(text))).toBe(text);
  });

  it('flags else and end that are not inside a frame', () => {
    const understood: PlainSequenceLine[] = [];
    built('User asks Agent: hi\nelse:\nend', understood);
    expect(understood[1].warning).toMatch(/no open/);
    expect(understood[2].warning).toMatch(/no open/);
  });

  it('strips list markers before reading the line', () => {
    const { model } = built('- User asks Agent: hi\n1. Agent replies User: ok');
    expect(messages(model.items)).toHaveLength(2);
    expect(messages(model.items)[1]).toMatchObject({ dashed: true, text: 'ok' });
  });

  it('round-trips typed lines, including blanks, after the diagram is edited', () => {
    const text = 'User asks Agent: hi\n\nhello there';
    const edited = plainSequenceToMermaid(text).replace('User->>Agent: hi', 'User->>Agent: edited');
    expect(plainMessagesFromBoardSource(edited)).toBe(text);
    expect(parseSequenceDiagram(edited).items.filter(item => item.kind === 'message')[0]).toMatchObject({ text: 'edited' });
  });

  it('does not refill a hand-written sequence diagram', () => {
    expect(plainMessagesFromBoardSource('sequenceDiagram\nparticipant A as Actor\nA->>B: hi')).toBeNull();
    expect(plainMessagesFromBoardSource('%% a note\nsequenceDiagram\nA->>B: hi')).toBeNull();
  });

  it('throws when there is nothing to draw', () => {
    expect(() => plainSequenceToMermaid('')).toThrow(/No messages found/);
    expect(() => plainSequenceToMermaid('   \n  ')).toThrow(/No messages found/);
    expect(() => plainSequenceToMermaid('if later:\nend')).toThrow(/No messages found/);
    expect(typeMessagesPreviewRows('hello there')[0].warning).toMatch(/wasn't understood/);
  });

  it('keeps a note and a reserved name as valid mermaid', () => {
    const { source, model } = built('note on Human: end: stop here\nUser asks end: go');
    expect(parseSequenceSource(source).error).toBeNull();
    expect(model.participants.map(item => item.name)).toEqual(['end', 'User']);
    expect(source).toContain('%% role end_p human');
    expect(source).toContain('participant end_p as end');
    expect(source).toContain('Note over end_p: stop here');
  });

  it('previews the same reading Build uses', () => {
    const rows = typeMessagesPreviewRows('User asks Agent: plan my trip\nnope');
    expect(rows[0]).toMatchObject({
      lineNumber: 1,
      summary: 'User → Agent (call) "plan my trip"',
    });
    expect(rows[1].warning).toMatch(/wasn't understood/);
  });
});
