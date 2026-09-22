import { describe, it, expect } from 'vitest';
import { plainStepsToDSL } from './plainSteps';
import { parseDiagram } from './parser';

describe('plainStepsToDSL (converter output shape)', () => {
  it('converts one plain step per line into nodes + edges in order', () => {
    const dsl = plainStepsToDSL('Check email\nSend reply\nArchive');
    const parsed = parseDiagram(dsl);
    expect(parsed.mode).toBe('flow');
    expect(parsed.nodes.filter(n => n.type === 'flow')).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges.map(e => `${e.from}->${e.to}`)).toEqual([
      'check_email->send_reply',
      'send_reply->archive',
    ]);
  });

  it('uses step text as the visible label', () => {
    const parsed = parseDiagram(plainStepsToDSL('Check email\nSend reply'));
    const first = parsed.nodes.find(n => n.id === 'check_email');
    expect((first as { properties: { label?: string } }).properties.label).toBe('Check email');
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
    const input = 'Check email\nIf error then Retry else Flag';
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
