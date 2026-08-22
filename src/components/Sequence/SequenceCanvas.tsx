import { useEffect, useMemo, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { parseSequenceSource } from './sequenceParser';
import type { SequenceItem } from './sequenceParser';
import { renameParticipant, editMessageText, toggleMessageDashed } from './sequenceEdit';

// Presentation-style sequence diagram renderer (SVG). Participants are
// colour-coded cards repeated top and bottom (slide-deck style), with
// dashed lifelines, labelled arrows, note cards, and loop/alt frames.
//
// Interactive like the other canvases: a zoom panel (buttons + ctrl-wheel),
// click a participant card to rename it, click a message label to rewrite it,
// and double-click a message line to toggle solid ↔ dashed. Every edit writes
// back into the Mermaid text, which stays the source of truth.

const PALETTE = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');

  const parsed = useMemo(() => parseSequenceSource(dslText), [dslText]);
  const [lastGood, setLastGood] = useState(parsed.model);
  if (!parsed.error && lastGood !== parsed.model) {
    setLastGood(parsed.model);
  }
  const model = parsed.error ? lastGood : parsed.model;
  const { participants, items, title } = model;

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
    const rows: { item: SequenceItem; y: number; msgIndex?: number }[] = [];
    const frames: FrameBox[] = [];
    const stack: FrameBox[] = [];
    let msgCounter = 0;

    items.forEach(item => {
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
        rows.push({ item, y });
        y += NOTE_H + 14;
      } else {
        rows.push({ item, y, msgIndex: msgCounter++ });
        y += item.kind === 'message' && item.from === item.to ? ROW_H + 14 : ROW_H;
      }
    });
    // Close any unclosed frames gracefully
    stack.forEach(box => { box.endY = y; });

    const bodyEnd = y + 16;
    const width = MARGIN_X * 2 + 180 + Math.max(0, participants.length - 1) * spacing;
    const height = bodyEnd + HEADER_GAP + HEADER_H + 30;
    return { xFor, rows, frames, width, height, bodyEnd, spacing };
  }, [participants, items]);

  const colorFor = (id: string) =>
    PALETTE[participants.findIndex(p => p.id === id) % PALETTE.length];

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

  if (participants.length === 0) {
    return (
      <div className="sequence-canvas w-full h-full flex items-center justify-center bg-white">
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
      const c = colorFor(p.id);
      const w = Math.max(120, p.name.length * 8.5 + 36);
      const isEditingThis = editable && editing?.kind === 'participant' && editing.id === p.id;
      return (
        <g
          key={`${p.id}-${yPos}`}
          style={{ cursor: editable ? 'pointer' : 'default' }}
          onClick={editable && !isEditingThis ? () => startParticipantEdit(p.id, p.name) : undefined}
        >
          <rect x={x - w / 2} y={yPos} width={w} height={HEADER_H - 12} rx={10}
            fill={c} opacity={0.92} />
          <rect x={x - w / 2} y={yPos} width={w} height={HEADER_H - 12} rx={10}
            fill="none" stroke="#0f172a" strokeOpacity={0.08} />
          {isEditingThis ? (
            <foreignObject x={x - w / 2 + 4} y={yPos + 6} width={w - 8} height={HEADER_H - 24}>
              {editorInput('Rename participant')}
            </foreignObject>
          ) : (
            <text x={x} y={yPos + (HEADER_H - 12) / 2 + 1} textAnchor="middle" dominantBaseline="central"
              fill="#fff" fontSize={13.5} fontWeight={600} fontFamily="Inter, sans-serif">
              {p.actor ? `👤 ${p.name}` : p.name}
            </text>
          )}
          {editable && !isEditingThis && (
            <title>Click to rename</title>
          )}
        </g>
      );
    });

  return (
    <div className="sequence-canvas relative w-full h-full bg-white" data-canvas-target="primary">
      <div ref={scrollRef} className="w-full h-full overflow-auto">
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          xmlns="http://www.w3.org/2000/svg"
        >
        <defs>
          {PALETTE.map(c => (
            <marker key={c} id={`seq-arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {title && (
          <text x={layout.width / 2} y={26} textAnchor="middle" fontSize={16} fontWeight={700}
            fill="#0f172a" fontFamily="Inter, sans-serif">{title}</text>
        )}

        {/* Lifelines */}
        {participants.map(p => {
          const x = layout.xFor.get(p.id)!;
          return (
            <line key={p.id} x1={x} y1={HEADER_H + 32} x2={x} y2={layout.bodyEnd + HEADER_GAP - 6}
              stroke={colorFor(p.id)} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 5" />
          );
        })}

        {/* Frames (loop / alt / opt) */}
        {layout.frames.map((f, i) => {
          const xs = participants.map(p => layout.xFor.get(p.id)!);
          const left = Math.min(...xs) - 46;
          const right = Math.max(...xs) + 46;
          return (
            <g key={i}>
              <rect x={left} y={f.startY} width={right - left} height={f.endY - f.startY}
                rx={8} fill="#6366f1" fillOpacity={0.03} stroke="#94a3b8" strokeDasharray="4 4" />
              <rect x={left} y={f.startY} width={Math.max(58, f.frameType.length * 8 + 26)} height={20} rx={6}
                fill="#475569" />
              <text x={left + 10} y={f.startY + 10.5} dominantBaseline="central" fontSize={10.5}
                fontWeight={700} fill="#fff" fontFamily="Inter, sans-serif">
                {f.frameType.toUpperCase()}
              </text>
              {f.label && (
                <text x={left + Math.max(58, f.frameType.length * 8 + 26) + 8} y={f.startY + 10.5}
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
        })}

        {/* Messages and notes */}
        {layout.rows.map(({ item, y, msgIndex }, i) => {
          if (item.kind === 'note') {
            const xs = item.targets.map(t => layout.xFor.get(t)!).filter(x => x !== undefined);
            const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
            const w = Math.max(120, item.text.length * 6.6 + 24);
            let x = cx - w / 2;
            if (item.position === 'left') x = xs[0] - w - 14;
            if (item.position === 'right') x = xs[0] + 14;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={NOTE_H - 6} rx={6}
                  fill="#fef9c3" stroke="#eab308" strokeOpacity={0.5} />
                <text x={x + w / 2} y={y + (NOTE_H - 6) / 2 + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fill="#713f12" fontFamily="Inter, sans-serif">
                  {item.text}
                </text>
              </g>
            );
          }

          if (item.kind !== 'message' || msgIndex === undefined) return null;
          const c = colorFor(item.from);
          const marker = `url(#seq-arrow-${c.slice(1)})`;
          const x1 = layout.xFor.get(item.from)!;
          const x2 = layout.xFor.get(item.to)!;
          const isEditingThis = editing?.kind === 'message' && editing.index === msgIndex;

          if (item.from === item.to) {
            // Self message: small loop to the right of the lifeline
            const loopW = 46;
            return (
              <g key={i}>
                <path d={`M ${x1} ${y} H ${x1 + loopW} V ${y + 24} H ${x1 + 6}`}
                  fill="none" stroke={c} strokeWidth={1.8}
                  strokeDasharray={item.dashed ? '6 4' : undefined} markerEnd={marker} />
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
                  <text x={x1 + loopW + 8} y={y + 12} fontSize={12} fill="#334155"
                    fontFamily="Inter, sans-serif" style={{ cursor: 'text' }}
                    onClick={() => startMessageEdit(msgIndex, item.text, x1 + loopW + 8, y)}>
                    {item.text}
                    <title>Click to edit</title>
                  </text>
                )}
              </g>
            );
          }

          const dir = x2 > x1 ? 1 : -1;
          const midX = (x1 + x2) / 2;
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2 - dir * 4} y2={y} stroke={c} strokeWidth={1.8}
                strokeDasharray={item.dashed ? '6 4' : undefined} markerEnd={marker} />
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
                  fontWeight={500} fill="#334155" fontFamily="Inter, sans-serif"
                  style={{ cursor: 'text' }}
                  onClick={() => startMessageEdit(msgIndex, item.text, midX, y)}>
                  {item.text}
                  <title>Click to edit</title>
                </text>
              )}
            </g>
          );
        })}

        {/* Participant cards, top and bottom */}
        {renderHeaderRow(HEADER_H - 24, true)}
        {renderHeaderRow(layout.bodyEnd + HEADER_GAP, false)}
        </svg>
      </div>

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
