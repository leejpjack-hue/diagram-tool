import { describe, it, expect } from 'vitest';
import { plainStepsToDSL } from './plainSteps';
import { parseDiagram } from './parser';

describe('plainStepsToDSL (converter output shape)', () => {
  it('converts one plain step per line into nodes + edges in order', () => {
    const dsl = plainStepsToDSL('Verify email\nSend reply\nArchive');
    const parsed = parseDiagram(dsl);
    expect(parsed.mode).toBe('flow');
    expect(parsed.nodes.filter(n => n.type === 'flow')).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges.map(e => `${e.from}->${e.to}`)).toEqual([
      'verify_email->send_reply',
      'send_reply->archive',
    ]);
  });

  it('uses step text as the visible label', () => {
    const parsed = parseDiagram(plainStepsToDSL('Verify email\nSend reply'));
    const first = parsed.nodes.find(n => n.id === 'verify_email');
    expect((first as { properties: { label?: string } }).properties.label).toBe('Verify email');
  });

  it('treats `then` as a chain connector', () => {
    const parsed = parseDiagram(plainStepsToDSL('Log in, then Verify email, then Answer ticket'));
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges.map(e => e.to).join(' ')).toBe('verify_email answer_ticket');
  });

  it('supports `then` at line start as a cross-line continuation', () => {
    const parsed = parseDiagram(plainStepsToDSL('Log in\nthen Verify email'));
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0].from).toBe('log_in');
    expect(parsed.edges[0].to).toBe('verify_email');
  });

  it('maps `if ... then` onto a decision node with a Yes-labelled edge', () => {
    const parsed = parseDiagram(plainStepsToDSL('If invalid then Retry'));
    expect(parsed.edges).toHaveLength(1);
    const decision = parsed.nodes.find(n => n.id === 'invalid');
    expect((decision as { properties: { nodeType?: string } }).properties.nodeType).toBe('decision');
    const yes = parsed.edges[0];
    expect(yes.label).toBe('Yes');
    expect(`${yes.from}->${yes.to}`).toBe('invalid->retry');
  });

  it('maps `if ... then ... else ...` on one line to Yes/No branch labels', () => {
    const parsed = parseDiagram(plainStepsToDSL('If email valid then Deliver else Bounce'));
    const decision = parsed.nodes.find(n => n.id === 'email_valid');
    expect((decision as { properties: { nodeType?: string } }).properties.nodeType).toBe('decision');
    const labels = parsed.edges.map(e => e.label ?? '');
    expect(labels).toEqual(expect.arrayContaining(['Yes', 'No']));
    expect(parsed.edges.find(e => e.label === 'Yes')?.to).toBe('deliver');
    expect(parsed.edges.find(e => e.label === 'No')?.to).toBe('bounce');
  });

  it('supports `else` on its own line reusing the last decision', () => {
    const parsed = parseDiagram(plainStepsToDSL('If invalid then Retry\nelse Manual review'));
    expect(parsed.edges.map(e => e.label).filter(Boolean).sort()).toEqual(['No', 'Yes']);
    expect(parsed.edges.find(e => e.label === 'No')?.from).toBe('invalid');
    expect(parsed.edges.find(e => e.label === 'No')?.to).toBe('manual_review');
  });

  it('keeps a plain chain flowing through an if-node', () => {
    const parsed = parseDiagram(
      plainStepsToDSL('Capture lead\nIf qualified then Draft proposal\nApply discount')
    );
    expect(parsed.edges.map(e => `${e.from}->${e.to}`)).toEqual(
      expect.arrayContaining(['capture_lead->qualified', 'qualified->draft_proposal', 'draft_proposal->apply_discount'])
    );
  });

  it('is deterministic: same input, same output', () => {
    const input = 'Verify email\nIf error then Retry else Flag';
    expect(plainStepsToDSL(input)).toBe(plainStepsToDSL(input));
  });

  it('supports an explicit title', () => {
    const dsl = plainStepsToDSL('Do a thing', { title: 'Support workflow' });
    expect(dsl).toContain('title: "Support workflow"');
  });
});

describe('plainStepsToDSL (bad/empty input)', () => {
  it('throws a teachable error on empty input', () => {
    expect(() => plainStepsToDSL('')).toThrow(/No steps found/i);
    expect(() => plainStepsToDSL('   \n  \n')).toThrow(/No steps found/i);
  });

  it('throws when lines contain only connectors / no step text', () => {
    expect(() => plainStepsToDSL('then\nif\nelse')).toThrow(/No steps found/i);
  });

  it('throws when steps are only punctuation', () => {
    expect(() => plainStepsToDSL('!!!\n###')).not.toThrow();
  });
});

describe('plainStepsToDSL (DT-AI-04 role words)', () => {
  function roleOf(parsed: ReturnType<typeof parseDiagram>, id: string) {
    const n = parsed.nodes.find(x => x.id === id);
    return n && n.type === 'flow' ? n.properties.role : undefined;
  }

  function labelOf(parsed: ReturnType<typeof parseDiagram>, id: string) {
    const n = parsed.nodes.find(x => x.id === id);
    return n && n.type === 'flow' ? n.properties.label : undefined;
  }

  it('strips Human:/Model:/Tool:/Check: prefixes and emits role:', () => {
    const parsed = parseDiagram(
      plainStepsToDSL('Human: ask\nModel: draft\nTool: search\nCheck: review')
    );
    expect(roleOf(parsed, 'ask')).toBe('human');
    expect(roleOf(parsed, 'draft')).toBe('model');
    expect(roleOf(parsed, 'search')).toBe('tool');
    expect(roleOf(parsed, 'review')).toBe('check');
    expect(labelOf(parsed, 'ask')).toBe('ask');
    expect(labelOf(parsed, 'draft')).toBe('draft');
  });

  it('accepts bare leading role tokens followed by space', () => {
    const parsed = parseDiagram(plainStepsToDSL('Model draft reply'));
    expect(roleOf(parsed, 'draft_reply')).toBe('model');
    expect(labelOf(parsed, 'draft_reply')).toBe('draft reply');
  });

  it('is case-insensitive and allows optional space after colon', () => {
    const a = parseDiagram(plainStepsToDSL('MODEL:draft reply'));
    const b = parseDiagram(plainStepsToDSL('Tool:  look up'));
    expect(roleOf(a, 'draft_reply')).toBe('model');
    expect(labelOf(a, 'draft_reply')).toBe('draft reply');
    expect(roleOf(b, 'look_up')).toBe('tool');
    expect(labelOf(b, 'look_up')).toBe('look up');
  });

  it('leaves unknown prefixes in the label (no crash)', () => {
    const parsed = parseDiagram(plainStepsToDSL('Alien: do stuff\nRobot act'));
    expect(roleOf(parsed, 'alien_do_stuff')).toBeUndefined();
    expect(labelOf(parsed, 'alien_do_stuff')).toBe('Alien: do stuff');
    expect(roleOf(parsed, 'robot_act')).toBeUndefined();
    expect(labelOf(parsed, 'robot_act')).toBe('Robot act');
  });

  it('keeps a no-role chain identical to DT-AI-01 (no role property)', () => {
    const dsl = plainStepsToDSL('Verify email\nSend reply\nArchive');
    expect(dsl).not.toMatch(/role:/);
    const parsed = parseDiagram(dsl);
    expect(parsed.edges.map(e => `${e.from}->${e.to}`)).toEqual([
      'verify_email->send_reply',
      'send_reply->archive',
    ]);
    expect(roleOf(parsed, 'verify_email')).toBeUndefined();
  });

  it('applies role on steps inside an if/then chain', () => {
    const parsed = parseDiagram(
      plainStepsToDSL('Human: capture lead\nIf qualified then Model: draft proposal')
    );
    expect(roleOf(parsed, 'capture_lead')).toBe('human');
    expect(labelOf(parsed, 'capture_lead')).toBe('capture lead');
    const decision = parsed.nodes.find(n => n.id === 'qualified');
    expect((decision as { properties: { nodeType?: string } }).properties.nodeType).toBe('decision');
    expect(roleOf(parsed, 'draft_proposal')).toBe('model');
    expect(parsed.edges.find(e => e.label === 'Yes')?.to).toBe('draft_proposal');
  });
});
