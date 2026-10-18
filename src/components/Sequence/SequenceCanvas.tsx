import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ICON_STYLES } from '../Canvas/iconStyles';
import { StyleIcon } from '../Canvas/icons/styles/StyleIcon';
import { WalkThroughOverlay } from '../Canvas/WalkThroughOverlay';
import { useDiagramStore } from '../../store/diagramStore';
import { activationSpans, parseSequenceSource } from './sequenceParser';
import type { SequenceArrow, SequenceItem } from './sequenceParser';
import { renameParticipant, editMessageText, toggleMessageDashed } from './sequenceEdit';
import {
  SEQUENCE_PALETTE,
  sequenceBadgePaint,
  sequenceFramePaint,
  sequenceHeaderPaint,
  sequenceLifelinePaint,
  sequenceMessagePaint,
  sequenceNotePaint,
  sequenceRoleColor,
  sequenceTitlePaint,
} from './sequenceStyle';
import { SEQUENCE_WALK_DIM, sequenceCanWalk, sequenceWalkSessionText, sequenceWalkSteps } from './sequenceWalk';

// Presentation-style sequence diagram renderer (SVG). Participants are
// colour-coded cards repeated top and bottom (slide-deck style), with
// dashed lifelines, labelled arrows, note cards, and loop/alt frames.
//
// Interactive like the other canvases: a zoom panel (buttons + ctrl-wheel),
// click a participant card to rename it, click a message label to rewrite it,
// and double-click a message line to toggle solid ↔ dashed. Every edit writes
// back into the Mermaid text, which stays the source of truth.

const PALETTE: readonly string[] = SEQUENCE_PALETTE;

const MARGIN_X = 60;
const HEADER_H = 56;
const HEADER_GAP = 28; // gap between header cards and first message
const ROW_H = 48;
const NOTE_H = 40;
const FRAME_PAD = 30; // vertical space consumed by frame start/else/end rows
const MIN_SPACING = 170;
const CHAR_W = 7.2; // rough width of a label character at 12px

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ACTIVATE_ROW = 16;
const BAR_W = 8;

function formatSeqNo(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function ArrowTip({
  kind,
  x,
  y,
  dir,
  color,
  strokeWidth = 1.6,
}: {
  kind: SequenceArrow;
  x: number;
  y: number;
  dir: 1 | -1;
  color: string;
  strokeWidth?: number;
}) {
  if (kind === 'async') {
    const back = x - dir * 9;
    return (
      <path
        d={`M ${back} ${y - 5} L ${x} ${y} L ${back} ${y + 5}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (kind === 'lost') {
    return (
      <g>
        <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

function SeqBadge({
  n,
  x,
  y,
  color,
  fill = '#fff',
  textColor,
  stroke,
  fontFamily = 'Inter, sans-serif',
}: {
  n: string;
  x: number;
  y: number;
  color: string;
  fill?: string;
  textColor?: string;
  stroke?: string;
  fontFamily?: string;
}) {
  const wide = n.length > 2;
  return (
    <g data-testid="seq-number" pointerEvents="none">
      <circle cx={x} cy={y} r={wide ? 11 : 8} fill={fill} stroke={stroke ?? color} strokeWidth={1.25} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={wide ? 8 : 9}
        fontWeight={700}
        fill={textColor ?? color}
        fontFamily={fontFamily}
      >
        {n}
      </text>
    </g>
  );
}

interface FrameBox {
  startY: number;
  endY: number;
  label: string;
  frameType: string;
  elses: { y: number; label: string }[];
}

type Editing =
  | { kind: 'participant'; id: string }
  | { kind: 'message'; index: number; x: number; y: number }
  | null;

export function SequenceCanvas() {
  const { dslText, setDslText, setError } = useDiagramStore();
  const iconStyle = useDiagramStore(s => s.iconStyle);
  const walkThroughStep = useDiagramStore(s => s.walkThroughStep);
  const walkThroughStack = useDiagramStore(s => s.walkThroughStack);
  const pushWalkThroughStep = useDiagramStore(s => s.pushWalkThroughStep);
  const popWalkThroughStep = useDiagramStore(s => s.popWalkThroughStep);
  const exitWalkThrough = useDiagramStore(s => s.exitWalkThrough);
  const setWalkThroughStep = useDiagramStore(s => s.setWalkThroughStep);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<SVGGElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');

  const parsed = useMemo(() => parseSequenceSource(dslText), [dslText]);
  const [lastGood, setLastGood] = useState(parsed.model);
  if (!parsed.error && lastGood !== parsed.model) {
    setLastGood(parsed.model);
  }
  const model = parsed.error ? lastGood : parsed.model;
  const { participants, items, title, autonumber } = model;

  useEffect(() => {
    setError(parsed.error);
  }, [parsed.error, setError]);

  // Ctrl/Cmd + wheel zooms, matching the React Flow canvases.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const layout = useMemo(() => {
    // Column spacing: wide enough for the longest message between adjacent
    // lifelines, with a sane minimum.
    let spacing = MIN_SPACING;
    items.forEach(it => {
      if (it.kind === 'message' && it.from !== it.to) {
        const span = Math.abs(
          participants.findIndex(p => p.id === it.from) -
          participants.findIndex(p => p.id === it.to),
        ) || 1;
        spacing = Math.max(spacing, (it.text.length * CHAR_W + 40) / span);
      }
    });
    const xFor = new Map<string, number>();
    participants.forEach((p, i) => xFor.set(p.id, MARGIN_X + 90 + i * spacing));

    // Vertical layout: walk items, assigning each a y position. Message rows
    // carry their document-order index so canvas edits can address the exact
    // line in the Mermaid text.
    let y = HEADER_H + HEADER_GAP + 20;
    const rows: { item: SequenceItem; y: number; msgIndex?: number; itemIndex: number }[] = [];
    const frames: FrameBox[] = [];
    const stack: FrameBox[] = [];
    const itemY: number[] = [];
    let msgCounter = 0;

    items.forEach((item, index) => {
      itemY[index] = y;
      if (item.kind === 'frameStart') {
        const box: FrameBox = { startY: y, endY: y, label: item.label, frameType: item.frameType, elses: [] };
        stack.push(box);
        frames.push(box);
        y += FRAME_PAD;
      } else if (item.kind === 'frameElse') {
        const box = stack[stack.length - 1];
        if (box) box.elses.push({ y, label: item.label });
        y += FRAME_PAD;
      } else if (item.kind === 'frameEnd') {
        const box = stack.pop();
        if (box) box.endY = y;
        y += FRAME_PAD - 10;
      } else if (item.kind === 'note') {
        rows.push({ item, y, itemIndex: index });
        y += NOTE_H + 14;
      } else if (item.kind === 'activate' || item.kind === 'deactivate') {
        y += ACTIVATE_ROW;
      } else {
        rows.push({ item, y, msgIndex: msgCounter++, itemIndex: index });
        y += item.kind === 'message' && item.from === item.to ? ROW_H + 14 : ROW_H;
      }
    });
    // Close any unclosed frames gracefully
    stack.forEach(box => { box.endY = y; });

    const bodyEnd = y + 16;
    const width = MARGIN_X * 2 + 180 + Math.max(0, participants.length - 1) * spacing;
    const height = bodyEnd + HEADER_GAP + HEADER_H + 30;
    const lastY = itemY.length > 0 ? itemY[itemY.length - 1] : y;
    const bars = activationSpans(items).flatMap(span => {
      const x = xFor.get(span.id);
      const y1 = itemY[span.from];
      if (x === undefined || y1 === undefined) return [];
      const y2 = span.open ? lastY : (itemY[span.to] ?? lastY);
      return [{ id: span.id, x, y1, y2: Math.max(y2, y1), depth: span.depth, from: span.from, to: span.to }];
    });
    return { xFor, rows, frames, width, height, bodyEnd, spacing, bars };
  }, [participants, items]);

  // DT-SEQ-03 — one message or note at a time. View state only; the Mermaid
  // source is unchanged and there is no board field.
  const walkSteps = useMemo(() => sequenceWalkSteps(model), [model]);
  const walkActive = walkThroughStep !== null && sequenceCanWalk(model) && walkSteps.length > 0;
  const walkIndex = walkActive ? Math.min(walkThroughStep ?? 0, walkSteps.length - 1) : 0;
  const currentWalk = walkActive ? walkSteps[walkIndex] : null;
  const hotParticipants = useMemo(() => new Set(currentWalk?.participantIds ?? []), [currentWalk]);
  const walkPathText = walkActive
    ? sequenceWalkSessionText(walkSteps, [0, ...walkThroughStack, walkIndex])
    : undefined;

  useEffect(() => {
    if (walkThroughStep === null) return;
    if (!sequenceCanWalk(model) || walkSteps.length === 0) exitWalkThrough();
    else if (walkThroughStep >= walkSteps.length) setWalkThroughStep(walkSteps.length - 1);
  }, [walkThroughStep, model, walkSteps.length, exitWalkThrough, setWalkThroughStep]);

  useEffect(() => {
    if (!walkActive) return;
    const row = currentRowRef.current;
    const scroller = scrollRef.current;
    if (!row || !scroller || typeof scroller.scrollTo !== 'function') return;
    const rowRect = row.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    if (box.height === 0 && box.width === 0) return;
    const pad = 24;
    let top = scroller.scrollTop;
    let left = scroller.scrollLeft;
    if (rowRect.top < box.top + pad) top -= box.top + pad - rowRect.top;
    else if (rowRect.bottom > box.bottom - pad) top += rowRect.bottom - (box.bottom - pad);
    if (rowRect.left < box.left + pad) left -= box.left + pad - rowRect.left;
    else if (rowRect.right > box.right - pad) left += rowRect.right - (box.right - pad);
    if (top !== scroller.scrollTop || left !== scroller.scrollLeft) {
      scroller.scrollTo({ top, left });
    }
  }, [walkActive, walkIndex, zoom, layout.height, layout.width]);

  const accentOf = (id: string) => {
    const index = participants.findIndex(p => p.id === id);
    const participant = index >= 0 ? participants[index] : undefined;
    if (participant?.role) return sequenceRoleColor(participant.role, iconStyle);
    const slot = index >= 0 ? index : 0;
    return PALETTE[slot % PALETTE.length];
  };
  const messagePaint = sequenceMessagePaint(iconStyle);
  const lifelinePaint = sequenceLifelinePaint(iconStyle);
  const titlePaint = sequenceTitlePaint(iconStyle);
  const framePaint = sequenceFramePaint(iconStyle);
  const notePaint = sequenceNotePaint(iconStyle);
  const styled = iconStyle !== 'clean';
  const markerColors = [...new Set(participants.map(p => accentOf(p.id)))];

  const commitEdit = () => {
    if (!editing) {
      return;
    }
    const value = draft.trim();
    if (value) {
      const next = editing.kind === 'participant'
        ? renameParticipant(dslText, editing.id, value)
        : editMessageText(dslText, editing.index, value);
      if (next !== dslText) setDslText(next);
    }
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  const startParticipantEdit = (id: string, current: string) => {
    setDraft(current);
    setEditing({ kind: 'participant', id });
  };

  const startMessageEdit = (index: number, current: string, x: number, y: number) => {
    setDraft(current);
    setEditing({ kind: 'message', index, x, y });
  };

  const toggleDashed = (index: number) => {
    const next = toggleMessageDashed(dslText, index);
    if (next !== dslText) setDslText(next);
  };

  const blueprintGrid = useMemo(() => {
    if (iconStyle !== 'blueprint') return null;
    const grid = ICON_STYLES.blueprint.grid;
    if (!grid) return null;
    const lines: ReactNode[] = [];
    for (let x = 0; x <= layout.width; x += grid.gap) {
      lines.push(<line key={`v-${x}`} x1={x} y1={0} x2={x} y2={layout.height} stroke={grid.color} strokeWidth={1} />);
    }
    for (let y = 0; y <= layout.height; y += grid.gap) {
      lines.push(<line key={`h-${y}`} x1={0} y1={y} x2={layout.width} y2={y} stroke={grid.color} strokeWidth={1} />);
    }
    return lines;
  }, [iconStyle, layout.width, layout.height]);

  if (participants.length === 0) {
    return (
      <div className="sequence-canvas w-full h-full flex items-center justify-center bg-white" data-icon-style={iconStyle}>
        <div className="text-center text-slate-400 max-w-md px-6">
          <div className="text-4xl mb-4">🔁</div>
          <div className="text-lg mb-2">Describe a sequence in Mermaid format</div>
          <pre className="text-left text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-500">
{`sequenceDiagram
participant U as User
participant A as API
U->>A: GET /orders
A-->>U: 200 OK`}
          </pre>
        </div>
      </div>
    );
  }

  const editorInput = (commitLabel: string) => (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={e => {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') cancelEdit();
      }}
      aria-label={commitLabel}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: '1.5px solid #6366f1',
        borderRadius: 8,
        padding: '0 8px',
        fontSize: 12,
        fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
        outline: 'none',
        background: '#fff',
        color: '#0f172a',
      }}
    />
  );

  const renderHeaderRow = (yPos: number, editable: boolean) =>
    participants.map(p => {
      const x = layout.xFor.get(p.id)!;
      const c = accentOf(p.id);
      const isEditingThis = editable && editing?.kind === 'participant' && editing.id === p.id;
      const headerHot = hotParticipants.has(p.id);
      const legacy = iconStyle === 'clean' && !p.role;
      const paint = legacy ? null : sequenceHeaderPaint(iconStyle, c, p.role);
      const iconSize = paint?.showIcon ? paint.iconSize : 0;
      const iconGap = iconSize ? 6 : 0;
      const w = Math.max(120, p.name.length * 8.5 + 36 + iconSize + iconGap);
      const textW = p.name.length * 8.5;
      const blockW = iconSize + iconGap + textW;
      const iconX = x - blockW / 2;
      const textX = iconSize ? iconX + iconSize + iconGap + textW / 2 : x;
      const iconY = yPos + ((HEADER_H - 12) - iconSize) / 2;
      const card = {
        x: x - w / 2,
        y: yPos,
        width: w,
        height: HEADER_H - 12,
      };
      return (
        <g
          key={`${p.id}-${yPos}`}
          data-seq-participant={p.id}
          data-role={p.role}
          data-walk-header={walkActive ? (headerHot ? 'hot' : 'dim') : undefined}
          opacity={walkActive ? (headerHot ? 1 : SEQUENCE_WALK_DIM) : undefined}
          style={{ cursor: editable ? 'pointer' : 'default' }}
          onClick={editable && !isEditingThis ? () => startParticipantEdit(p.id, p.name) : undefined}
        >
          {legacy ? (
            <>
              <rect x={card.x} y={card.y} width={card.width} height={card.height} rx={10}
                fill={c} opacity={0.92} />
              <rect x={card.x} y={card.y} width={card.width} height={card.height} rx={10}
                fill="none" stroke="#0f172a" strokeOpacity={0.08} />
            </>
          ) : paint && (
            <>
              <rect
                x={card.x}
                y={card.y}
                width={card.width}
                height={card.height}
                rx={paint.radius}
                fill={paint.fill}
                opacity={paint.fillOpacity}
                stroke={iconStyle !== 'clean' && paint.borderWidth > 0 ? paint.border : undefined}
                strokeWidth={iconStyle !== 'clean' && paint.borderWidth > 0 ? paint.borderWidth : undefined}
              />
              {iconStyle === 'clean' && (
                <rect x={card.x} y={card.y} width={card.width} height={card.height} rx={paint.radius}
                  fill="none" stroke="#0f172a" strokeOpacity={0.08} />
              )}
            </>
          )}
          {isEditingThis ? (
            <foreignObject x={card.x + 4} y={yPos + 6} width={card.width - 8} height={HEADER_H - 24}>
              {editorInput('Rename participant')}
            </foreignObject>
          ) : legacy ? (
            <text x={x} y={yPos + (HEADER_H - 12) / 2 + 1} textAnchor="middle" dominantBaseline="central"
              fill="#fff" fontSize={13.5} fontWeight={600} fontFamily="Inter, sans-serif">
              {p.actor ? `👤 ${p.name}` : p.name}
            </text>
          ) : paint && (
            <>
              {paint.showIcon && paint.icon && (
                <g transform={`translate(${iconX}, ${iconY})`} pointerEvents="none">
                  <StyleIcon
                    name={paint.icon}
                    size={paint.iconSize}
                    strokeWidth={paint.iconStroke}
                    filled={paint.iconFilled}
                    color={paint.iconColor}
                    markColor={paint.iconFilled ? paint.fill : undefined}
                    decorative
                  />
                </g>
              )}
              <text x={textX} y={yPos + (HEADER_H - 12) / 2 + 1} textAnchor="middle" dominantBaseline="central"
                fill={paint.label} fontSize={13.5} fontWeight={paint.fontWeight} fontFamily={paint.fontFamily}>
                {p.name}
              </text>
            </>
          )}
          {editable && !isEditingThis && (
            <title>Click to rename</title>
          )}
        </g>
      );
    });

  return (
    <div
      className="sequence-canvas relative w-full h-full bg-white"
      data-canvas-target="primary"
      data-icon-style={iconStyle}
      style={iconStyle === 'blueprint' ? { background: ICON_STYLES.blueprint.pane } : undefined}
    >
      <div ref={scrollRef} className="w-full h-full overflow-auto">
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          xmlns="http://www.w3.org/2000/svg"
        >
        <defs>
          {markerColors.map(c => (
            <marker key={c} id={`seq-arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {iconStyle === 'blueprint' && (
          <g data-seq-grid="blueprint" pointerEvents="none">
            <rect x={0} y={0} width={layout.width} height={layout.height} fill={ICON_STYLES.blueprint.canvas} />
            {blueprintGrid}
          </g>
        )}

        <g opacity={walkActive ? SEQUENCE_WALK_DIM : undefined}>
        {title && (
          <text x={layout.width / 2} y={26} textAnchor="middle" fontSize={16} fontWeight={700}
            fill={titlePaint.color} fontFamily={titlePaint.fontFamily}>{title}</text>
        )}

        {/* Lifelines. A role tints the dash with that role colour. */}
        {participants.map(p => {
          const x = layout.xFor.get(p.id)!;
          return (
            <line key={p.id} x1={x} y1={HEADER_H + 32} x2={x} y2={layout.bodyEnd + HEADER_GAP - 6}
              stroke={accentOf(p.id)} strokeOpacity={lifelinePaint.opacity} strokeWidth={lifelinePaint.width}
              strokeDasharray={lifelinePaint.dash} />
          );
        })}

        {/* Frames (loop / alt / opt) */}
        {layout.frames.map((f, i) => {
          const xs = participants.map(p => layout.xFor.get(p.id)!);
          const left = Math.min(...xs) - 46;
          const right = Math.max(...xs) + 46;
          const pillW = Math.max(58, f.frameType.length * 8 + 26);
          if (!styled) {
            return (
              <g key={i}>
                <rect x={left} y={f.startY} width={right - left} height={f.endY - f.startY}
                  rx={8} fill="#6366f1" fillOpacity={0.03} stroke="#94a3b8" strokeDasharray="4 4" />
                <rect x={left} y={f.startY} width={pillW} height={20} rx={6}
                  fill="#475569" />
                <text x={left + 10} y={f.startY + 10.5} dominantBaseline="central" fontSize={10.5}
                  fontWeight={700} fill="#fff" fontFamily="Inter, sans-serif">
                  {f.frameType.toUpperCase()}
                </text>
                {f.label && (
                  <text x={left + pillW + 8} y={f.startY + 10.5}
                    dominantBaseline="central" fontSize={11} fill="#475569" fontStyle="italic"
                    fontFamily="Inter, sans-serif">
                    {f.label}
                  </text>
                )}
                {f.elses.map((e, j) => (
                  <g key={j}>
                    <line x1={left} y1={e.y} x2={right} y2={e.y} stroke="#94a3b8" strokeDasharray="4 4" />
                    <text x={left + 10} y={e.y + 12} fontSize={10.5} fontStyle="italic" fill="#475569"
                      fontFamily="Inter, sans-serif">
                      [{e.label || 'else'}]
                    </text>
                  </g>
                ))}
              </g>
            );
          }
          return (
            <g key={i}>
              <rect x={left} y={f.startY} width={right - left} height={f.endY - f.startY}
                rx={framePaint.radius} fill={framePaint.fill} fillOpacity={framePaint.fillOpacity}
                stroke={framePaint.stroke} strokeWidth={framePaint.strokeWidth}
                strokeDasharray={framePaint.dash} />
              <rect x={left} y={f.startY} width={pillW} height={20} rx={framePaint.pillRadius}
                fill={framePaint.pillFill}
                stroke={framePaint.pillStrokeWidth > 0 ? framePaint.pillStroke : undefined}
                strokeWidth={framePaint.pillStrokeWidth > 0 ? framePaint.pillStrokeWidth : undefined} />
              <text x={left + 10} y={f.startY + 10.5} dominantBaseline="central" fontSize={10.5}
                fontWeight={700} fill={framePaint.pillLabel} fontFamily={framePaint.fontFamily}>
                {f.frameType.toUpperCase()}
              </text>
              {f.label && (
                <text x={left + pillW + 8} y={f.startY + 10.5}
                  dominantBaseline="central" fontSize={11} fill={framePaint.label} fontStyle="italic"
                  fontFamily={framePaint.fontFamily}>
                  {f.label}
                </text>
              )}
              {f.elses.map((e, j) => (
                <g key={j}>
                  <line x1={left} y1={e.y} x2={right} y2={e.y} stroke={framePaint.elseStroke}
                    strokeDasharray={framePaint.elseDash} />
                  <text x={left + 10} y={e.y + 12} fontSize={10.5} fontStyle="italic" fill={framePaint.label}
                    fontFamily={framePaint.fontFamily}>
                    [{e.label || 'else'}]
                  </text>
                </g>
              ))}
            </g>
          );
        })}
        </g>

        {/* Activation bars sit on the lifeline, under the arrows. */}
        {layout.bars.map((bar, i) => {
          const barHot = Boolean(currentWalk && currentWalk.itemIndex >= bar.from && currentWalk.itemIndex <= bar.to);
          return (
            <g
              key={`act-${i}`}
              data-walk-bar={walkActive ? (barHot ? 'hot' : 'dim') : undefined}
              opacity={walkActive ? (barHot ? 1 : SEQUENCE_WALK_DIM) : undefined}
            >
              <rect
                data-testid="seq-activation"
                x={bar.x - BAR_W / 2 + bar.depth * 7}
                y={bar.y1 - 4}
                width={BAR_W}
                height={Math.max(12, bar.y2 - bar.y1 + 8)}
                rx={1}
                fill={accentOf(bar.id)}
                fillOpacity={0.9}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* Messages and notes */}
        {layout.rows.map(({ item, y, msgIndex, itemIndex }, i) => {
          const walkStep = walkSteps.find(step => step.itemIndex === itemIndex);
          const rowCurrent = Boolean(walkActive && walkStep && walkStep.index === walkIndex);
          const rowOpacity = walkActive ? (rowCurrent ? 1 : SEQUENCE_WALK_DIM) : undefined;
          if (item.kind === 'note') {
            const xs = item.targets.map(t => layout.xFor.get(t)!).filter(x => x !== undefined);
            const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
            const w = Math.max(120, item.text.length * 6.6 + 24);
            let x = cx - w / 2;
            if (item.position === 'left') x = xs[0] - w - 14;
            if (item.position === 'right') x = xs[0] + 14;
            return (
              <g
                key={i}
                ref={rowCurrent ? currentRowRef : undefined}
                data-walk-index={walkStep?.index}
                data-walk-current={rowCurrent ? 'true' : undefined}
                opacity={rowOpacity}
              >
                {styled ? (
                  <rect x={x} y={y} width={w} height={NOTE_H - 6} rx={notePaint.radius}
                    fill={notePaint.fill} stroke={notePaint.strokeWidth > 0 ? notePaint.stroke : undefined}
                    strokeWidth={notePaint.strokeWidth > 0 ? notePaint.strokeWidth : undefined}
                    strokeOpacity={notePaint.strokeOpacity} />
                ) : (
                  <rect x={x} y={y} width={w} height={NOTE_H - 6} rx={6}
                    fill="#fef9c3" stroke="#eab308" strokeOpacity={0.5} />
                )}
                <text x={x + w / 2} y={y + (NOTE_H - 6) / 2 + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fill={styled ? notePaint.label : '#713f12'}
                  fontFamily={styled ? notePaint.fontFamily : 'Inter, sans-serif'}>
                  {item.text}
                </text>
              </g>
            );
          }

          if (item.kind !== 'message' || msgIndex === undefined) return null;
          const c = accentOf(item.from);
          const arrow: SequenceArrow = item.arrow ?? 'sync';
          const marker = arrow === 'sync' ? `url(#seq-arrow-${c.slice(1)})` : undefined;
          const messageDash = item.dashed ? messagePaint.dashedDash : messagePaint.solidDash;
          const badge = sequenceBadgePaint(iconStyle, c);
          const x1 = layout.xFor.get(item.from)!;
          const x2 = layout.xFor.get(item.to)!;
          const isEditingThis = editing?.kind === 'message' && editing.index === msgIndex;
          const seqLabel = autonumber
            ? formatSeqNo(autonumber.start + msgIndex * autonumber.step)
            : null;
          const arrowAttr = arrow === 'sync' ? {} : { 'data-arrow': arrow };

          if (item.from === item.to) {
            // Self message: small loop to the right of the lifeline.
            // Sync keeps the historical path and filled marker.
            const loopW = 46;
            const shaftEnd = arrow === 'sync' ? x1 + 6 : arrow === 'open' ? x1 : x1 + 10;
            const tipX = arrow === 'open' ? x1 : x1 + 2;
            return (
              <g
                key={i}
                {...arrowAttr}
                ref={rowCurrent ? currentRowRef : undefined}
                data-walk-index={walkStep?.index}
                data-walk-current={rowCurrent ? 'true' : undefined}
                opacity={rowOpacity}
              >
                <path d={`M ${x1} ${y} H ${x1 + loopW} V ${y + 24} H ${shaftEnd}`}
                  fill="none" stroke={c} strokeWidth={messagePaint.width}
                  strokeDasharray={messageDash} markerEnd={marker} />
                {arrow !== 'sync' && (
                  <ArrowTip kind={arrow} x={tipX} y={y + 24} dir={-1} color={c} strokeWidth={messagePaint.tipWidth} />
                )}
                <path d={`M ${x1} ${y} H ${x1 + loopW} V ${y + 24} H ${x1 + 6}`}
                  fill="none" stroke="transparent" strokeWidth={12} style={{ cursor: 'pointer' }}
                  onDoubleClick={() => toggleDashed(msgIndex)}>
                  <title>Double-click to toggle dashed</title>
                </path>
                {isEditingThis ? (
                  <foreignObject x={x1 + loopW + 6} y={y} width={190} height={26}>
                    {editorInput('Edit message')}
                  </foreignObject>
                ) : (
                  <text x={x1 + loopW + 8} y={y + 12} fontSize={12} fill={messagePaint.label}
                    fontFamily={messagePaint.fontFamily} style={{ cursor: 'text' }}
                    onClick={() => startMessageEdit(msgIndex, item.text, x1 + loopW + 8, y)}>
                    {item.text}
                    <title>Click to edit</title>
                  </text>
                )}
                {seqLabel && (
                  <SeqBadge
                    n={seqLabel}
                    x={x1 + 18}
                    y={y - 12}
                    color={c}
                    fill={styled ? badge.fill : undefined}
                    textColor={styled ? badge.text : undefined}
                    stroke={styled ? badge.stroke : undefined}
                    fontFamily={styled ? badge.fontFamily : undefined}
                  />
                )}
              </g>
            );
          }

          const dir: 1 | -1 = x2 > x1 ? 1 : -1;
          const midX = (x1 + x2) / 2;
          const xEnd = arrow === 'sync' ? x2 - dir * 4 : arrow === 'open' ? x2 : x2 - dir * 8;
          return (
            <g
              key={i}
              {...arrowAttr}
              ref={rowCurrent ? currentRowRef : undefined}
              data-walk-index={walkStep?.index}
              data-walk-current={rowCurrent ? 'true' : undefined}
              opacity={rowOpacity}
            >
              <line x1={x1} y1={y} x2={xEnd} y2={y} stroke={c} strokeWidth={messagePaint.width}
                strokeDasharray={messageDash} markerEnd={marker} />
              {arrow !== 'sync' && (
                <ArrowTip kind={arrow} x={x2} y={y} dir={dir} color={c} strokeWidth={messagePaint.tipWidth} />
              )}
              {/* Wide invisible hit-line: easier double-click target */}
              <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={14}
                style={{ cursor: 'pointer' }} onDoubleClick={() => toggleDashed(msgIndex)}>
                <title>Double-click to toggle dashed</title>
              </line>
              {isEditingThis ? (
                <foreignObject x={midX - 100} y={y - 32} width={200} height={26}>
                  {editorInput('Edit message')}
                </foreignObject>
              ) : (
                <text x={midX} y={y - 8} textAnchor="middle" fontSize={12}
                  fontWeight={500} fill={messagePaint.label} fontFamily={messagePaint.fontFamily}
                  style={{ cursor: 'text' }}
                  onClick={() => startMessageEdit(msgIndex, item.text, midX, y)}>
                  {item.text}
                  <title>Click to edit</title>
                </text>
              )}
              {seqLabel && (
                <SeqBadge
                  n={seqLabel}
                  x={x1 + dir * 14}
                  y={y - 14}
                  color={c}
                  fill={styled ? badge.fill : undefined}
                  textColor={styled ? badge.text : undefined}
                  stroke={styled ? badge.stroke : undefined}
                  fontFamily={styled ? badge.fontFamily : undefined}
                />
              )}
            </g>
          );
        })}

        {/* Participant cards, top and bottom */}
        {renderHeaderRow(HEADER_H - 24, true)}
        {renderHeaderRow(layout.bodyEnd + HEADER_GAP, false)}
        </svg>
      </div>

      {walkActive && currentWalk && (
        <WalkThroughOverlay
          placement="anchor"
          step={walkIndex + 1}
          total={walkSteps.length}
          label={currentWalk.caption}
          captionText={currentWalk.caption}
          pathText={walkPathText}
          onPrev={() => {
            if (walkIndex <= 0) return;
            popWalkThroughStep();
          }}
          onNext={() => {
            if (walkIndex >= walkSteps.length - 1) return;
            pushWalkThroughStep(walkIndex + 1);
          }}
          onExit={exitWalkThrough}
        />
      )}

      {/* Zoom panel — same treatment as the other canvases */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 p-1.5 flex items-center gap-1">
        <button
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - 0.1) * 10) / 10))}
          className="w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold text-sm"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-1.5 h-7 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 tabular-nums"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + 0.1) * 10) / 10))}
          className="w-7 h-7 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold text-sm"
          title="Zoom in"
        >
          +
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button
          onClick={() => {
            const el = scrollRef.current;
            if (!el) return;
            setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(
              el.clientWidth / layout.width,
              el.clientHeight / layout.height,
            ))));
          }}
          className="px-2 h-7 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          title="Fit the whole diagram in view"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
