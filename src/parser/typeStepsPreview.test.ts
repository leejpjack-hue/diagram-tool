import { describe, expect, it } from 'vitest';
import { parseDiagram } from './parser';
import { plainStepsToDSL, type UnderstoodLine } from './plainSteps';
import {
  stepLineRange,
  suggestRoleWord,
  typeStepsPreviewRows,
  typeStepsPreviewSummary,
  type TypeStepsPreviewRow,
} from './typeStepsPreview';

function row(text: string, index = 0): TypeStepsPreviewRow {
  const rows = typeStepsPreviewRows(text);
  const found = rows[index];
  expect(found, `row ${index} of ${JSON.stringify(text)}`).toBeDefined();
  return found;
}

describe('typeStepsPreviewRows (DT-AI-28 line forms)', () => {
  it('reads a plain step', () => {
    expect(row('Ship the order')).toMatchObject({
      kind: 'step',
      kindTag: 'step',
      label: 'Ship the order',
      roles: [],
      note: undefined,
      warning: undefined,
    });
  });

  it('joins a same-line then chain and keeps a following then line as a step', () => {
    const rows = typeStepsPreviewRows('Log in, then Verify email\nthen Send reply');
    expect(rows[0]).toMatchObject({ kind: 'step', label: 'Log in · Verify email', warning: undefined });
    expect(rows[1]).toMatchObject({ kind: 'step', label: 'Send reply', lineIndex: 1 });
  });

  it('reads if/then, if/then/else, and else on its own line as decision Yes/No', () => {
    expect(row('If invalid then Retry')).toMatchObject({
      kind: 'decision',
      kindTag: 'decision Yes/No',
      label: 'invalid · Retry',
    });
    expect(row('If invalid then Retry else Reject')).toMatchObject({
      kind: 'decision',
      kindTag: 'decision Yes/No',
      label: 'invalid · Retry · Reject',
    });
    const rows = typeStepsPreviewRows('If invalid then Retry\nelse Manual review');
    expect(rows[1]).toMatchObject({
      kind: 'decision',
      kindTag: 'decision Yes/No',
      label: 'Manual review',
      lineIndex: 1,
    });
  });

  it('reads role words, aliases, bare tokens, and list markers', () => {
    expect(row('Human: ask the question')).toMatchObject({
      roles: ['human'],
      kind: 'step',
      label: 'ask the question',
    });
    expect(row('Model draft reply')).toMatchObject({ roles: ['model'], label: 'draft reply' });
    expect(row('1. User: ask')).toMatchObject({ roles: ['human'], label: 'ask' });
    expect(row('2) Assistant: answer')).toMatchObject({ roles: ['model'], label: 'answer' });
    expect(row('- System: policy')).toMatchObject({ roles: ['check'], label: 'policy' });
    expect(row('TOOL: search docs')).toMatchObject({ roles: ['tool'], label: 'search docs' });
  });

  it('reads data, memory, db, and file as data', () => {
    expect(row('Data: customer tickets')).toMatchObject({
      kind: 'data',
      kindTag: 'data',
      label: 'customer tickets',
      roles: [],
    });
    expect(row('Memory last 3 tickets')).toMatchObject({ kind: 'data', label: 'last 3 tickets' });
    expect(row('DB: crm')).toMatchObject({ kind: 'data', label: 'crm' });
    expect(row('File: brief')).toMatchObject({ kind: 'data', label: 'brief' });
  });

  it('reads an em dash or double hyphen as a note on the final label', () => {
    expect(row('Model: draft — reuse tickets')).toMatchObject({
      roles: ['model'],
      kind: 'step',
      label: 'draft',
      note: 'reuse tickets',
    });
    expect(row('Send reply -- blocks if confidence < 0.8')).toMatchObject({
      label: 'Send reply',
      note: 'blocks if confidence < 0.8',
    });
  });

  it('reads a loop that finds its target, and warns when it does not', () => {
    const found = typeStepsPreviewRows('Draft reply\nReview notes\ngo back to draft reply');
    expect(found[2]).toMatchObject({
      kind: 'loop',
      kindTag: 'loop → Draft reply',
      label: 'Draft reply',
      warning: undefined,
      lineIndex: 2,
    });
    const missing = typeStepsPreviewRows('Draft reply\ngo back to nowhere');
    expect(missing[1]).toMatchObject({
      kind: 'loop',
      kindTag: 'loop → nowhere',
      label: 'go back to nowhere',
      warning: 'go back to target not found: nowhere',
    });
  });

  it('reads parallel branches as one row', () => {
    expect(row('Tool: search docs and at the same time Tool: search tickets')).toMatchObject({
      kind: 'parallel',
      kindTag: 'parallel',
      roles: ['tool'],
      label: 'search docs · search tickets',
    });
    expect(row('File: brief in parallel with Data: tickets')).toMatchObject({
      kind: 'parallel',
      kindTag: 'parallel',
      label: 'brief · tickets',
      roles: [],
    });
  });

  it('skips empty lines and keeps their textarea indexes', () => {
    const rows = typeStepsPreviewRows('Ship\n\n  \nSend');
    expect(rows.map(item => item.lineIndex)).toEqual([0, 3]);
    expect(rows).toHaveLength(2);
  });

  it('returns no rows for empty input', () => {
    expect(typeStepsPreviewRows('')).toEqual([]);
    expect(typeStepsPreviewRows('\n  \n')).toEqual([]);
  });
});

describe('typeStepsPreviewRows warnings', () => {
  it('suggests a role word within edit distance 1 or 2', () => {
    expect(suggestRoleWord('Humna')).toBe('Human');
    expect(suggestRoleWord('Humn')).toBe('Human');
    expect(suggestRoleWord('Modle')).toBe('Model');
    expect(suggestRoleWord('Human')).toBeNull();
    expect(suggestRoleWord('Model')).toBeNull();
    expect(suggestRoleWord('Data')).toBeNull();
    expect(suggestRoleWord('Alien')).toBeNull();
    expect(suggestRoleWord('Ask')).toBeNull();
  });

  it('warns on a mistyped role prefix and leaves the converter label alone', () => {
    expect(row('Humna: ask')).toMatchObject({
      kind: 'step',
      label: 'Humna: ask',
      roles: [],
      warning: 'Did you mean Human:?',
    });
    expect(row('If invalid then Humna: retry')).toMatchObject({
      warning: 'Did you mean Human:?',
      label: 'invalid · Humna: retry',
    });
  });

  it('does not warn on an unknown prefix that is not a near-miss', () => {
    expect(row('Alien: do stuff').warning).toBeUndefined();
    expect(row('Alien: do stuff').label).toBe('Alien: do stuff');
  });

  it('warns on an empty branch after then and still shows the decision', () => {
    expect(row('If invalid then')).toMatchObject({
      kind: 'decision',
      label: 'invalid',
      warning: 'Empty branch after then',
    });
    expect(row('Validate email, then').warning).toBe('Empty branch after then');
    expect(row('If invalid then else Reject').warning).toBe('Empty branch after then');
  });

  it('counts one warning per row in the polite summary', () => {
    const rows = typeStepsPreviewRows('Humna: ask\nModel: draft — reuse tickets\n\nShip');
    expect(typeStepsPreviewSummary(rows)).toBe('3 steps, 1 warning');
    expect(typeStepsPreviewSummary([])).toBe('0 steps, 0 warnings');
    expect(typeStepsPreviewSummary([rows[0]])).toBe('1 step, 1 warning');
  });
});

describe('typeStepsPreviewRows converter parity', () => {
  it('matches the converter label, role, and note and does not change the DSL', () => {
    const text = 'Model: draft — reuse tickets\nIf bad then Retry else Flag\nData: tickets';
    const traced: UnderstoodLine[] = [];
    const withTrace = plainStepsToDSL(text, { understood: traced });
    expect(withTrace).toBe(plainStepsToDSL(text));
    expect(traced).toHaveLength(3);

    const parsed = parseDiagram(withTrace);
    const draft = parsed.nodes.find(node => node.type === 'flow' && node.id === 'draft');
    expect(draft && draft.type === 'flow' && draft.properties).toMatchObject({
      label: 'draft',
      role: 'model',
      note: 'reuse tickets',
    });
    expect(row(text, 0)).toMatchObject({
      label: 'draft',
      roles: ['model'],
      note: 'reuse tickets',
    });
  });

  it('previews 200 lines within 300ms', () => {
    const lines = Array.from({ length: 200 }, (_, i) => {
      if (i % 17 === 0) return `If ready ${i} then Ship ${i} else Hold ${i}`;
      if (i % 11 === 0) return `Model: draft ${i} — note ${i}`;
      if (i % 7 === 0) return `Data: row ${i}`;
      return `Step ${i}`;
    });
    const start = performance.now();
    const rows = typeStepsPreviewRows(lines.join('\n'));
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(200);
    expect(rows[10].kind).toBe('step');
    expect(elapsed).toBeLessThanOrEqual(300);
  });
});

describe('stepLineRange', () => {
  it('selects the clicked line, including a line after a blank', () => {
    const text = 'Send\n\nHumna: ask';
    expect(stepLineRange(text, 0)).toEqual({ start: 0, end: 4 });
    expect(stepLineRange(text, 2)).toEqual({ start: 6, end: 6 + 'Humna: ask'.length });
  });
});
