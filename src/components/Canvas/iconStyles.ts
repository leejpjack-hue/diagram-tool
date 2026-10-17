// DT-STYLE-01 — four named Flow icon styles. One token table; Clean is today's
// look (and the default when a board has no iconStyle, or an unknown value).
// Line / Bold / Blueprint colours are consumed by the flow nodes, edges, and
// legend. No runtime icon CDN.

export const ICON_STYLE_IDS = ['clean', 'line', 'bold', 'blueprint'] as const;
export type IconStyleId = (typeof ICON_STYLE_IDS)[number];

export const STYLE_NODE_KINDS = [
  'agent',
  'tool',
  'check',
  'human',
  'decision',
  'data',
  'step',
  'start',
  'end',
] as const;
export type StyleNodeKind = (typeof STYLE_NODE_KINDS)[number];

export const STYLE_ICON_NAMES = [
  'sparkles',
  'wrench',
  'shield-check',
  'user',
  'git-branch',
  'database',
  'circle-dot',
  'play',
  'square',
] as const;
export type StyleIconName = (typeof STYLE_ICON_NAMES)[number];

export const STYLE_KIND_LABEL: Record<StyleNodeKind, string> = {
  agent: 'AI agent',
  tool: 'Tool',
  check: 'Check',
  human: 'Human',
  decision: 'Decision',
  data: 'Data',
  step: 'Step',
  start: 'Start',
  end: 'End',
};

/** Role word kept in aria-label / tooltip (DT-AI-03 vocabulary). */
export const STYLE_KIND_ROLE: Partial<Record<StyleNodeKind, 'human' | 'model' | 'tool' | 'check'>> = {
  agent: 'model',
  tool: 'tool',
  check: 'check',
  human: 'human',
};

export interface TypeToken {
  color: string;
  icon: StyleIconName;
  /** Surface the type colour sits on when it is the foreground (clean chips / labels). */
  surface: string;
}

export interface StyleTokens {
  id: IconStyleId;
  name: string;
  /** Canvas paint. Clean matches the PNG export fill used today. */
  canvas: string;
  /** On-screen flow canvas. Clean stays the existing white pane. */
  pane: string;
  grid: { color: string; gap: number; variant: 'dots' | 'lines' } | null;
  shape: {
    /** white card, solid type fill, or the canvas colour (blueprint). */
    fill: 'white' | 'solid' | 'canvas';
    borderWidth: number;
    /** Fixed border, or the type colour. */
    border: string | 'type';
    radius: number;
    pillRadius: number;
    diamondRadius: number;
    doubleStroke: boolean;
  };
  icon: {
    show: boolean;
    size: number;
    strokeWidth: number;
    filled: boolean;
    /** White glyph, or the type colour. */
    color: 'white' | 'type';
  };
  label: {
    color: string | 'type';
    font: string;
    weight: number;
    /** Where the label is painted, for contrast. */
    on: 'surface' | 'fill' | 'canvas' | 'white';
  };
  types: Record<StyleNodeKind, TypeToken>;
  edge: {
    color: string;
    width: number;
    dash?: string;
    marker: 'closed' | 'open';
    route: 'inherit' | 'smoothstep' | 'step';
    labelColor: string;
    labelBg: string;
  };
  selection: { color: string; width: number; offset: number };
  walk: { highlight: string; trail: string };
  roleChip: 'text' | 'icon';
}

const TITLE_FONT = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const GLYPHS: Record<StyleNodeKind, StyleIconName> = {
  agent: 'sparkles',
  tool: 'wrench',
  check: 'shield-check',
  human: 'user',
  decision: 'git-branch',
  data: 'database',
  step: 'circle-dot',
  start: 'play',
  end: 'square',
};

function types(
  colors: Record<StyleNodeKind, string>,
  surface: string | Record<StyleNodeKind, string>,
): Record<StyleNodeKind, TypeToken> {
  const out = {} as Record<StyleNodeKind, TypeToken>;
  for (const kind of STYLE_NODE_KINDS) {
    out[kind] = {
      color: colors[kind],
      icon: GLYPHS[kind],
      surface: typeof surface === 'string' ? surface : surface[kind],
    };
  }
  return out;
}

const CLEAN_TYPES = types(
  {
    agent: '#6d28d9',
    tool: '#b45309',
    check: '#15803d',
    human: '#1d4ed8',
    decision: '#b45309',
    data: '#334155',
    step: '#1d4ed8',
    start: '#15803d',
    end: '#b91c1c',
  },
  {
    agent: '#f5f3ff',
    tool: '#fffbeb',
    check: '#f0fdf4',
    human: '#eff6ff',
    decision: '#ffffff',
    data: '#ffffff',
    step: '#ffffff',
    start: '#f0fdf4',
    end: '#fef2f2',
  },
);

const LINE_TYPES = types(
  {
    agent: '#7c3aed',
    tool: '#c2410c',
    check: '#15803d',
    human: '#2563eb',
    decision: '#b45309',
    data: '#475569',
    step: '#334155',
    start: '#15803d',
    end: '#b91c1c',
  },
  '#ffffff',
);

const BOLD_TYPES = types(
  {
    agent: '#6d28d9',
    tool: '#b45309',
    check: '#15803d',
    human: '#1d4ed8',
    decision: '#be123c',
    data: '#334155',
    step: '#0f766e',
    start: '#166534',
    end: '#991b1b',
  },
  '#ffffff',
);

const BLUEPRINT_CANVAS = '#0b1f3a';
const BLUEPRINT_TYPES = types(
  {
    agent: '#c4b5fd',
    tool: '#fcd34d',
    check: '#86efac',
    human: '#7dd3fc',
    decision: '#fda4af',
    data: '#cbd5e1',
    step: '#e0f2fe',
    start: '#86efac',
    end: '#fda4af',
  },
  BLUEPRINT_CANVAS,
);

export const ICON_STYLES: Record<IconStyleId, StyleTokens> = {
  clean: {
    id: 'clean',
    name: 'Clean',
    canvas: '#FDFDFD',
    pane: '#ffffff',
    grid: null,
    shape: {
      fill: 'white',
      borderWidth: 1.5,
      border: 'type',
      radius: 12,
      pillRadius: 999,
      diamondRadius: 12,
      doubleStroke: false,
    },
    icon: { show: false, size: 16, strokeWidth: 1.75, filled: false, color: 'type' },
    label: { color: 'type', font: TITLE_FONT, weight: 600, on: 'surface' },
    types: CLEAN_TYPES,
    edge: {
      color: '#64748b',
      width: 1.8,
      marker: 'closed',
      route: 'inherit',
      labelColor: '#1E293B',
      labelBg: '#FDFDFD',
    },
    selection: { color: '#1d4ed8', width: 3, offset: 0 },
    walk: { highlight: '#6366f1', trail: '#818cf8' },
    roleChip: 'text',
  },
  line: {
    id: 'line',
    name: 'Line',
    canvas: '#ffffff',
    pane: '#ffffff',
    grid: null,
    shape: {
      fill: 'white',
      borderWidth: 1,
      border: '#cbd5e1',
      radius: 8,
      pillRadius: 999,
      diamondRadius: 4,
      doubleStroke: false,
    },
    icon: { show: true, size: 16, strokeWidth: 1.75, filled: false, color: 'type' },
    label: { color: '#0f172a', font: TITLE_FONT, weight: 600, on: 'white' },
    types: LINE_TYPES,
    edge: {
      color: '#64748b',
      width: 1.5,
      marker: 'open',
      route: 'smoothstep',
      labelColor: '#334155',
      labelBg: '#ffffff',
    },
    selection: { color: '#0f172a', width: 2, offset: 2 },
    walk: { highlight: '#4338ca', trail: '#4f46e5' },
    roleChip: 'icon',
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    canvas: '#ffffff',
    pane: '#ffffff',
    grid: null,
    shape: {
      fill: 'solid',
      borderWidth: 0,
      border: 'type',
      radius: 16,
      pillRadius: 999,
      diamondRadius: 6,
      doubleStroke: false,
    },
    icon: { show: true, size: 18, strokeWidth: 1.75, filled: true, color: 'white' },
    label: { color: '#ffffff', font: TITLE_FONT, weight: 600, on: 'fill' },
    types: BOLD_TYPES,
    edge: {
      color: '#334155',
      width: 2,
      marker: 'closed',
      route: 'smoothstep',
      labelColor: '#334155',
      labelBg: '#ffffff',
    },
    selection: { color: '#0f172a', width: 3, offset: 2 },
    walk: { highlight: '#0f172a', trail: '#334155' },
    roleChip: 'icon',
  },
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint',
    canvas: BLUEPRINT_CANVAS,
    pane: BLUEPRINT_CANVAS,
    grid: { color: '#12305a', gap: 24, variant: 'lines' },
    shape: {
      fill: 'canvas',
      borderWidth: 1.5,
      border: 'type',
      radius: 2,
      pillRadius: 2,
      diamondRadius: 2,
      doubleStroke: true,
    },
    icon: { show: true, size: 16, strokeWidth: 1.75, filled: false, color: 'type' },
    label: { color: '#e0f2fe', font: MONO_FONT, weight: 500, on: 'canvas' },
    types: BLUEPRINT_TYPES,
    edge: {
      color: '#7dd3fc',
      width: 1,
      dash: '6 4',
      marker: 'open',
      route: 'step',
      labelColor: '#e0f2fe',
      labelBg: BLUEPRINT_CANVAS,
    },
    selection: { color: '#e0f2fe', width: 2, offset: 2 },
    walk: { highlight: '#fde68a', trail: '#7dd3fc' },
    roleChip: 'icon',
  },
};

export function isIconStyleId(value: unknown): value is IconStyleId {
  return typeof value === 'string' && (ICON_STYLE_IDS as readonly string[]).includes(value);
}

/** Missing or unknown values load as Clean. */
export function resolveIconStyle(value: unknown): IconStyleId {
  return isIconStyleId(value) ? value : 'clean';
}

/**
 * Value written on a board / portable document. Clean is omitted so older
 * files stay unchanged and older app versions ignore the extra field.
 */
export function iconStyleForStorage(value: unknown): IconStyleId | undefined {
  if (!isIconStyleId(value) || value === 'clean') return undefined;
  return value;
}

export interface FlowFaceInput {
  role?: string;
  nodeType?: string;
  isStart?: boolean;
  isEnd?: boolean;
  color?: string;
}

const DECISION_KINDS = new Set(['decision', 'gatewayexclusive', 'gatewayparallel', 'gatewayinclusive']);
const DATA_KINDS = new Set(['data', 'document']);

/** Icon + colour. A role wins over decision/data/start shape. */
export function styleKindOf(input: FlowFaceInput): StyleNodeKind {
  if (input.role === 'model') return 'agent';
  if (input.role === 'tool') return 'tool';
  if (input.role === 'check') return 'check';
  if (input.role === 'human') return 'human';
  const kind = input.nodeType;
  if (kind && DECISION_KINDS.has(kind)) return 'decision';
  if (kind && DATA_KINDS.has(kind)) return 'data';
  if (input.isEnd || kind === 'eventend') return 'end';
  if (input.isStart || kind === 'terminator' || kind === 'eventstart') return 'start';
  return 'step';
}

export type FaceShape = 'card' | 'pill' | 'diamond';

export interface ResolvedFace {
  styleId: IconStyleId;
  kind: StyleNodeKind;
  color: string;
  icon: StyleIconName;
  fill: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  labelColor: string;
  fontFamily: string;
  fontWeight: number;
  showIcon: boolean;
  iconSize: number;
  iconStroke: number;
  iconFilled: boolean;
  iconColor: string;
  doubleStroke: boolean;
  canvas: string;
  /** Role word when this face stands for human/model/tool/check. */
  roleWord?: 'human' | 'model' | 'tool' | 'check';
  ariaLabel: string;
}

function hexOr(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed;
  // DSL color: may be a named/rgb colour. Still let it win over the set palette.
  if (trimmed) return trimmed;
  return fallback;
}

export function resolveFace(styleId: IconStyleId, input: FlowFaceInput, shape: FaceShape = 'card'): ResolvedFace {
  const tokens = ICON_STYLES[styleId];
  const kind = styleKindOf(input);
  const typeColor = hexOr(input.color, tokens.types[kind].color);
  const fill = tokens.shape.fill === 'solid'
    ? typeColor
    : tokens.shape.fill === 'canvas'
      ? tokens.canvas
      : '#ffffff';
  const borderColor = tokens.shape.border === 'type' ? typeColor : tokens.shape.border;
  const radius = shape === 'pill'
    ? tokens.shape.pillRadius
    : shape === 'diamond'
      ? tokens.shape.diamondRadius
      : tokens.shape.radius;
  const labelColor = tokens.label.color === 'type' ? typeColor : tokens.label.color;
  const iconColor = tokens.icon.color === 'white' ? '#ffffff' : typeColor;
  const roleWord = input.role === 'human' || input.role === 'model' || input.role === 'tool' || input.role === 'check'
    ? input.role
    : STYLE_KIND_ROLE[kind];
  return {
    styleId,
    kind,
    color: typeColor,
    icon: tokens.types[kind].icon,
    fill,
    borderColor,
    borderWidth: tokens.shape.borderWidth,
    radius,
    labelColor,
    fontFamily: tokens.label.font,
    fontWeight: tokens.label.weight,
    showIcon: tokens.icon.show,
    iconSize: tokens.icon.size,
    iconStroke: tokens.icon.strokeWidth,
    iconFilled: tokens.icon.filled,
    iconColor,
    doubleStroke: tokens.shape.doubleStroke && shape === 'pill',
    canvas: tokens.canvas,
    roleWord,
    ariaLabel: roleWord ?? STYLE_KIND_LABEL[kind],
  };
}

export function faceBoxShadow(face: ResolvedFace): string | undefined {
  if (!face.doubleStroke) return undefined;
  return `inset 0 0 0 2px ${face.canvas}, inset 0 0 0 3.5px ${face.color}`;
}

export interface ContrastPair {
  set: IconStyleId;
  kind: StyleNodeKind | 'edge';
  role: 'label' | 'icon' | 'edge';
  fg: string;
  bg: string;
  min: number;
}

/** WCAG pairs the renderer is required to meet. Neutral hairline borders are not type meaning. */
export function styleContrastPairs(): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const id of ICON_STYLE_IDS) {
    const tokens = ICON_STYLES[id];
    for (const kind of STYLE_NODE_KINDS) {
      const type = tokens.types[kind];
      const labelFg = tokens.label.color === 'type' ? type.color : tokens.label.color;
      const labelBg = tokens.label.on === 'fill'
        ? type.color
        : tokens.label.on === 'canvas'
          ? tokens.canvas
          : tokens.label.on === 'surface'
            ? type.surface
            : '#ffffff';
      pairs.push({ set: id, kind, role: 'label', fg: labelFg, bg: labelBg, min: 4.5 });
      if (tokens.icon.show) {
        const iconFg = tokens.icon.color === 'white' ? '#ffffff' : type.color;
        const iconBg = tokens.icon.color === 'white' ? type.color : (tokens.shape.fill === 'canvas' ? tokens.canvas : '#ffffff');
        const min = id === 'line' ? 3 : 4.5;
        pairs.push({ set: id, kind, role: 'icon', fg: iconFg, bg: iconBg, min });
      } else {
        pairs.push({ set: id, kind, role: 'icon', fg: type.color, bg: type.surface, min: 4.5 });
      }
    }
    pairs.push({
      set: id,
      kind: 'edge',
      role: 'edge',
      fg: tokens.edge.color,
      bg: tokens.canvas === '#FDFDFD' ? '#ffffff' : tokens.canvas,
      min: 3,
    });
  }
  return pairs;
}

function channel(hex: string, index: number): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255;
}

export function relativeLuminance(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const r = lin(channel(hex, 0));
  const g = lin(channel(hex, 1));
  const b = lin(channel(hex, 2));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** DT-AI-27 role-lane titles, painted from the active style's role colours. */
const ROLE_LANE_KIND: Record<string, StyleNodeKind> = {
  human: 'human',
  'ai agent': 'agent',
  tool: 'tool',
  check: 'check',
  data: 'data',
  other: 'step',
};

/** Colour for a role lane, or null when the title is not one of those lanes. */
export function roleLaneColor(label: string, iconStyle: IconStyleId): string | null {
  const kind = ROLE_LANE_KIND[label.trim().toLowerCase()];
  if (!kind) return null;
  return ICON_STYLES[iconStyle].types[kind].color;
}
