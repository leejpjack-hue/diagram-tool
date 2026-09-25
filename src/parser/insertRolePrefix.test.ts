import { describe, it, expect } from 'vitest';
import { insertRolePrefix } from './insertRolePrefix';

describe('insertRolePrefix (DT-AI-08)', () => {
  it('Human inserts "Human: " at line start', () => {
    expect(insertRolePrefix('draft reply', 0, 0, 'Human')).toEqual({
      text: 'Human: draft reply',
      selectionStart: 'Human: '.length,
      selectionEnd: 'Human: '.length,
    });
  });

  it('Model, Tool, Check each use their own prefix', () => {
    for (const role of ['Model', 'Tool', 'Check'] as const) {
      const r = insertRolePrefix('do the thing', 0, 0, role);
      expect(r.text).toBe(`${role}: do the thing`);
      expect(r.selectionStart).toBe(`${role}: `.length);
    }
  });

  it('no selection mid-line: inserts at line start after leading whitespace', () => {
    const text = '  draft reply';
    const r = insertRolePrefix(text, 5, 5, 'Human');
    expect(r.text).toBe('  Human: draft reply');
    // Mid-line caret keeps its relative position: shifted past the prefix.
    expect(r.selectionStart).toBe(5 + 'Human: '.length);
  });

  it('selection: PREFIXES at selection-start line, selection shifts past prefix', () => {
    const text = 'then draft reply\nreview it';
    // Select "draft reply" on line 1.
    const start = text.indexOf('draft');
    const end = start + 'draft reply'.length;
    const r = insertRolePrefix(text, start, end, 'Model');
    expect(r.text).toBe('then Model: draft reply\nreview it');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('draft reply');
  });

  it('selection spanning two lines: prefixes the first selected line only', () => {
    const text = 'step one\nstep two';
    const start = text.indexOf('step one');
    const end = text.indexOf('step two') + 'step two'.length;
    const r = insertRolePrefix(text, start, end, 'Tool');
    expect(r.text).toBe('Tool: step one\nstep two');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('step one\nstep two');
  });

  it('does not double-prefix a line already starting with a role (case-insensitive)', () => {
    for (const line of ['Human: ask', 'MODEL: draft', 'tool: search', 'Check: verify', 'Check  verify']) {
      const r = insertRolePrefix(line, 2, 2, 'Human');
      expect(r.text).toBe(line);
      expect(r.selectionStart).toBe(2);
      expect(r.selectionEnd).toBe(2);
    }
  });

  it('role word already used elsewhere is fine if target line has none', () => {
    const text = 'Human: ask\nreview it';
    const pos = text.indexOf('review');
    const r = insertRolePrefix(text, pos, pos, 'Check');
    expect(r.text).toBe('Human: ask\nCheck: review it');
  });

  it('empty text gets the prefix at position 0', () => {
    expect(insertRolePrefix('', 0, 0, 'Human')).toEqual({
      text: 'Human: ',
      selectionStart: 'Human: '.length,
      selectionEnd: 'Human: '.length,
    });
  });
});
