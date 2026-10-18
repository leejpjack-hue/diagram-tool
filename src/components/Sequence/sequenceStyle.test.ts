import { describe, expect, it } from 'vitest';
import { ROLE_CHIP_PALETTE } from '../Canvas/rolePalette';
import { ICON_STYLES } from '../Canvas/iconStyles';
import {
  SEQUENCE_PALETTE,
  sequenceContrastFailures,
  sequenceHeaderPaint,
  sequenceMessagePaint,
  sequenceRoleColor,
  sequenceRoleIcon,
} from './sequenceStyle';

describe('sequence role colours and styles', () => {
  it('uses the Flow role-chip colours in Clean, including Data from the style table', () => {
    expect(sequenceRoleColor('human', 'clean')).toBe(ROLE_CHIP_PALETTE.human.text);
    expect(sequenceRoleColor('ai', 'clean')).toBe(ROLE_CHIP_PALETTE.model.text);
    expect(sequenceRoleColor('tool', 'clean')).toBe(ROLE_CHIP_PALETTE.tool.text);
    expect(sequenceRoleColor('check', 'clean')).toBe(ROLE_CHIP_PALETTE.check.text);
    expect(sequenceRoleColor('data', 'clean')).toBe(ICON_STYLES.clean.types.data.color);
    expect(sequenceRoleIcon('ai')).toBe('sparkles');
    expect(sequenceRoleIcon('human')).toBe('user');
    expect(sequenceRoleIcon('tool')).toBe('wrench');
    expect(sequenceRoleIcon('data')).toBe('database');
    expect(sequenceRoleIcon('check')).toBe('shield-check');
  });

  it('keeps Clean message paint identical to today and shifts the other styles', () => {
    expect(sequenceMessagePaint('clean')).toMatchObject({
      width: 1.8,
      label: '#334155',
      fontFamily: 'Inter, sans-serif',
      dashedDash: '6 4',
      tipWidth: 1.6,
    });
    expect(sequenceMessagePaint('clean').solidDash).toBeUndefined();
    expect(sequenceMessagePaint('line').width).toBe(ICON_STYLES.line.edge.width);
    expect(sequenceMessagePaint('bold').width).toBe(ICON_STYLES.bold.edge.width);
    expect(sequenceMessagePaint('blueprint').solidDash).toBe('6 4');
    expect(sequenceMessagePaint('blueprint').label).toBe('#e0f2fe');
  });

  it('does not darken Bold role fills that already clear white text', () => {
    for (const role of ['ai', 'human', 'tool', 'data', 'check'] as const) {
      const accent = sequenceRoleColor(role, 'bold');
      expect(sequenceHeaderPaint('bold', accent, role).fill).toBe(accent);
      expect(sequenceHeaderPaint('bold', accent, role).label).toBe('#ffffff');
    }
  });

  it('meets AA for sequence text in every style', () => {
    const failures = sequenceContrastFailures().map(failure => `${failure.where} ${failure.ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
    expect(SEQUENCE_PALETTE).toHaveLength(8);
  });
});
