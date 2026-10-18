// DT-SEQ-04 — sequence paint on top of the shared icon-style tokens.
// Clean with no role is today's sequence diagram (the canvas keeps that JSX).
// A role uses the Flow type colour for that style. Text is AA (4.5:1).

import {
  ICON_STYLES,
  contrastRatio,
  type IconStyleId,
  type StyleIconName,
  type StyleNodeKind,
} from '../Canvas/iconStyles';
import type { SequenceRole } from './sequenceParser';

/** Today's participant palette, by column, when a participant has no role. */
export const SEQUENCE_PALETTE = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'] as const;

const ROLE_KIND: Record<SequenceRole, StyleNodeKind> = {
  ai: 'agent',
  human: 'human',
  tool: 'tool',
  data: 'data',
  check: 'check',
};

const CLEAN_FONT = 'Inter, sans-serif';

/** Flow role colour for this style. Clean matches the RoleChip text colours. */
export function sequenceRoleColor(role: SequenceRole, styleId: IconStyleId): string {
  return ICON_STYLES[styleId].types[ROLE_KIND[role]].color;
}

export function sequenceRoleIcon(role: SequenceRole): StyleIconName {
  return ICON_STYLES.clean.types[ROLE_KIND[role]].icon;
}

export interface SequenceHeaderPaint {
  fill: string;
  fillOpacity: number;
  border: string;
  borderWidth: number;
  borderOpacity: number;
  radius: number;
  label: string;
  fontFamily: string;
  fontWeight: number;
  showIcon: boolean;
  icon: StyleIconName | null;
  iconColor: string;
  iconFilled: boolean;
  iconSize: number;
  iconStroke: number;
}

/**
 * Darken a Bold fill until white text clears 4.5:1. Role colours already pass,
 * so they stay the style colour. Palette colours that fail are nudged darker.
 */
function fillForWhiteText(hex: string): string {
  if (contrastRatio('#ffffff', hex) >= 4.5) return hex;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#0f172a';
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  for (let step = 0; step < 24; step += 1) {
    r = Math.max(0, Math.round(r * 0.94));
    g = Math.max(0, Math.round(g * 0.94));
    b = Math.max(0, Math.round(b * 0.94));
    const next = `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    if (contrastRatio('#ffffff', next) >= 4.5) return next;
  }
  return '#0f172a';
}

export function sequenceHeaderPaint(styleId: IconStyleId, accent: string, role?: SequenceRole): SequenceHeaderPaint {
  const tokens = ICON_STYLES[styleId];
  const showIcon = Boolean(role);
  const icon = role ? sequenceRoleIcon(role) : null;
  if (styleId === 'line') {
    return {
      fill: '#ffffff',
      fillOpacity: 1,
      border: '#cbd5e1',
      borderWidth: 1,
      borderOpacity: 1,
      radius: tokens.shape.radius,
      label: '#0f172a',
      fontFamily: tokens.label.font,
      fontWeight: tokens.label.weight,
      showIcon,
      icon,
      iconColor: accent,
      iconFilled: false,
      iconSize: tokens.icon.size,
      iconStroke: tokens.icon.strokeWidth,
    };
  }
  if (styleId === 'bold') {
    const fill = fillForWhiteText(accent);
    return {
      fill,
      fillOpacity: 1,
      border: fill,
      borderWidth: 0,
      borderOpacity: 1,
      radius: tokens.shape.radius,
      label: '#ffffff',
      fontFamily: tokens.label.font,
      fontWeight: tokens.label.weight,
      showIcon,
      icon,
      iconColor: '#ffffff',
      iconFilled: true,
      iconSize: tokens.icon.size,
      iconStroke: tokens.icon.strokeWidth,
    };
  }
  if (styleId === 'blueprint') {
    return {
      fill: tokens.canvas,
      fillOpacity: 1,
      border: accent,
      borderWidth: tokens.shape.borderWidth,
      borderOpacity: 1,
      radius: tokens.shape.radius,
      label: '#e0f2fe',
      fontFamily: tokens.label.font,
      fontWeight: tokens.label.weight,
      showIcon,
      icon,
      iconColor: accent,
      iconFilled: false,
      iconSize: tokens.icon.size,
      iconStroke: tokens.icon.strokeWidth,
    };
  }
  // Clean. Role cards are solid so white text stays AA; unroled cards are not
  // painted from here (the canvas keeps today's 0.92 palette rect).
  return {
    fill: accent,
    fillOpacity: 1,
    border: '#0f172a',
    borderWidth: 1,
    borderOpacity: 0.08,
    radius: 10,
    label: '#ffffff',
    fontFamily: CLEAN_FONT,
    fontWeight: 600,
    showIcon,
    icon,
    iconColor: '#ffffff',
    iconFilled: false,
    iconSize: tokens.icon.size,
    iconStroke: tokens.icon.strokeWidth,
  };
}

export interface SequenceMessagePaint {
  width: number;
  label: string;
  fontFamily: string;
  /** Omitted on a solid Clean / Line / Bold message so the stroke stays solid. */
  solidDash?: string;
  dashedDash: string;
  tipWidth: number;
}

export function sequenceMessagePaint(styleId: IconStyleId): SequenceMessagePaint {
  const tokens = ICON_STYLES[styleId];
  if (styleId === 'blueprint') {
    return {
      width: tokens.edge.width,
      label: '#e0f2fe',
      fontFamily: tokens.label.font,
      solidDash: tokens.edge.dash,
      dashedDash: '2 3',
      tipWidth: 1.5,
    };
  }
  if (styleId === 'bold') {
    return {
      width: tokens.edge.width,
      label: '#0f172a',
      fontFamily: tokens.label.font,
      dashedDash: '6 4',
      tipWidth: 2,
    };
  }
  if (styleId === 'line') {
    return {
      width: tokens.edge.width,
      label: '#0f172a',
      fontFamily: tokens.label.font,
      dashedDash: '6 4',
      tipWidth: 1.5,
    };
  }
  return {
    width: 1.8,
    label: '#334155',
    fontFamily: CLEAN_FONT,
    dashedDash: '6 4',
    tipWidth: 1.6,
  };
}

export interface SequenceFramePaint {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  radius: number;
  pillFill: string;
  pillRadius: number;
  pillLabel: string;
  pillStroke: string;
  pillStrokeWidth: number;
  label: string;
  fontFamily: string;
  elseStroke: string;
  elseDash?: string;
}

export function sequenceFramePaint(styleId: IconStyleId): SequenceFramePaint {
  const tokens = ICON_STYLES[styleId];
  if (styleId === 'blueprint') {
    return {
      fill: tokens.canvas,
      fillOpacity: 0,
      stroke: tokens.edge.color,
      strokeWidth: tokens.edge.width,
      dash: tokens.edge.dash,
      radius: tokens.shape.radius,
      pillFill: tokens.canvas,
      pillRadius: tokens.shape.radius,
      pillLabel: '#e0f2fe',
      pillStroke: tokens.edge.color,
      pillStrokeWidth: 1,
      label: '#e0f2fe',
      fontFamily: tokens.label.font,
      elseStroke: tokens.edge.color,
      elseDash: tokens.edge.dash,
    };
  }
  if (styleId === 'bold') {
    return {
      fill: '#ffffff',
      fillOpacity: 0,
      stroke: '#334155',
      strokeWidth: tokens.edge.width,
      radius: tokens.shape.radius,
      pillFill: '#0f172a',
      pillRadius: 8,
      pillLabel: '#ffffff',
      pillStroke: '#0f172a',
      pillStrokeWidth: 0,
      label: '#0f172a',
      fontFamily: tokens.label.font,
      elseStroke: '#334155',
    };
  }
  if (styleId === 'line') {
    return {
      fill: '#ffffff',
      fillOpacity: 0,
      stroke: '#cbd5e1',
      strokeWidth: 1,
      dash: '4 4',
      radius: tokens.shape.radius,
      pillFill: '#ffffff',
      pillRadius: 6,
      pillLabel: '#0f172a',
      pillStroke: '#cbd5e1',
      pillStrokeWidth: 1,
      label: '#0f172a',
      fontFamily: tokens.label.font,
      elseStroke: '#94a3b8',
      elseDash: '4 4',
    };
  }
  return {
    fill: '#6366f1',
    fillOpacity: 0.03,
    stroke: '#94a3b8',
    strokeWidth: 1,
    dash: '4 4',
    radius: 8,
    pillFill: '#475569',
    pillRadius: 6,
    pillLabel: '#ffffff',
    pillStroke: '#475569',
    pillStrokeWidth: 0,
    label: '#475569',
    fontFamily: CLEAN_FONT,
    elseStroke: '#94a3b8',
    elseDash: '4 4',
  };
}

export interface SequenceNotePaint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  radius: number;
  label: string;
  fontFamily: string;
}

export function sequenceNotePaint(styleId: IconStyleId): SequenceNotePaint {
  const tokens = ICON_STYLES[styleId];
  if (styleId === 'blueprint') {
    return {
      fill: tokens.canvas,
      stroke: '#fcd34d',
      strokeWidth: 1.5,
      strokeOpacity: 1,
      radius: tokens.shape.radius,
      label: '#e0f2fe',
      fontFamily: tokens.label.font,
    };
  }
  if (styleId === 'bold') {
    return {
      fill: '#9a3412',
      stroke: '#9a3412',
      strokeWidth: 0,
      strokeOpacity: 1,
      radius: tokens.shape.radius,
      label: '#ffffff',
      fontFamily: tokens.label.font,
    };
  }
  if (styleId === 'line') {
    return {
      fill: '#ffffff',
      stroke: '#cbd5e1',
      strokeWidth: 1,
      strokeOpacity: 1,
      radius: tokens.shape.radius,
      label: '#0f172a',
      fontFamily: tokens.label.font,
    };
  }
  return {
    fill: '#fef9c3',
    stroke: '#eab308',
    strokeWidth: 1,
    strokeOpacity: 0.5,
    radius: 6,
    label: '#713f12',
    fontFamily: CLEAN_FONT,
  };
}

export function sequenceLifelinePaint(styleId: IconStyleId): { width: number; opacity: number; dash: string } {
  if (styleId === 'line') return { width: 1, opacity: 0.4, dash: '4 4' };
  if (styleId === 'bold') return { width: 2, opacity: 0.55, dash: '5 5' };
  if (styleId === 'blueprint') return { width: 1, opacity: 0.8, dash: '6 4' };
  return { width: 1.5, opacity: 0.35, dash: '5 5' };
}

export function sequenceTitlePaint(styleId: IconStyleId): { color: string; fontFamily: string } {
  if (styleId === 'blueprint') {
    return { color: '#e0f2fe', fontFamily: ICON_STYLES.blueprint.label.font };
  }
  if (styleId === 'clean') return { color: '#0f172a', fontFamily: CLEAN_FONT };
  return { color: '#0f172a', fontFamily: ICON_STYLES[styleId].label.font };
}

export interface SequenceBadgePaint {
  fill: string;
  stroke: string;
  text: string;
  fontFamily: string;
}

export function sequenceBadgePaint(styleId: IconStyleId, accent: string): SequenceBadgePaint {
  if (styleId === 'clean') {
    return { fill: '#fff', stroke: accent, text: accent, fontFamily: CLEAN_FONT };
  }
  const badge = ICON_STYLES[styleId].stepBadge;
  return {
    fill: badge.background,
    stroke: badge.border,
    text: badge.color,
    fontFamily: ICON_STYLES[styleId].label.font,
  };
}

export interface SequenceContrastFailure {
  where: string;
  ratio: number;
}

/** Text pairs the sequence renderer paints. Icons on Line may sit at 3:1. */
export function sequenceContrastFailures(): SequenceContrastFailure[] {
  const failures: SequenceContrastFailure[] = [];
  const check = (where: string, fg: string, bg: string, min = 4.5) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio < min) failures.push({ where, ratio });
  };
  const roles: SequenceRole[] = ['ai', 'human', 'tool', 'data', 'check'];

  for (const styleId of ['clean', 'line', 'bold', 'blueprint'] as const) {
    const canvas = styleId === 'blueprint' ? ICON_STYLES.blueprint.canvas : '#ffffff';
    const title = sequenceTitlePaint(styleId);
    check(`${styleId} title`, title.color, canvas);
    const message = sequenceMessagePaint(styleId);
    check(`${styleId} message`, message.label, canvas);
    const frame = sequenceFramePaint(styleId);
    // A faint frame wash (Clean's 0.03 indigo) leaves the label on the canvas.
    const frameBg = frame.fillOpacity < 0.5 ? canvas : frame.fill;
    check(`${styleId} frame label`, frame.label, frameBg);
    check(`${styleId} frame pill`, frame.pillLabel, frame.pillFill);
    const note = sequenceNotePaint(styleId);
    check(`${styleId} note`, note.label, note.fill);

    for (const role of roles) {
      const accent = sequenceRoleColor(role, styleId);
      const header = sequenceHeaderPaint(styleId, accent, role);
      check(`${styleId} ${role} header`, header.label, header.fill);
      if (header.showIcon) {
        const min = styleId === 'line' ? 3 : 4.5;
        check(`${styleId} ${role} icon`, header.iconColor, header.fill, min);
      }
    }
    for (const accent of SEQUENCE_PALETTE) {
      const header = sequenceHeaderPaint(styleId, accent);
      if (styleId === 'clean') continue;
      check(`${styleId} palette header`, header.label, header.fill);
    }
    if (styleId !== 'clean') {
      const badge = sequenceBadgePaint(styleId, '#6366f1');
      check(`${styleId} badge`, badge.text, badge.fill);
    }
  }
  return failures;
}
