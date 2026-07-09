// Per-board presentation canvas. Each board can carry its own "deck": a list
// of draggable + resizable images (rendered diagram snapshots) and speaker
// notes arranged on an infinite workspace, so the user can compose a
// presentation out of their diagrams and export the whole thing as one
// PNG for sharing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { boardManager, type Board, type PresentationItem } from '../../utils/boardManager';

// ---------------------------------------------------------------------------
// Hooks + helpers
// ---------------------------------------------------------------------------

interface Size { w: number; h: number; }
interface Pos { x: number; y: number; }

function clamp<T extends number>(n: T, min: number, max: number): T {
  return Math.max(min, Math.min(max, n)) as T;
}

function sortPresentationItems(items: PresentationItem[]): PresentationItem[] {
  return [...items].sort((a, b) => (a.type === b.type ? 0 : a.type === 'image' ? -1 : 1));
}

// Translate pointer events on a handle into a new size for the item. The
// handle element exposes `data-handle` (nw, ne, sw, se, n, s, e, w).
function useResize(itemId: string, onResize: (id: string, w: number, h: number) => void) {
  return (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const handle = (e.currentTarget as HTMLElement).dataset.handle ?? 'se';
    const startX = e.clientX;
    const startY = e.clientY;
    let initialSize: Size;
    try {
      initialSize = JSON.parse((e.currentTarget as HTMLElement).dataset.size || '{"w":0,"h":0}');
    } catch {
      initialSize = { w: 0, h: 0 };
    }

    // Listen on window — not on the tiny 12×12 handle. As the user drags
    // outward, the cursor leaves the handle within a few pixels and
    // per-element listeners stop firing; setPointerCapture is unreliable
    // here because React re-renders mid-drag and swaps the DOM node.
    // Window-level listeners capture every move / up until the user
    // releases the mouse button.
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let w = initialSize.w;
      let h = initialSize.h;
      if (handle.includes('e')) w = Math.max(80, initialSize.w + dx);
      if (handle.includes('w')) w = Math.max(80, initialSize.w - dx);
      if (handle.includes('s')) h = Math.max(60, initialSize.h + dy);
      if (handle.includes('n')) h = Math.max(60, initialSize.h - dy);
      onResize(itemId, w, h);
    };
    const up = () => {
      window.removeEventListener('pointermove', move as unknown as EventListener);
      window.removeEventListener('pointerup', up as unknown as EventListener);
    };
    window.addEventListener('pointermove', move as unknown as EventListener);
    window.addEventListener('pointerup', up as unknown as EventListener);
  };
}

function useDrag(
  itemId: string,
  initial: Pos,
  onMove: (id: string, x: number, y: number) => void,
) {
  return (e: React.PointerEvent) => {
    // Ignore drags that originate on a resize handle.
    if ((e.target as HTMLElement).dataset.handle) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    // Window-level listeners — same reasoning as useResize above.
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onMove(itemId, initial.x + dx, initial.y + dy);
    };
    const up = () => {
      window.removeEventListener('pointermove', move as unknown as EventListener);
      window.removeEventListener('pointerup', up as unknown as EventListener);
    };
    window.addEventListener('pointermove', move as unknown as EventListener);
    window.addEventListener('pointerup', up as unknown as EventListener);
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type ToolIconName = 'diagram' | 'text' | 'arrow' | 'note' | 'reset' | 'export' | 'back';

function ToolIcon({ name }: { name: ToolIconName }) {
  if (name === 'diagram') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="5" width="16" height="14" rx="2" strokeWidth={2} />
        <path d="M8 10h8M8 14h5" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'text') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M5 6h14M12 6v12M9 18h6" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'arrow') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M5 12h13M13 7l5 5-5 5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'note') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M6 4h9l3 3v13H6z" strokeWidth={2} strokeLinejoin="round" />
        <path d="M15 4v4h4M9 12h6M9 16h4" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'reset') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 11 3M19 9A7 7 0 0 0 8 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'export') {
    return (
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 4v10M8 10l4 4 4-4M5 20h14" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  variant = 'secondary',
  disabled,
  title,
}: {
  icon: ToolIconName;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success';
  disabled?: boolean;
  title?: string;
}) {
  const variantClass =
    variant === 'primary' ? 'btn-primary' :
    variant === 'success' ? 'btn-success' :
    'btn-secondary';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`btn btn-sm ${variantClass} ${disabled ? 'opacity-50 cursor-not-allowed hover:transform-none' : ''}`}
    >
      <ToolIcon name={icon} />
      {label}
    </button>
  );
}

function ResizeHandles({ item, onResize }: { item: PresentationItem; onResize: (id: string, w: number, h: number) => void }) {
  const handle = useResize(item.id, onResize);
  return (
    <>
      {HANDLES.map(h => (
        <div
          key={h}
          data-handle={h}
          data-size={JSON.stringify({ w: item.width, h: item.height })}
          onPointerDown={handle}
          className={`absolute w-3 h-3 bg-white border-2 border-indigo-500 rounded-sm
            ${h === 'nw' ? 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize' : ''}
            ${h === 'n'  ? 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-n-resize' : ''}
            ${h === 'ne' ? 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize' : ''}
            ${h === 'e'  ? 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-e-resize' : ''}
            ${h === 'se' ? 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-se-resize' : ''}
            ${h === 's'  ? 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-s-resize' : ''}
            ${h === 'sw' ? 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize' : ''}
            ${h === 'w'  ? 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-w-resize' : ''}
          `}
        />
      ))}
    </>
  );
}

function ItemRenderer({
  item,
  selected,
  onSelect,
  onMove,
  onResize,
  onDelete,
  onTextChange,
}: {
  item: PresentationItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
}) {
  const drag = useDrag(item.id, { x: item.x, y: item.y }, onMove);
  if (item.type === 'image') {
    return (
      <div
        data-item-id={item.id}
        onPointerDown={(e) => { e.stopPropagation(); drag(e); onSelect(item.id); }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute bg-white shadow-md rounded-lg overflow-hidden cursor-move
          ${selected ? 'ring-2 ring-indigo-500' : 'ring-1 ring-slate-200'}`}
        style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      >
        <img src={item.content} alt={item.title ?? ''}
          className="w-full h-full object-contain select-none pointer-events-none bg-white"
          draggable={false}
        />
        {item.title && (
          <div className="absolute top-2 left-2 max-w-[calc(100%-16px)] px-2 py-1 bg-white text-slate-950 text-xs font-medium truncate rounded border border-slate-200 shadow-sm">
            {item.title}
          </div>
        )}
        {selected && <ResizeHandles item={item} onResize={onResize} />}
        {selected && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(item.id)}
            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold shadow"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (item.type === 'arrow') {
    const markerId = `arrowhead-${item.id}`;
    const stroke = item.content || '#111827';
    return (
      <div
        data-item-id={item.id}
        onPointerDown={(e) => { e.stopPropagation(); drag(e); onSelect(item.id); }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute cursor-move ${selected ? 'ring-2 ring-indigo-500' : ''}`}
        style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      >
        <svg className="w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <defs>
            <marker id={markerId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={stroke} />
            </marker>
          </defs>
          <line
            x1="8"
            y1={item.height / 2}
            x2={Math.max(16, item.width - 12)}
            y2={item.height / 2}
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        </svg>
        {selected && <ResizeHandles item={item} onResize={onResize} />}
        {selected && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(item.id)}
            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold shadow"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  if (item.type === 'text') {
    return (
      <div
        data-item-id={item.id}
        onPointerDown={(e) => { e.stopPropagation(); drag(e); onSelect(item.id); }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute bg-transparent cursor-move p-1 flex flex-col
          ${selected ? 'ring-2 ring-indigo-500 rounded-md' : ''}`}
        style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      >
        {selected && (
          <div
            onPointerDown={(e) => { e.stopPropagation(); onSelect(item.id); drag(e); }}
            className="absolute -top-8 left-0 px-2 py-1 rounded-md bg-white border border-slate-200 shadow-sm text-[11px] font-semibold text-slate-600 cursor-move select-none"
            title="Drag to move wording"
          >
            Move
          </div>
        )}
        <textarea
          value={item.content}
          onChange={(e) => onTextChange(item.id, e.target.value)}
          onPointerDown={(e) => { e.stopPropagation(); onSelect(item.id); }}
          onFocus={() => onSelect(item.id)}
          className="flex-1 bg-transparent border-0 outline-none resize-none text-2xl font-semibold leading-tight text-slate-950 placeholder-slate-400 cursor-text"
          placeholder="Add wording..."
        />
        {selected && <ResizeHandles item={item} onResize={onResize} />}
        {selected && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(item.id)}
            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold shadow"
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // Note item — a sticky-note card.
  return (
    <div
      data-item-id={item.id}
      onPointerDown={(e) => { e.stopPropagation(); drag(e); onSelect(item.id); }}
      onClick={(e) => e.stopPropagation()}
      className={`absolute bg-amber-100 border-2 rounded-md shadow-md cursor-move p-3 flex flex-col
        ${selected ? 'border-indigo-500' : 'border-amber-300'}`}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
    >
      {item.title && (
        <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">
          {item.title}
        </div>
      )}
      <textarea
        value={item.content}
        onChange={(e) => onTextChange(item.id, e.target.value)}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(item.id); }}
        onFocus={() => onSelect(item.id)}
        className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-amber-900 placeholder-amber-700/50"
        placeholder="Speaker note…"
      />
      {selected && <ResizeHandles item={item} onResize={onResize} />}
      {selected && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(item.id)}
          className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold shadow"
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PresentationCanvasProps {
  board: Board;
  /** PNG data URL of the current diagram (captured from the editor). */
  currentDiagramImage: string | null;
  /** Optional callback for the user adding the current diagram as a fresh item. */
  onCaptureCurrentDiagram?: () => void;
  /** Called after items change so the host can persist. */
  onItemsChange?: (items: PresentationItem[]) => void;
  /** Back to dashboard. */
  onClose: () => void;
  /** Toast-style notification. */
  notify: (kind: 'success' | 'error', message: string) => void;
}

export function PresentationCanvas({
  board,
  currentDiagramImage,
  onCaptureCurrentDiagram,
  onItemsChange,
  onClose,
  notify,
}: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PresentationItem[]>(board.presentation?.items ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [panning, setPanning] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const selectedItem = useMemo(
    () => items.find(item => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  // Persist on every change so a reload brings the user back to where they
  // were. Last-write-wins via boardManager.
  useEffect(() => {
    boardManager.setPresentation(board.id, items);
    onItemsChange?.(items);
    // We deliberately exclude onItemsChange to avoid feedback loops when the
    // host rerenders parent state on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, board.id]);

  // Persist a sensible default item when the user first opens an empty
  // presentation canvas with a freshly-rendered diagram ready to drop.
  const handleCapture = () => {
    if (!currentDiagramImage) {
      notify('error', 'No diagram rendered yet. Open a diagram, then publish.');
      return;
    }
    const item: PresentationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'image',
      title: board.title,
      content: currentDiagramImage,
      x: Math.round((viewport.x + 80 - viewport.x) / viewport.zoom),
      y: Math.round((80) / viewport.zoom),
      // Stamp the image at a sensible canvas size by default. 1024-wide
      // looks good at 1× zoom.
      width: 480,
      height: 320,
    };
    setItems(prev => [...prev, item]);
    setSelectedId(item.id);
    onCaptureCurrentDiagram?.();
    notify('success', 'Added the current diagram to the deck.');
  };

  const handleAddNote = () => {
    const note: PresentationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'note',
      title: 'Note',
      content: '',
      x: 120,
      y: 120,
      width: 220,
      height: 140,
    };
    setItems(prev => [...prev, note]);
    setSelectedId(note.id);
  };

  const handleAddText = () => {
    const text: PresentationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      title: 'Wording',
      content: 'Add wording',
      x: 120,
      y: 120,
      width: 280,
      height: 90,
    };
    setItems(prev => [...prev, text]);
    setSelectedId(text.id);
  };

  const handleAddArrow = () => {
    const arrow: PresentationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'arrow',
      title: 'Arrow',
      content: '#111827',
      x: 160,
      y: 180,
      width: 220,
      height: 80,
    };
    setItems(prev => [...prev, arrow]);
    setSelectedId(arrow.id);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  };

  const handleMove = (id: string, x: number, y: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, x, y } : i));
  };

  const handleResize = (id: string, w: number, h: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, width: w, height: h } : i));
  };

  const handleTitleChange = (id: string, title: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, title } : i));
  };

  const handleTextChange = (id: string, content: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, content } : i));
  };

  // Pan / zoom the workspace.
  const beginPan = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.itemId) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    setPanning({ x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y });
  };
  useEffect(() => {
    if (!panning) return;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - panning.x) / viewport.zoom;
      const dy = (ev.clientY - panning.y) / viewport.zoom;
      setViewport(v => ({ ...v, x: panning.vx + dx, y: panning.vy + dy }));
    };
    const up = () => setPanning(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [panning, viewport.zoom]);

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setViewport(v => ({
      ...v,
      zoom: clamp(v.zoom * (e.deltaY < 0 ? 1.08 : 0.93), 0.25, 2.5),
    }));
  };

  // Export the composed board as PNG. Render directly to canvas instead of
  // rasterizing the DOM, which is more reliable for editable text and arrows.
  const exportPng = async () => {
    if (items.length === 0) {
      notify('error', 'Add something to the presentation before exporting.');
      return;
    }

    try {
      const dataUrl = await renderPresentationPng(items);
      const a = document.createElement('a');
      a.download = `${slug(board.title)}-deck.png`;
      a.href = dataUrl;
      a.click();
      notify('success', 'Exported the deck as PNG.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'PNG export failed.');
    }
  };

  const sortedItems = useMemo(() => sortPresentationItems(items), [items]);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
        <button
          onClick={onClose}
          className="btn btn-secondary btn-sm"
        >
          <ToolIcon name="back" />
          Back
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Presentation · {board.title}</div>
          <div className="text-[11px] text-slate-500">{items.length} item{items.length === 1 ? '' : 's'} · saved with the board</div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-xs">
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Insert
            </span>
            <ToolButton
              icon="diagram"
              label="Diagram"
              variant="primary"
              onClick={handleCapture}
              disabled={!currentDiagramImage}
              title={currentDiagramImage ? 'Add the current diagram as an image' : 'Open a diagram first, then publish'}
            />
            <ToolButton icon="text" label="Wording" onClick={handleAddText} />
            <ToolButton icon="arrow" label="Arrow" onClick={handleAddArrow} />
            <ToolButton icon="note" label="Note" onClick={handleAddNote} />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-xs">
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Canvas
            </span>
            <ToolButton
              icon="reset"
              label="100%"
              onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
              title="Reset view (100%)"
            />
          </div>

          <ToolButton icon="export" label="Export PNG" variant="success" onClick={exportPng} />
        </div>
      </div>

      {selectedItem && (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm shadow-xs">
          <div className="flex items-center gap-2 min-w-40">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Edit
            </span>
            <span className="px-2 py-1 rounded-md bg-white border border-slate-200 text-xs font-semibold text-indigo-600 shadow-xs">
              {selectedItem.type === 'image' ? 'Diagram' : selectedItem.type === 'text' ? 'Wording' : selectedItem.type === 'arrow' ? 'Arrow' : 'Note'}
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Title
            <input
              value={selectedItem.title ?? ''}
              onChange={e => handleTitleChange(selectedItem.id, e.target.value)}
              className="w-56 px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium normal-case tracking-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={selectedItem.type === 'image' ? 'Diagram title' : `${selectedItem.type} title`}
            />
          </label>
          {selectedItem.type === 'arrow' && (
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Color
              <input
                type="color"
                value={selectedItem.content || '#111827'}
                onChange={e => handleTextChange(selectedItem.id, e.target.value)}
                className="w-10 h-8 p-1 border border-slate-200 rounded-md bg-white shadow-xs"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            W
            <input
              type="number"
              min={80}
              value={Math.round(selectedItem.width)}
              onChange={e => handleResize(selectedItem.id, Math.max(80, Number(e.target.value) || 80), selectedItem.height)}
              className="w-20 px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium normal-case tracking-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            H
            <input
              type="number"
              min={60}
              value={Math.round(selectedItem.height)}
              onChange={e => handleResize(selectedItem.id, selectedItem.width, Math.max(60, Number(e.target.value) || 60))}
              className="w-20 px-2 py-1.5 border border-slate-200 rounded-md bg-white text-sm font-medium normal-case tracking-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <button
            onClick={() => handleDelete(selectedItem.id)}
            className="btn btn-danger btn-sm ml-auto"
          >
            Delete
          </button>
        </div>
      )}

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={beginPan}
        onWheel={onWheel}
        onClick={() => setSelectedId(null)}
        className="flex-1 relative overflow-hidden bg-white"
        style={{
          cursor: panning ? 'grabbing' : 'grab',
        }}
      >
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${viewport.x * viewport.zoom}px, ${viewport.y * viewport.zoom}px) scale(${viewport.zoom})`,
          }}
        >
          {sortedItems.length === 0 && (
            <div className="absolute left-12 top-12 max-w-md bg-white/90 backdrop-blur border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-1">Empty deck</div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Click <strong>+ Add current diagram</strong> to drop a rendered PNG of the
                board's diagram onto the canvas, then drag and resize it.
                <br /><br />
                Add a few <strong>+ Note</strong> cards for speaker notes, then
                <strong> Export PNG</strong> to publish the whole composition.
              </div>
            </div>
          )}
          {sortedItems.map(item => (
            <ItemRenderer
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={setSelectedId}
              onMove={handleMove}
              onResize={handleResize}
              onDelete={handleDelete}
              onTextChange={handleTextChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'deck';
}

async function renderPresentationPng(items: PresentationItem[]): Promise<string> {
  const padding = 56;
  const bounds = getItemsBounds(items, padding);
  const pixelRatio = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bounds.width * pixelRatio);
  canvas.height = Math.ceil(bounds.height * pixelRatio);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create PNG canvas.');

  ctx.scale(pixelRatio, pixelRatio);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, bounds.width, bounds.height);
  ctx.translate(-bounds.x, -bounds.y);

  for (const item of sortPresentationItems(items)) {
    await drawPresentationItem(ctx, item);
  }

  return canvas.toDataURL('image/png');
}

function getItemsBounds(items: PresentationItem[], padding: number) {
  const minX = Math.min(...items.map(item => item.x));
  const minY = Math.min(...items.map(item => item.y));
  const maxX = Math.max(...items.map(item => item.x + item.width));
  const maxY = Math.max(...items.map(item => item.y + item.height));

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
}

async function drawPresentationItem(ctx: CanvasRenderingContext2D, item: PresentationItem): Promise<void> {
  if (item.type === 'image') {
    await drawImageItem(ctx, item);
  } else if (item.type === 'arrow') {
    drawArrowItem(ctx, item);
  } else if (item.type === 'text') {
    drawTextItem(ctx, item);
  } else {
    drawNoteItem(ctx, item);
  }
}

async function drawImageItem(ctx: CanvasRenderingContext2D, item: PresentationItem): Promise<void> {
  ctx.save();
  roundRect(ctx, item.x, item.y, item.width, item.height, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  try {
    const image = await loadImage(item.content);
    const fit = containRect(image.width, image.height, item.width, item.height);
    ctx.drawImage(image, item.x + fit.x, item.y + fit.y, fit.width, fit.height);
  } catch {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(item.x, item.y, item.width, item.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, Arial, sans-serif';
    ctx.fillText('Image could not be exported', item.x + 16, item.y + 28);
  }

  if (item.title) {
    ctx.font = '600 13px Inter, Arial, sans-serif';
    const text = truncateForWidth(ctx, item.title, item.width - 32);
    const labelWidth = Math.min(item.width - 16, ctx.measureText(text).width + 18);
    roundRect(ctx, item.x + 8, item.y + 8, labelWidth, 26, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    ctx.fillStyle = '#020617';
    ctx.fillText(text, item.x + 17, item.y + 26);
  }

  ctx.restore();
}

function drawArrowItem(ctx: CanvasRenderingContext2D, item: PresentationItem): void {
  const stroke = item.content || '#111827';
  const y = item.y + item.height / 2;
  const startX = item.x + 8;
  const endX = item.x + Math.max(18, item.width - 14);

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(endX, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, y);
  ctx.lineTo(endX - 14, y - 8);
  ctx.lineTo(endX - 14, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTextItem(ctx: CanvasRenderingContext2D, item: PresentationItem): void {
  ctx.save();
  ctx.fillStyle = '#020617';
  ctx.font = '700 26px Inter, Arial, sans-serif';
  drawWrappedText(ctx, item.content || 'Add wording', item.x + 4, item.y + 30, item.width - 8, 31, item.height - 8);
  ctx.restore();
}

function drawNoteItem(ctx: CanvasRenderingContext2D, item: PresentationItem): void {
  ctx.save();
  roundRect(ctx, item.x, item.y, item.width, item.height, 6);
  ctx.fillStyle = '#fef3c7';
  ctx.fill();
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 2;
  ctx.stroke();

  let textY = item.y + 18;
  if (item.title) {
    ctx.fillStyle = '#92400e';
    ctx.font = '700 11px Inter, Arial, sans-serif';
    ctx.fillText(item.title.toUpperCase(), item.x + 12, textY);
    textY += 18;
  }

  ctx.fillStyle = '#78350f';
  ctx.font = '14px Inter, Arial, sans-serif';
  drawWrappedText(ctx, item.content || '', item.x + 12, textY, item.width - 24, 18, item.height - (textY - item.y) - 8);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function containRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxHeight: number,
): void {
  const paragraphs = text.split('\n');
  let cursorY = y;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';

    if (words.length === 0) {
      cursorY += lineHeight;
      continue;
    }

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (cursorY - y + lineHeight > maxHeight) return;
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }

    if (line) {
      if (cursorY - y + lineHeight > maxHeight) return;
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
  }
}

function truncateForWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
