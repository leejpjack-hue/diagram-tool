import type { PresentationItem } from '../../utils/boardManager';
import { createConnectorItem, magnetOf, type ConnectorSide } from '../../utils/presentationConnectors';
import type { DiagramTemplate } from './templates';

export const WORKSHOP_HOWTO = {
  retro: 'Park stickies in Went well, Change, or Questions. Talk through Change last.',
  twoByTwo: 'Plot ideas by impact vs effort. Do the high-impact / low-effort quadrant first.',
  journey: 'One sticky per step. Mark the emotion under each step as you walk the path.',
  standup: "Yesterday / Today / Blocked. Move yesterday's Today into Yesterday, then fill Today.",
  review: 'Context first, then options, then write the decision in the last frame.',
} as const;

export const WORKSHOP_TITLES = {
  retro: 'Retro',
  twoByTwo: '2×2',
  journey: 'User journey',
  standup: 'Standup',
  review: 'Design review',
} as const;

const NOTE = {
  green: { fill: '#bbf7d0', stroke: '#86efac', text: '#14532d' },
  amber: { fill: '#fef3c7', stroke: '#fcd34d', text: '#78350f' },
  blue: { fill: '#dbeafe', stroke: '#93c5fd', text: '#1e3a8a' },
  rose: { fill: '#ffe4e6', stroke: '#fda4af', text: '#881337' },
  violet: { fill: '#ede9fe', stroke: '#c4b5fd', text: '#5b21b6' },
} as const;

function titledArchitectureDsl(title: string): string {
  return `diagram: architecture
title: ${title}
edges: orthogonal
`;
}

function frame(
  id: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeColor: string,
): PresentationItem {
  return {
    id,
    type: 'frame',
    title,
    content: '',
    x,
    y,
    width,
    height,
    zIndex: -100,
    style: { strokeColor, fillColor: '#ffffff' },
  };
}

function sticky(
  id: string,
  content: string,
  x: number,
  y: number,
  palette: (typeof NOTE)[keyof typeof NOTE],
): PresentationItem {
  return {
    id,
    type: 'note',
    title: 'Sticky note',
    content,
    x,
    y,
    width: 200,
    height: 132,
    zIndex: 10,
    style: {
      fillColor: palette.fill,
      strokeColor: palette.stroke,
      textColor: palette.text,
      fontSize: 16,
      textAlign: 'left',
    },
  };
}

function label(id: string, content: string, x: number, y: number, width = 160): PresentationItem {
  return {
    id,
    type: 'text',
    title: 'Label',
    content,
    x,
    y,
    width,
    height: 36,
    zIndex: 12,
    style: { textColor: '#334155', fontSize: 16, fontWeight: 'semibold', textAlign: 'left' },
  };
}

function connect(
  id: string,
  start: PresentationItem,
  end: PresentationItem,
  startSide: ConnectorSide,
  endSide: ConnectorSide,
): PresentationItem {
  const startPoint = magnetOf(start, startSide);
  const endPoint = magnetOf(end, endSide);
  return createConnectorItem(
    { point: startPoint, snap: { id: start.id, side: startSide, point: startPoint } },
    { point: endPoint, snap: { id: end.id, side: endSide, point: endPoint } },
    id,
    20,
  );
}

function retroDeck(): PresentationItem[] {
  const wentWell = frame('retro-frame-well', 'Went well', 40, 72, 360, 460, '#059669');
  const change = frame('retro-frame-change', 'Change', 440, 72, 360, 460, '#d97706');
  const questions = frame('retro-frame-questions', 'Questions', 840, 72, 360, 460, '#2563eb');
  const notes = [
    sticky('retro-note-shipped', 'Shipped the checkout fix', 68, 120, NOTE.green),
    sticky('retro-note-pairing', 'Pairing unblocked the API work', 68, 272, NOTE.green),
    sticky('retro-note-handoff', 'Handoff to support was late', 468, 120, NOTE.amber),
    sticky('retro-note-scope', 'Scope crept in review', 468, 272, NOTE.amber),
    sticky('retro-note-metrics', 'Do we have a rollback metric?', 868, 120, NOTE.blue),
    sticky('retro-note-owner', 'Who owns the on-call doc?', 868, 272, NOTE.blue),
  ];
  return [
    wentWell,
    change,
    questions,
    ...notes,
    connect('retro-link-well-change', wentWell, change, 'right', 'left'),
    connect('retro-link-change-questions', change, questions, 'right', 'left'),
  ];
}

function twoByTwoDeck(): PresentationItem[] {
  const quickWins = frame('matrix-frame-quick', 'High impact · Low effort', 280, 80, 380, 300, '#059669');
  const bets = frame('matrix-frame-bets', 'High impact · High effort', 700, 80, 380, 300, '#7c3aed');
  const fillins = frame('matrix-frame-fill', 'Low impact · Low effort', 280, 420, 380, 300, '#2563eb');
  const avoid = frame('matrix-frame-avoid', 'Low impact · High effort', 700, 420, 380, 300, '#be123c');
  return [
    label('matrix-label-impact', 'Impact →', 40, 40, 140),
    label('matrix-label-effort', 'Effort →', 40, 720, 140),
    quickWins,
    bets,
    fillins,
    avoid,
    sticky('matrix-note-quick-1', 'Fix the empty state', 308, 128, NOTE.green),
    sticky('matrix-note-quick-2', 'Add a one-click retry', 308, 280, NOTE.green),
    sticky('matrix-note-bet', 'Rebuild search ranking', 728, 128, NOTE.violet),
    sticky('matrix-note-fill', 'Polish the empty icon', 308, 468, NOTE.blue),
    sticky('matrix-note-avoid', 'Custom animation engine', 728, 468, NOTE.rose),
    connect('matrix-link-do-first', quickWins, bets, 'right', 'left'),
  ];
}

function journeyDeck(): PresentationItem[] {
  const discover = frame('journey-frame-discover', 'Discover', 40, 72, 280, 280, '#2563eb');
  const tryIt = frame('journey-frame-try', 'Try', 360, 72, 280, 280, '#7c3aed');
  const use = frame('journey-frame-use', 'Use', 680, 72, 280, 280, '#059669');
  const returnTo = frame('journey-frame-return', 'Return', 1000, 72, 280, 280, '#d97706');
  return [
    discover,
    tryIt,
    use,
    returnTo,
    sticky('journey-step-discover', 'Heard about us from a teammate', 68, 128, NOTE.blue),
    sticky('journey-step-try', 'Created a board in 30 seconds', 388, 128, NOTE.violet),
    sticky('journey-step-use', 'Ran the standup on the canvas', 708, 128, NOTE.green),
    sticky('journey-step-return', 'Opened the same board next week', 1028, 128, NOTE.amber),
    sticky('journey-feel-discover', 'Emotion: curious', 68, 400, NOTE.amber),
    sticky('journey-feel-try', 'Emotion: relieved', 388, 400, NOTE.green),
    sticky('journey-feel-use', 'Emotion: focused', 708, 400, NOTE.blue),
    sticky('journey-feel-return', 'Emotion: confident', 1028, 400, NOTE.violet),
    connect('journey-link-1', discover, tryIt, 'right', 'left'),
    connect('journey-link-2', tryIt, use, 'right', 'left'),
    connect('journey-link-3', use, returnTo, 'right', 'left'),
  ];
}

function standupDeck(): PresentationItem[] {
  const yesterday = frame('standup-frame-yesterday', 'Yesterday', 40, 72, 380, 480, '#2563eb');
  const today = frame('standup-frame-today', 'Today', 460, 72, 380, 480, '#059669');
  const blocked = frame('standup-frame-blocked', 'Blocked', 880, 72, 380, 480, '#be123c');
  return [
    yesterday,
    today,
    blocked,
    sticky('standup-note-y1', 'Closed the import review', 68, 128, NOTE.blue),
    sticky('standup-note-y2', 'Paired on the meter copy', 68, 280, NOTE.blue),
    sticky('standup-note-t1', 'Write the five workshop starters', 488, 128, NOTE.green),
    sticky('standup-note-t2', 'Walk the Retro board with the team', 488, 280, NOTE.green),
    sticky('standup-note-b1', 'Waiting on the design token list', 908, 128, NOTE.rose),
    connect('standup-link-roll', yesterday, today, 'right', 'left'),
    connect('standup-link-block', today, blocked, 'right', 'left'),
  ];
}

function reviewDeck(): PresentationItem[] {
  const context = frame('review-frame-context', 'Context', 40, 72, 380, 460, '#2563eb');
  const options = frame('review-frame-options', 'Options', 460, 72, 380, 460, '#7c3aed');
  const decision = frame('review-frame-decision', 'Decision', 880, 72, 380, 460, '#059669');
  return [
    context,
    options,
    decision,
    sticky('review-note-problem', 'Teams leave the diagram and stall', 68, 128, NOTE.blue),
    sticky('review-note-constraint', 'Local-first. No accounts or sync.', 68, 280, NOTE.blue),
    sticky('review-note-a', 'Option A: five deck canvases', 488, 128, NOTE.violet),
    sticky('review-note-b', 'Option B: more architecture DSLs', 488, 280, NOTE.violet),
    sticky('review-note-decision', 'Ship the five deck starters.', 908, 128, NOTE.green),
    sticky('review-note-next', 'Talk through Change last in Retro.', 908, 280, NOTE.green),
    connect('review-link-1', context, options, 'right', 'left'),
    connect('review-link-2', options, decision, 'right', 'left'),
  ];
}

function workshopTemplate(
  id: string,
  name: string,
  description: string,
  tags: string[],
  items: PresentationItem[],
): DiagramTemplate {
  return {
    id,
    name,
    description,
    category: 'Workshop',
    mode: 'architecture',
    tags,
    dsl: titledArchitectureDsl(name),
    presentation: items,
  };
}

export const WORKSHOP_TEMPLATES: DiagramTemplate[] = [
  workshopTemplate('workshop-retro', WORKSHOP_TITLES.retro, WORKSHOP_HOWTO.retro, ['workshop', 'retro', 'sticky'], retroDeck()),
  workshopTemplate('workshop-2x2', WORKSHOP_TITLES.twoByTwo, WORKSHOP_HOWTO.twoByTwo, ['workshop', '2x2', 'impact', 'effort'], twoByTwoDeck()),
  workshopTemplate('workshop-user-journey', WORKSHOP_TITLES.journey, WORKSHOP_HOWTO.journey, ['workshop', 'journey', 'emotion'], journeyDeck()),
  workshopTemplate('workshop-standup', WORKSHOP_TITLES.standup, WORKSHOP_HOWTO.standup, ['workshop', 'standup', 'blocked'], standupDeck()),
  workshopTemplate('workshop-design-review', WORKSHOP_TITLES.review, WORKSHOP_HOWTO.review, ['workshop', 'design', 'decision'], reviewDeck()),
];

export const WORKSHOP_TEMPLATE_IDS = new Set(WORKSHOP_TEMPLATES.map(template => template.id));

export function isWorkshopTemplateId(id: string | undefined): boolean {
  return Boolean(id && WORKSHOP_TEMPLATE_IDS.has(id));
}
