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

// Translate pointer events on a handle into a new size for the item. The
// handle element exposes `data-handle` (nw, ne, sw, se, n, s, e, w).
function useResize(itemId: string, onResize: (id: string, w: number, h: number) => void) {
  return (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const handle = (e.currentTarget as HTMLElement).dataset.handle ?? 'se';
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialSize: Size = JSON.parse(target.dataset.size || '{"w":0,"h":0}');
    target.setPointerCapture(e.pointerId);

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
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
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
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onMove(itemId, initial.x + dx, initial.y + dy);
    };
    const up = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

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
        onPointerDown={(e) => { drag(e); onSelect(item.id); }}
        className={`absolute bg-white shadow-md rounded-lg overflow-hidden cursor-move
          ${selected ? 'ring-2 ring-indigo-500' : 'ring-1 ring-slate-200'}`}
        style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
      >
        <img src={item.content} alt={item.title ?? ''}
          className="w-full h-full object-contain select-none pointer-events-none bg-slate-50"
          draggable={false}
        />
        {item.title && (
          <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-gradient-to-b from-black/60 to-transparent text-white text-xs truncate">
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

  // Note item — a sticky-note card.
  return (
    <div
      data-item-id={item.id}
      onPointerDown={(e) => { drag(e); onSelect(item.id); }}
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
        onPointerDown={(e) => e.stopPropagation()}
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

  // Export the whole stage (background included) as PNG.
  const exportPng = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    const { default: htmlToImage } = await import('html-to-image');
    try {
      const dataUrl = await htmlToImage.toPng(stage, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.download = `${slug(board.title)}-deck.png`;
      a.href = dataUrl;
      a.click();
      notify('success', 'Exported the deck as PNG.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'PNG export failed.');
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.type === b.type ? 0 : a.type === 'image' ? -1 : 1)),
    [items],
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-100">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
        >
          ← Back
        </button>
        <div className="ml-1">
          <div className="text-sm font-semibold text-slate-900">Presentation · {board.title}</div>
          <div className="text-[11px] text-slate-500">{items.length} item{items.length === 1 ? '' : 's'} · saved with the board</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCapture}
            disabled={!currentDiagramImage}
            title={currentDiagramImage ? 'Add the current diagram as an image' : 'Open a diagram first, then publish'}
            className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            + Add current diagram
          </button>
          <button
            onClick={handleAddNote}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
          >
            + Note
          </button>
          <button
            onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
            title="Reset view (100%)"
          >
            100%
          </button>
          <button
            onClick={exportPng}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onPointerDown={beginPan}
        onWheel={onWheel}
        onClick={() => setSelectedId(null)}
        className="flex-1 relative overflow-hidden bg-slate-100"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)',
          backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x * viewport.zoom}px ${viewport.y * viewport.zoom}px`,
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
