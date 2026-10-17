import { describe, expect, it } from 'vitest';
import {
  ICON_STYLE_IDS,
  ICON_STYLES,
  STYLE_NODE_KINDS,
  contrastRatio,
  iconStyleForStorage,
  resolveFace,
  resolveIconStyle,
  styleContrastPairs,
  styleKindOf,
} from './iconStyles';

describe('ICON_STYLES', () => {
  it('defines every style and every node type with a distinct glyph', () => {
    expect(ICON_STYLE_IDS).toEqual(['clean', 'line', 'bold', 'blueprint']);
    for (const id of ICON_STYLE_IDS) {
      const tokens = ICON_STYLES[id];
      expect(tokens.id).toBe(id);
      const icons = STYLE_NODE_KINDS.map(kind => tokens.types[kind].icon);
      expect(new Set(icons).size).toBe(STYLE_NODE_KINDS.length);
      expect(tokens.types.agent.icon).toBe('sparkles');
      expect(tokens.types.tool.icon).toBe('wrench');
      expect(tokens.types.check.icon).toBe('shield-check');
      expect(tokens.types.human.icon).toBe('user');
      expect(tokens.types.decision.icon).toBe('git-branch');
      expect(tokens.types.data.icon).toBe('database');
      expect(tokens.types.step.icon).toBe('circle-dot');
      expect(tokens.types.start.icon).toBe('play');
      expect(tokens.types.end.icon).toBe('square');
    }
    expect(ICON_STYLES.clean.icon.show).toBe(false);
    expect(ICON_STYLES.clean.roleChip).toBe('text');
    expect(ICON_STYLES.clean.canvas).toBe('#FDFDFD');
    expect(ICON_STYLES.line.shape.border).toBe('#cbd5e1');
    expect(ICON_STYLES.line.shape.borderWidth).toBe(1);
    expect(ICON_STYLES.line.shape.radius).toBe(8);
    expect(ICON_STYLES.line.icon).toMatchObject({ show: true, size: 16, strokeWidth: 1.75, filled: false });
    expect(ICON_STYLES.bold.shape).toMatchObject({ fill: 'solid', borderWidth: 0, radius: 16 });
    expect(ICON_STYLES.bold.icon).toMatchObject({ size: 18, filled: true, color: 'white' });
    expect(ICON_STYLES.bold.selection).toEqual({ color: '#0f172a', width: 3, offset: 2 });
    expect(ICON_STYLES.blueprint.canvas).toBe('#0b1f3a');
    expect(ICON_STYLES.blueprint.grid).toEqual({ color: '#12305a', gap: 24, variant: 'lines' });
    expect(ICON_STYLES.blueprint.shape).toMatchObject({ radius: 2, borderWidth: 1.5, doubleStroke: true });
    expect(ICON_STYLES.blueprint.edge).toMatchObject({ width: 1, dash: '6 4', color: '#7dd3fc', route: 'step', marker: 'open' });
    expect(ICON_STYLES.line.edge).toMatchObject({ width: 1.5, color: '#64748b', marker: 'open', route: 'smoothstep' });
    expect(ICON_STYLES.bold.edge).toMatchObject({ width: 2, color: '#334155', marker: 'closed', route: 'smoothstep' });
  });

  it('meets the contrast floor for labels, icons, and edges', () => {
    const failures = styleContrastPairs()
      .map(pair => ({ ...pair, ratio: contrastRatio(pair.fg, pair.bg) }))
      .filter(pair => pair.ratio < pair.min);
    expect(failures).toEqual([]);
  });

  it('loads missing and unknown styles as clean and omits clean when storing', () => {
    expect(resolveIconStyle(undefined)).toBe('clean');
    expect(resolveIconStyle(null)).toBe('clean');
    expect(resolveIconStyle('neon')).toBe('clean');
    expect(resolveIconStyle('bold')).toBe('bold');
    expect(iconStyleForStorage(undefined)).toBeUndefined();
    expect(iconStyleForStorage('clean')).toBeUndefined();
    expect(iconStyleForStorage('nope')).toBeUndefined();
    expect(iconStyleForStorage('blueprint')).toBe('blueprint');
  });

  it('takes icon and colour from the role when the shape is a decision or data node', () => {
    expect(styleKindOf({ role: 'model', nodeType: 'decision' })).toBe('agent');
    expect(styleKindOf({ role: 'human', nodeType: 'data' })).toBe('human');
    expect(styleKindOf({ nodeType: 'decision' })).toBe('decision');
    expect(styleKindOf({ nodeType: 'document' })).toBe('data');
    expect(styleKindOf({ isEnd: true })).toBe('end');
    expect(styleKindOf({})).toBe('step');

    const face = resolveFace('line', { role: 'tool', nodeType: 'decision', color: '#111111' }, 'diamond');
    expect(face.kind).toBe('tool');
    expect(face.color).toBe('#111111');
    expect(face.icon).toBe('wrench');
    expect(face.roleWord).toBe('tool');
    expect(face.showIcon).toBe(true);
  });

  it('paints data and document nodes with the Data icon and colour in every style set (DT-AI-24)', () => {
    for (const id of ICON_STYLE_IDS) {
      for (const nodeType of ['data', 'document'] as const) {
        const face = resolveFace(id, { nodeType });
        expect(face.kind).toBe('data');
        expect(face.icon).toBe('database');
        expect(face.color).toBe(ICON_STYLES[id].types.data.color);
        expect(face.roleWord).toBeUndefined();
      }
    }
  });
});
