import { describe, expect, it } from 'vitest';
import {
  ARCH_STYLE_KINDS,
  ICON_STYLE_IDS,
  ICON_STYLES,
  STYLE_NODE_KINDS,
  archTreatment,
  boardShowsIconStyle,
  contrastRatio,
  iconStyleForStorage,
  resolveArchFace,
  resolveFace,
  resolveIconStyle,
  resolveStyleEdge,
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

  it('paints step-number badges from each style at 4.5:1 or better', () => {
    for (const id of ICON_STYLE_IDS) {
      const badge = ICON_STYLES[id].stepBadge;
      expect(contrastRatio(badge.color, badge.background)).toBeGreaterThanOrEqual(4.5);
    }
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

  it('resolves an architecture token for every kind and every style', () => {
    expect(boardShowsIconStyle('architecture')).toBe(true);
    expect(boardShowsIconStyle('flow')).toBe(true);
    expect(boardShowsIconStyle('sequence')).toBe(false);
    expect(boardShowsIconStyle('gantt')).toBe(false);
    expect(boardShowsIconStyle('c4')).toBe(false);

    const treatments = {
      clean: 'chip',
      line: 'line',
      bold: 'filled',
      blueprint: 'outline',
    } as const;

    for (const id of ICON_STYLE_IDS) {
      expect(archTreatment(id)).toBe(treatments[id]);
      const tokens = ICON_STYLES[id];
      for (const kind of ARCH_STYLE_KINDS) {
        const face = resolveArchFace(id, kind);
        expect(face.kind).toBe(kind);
        expect(face.styleId).toBe(id);
        expect(face.treatment).toBe(treatments[id]);
        expect(face.color).toBe(tokens.arch[kind].color);
        expect(face.icon).toBe(tokens.arch[kind].icon);
        expect(face.icon).toBeTruthy();
        if (id === 'clean') {
          expect(face.showIcon).toBe(false);
          expect(face.labelColor).toBe('#1e293b');
          expect(face.fill).toBe('#ffffff');
        }
        if (id === 'line') {
          expect(face.showIcon).toBe(true);
          expect(face.iconFilled).toBe(false);
          expect(face.fill).toBe('#ffffff');
          expect(face.borderColor).toBe('#cbd5e1');
          expect(face.borderWidth).toBe(1);
          expect(face.iconColor).toBe(face.color);
          expect(face.labelColor).toBe('#0f172a');
        }
        if (id === 'bold') {
          expect(face.fill).toBe(face.color);
          expect(face.iconColor).toBe('#ffffff');
          expect(face.labelColor).toBe('#ffffff');
          expect(face.iconFilled).toBe(true);
        }
        if (id === 'blueprint') {
          expect(face.fill).toBe('#0b1f3a');
          expect(face.radius).toBe(2);
          expect(face.fontFamily).toContain('JetBrains Mono');
          expect(face.labelColor).toBe('#e0f2fe');
          expect(tokens.edge.dash).toBe('6 4');
          expect(tokens.grid).toEqual({ color: '#12305a', gap: 24, variant: 'lines' });
        }
      }
    }
    expect(ICON_STYLES.bold.edge.width).toBeGreaterThan(ICON_STYLES.line.edge.width);
    expect(ICON_STYLES.bold.edge.width).toBeGreaterThan(ICON_STYLES.blueprint.edge.width);
  });

  it('lets an explicit architecture color win over the style colour', () => {
    for (const id of ICON_STYLE_IDS) {
      for (const kind of ARCH_STYLE_KINDS) {
        const painted = resolveArchFace(id, kind, '#112233');
        expect(painted.color).toBe('#112233');
        expect(painted.color).not.toBe(ICON_STYLES[id].arch[kind].color);
        if (id === 'bold') expect(painted.fill).toBe('#112233');
        if (id === 'line') expect(painted.iconColor).toBe('#112233');
        if (id === 'blueprint') expect(painted.borderColor).toBe('#112233');
      }
      expect(resolveStyleEdge(id, '#abcdef').color).toBe('#abcdef');
      expect(resolveStyleEdge(id).color).toBe(ICON_STYLES[id].edge.color);
    }
  });

  it('meets WCAG AA for architecture text in every style', () => {
    const failures: string[] = [];
    for (const id of ICON_STYLE_IDS) {
      const tokens = ICON_STYLES[id];
      for (const kind of ARCH_STYLE_KINDS) {
        const face = resolveArchFace(id, kind);
        const labelBg = id === 'bold' ? face.color : id === 'blueprint' ? tokens.canvas : '#ffffff';
        const labelRatio = contrastRatio(face.labelColor, labelBg);
        if (labelRatio < 4.5) failures.push(`${id} ${kind} label ${labelRatio.toFixed(2)}`);
        if (id !== 'clean') {
          const iconBg = id === 'bold' ? face.color : id === 'blueprint' ? tokens.canvas : '#ffffff';
          const min = id === 'line' ? 3 : 4.5;
          const iconRatio = contrastRatio(face.iconColor, iconBg);
          if (iconRatio < min) failures.push(`${id} ${kind} icon ${iconRatio.toFixed(2)} < ${min}`);
        }
      }
      const badge = tokens.stepBadge;
      const badgeRatio = contrastRatio(badge.color, badge.background);
      if (badgeRatio < 4.5) failures.push(`${id} step badge ${badgeRatio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
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
