import { parseSequenceDiagram } from './sequenceParser';
import type { SequenceArrow, SequenceDiagramModel, SequenceItem } from './sequenceParser';

/** Opacity for everything that is not the current sequence row, its headers, or its bars. */
export const SEQUENCE_WALK_DIM = 0.35;

export interface SequenceWalkFrame {
  frameType: string;
  label: string;
}

/** One walk step: a message, or a note on its own step. */
export interface SequenceWalkStep {
  /** 0-based position in the walk. */
  index: number;
  /** 1-based position. Notes count, even though their caption omits the number. */
  step: number;
  /** Index into `SequenceDiagramModel.items`, used to match activation bars. */
  itemIndex: number;
  kind: 'message' | 'note';
  caption: string;
  /** Participant ids that stay bright (both ends of a message, or a note's targets). */
  participantIds: string[];
}

interface OpenFrame {
  frameType: string;
  label: string;
}

function nameOf(model: SequenceDiagramModel, id: string): string {
  return model.participants.find(participant => participant.id === id)?.name || id;
}

function frameSuffix(frames: SequenceWalkFrame[]): string {
  return frames.map(frame => {
    const type = frame.frameType.toUpperCase();
    const label = frame.label.trim();
    return label ? ` (inside ${type}: ${label})` : ` (inside ${type})`;
  }).join('');
}

function arrowSuffix(dashed: boolean, arrow: SequenceArrow | undefined): string {
  const marks: string[] = [];
  if (dashed) marks.push('reply');
  if (arrow === 'async') marks.push('async');
  else if (arrow === 'lost') marks.push('failed');
  return marks.length ? ` ${marks.join(' ')}` : '';
}

function messageCaption(
  step: number,
  from: string,
  to: string,
  text: string,
  dashed: boolean,
  arrow: SequenceArrow | undefined,
  frames: SequenceWalkFrame[],
): string {
  return `${step} · ${from} → ${to}: ${text}${arrowSuffix(dashed, arrow)}${frameSuffix(frames)}`;
}

function noteCaption(
  position: 'over' | 'left' | 'right',
  names: string,
  text: string,
  frames: SequenceWalkFrame[],
): string {
  const lead = position === 'left'
    ? `Note left of ${names}`
    : position === 'right'
      ? `Note right of ${names}`
      : `Note over ${names}`;
  return `${lead}: ${text}${frameSuffix(frames)}`;
}

function snapshotFrames(stack: OpenFrame[]): SequenceWalkFrame[] {
  return stack.map(frame => ({ frameType: frame.frameType, label: frame.label }));
}

/**
 * DT-SEQ-03 — messages and notes in document order.
 * Frames are not steps; they annotate the caption of whatever they enclose.
 * An `else` / `and` replaces the open frame's section label for later steps.
 * Activate lines are not steps. A board with no messages and no notes returns [].
 */
export function sequenceWalkSteps(model: SequenceDiagramModel | null | undefined): SequenceWalkStep[] {
  if (!model) return [];
  const steps: SequenceWalkStep[] = [];
  const stack: OpenFrame[] = [];

  model.items.forEach((item: SequenceItem, itemIndex) => {
    if (item.kind === 'frameStart') {
      stack.push({ frameType: item.frameType, label: item.label });
      return;
    }
    if (item.kind === 'frameElse') {
      const top = stack[stack.length - 1];
      if (top) top.label = item.label.trim() || 'else';
      return;
    }
    if (item.kind === 'frameEnd') {
      stack.pop();
      return;
    }
    if (item.kind === 'message') {
      const frames = snapshotFrames(stack);
      const step = steps.length + 1;
      const from = nameOf(model, item.from);
      const to = nameOf(model, item.to);
      steps.push({
        index: steps.length,
        step,
        itemIndex,
        kind: 'message',
        caption: messageCaption(step, from, to, item.text, item.dashed, item.arrow, frames),
        participantIds: item.from === item.to ? [item.from] : [item.from, item.to],
      });
      return;
    }
    if (item.kind === 'note') {
      const frames = snapshotFrames(stack);
      const names = item.targets.map(id => nameOf(model, id)).join(', ');
      steps.push({
        index: steps.length,
        step: steps.length + 1,
        itemIndex,
        kind: 'note',
        caption: noteCaption(item.position, names, item.text, frames),
        participantIds: [...item.targets],
      });
    }
  });

  return steps;
}

/** True when the board has at least one message. Notes alone do not open a walk. */
export function sequenceCanWalk(model: SequenceDiagramModel | null | undefined): boolean {
  return Boolean(model?.items.some(item => item.kind === 'message'));
}

export function sequenceWalkFromSource(text: string): SequenceWalkStep[] {
  return sequenceWalkSteps(parseSequenceDiagram(text));
}

export function sequenceSourceCanWalk(text: string): boolean {
  return sequenceCanWalk(parseSequenceDiagram(text));
}

/**
 * Captions for the indexes actually visited, consecutive duplicates removed.
 * Same session-path shape as the Flow and Architecture Copy path.
 */
export function sequenceWalkSessionText(steps: SequenceWalkStep[], indexes: number[]): string | undefined {
  const kept: number[] = [];
  let prev = -1;
  for (const index of indexes) {
    if (!Number.isInteger(index) || index === prev || index < 0 || index >= steps.length) continue;
    kept.push(index);
    prev = index;
  }
  if (kept.length === 0) return undefined;
  return kept.map(index => steps[index].caption).join('\n');
}
