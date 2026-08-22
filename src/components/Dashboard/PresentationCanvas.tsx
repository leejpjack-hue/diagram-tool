import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boardManager, type Board, type PresentationItem, type PresentationItemStyle } from '../../utils/boardManager';
import {
  connectorPath,
  dashArray,
  exportFilename,
  itemZ,
  parseConnector,
  parsePoints,
  renderPresentationPdf,
  renderPresentationPng,
  sortedItems,
  styleFor,
  triggerDownload,
} from '../../utils/presentationExport';
import {
  childLockedByFrame,
  fitViewportToFrame,
  frameFromSelection,
  isFrame,
  moveFrameAndChildren,
  visibleFrames,
  type PresentationExportScope,
} from '../../utils/presentationFrames';
import {
  attachToItem,
  createConnectorItem,
  isAttachable,
  parseConnectorLabel,
  pointOnItem,
  reflowConnectors,
  setConnectorLabel,
  snapAttachment,
  updateConnectorEnd,
  type ConnectorDraft,
  type Point,
} from '../../utils/presentationConnectors';

type CanvasTool = 'select' | 'hand' | 'text' | 'note' | 'shape' | 'line' | 'pen' | 'highlighter' | 'eraser' | 'frame';
type ShapeKind = NonNullable<PresentationItemStyle['shape']>;
type ConnectorType = NonNullable<PresentationItemStyle['connectorType']>;

const SHAPES: Array<{ kind: ShapeKind; label: string }> = [
  { kind: 'rectangle', label: 'Rectangle' }, { kind: 'rounded', label: 'Rounded rectangle' },
  { kind: 'circle', label: 'Circle' }, { kind: 'diamond', label: 'Diamond' }, { kind: 'triangle', label: 'Triangle' },
];
const uid = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const cloneItems = (items: PresentationItem[]) => items.map(item => ({ ...item, style: item.style ? { ...item.style } : undefined }));

function drawingItem(id: string, points: Point[], highlighter: boolean): PresentationItem {
  const minX = Math.min(...points.map(point => point.x)); const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x)); const maxY = Math.max(...points.map(point => point.y));
  return {
    id, type: 'drawing', title: highlighter ? 'Highlighter' : 'Drawing',
    content: JSON.stringify(points.map(point => ({ x: point.x - minX + 8, y: point.y - minY + 8 }))),
    x: minX - 8, y: minY - 8, width: Math.max(16, maxX - minX + 16), height: Math.max(16, maxY - minY + 16),
    style: { strokeColor: highlighter ? '#fde047' : '#111827', strokeWidth: highlighter ? 16 : 3, opacity: highlighter ? 0.45 : 1 },
  };
}

function useResize(item: PresentationItem, onStart: () => void, onResize: (id: string, x: number, y: number, width: number, height: number) => void, onEnd: () => void) {
  return (event: React.PointerEvent) => {
    event.stopPropagation(); event.preventDefault();
    const handle = (event.currentTarget as HTMLElement).dataset.handle ?? 'se';
    const start = { x: event.clientX, y: event.clientY }; const initial = { x: item.x, y: item.y, width: item.width, height: item.height };
    onStart();
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x; const dy = next.clientY - start.y; let { x, y, width, height } = initial;
      if (handle.includes('e')) width = Math.max(24, initial.width + dx);
      if (handle.includes('w')) { width = Math.max(24, initial.width - dx); x = initial.x + initial.width - width; }
      if (handle.includes('s')) height = Math.max(24, initial.height + dy);
      if (handle.includes('n')) { height = Math.max(24, initial.height - dy); y = initial.y + initial.height - height; }
      onResize(item.id, x, y, width, height);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onEnd(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
}

function useDrag(item: PresentationItem, onStart: () => void, onMove: (id: string, x: number, y: number) => void, onEnd: () => void) {
  return (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).dataset.handle || item.locked) return;
    event.stopPropagation(); event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, itemX: item.x, itemY: item.y }; onStart();
    const move = (next: PointerEvent) => onMove(item.id, start.itemX + next.clientX - start.x, start.itemY + next.clientY - start.y);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onEnd(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
function ResizeHandles({ item, onStart, onResize, onEnd }: { item: PresentationItem; onStart: () => void; onResize: (id: string, x: number, y: number, width: number, height: number) => void; onEnd: () => void }) {
  const resize = useResize(item, onStart, onResize, onEnd);
  return <>{HANDLES.map(handle => <span key={handle} data-handle={handle} onPointerDown={resize} className={`absolute z-30 h-3 w-3 rounded-sm border-2 border-indigo-600 bg-white
    ${handle === 'nw' ? '-left-1.5 -top-1.5 cursor-nw-resize' : ''} ${handle === 'n' ? 'left-1/2 -top-1.5 -translate-x-1/2 cursor-n-resize' : ''}
    ${handle === 'ne' ? '-right-1.5 -top-1.5 cursor-ne-resize' : ''} ${handle === 'e' ? '-right-1.5 top-1/2 -translate-y-1/2 cursor-e-resize' : ''}
    ${handle === 'se' ? '-bottom-1.5 -right-1.5 cursor-se-resize' : ''} ${handle === 's' ? '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize' : ''}
    ${handle === 'sw' ? '-bottom-1.5 -left-1.5 cursor-sw-resize' : ''} ${handle === 'w' ? '-left-1.5 top-1/2 -translate-y-1/2 cursor-w-resize' : ''}`}/>)}</>;
}

function ShapeSvg({ item }: { item: PresentationItem }) {
  const style = styleFor(item); const w = item.width; const h = item.height;
  const common = { fill: style.fillColor, stroke: style.strokeColor, strokeWidth: style.strokeWidth, strokeDasharray: dashArray(style.lineStyle, style.strokeWidth) };
  if (style.shape === 'circle') return <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, w / 2 - 3)} ry={Math.max(1, h / 2 - 3)} {...common}/>;
  if (style.shape === 'diamond') return <polygon points={`${w / 2},3 ${w - 3},${h / 2} ${w / 2},${h - 3} 3,${h / 2}`} {...common}/>;
  if (style.shape === 'triangle') return <polygon points={`${w / 2},3 ${w - 3},${h - 3} 3,${h - 3}`} {...common}/>;
  return <rect x="3" y="3" width={Math.max(1, w - 6)} height={Math.max(1, h - 6)} rx={style.shape === 'rounded' ? 16 : 2} {...common}/>;
}

function ItemRenderer({ item, selected, connectorMode, childLocked, onSelect, onConnectorPoint, onMove, onResize, onText, onStart, onEnd, onEndpointDrag }: {
  item: PresentationItem; selected: boolean; childLocked: boolean; onSelect: (id: string, additive?: boolean) => void; onMove: (id: string, x: number, y: number) => void;
  connectorMode: boolean; onConnectorPoint: (item: PresentationItem, event: React.PointerEvent) => void;
  onResize: (id: string, x: number, y: number, width: number, height: number) => void; onText: (id: string, content: string) => void; onStart: () => void; onEnd: () => void;
  onEndpointDrag: (id: string, which: 'start' | 'end', event: React.PointerEvent) => void;
}) {
  const frozen = { ...item, locked: item.locked || childLocked };
  const drag = useDrag(frozen, onStart, onMove, onEnd); const style = styleFor(item);
  const weight = style.fontWeight === 'bold' ? 700 : style.fontWeight === 'semibold' ? 600 : 400;
  const wrapper = `absolute ${frozen.locked ? 'cursor-default' : 'cursor-move'} ${selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`;
  const selectAndDrag = (event: React.PointerEvent) => { if (connectorMode) { event.stopPropagation(); event.preventDefault(); onConnectorPoint(item, event); return; } onSelect(item.id, event.shiftKey); if (!childLocked) drag(event); };
  const selectEditable = (event: React.PointerEvent) => { event.stopPropagation(); if (connectorMode) { event.preventDefault(); onConnectorPoint(item, event); } else onSelect(item.id, event.shiftKey); };
  const handles = selected && !frozen.locked ? <ResizeHandles item={item} onStart={onStart} onResize={onResize} onEnd={onEnd}/> : null;
  const commonStyle = { left: item.x, top: item.y, width: item.width, height: item.height, zIndex: itemZ(item), opacity: item.hidden ? 0.35 : style.opacity };

  if (item.type === 'image') return <div data-item-id={item.id} onPointerDown={selectAndDrag} className={`${wrapper} overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm`} style={commonStyle}>
    <img src={item.content} alt={item.title ?? ''} draggable={false} className="pointer-events-none h-full w-full select-none object-contain"/>
    {item.title && <span className="absolute left-2 top-2 max-w-[calc(100%-16px)] truncate rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold shadow-sm">{item.title}</span>}{handles}
  </div>;
  if (item.type === 'drawing') return <div data-item-id={item.id} onPointerDown={selectAndDrag} className={wrapper} style={commonStyle}>
    <svg className="pointer-events-none h-full w-full overflow-visible"><polyline points={parsePoints(item).map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={style.strokeColor} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round"/></svg>{handles}
  </div>;
  if (item.type === 'arrow') {
    const endId = `end-${item.id}`; const startId = `start-${item.id}`;
    const geometry = parseConnector(item);
    const label = parseConnectorLabel(item);
    const mid = { x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 };
    const grabEnd = (which: 'start' | 'end') => (event: React.PointerEvent) => {
      event.stopPropagation(); event.preventDefault();
      onEndpointDrag(item.id, which, event);
    };
    return <div data-item-id={item.id} data-testid="deck-connector" data-start-id={item.startId ?? ''} data-end-id={item.endId ?? ''} data-start-side={item.startSide ?? ''} data-end-side={item.endSide ?? ''} onPointerDown={selectAndDrag} className={wrapper} style={commonStyle}><svg className="pointer-events-none h-full w-full overflow-visible" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none"><defs>
      <marker id={endId} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={style.strokeColor}/></marker>
      <marker id={startId} markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto"><path d="M9,0 L9,6 L0,3 z" fill={style.strokeColor}/></marker></defs>
      <path d={connectorPath(geometry, style.connectorType)} fill="none" stroke={style.strokeColor} strokeWidth={style.strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashArray(style.lineStyle, style.strokeWidth)} markerStart={style.arrowStart ? `url(#${startId})` : undefined} markerEnd={style.arrowEnd ? `url(#${endId})` : undefined}/>
      {label && <text x={mid.x} y={mid.y - 8} textAnchor="middle" fill={style.strokeColor} fontSize="12" fontWeight="600">{label}</text>}
      <circle data-endpoint="start" cx={geometry.start.x} cy={geometry.start.y} r={selected ? 6 : 4} fill={selected ? 'white' : 'transparent'} stroke={selected ? '#4f46e5' : 'transparent'} strokeWidth="2" className="pointer-events-auto cursor-grab" onPointerDown={grabEnd('start')}/>
      <circle data-endpoint="end" cx={geometry.end.x} cy={geometry.end.y} r={selected ? 6 : 4} fill={selected ? 'white' : 'transparent'} stroke={selected ? '#4f46e5' : 'transparent'} strokeWidth="2" className="pointer-events-auto cursor-grab" onPointerDown={grabEnd('end')}/>
    </svg>{handles}</div>;
  }
  if (item.type === 'frame') return <div data-item-id={item.id} data-frame-title={item.title || 'Frame'} onPointerDown={selectAndDrag} className={`${wrapper} border-2 bg-white/40`} style={{ ...commonStyle, borderColor: style.strokeColor }}><span className="absolute -top-7 left-0 max-w-full truncate text-sm font-semibold text-slate-700">{item.title || 'Frame'}{item.hidden ? ' · hidden' : ''}{item.lockChildren ? ' · locked children' : ''}</span>{handles}</div>;
  if (item.type === 'shape') return <div data-item-id={item.id} onPointerDown={selectAndDrag} className={wrapper} style={commonStyle}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none"><ShapeSvg item={item}/></svg>
    <textarea value={item.content} onChange={event => onText(item.id, event.target.value)} onFocus={onStart} onBlur={onEnd} onPointerDown={selectEditable} className="absolute inset-[12%] resize-none border-0 bg-transparent p-1 outline-none" style={{ color: style.textColor, fontSize: style.fontSize, fontWeight: weight, textAlign: style.textAlign }} aria-label="Shape text"/>{handles}
  </div>;
  if (item.type === 'text') return <div data-item-id={item.id} onPointerDown={selectAndDrag} className={`${wrapper} flex flex-col`} style={commonStyle}>
    {selected && !item.locked && <button type="button" onPointerDown={selectAndDrag} className="absolute -top-8 left-0 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">Move</button>}
    <textarea value={item.content} onChange={event => onText(item.id, event.target.value)} onFocus={onStart} onBlur={onEnd} onPointerDown={selectEditable} readOnly={item.locked} className="h-full w-full resize-none border-0 bg-transparent p-1 outline-none" style={{ color: style.textColor, fontSize: style.fontSize, fontWeight: weight, textAlign: style.textAlign }} aria-label="Text content"/>{handles}
  </div>;
  return <div data-item-id={item.id} onPointerDown={selectAndDrag} className={`${wrapper} flex flex-col rounded-md border shadow-sm`} style={{ ...commonStyle, backgroundColor: style.fillColor, borderColor: style.strokeColor, borderWidth: style.strokeWidth }}>
    <textarea value={item.content} onChange={event => onText(item.id, event.target.value)} onFocus={onStart} onBlur={onEnd} onPointerDown={selectEditable} readOnly={item.locked} placeholder="Type a note..." className="h-full w-full resize-none border-0 bg-transparent p-4 outline-none" style={{ color: style.textColor, fontSize: style.fontSize, fontWeight: weight, textAlign: style.textAlign }} aria-label="Note content"/>{handles}
  </div>;
}

function Glyph({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    back: <path d="M15 18l-6-6 6-6"/>, undo: <path d="M9 7l-5 5 5 5M5 12h8a6 6 0 016 6"/>, redo: <path d="M15 7l5 5-5 5M19 12h-8a6 6 0 00-6 6"/>, select: <path d="M5 3l14 9-7 2-3 7z"/>,
    hand: <path d="M8 11V6a2 2 0 014 0v4-2a2 2 0 014 0v3-1a2 2 0 014 0v5c0 4-3 6-7 6h-1c-3 0-5-2-7-5l-2-3a2 2 0 013-2l2 2V8a2 2 0 014 0v3"/>,
    diagram: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 14h7"/></>, upload: <><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 14v6h16v-6"/></>, text: <path d="M5 5h14M12 5v14M8 19h8"/>,
    note: <><path d="M5 3h11l3 3v15H5z"/><path d="M16 3v4h4"/></>, shape: <rect x="4" y="4" width="16" height="16" rx="2"/>, line: <><path d="M4 17L20 7"/><path d="M14 6h6v6"/></>, pen: <><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 8l3 3"/></>,
    highlight: <><path d="M5 16l9-11 5 4-9 11H5z"/><path d="M4 21h16"/></>, eraser: <><path d="M4 15l8-10 8 7-7 9H8z"/><path d="M10 21h10"/></>, frame: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></>,
    export: <><path d="M12 4v11M8 11l4 4 4-4"/><path d="M4 20h16"/></>, duplicate: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></>, lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></>,
    present: <><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></>, follow: <path d="M4 12h16M14 6l6 6-6 6"/>,
    trash: <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14"/></>, front: <><rect x="8" y="4" width="12" height="12"/><rect x="4" y="8" width="12" height="12"/></>, zoomIn: <><circle cx="10" cy="10" r="6"/><path d="M14 14l6 6M10 7v6M7 10h6"/></>, zoomOut: <><circle cx="10" cy="10" r="6"/><path d="M14 14l6 6M7 10h6"/></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.shape}</svg>;
}

function RailButton({ tool, activeTool, label, icon, onClick }: { tool?: CanvasTool; activeTool: CanvasTool; label: string; icon: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition ${tool === activeTool ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><Glyph name={icon}/></button>;
}

export interface PresentationCanvasProps { board: Board; currentDiagramImage: string | null; onCaptureCurrentDiagram?: () => void; onItemsChange?: (items: PresentationItem[]) => void; onClose: () => void; notify: (kind: 'success' | 'error', message: string) => void }

export function PresentationCanvas({ board, currentDiagramImage, onCaptureCurrentDiagram, onItemsChange, onClose, notify }: PresentationCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null); const uploadRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PresentationItem[]>(() => reflowConnectors(board.presentation?.items ?? [])); const itemsRef = useRef(items);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [connectorStart, setConnectorStart] = useState<ConnectorDraft | null>(null); const [connectorPreview, setConnectorPreview] = useState<Point | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle'); const [shapeMenu, setShapeMenu] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [presenting, setPresenting] = useState(false); const [presentIndex, setPresentIndex] = useState(0);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 }); const undoStack = useRef<PresentationItem[][]>([]); const redoStack = useRef<PresentationItem[][]>([]); const interactionStart = useRef<PresentationItem[] | null>(null);
  const selectedItem = useMemo(() => items.find(item => item.id === selectedId) ?? null, [items, selectedId]);
  const frames = useMemo(() => items.filter(isFrame), [items]);
  const walkable = useMemo(() => visibleFrames(items), [items]);
  const presentFrame = walkable[presentIndex] ?? null;
  const activateTool = useCallback((next: CanvasTool) => { if (next !== 'line') { setConnectorStart(null); setConnectorPreview(null); } setTool(next); }, []);
  const selectItem = useCallback((id: string | null, additive = false) => {
    if (!id) { setSelectedId(null); setSelectedIds([]); return; }
    setSelectedId(id);
    setSelectedIds(current => additive ? (current.includes(id) ? current : [...current, id]) : [id]);
  }, []);

  const applyItems = useCallback((next: PresentationItem[]) => { const reflowed = reflowConnectors(next); itemsRef.current = reflowed; setItems(reflowed); }, []);
  const commit = useCallback((change: (current: PresentationItem[]) => PresentationItem[]) => {
    const before = cloneItems(itemsRef.current); const next = change(itemsRef.current); if (JSON.stringify(before) === JSON.stringify(next)) return;
    undoStack.current.push(before); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; applyItems(next);
  }, [applyItems]);
  const beginInteraction = useCallback(() => { if (!interactionStart.current) interactionStart.current = cloneItems(itemsRef.current); }, []);
  const endInteraction = useCallback(() => { const before = interactionStart.current; interactionStart.current = null; if (!before || JSON.stringify(before) === JSON.stringify(itemsRef.current)) return; undoStack.current.push(before); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; }, []);
  const undo = useCallback(() => { const previous = undoStack.current.pop(); if (!previous) return; redoStack.current.push(cloneItems(itemsRef.current)); applyItems(previous); selectItem(null); }, [applyItems, selectItem]);
  const redo = useCallback(() => { const next = redoStack.current.pop(); if (!next) return; undoStack.current.push(cloneItems(itemsRef.current)); applyItems(next); selectItem(null); }, [applyItems, selectItem]);

  useEffect(() => { void boardManager.setPresentation(board.id, items); onItemsChange?.(items); }, [items, board.id, onItemsChange]);
  const updateLive = useCallback((id: string, patch: Partial<PresentationItem>) => applyItems(itemsRef.current.map(item => item.id === id ? { ...item, ...patch } : item)), [applyItems]);
  const updateStyle = (id: string, patch: Partial<PresentationItemStyle>) => commit(current => current.map(item => item.id === id ? { ...item, style: { ...item.style, ...patch } } : item));
  const worldPoint = useCallback((clientX: number, clientY: number): Point => { const rect = stageRef.current?.getBoundingClientRect(); return { x: ((clientX - (rect?.left ?? 0)) / viewport.zoom) - viewport.x, y: ((clientY - (rect?.top ?? 0)) / viewport.zoom) - viewport.y }; }, [viewport]);
  const nextZ = () => Math.max(10, ...itemsRef.current.map(itemZ)) + 1;
  const addItem = (item: PresentationItem) => { commit(current => [...current, item]); selectItem(item.id); };
  const followFrame = useCallback((frame: PresentationItem) => {
    const rect = stageRef.current?.getBoundingClientRect();
    setViewport(fitViewportToFrame(frame, { width: rect?.width ?? 960, height: rect?.height ?? 640 }));
    selectItem(frame.id);
  }, [selectItem]);
  const stepPresent = useCallback((delta: number) => {
    const list = visibleFrames(itemsRef.current);
    if (!list.length) return;
    setPresentIndex(current => {
      const next = clamp(current + delta, 0, list.length - 1);
      const frame = list[next];
      if (frame) followFrame(frame);
      return next;
    });
  }, [followFrame]);
  const startPresent = useCallback((frameId?: string) => {
    const list = visibleFrames(itemsRef.current);
    if (!list.length) { notify('error', 'Add a visible frame before presenting.'); return; }
    const index = Math.max(0, list.findIndex(frame => frame.id === frameId));
    setPresenting(true);
    setPresentIndex(index);
    followFrame(list[index]);
    activateTool('select');
  }, [activateTool, followFrame, notify]);
  const wrapSelection = () => {
    const result = frameFromSelection(itemsRef.current, selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []), uid);
    if (!result) { notify('error', 'Select objects first, then create a frame around them.'); return; }
    commit(() => result.next);
    selectItem(result.frame.id);
    notify('success', 'Frame created around the selection. Children stay as objects.');
  };
  const exportDeck = async (format: 'png' | 'pdf', scope: PresentationExportScope) => {
    setExportOpen(false);
    const frameId = presentFrame?.id ?? (selectedItem?.type === 'frame' ? selectedItem.id : walkable[0]?.id);
    if (scope === 'frame' && !frameId) { notify('error', 'Select or present a frame to export just that frame.'); return; }
    if (!itemsRef.current.length) { notify('error', 'Add something before exporting.'); return; }
    try {
      const title = itemsRef.current.find(item => item.id === frameId)?.title;
      const filename = exportFilename(board.title, format, scope, title);
      if (format === 'png') {
        triggerDownload(await renderPresentationPng(itemsRef.current, scope, frameId), filename);
      } else {
        const blob = await renderPresentationPdf(itemsRef.current, scope, frameId);
        triggerDownload(URL.createObjectURL(blob), filename);
      }
      notify('success', format === 'png' ? 'Presentation exported as PNG.' : 'Presentation exported as PDF.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Export failed.');
    }
  };
  const addDiagram = () => { if (!currentDiagramImage) { notify('error', 'Open a diagram first so it can be captured.'); return; } addItem({ id: uid(), type: 'image', title: board.title, content: currentDiagramImage, x: 100, y: 90, width: 520, height: 330, zIndex: nextZ() }); onCaptureCurrentDiagram?.(); notify('success', 'Diagram added to the canvas.'); };
  const addAt = (kind: 'text' | 'note', point: Point) => { addItem(kind === 'text'
    ? { id: uid(), type: 'text', title: 'Text', content: 'Add text', x: point.x, y: point.y, width: 280, height: 80, zIndex: nextZ(), style: { fontSize: 28, fontWeight: 'bold', textAlign: 'left', textColor: '#0f172a' } }
    : { id: uid(), type: 'note', title: 'Sticky note', content: '', x: point.x, y: point.y, width: 220, height: 180, zIndex: nextZ(), style: { fillColor: '#fef3c7', strokeColor: '#fcd34d', textColor: '#78350f', fontSize: 16, textAlign: 'left' } }); activateTool('select'); };
  const eraseAt = useCallback((point: Point) => { const hit = [...itemsRef.current].reverse().find(item => !item.locked && (item.type !== 'drawing' ? point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height : parsePoints(item).some(local => Math.hypot(item.x + local.x - point.x, item.y + local.y - point.y) < Math.max(10, styleFor(item).strokeWidth)))); if (hit) commit(current => current.filter(item => item.id !== hit.id)); }, [commit]);

  const startBox = (event: React.PointerEvent, point: Point, type: 'shape' | 'frame') => {
    event.preventDefault(); const id = uid();
    const initial: PresentationItem = { id, type, title: type === 'frame' ? 'Frame' : SHAPES.find(shape => shape.kind === shapeKind)?.label, content: '', x: point.x, y: point.y, width: 140, height: 100,
      zIndex: type === 'frame' ? -100 + itemsRef.current.filter(item => item.type === 'frame').length : nextZ(), style: type === 'shape' ? { shape: shapeKind, fillColor: '#ffffff', strokeColor: '#334155', strokeWidth: 2, textColor: '#0f172a', fontSize: 16 } : { fillColor: '#ffffff', strokeColor: '#94a3b8', strokeWidth: 2 } };
    beginInteraction(); applyItems([...itemsRef.current, initial]); selectItem(id);
    const move = (next: PointerEvent) => { const current = worldPoint(next.clientX, next.clientY); updateLive(id, { x: Math.min(point.x, current.x), y: Math.min(point.y, current.y), width: Math.max(24, Math.abs(current.x - point.x)), height: Math.max(40, Math.abs(current.y - point.y)) }); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endInteraction(); activateTool('select'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const startDrawing = (point: Point, highlighter: boolean) => { const id = uid(); const points = [point]; beginInteraction(); applyItems([...itemsRef.current, drawingItem(id, points, highlighter)]); const move = (next: PointerEvent) => { points.push(worldPoint(next.clientX, next.clientY)); updateLive(id, drawingItem(id, points, highlighter)); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endInteraction(); selectItem(id); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
  const startPan = (event: React.PointerEvent) => { const start = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y }; const move = (next: PointerEvent) => setViewport(value => ({ ...value, x: start.vx + (next.clientX - start.x) / value.zoom, y: start.vy + (next.clientY - start.y) / value.zoom })); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
  const draftFromPoint = (point: Point, prefer?: PresentationItem): ConnectorDraft => {
    if (prefer && isAttachable(prefer)) {
      const snap = attachToItem(prefer, point);
      return { point: snap.point, snap };
    }
    const snap = snapAttachment(point, itemsRef.current);
    return { point: snap?.point ?? point, snap };
  };
  const addConnectorPoint = (point: Point, prefer?: PresentationItem) => {
    const draft = draftFromPoint(point, prefer);
    if (!connectorStart) { setConnectorStart(draft); setConnectorPreview(draft.point); selectItem(null); return; }
    if (Math.hypot(draft.point.x - connectorStart.point.x, draft.point.y - connectorStart.point.y) < 8) return;
    addItem(createConnectorItem(connectorStart, draft, uid(), nextZ())); activateTool('select');
  };
  const onItemConnectorPoint = (item: PresentationItem, event: React.PointerEvent) => {
    addConnectorPoint(pointOnItem(item, event.clientX, event.clientY, event.currentTarget), item);
  };
  const onEndpointDrag = (id: string, which: 'start' | 'end', event: React.PointerEvent) => {
    beginInteraction();
    const move = (next: PointerEvent) => applyItems(updateConnectorEnd(itemsRef.current, id, which, worldPoint(next.clientX, next.clientY)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endInteraction(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    move(event.nativeEvent);
  };
  const onStagePointerDown = (event: React.PointerEvent) => { if (presenting) return; const controls = stageRef.current?.querySelectorAll<HTMLElement>('[data-canvas-ui]') ?? []; const overControls = [...controls].some(control => { const rect = control.getBoundingClientRect(); return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom; }); if (overControls || event.target !== event.currentTarget) return; const point = worldPoint(event.clientX, event.clientY); if (tool === 'hand' || event.button === 1) startPan(event); else if (tool === 'text' || tool === 'note') addAt(tool, point); else if (tool === 'line') addConnectorPoint(point); else if (tool === 'shape' || tool === 'frame') startBox(event, point, tool); else if (tool === 'pen' || tool === 'highlighter') startDrawing(point, tool === 'highlighter'); else if (tool === 'eraser') eraseAt(point); else selectItem(null); };

  const deleteSelected = useCallback(() => { const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : []; if (!ids.length) return; commit(current => current.filter(item => !ids.includes(item.id))); selectItem(null); }, [commit, selectItem, selectedId, selectedIds]);
  const duplicateSelected = useCallback(() => { if (!selectedItem) return; const copy = { ...selectedItem, id: uid(), x: selectedItem.x + 24, y: selectedItem.y + 24, title: selectedItem.title ? `${selectedItem.title} copy` : undefined, locked: false, zIndex: Math.max(10, ...itemsRef.current.map(itemZ)) + 1, style: selectedItem.style ? { ...selectedItem.style } : undefined }; commit(current => [...current, copy]); selectItem(copy.id); }, [commit, selectItem, selectedItem]);
  const moveLayer = (direction: 'front' | 'back') => { if (!selectedItem) return; const values = itemsRef.current.map(itemZ); const zIndex = direction === 'front' ? Math.max(...values, 0) + 1 : Math.min(...values, 0) - 1; commit(current => current.map(item => item.id === selectedItem.id ? { ...item, zIndex } : item)); };

  useEffect(() => { const onKey = (event: KeyboardEvent) => { const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName); if (event.key === 'Escape') { if (presenting) { setPresenting(false); return; } activateTool('select'); setShapeMenu(false); setExportOpen(false); return; } if (presenting && !editing && (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ')) { event.preventDefault(); stepPresent(1); return; } if (presenting && !editing && (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp')) { event.preventDefault(); stepPresent(-1); return; } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && !editing) { event.preventDefault(); duplicateSelected(); return; } if (editing) return; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); return; } const keyTools: Record<string, CanvasTool> = { v: 'select', h: 'hand', t: 'text', n: 'note', r: 'shape', l: 'line', p: event.shiftKey ? 'highlighter' : 'pen', e: 'eraser', f: 'frame' }; const next = keyTools[event.key.toLowerCase()]; if (next) { event.preventDefault(); activateTool(next); } if (event.key === '+' || event.key === '=') setViewport(value => ({ ...value, zoom: clamp(value.zoom * 1.15, 0.2, 3) })); if (event.key === '-') setViewport(value => ({ ...value, zoom: clamp(value.zoom / 1.15, 0.2, 3) })); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [activateTool, deleteSelected, duplicateSelected, presenting, redo, stepPresent, undo]);
  const uploadImage = (file?: File) => { if (!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => addItem({ id: uid(), type: 'image', title: file.name.replace(/\.[^.]+$/, ''), content: String(reader.result), x: 120, y: 100, width: 420, height: 280, zIndex: nextZ() }); reader.onerror = () => notify('error', 'Image upload failed.'); reader.readAsDataURL(file); };

  return <div className="flex min-h-0 flex-1 flex-col bg-white text-slate-900">
    <header className="z-50 flex min-h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm"><button type="button" onClick={onClose} className="flex h-9 items-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Glyph name="back"/><span className="hidden sm:inline">Back</span></button><div className="min-w-0 border-l border-slate-200 pl-3"><div className="truncate text-sm font-semibold">{board.title}</div><div className="text-[11px] text-slate-500">Presentation canvas · {items.length} object{items.length === 1 ? '' : 's'}</div></div><div className="ml-auto flex items-center gap-1">
      <button type="button" onClick={undo} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" title="Undo (Ctrl/⌘ Z)"><Glyph name="undo"/></button><button type="button" onClick={redo} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" title="Redo"><Glyph name="redo"/></button><span className="mx-1 h-6 w-px bg-slate-200"/>
      <button type="button" onClick={addDiagram} disabled={!currentDiagramImage} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" title="Add current diagram"><Glyph name="diagram"/><span className="hidden lg:inline">Diagram</span></button><button type="button" onClick={() => uploadRef.current?.click()} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Glyph name="upload"/><span className="hidden lg:inline">Image</span></button><input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={event => { uploadImage(event.target.files?.[0]); event.target.value = ''; }}/>
      <button type="button" onClick={() => presenting ? setPresenting(false) : startPresent(selectedItem?.type === 'frame' ? selectedItem.id : undefined)} className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold ${presenting ? 'bg-indigo-50 text-indigo-700' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`} aria-pressed={presenting} aria-label={presenting ? 'Exit present' : 'Present deck'}><Glyph name="present"/><span className="hidden sm:inline">{presenting ? 'Exit' : 'Present'}</span></button>
      <div className="relative"><button type="button" onClick={() => setExportOpen(open => !open)} className="flex h-9 items-center gap-2 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700" aria-expanded={exportOpen} aria-haspopup="menu"><Glyph name="export"/><span className="hidden sm:inline">Export</span></button>
        {exportOpen && <div role="menu" className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-xl">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PNG</div>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('png', 'frame')}>This frame (PNG)</button>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('png', 'frames')}>All frames (PNG)</button>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('png', 'deck')}>Whole deck (PNG)</button>
          <div className="mt-1 border-t border-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PDF</div>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('pdf', 'frame')}>This frame (PDF)</button>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('pdf', 'frames')}>All frames (PDF)</button>
          <button type="button" role="menuitem" className="flex w-full rounded px-2 py-1.5 text-left hover:bg-slate-100" onClick={() => void exportDeck('pdf', 'deck')}>Whole deck (PDF)</button>
        </div>}
      </div>
    </div></header>

    {selectedItem && <div className="z-40 flex min-h-12 items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 py-1.5"><span className="whitespace-nowrap rounded bg-indigo-50 px-2 py-1 text-xs font-bold capitalize text-indigo-700">{selectedItem.type}</span>
      {selectedItem.type === 'frame' && <label className="flex items-center gap-1 text-xs text-slate-500">Title <input aria-label="Frame title" value={selectedItem.title ?? ''} onChange={event => commit(current => current.map(item => item.id === selectedItem.id ? { ...item, title: event.target.value } : item))} className="h-8 w-40 rounded border border-slate-200 px-2 text-xs text-slate-800"/></label>}
      {selectedItem.type !== 'image' && selectedItem.type !== 'drawing' && selectedItem.type !== 'arrow' && <label className="flex items-center gap-1 text-xs text-slate-500">{selectedItem.type === 'frame' ? 'Color' : 'Fill'} <input type="color" value={selectedItem.type === 'frame' ? styleFor(selectedItem).strokeColor : styleFor(selectedItem).fillColor} onChange={event => updateStyle(selectedItem.id, selectedItem.type === 'frame' ? { strokeColor: event.target.value } : { fillColor: event.target.value })} className="h-8 w-9 rounded border border-slate-200 bg-white p-1"/></label>}
      {selectedItem.type !== 'image' && selectedItem.type !== 'text' && selectedItem.type !== 'frame' && <label className="flex items-center gap-1 text-xs text-slate-500">Stroke <input type="color" value={styleFor(selectedItem).strokeColor} onChange={event => updateStyle(selectedItem.id, { strokeColor: event.target.value })} className="h-8 w-9 rounded border border-slate-200 bg-white p-1"/></label>}
      {selectedItem.type === 'frame' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedItem.lockChildren === true} onChange={event => commit(current => current.map(item => item.id === selectedItem.id ? { ...item, lockChildren: event.target.checked } : item))}/>Lock children</label>}
      {selectedItem.type === 'frame' && <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={selectedItem.hidden === true} onChange={event => commit(current => current.map(item => item.id === selectedItem.id ? { ...item, hidden: event.target.checked } : item))}/>Hidden</label>}
      {selectedItem.type !== 'image' && selectedItem.type !== 'text' && selectedItem.type !== 'frame' && <select value={styleFor(selectedItem).strokeWidth} onChange={event => updateStyle(selectedItem.id, { strokeWidth: Number(event.target.value) })} className="h-8 rounded border border-slate-200 bg-white px-2 text-xs" aria-label="Stroke width"><option value="1">1 px</option><option value="2">2 px</option><option value="3">3 px</option><option value="5">5 px</option><option value="8">8 px</option><option value="16">16 px</option></select>}
      {(selectedItem.type === 'arrow' || selectedItem.type === 'shape') && <select value={styleFor(selectedItem).lineStyle} onChange={event => updateStyle(selectedItem.id, { lineStyle: event.target.value as PresentationItemStyle['lineStyle'] })} className="h-8 rounded border border-slate-200 bg-white px-2 text-xs" aria-label="Line style"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select>}
      {selectedItem.type === 'arrow' && <><select value={styleFor(selectedItem).connectorType} onChange={event => updateStyle(selectedItem.id, { connectorType: event.target.value as ConnectorType })} className="h-8 rounded border border-slate-200 bg-white px-2 text-xs" aria-label="Connector route"><option value="curved">Curved</option><option value="straight">Straight</option><option value="elbow">Elbow</option></select><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={styleFor(selectedItem).arrowStart} onChange={event => updateStyle(selectedItem.id, { arrowStart: event.target.checked })}/>Start arrow</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={styleFor(selectedItem).arrowEnd} onChange={event => updateStyle(selectedItem.id, { arrowEnd: event.target.checked })}/>End arrow</label><label className="flex items-center gap-1 text-xs text-slate-500">Label <input aria-label="Connector label" value={parseConnectorLabel(selectedItem)} onChange={event => commit(current => current.map(item => item.id === selectedItem.id ? setConnectorLabel(item, event.target.value) : item))} className="h-8 w-36 rounded border border-slate-200 px-2 text-xs text-slate-800" placeholder="Edge label"/></label></>}
      {(selectedItem.type === 'text' || selectedItem.type === 'note' || selectedItem.type === 'shape') && <><input type="color" value={styleFor(selectedItem).textColor} onChange={event => updateStyle(selectedItem.id, { textColor: event.target.value })} className="h-8 w-9 rounded border border-slate-200 bg-white p-1" title="Text color"/><input type="number" min="8" max="96" value={styleFor(selectedItem).fontSize} onChange={event => updateStyle(selectedItem.id, { fontSize: clamp(Number(event.target.value), 8, 96) })} className="h-8 w-16 rounded border border-slate-200 px-2 text-xs" aria-label="Font size"/><button type="button" onClick={() => updateStyle(selectedItem.id, { fontWeight: styleFor(selectedItem).fontWeight === 'bold' ? 'normal' : 'bold' })} className={`h-8 w-8 rounded border text-sm font-bold ${styleFor(selectedItem).fontWeight === 'bold' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white'}`}>B</button></>}
      <label className="flex items-center gap-1 text-xs text-slate-500">Opacity <input type="range" min="10" max="100" value={styleFor(selectedItem).opacity * 100} onChange={event => updateStyle(selectedItem.id, { opacity: Number(event.target.value) / 100 })} className="w-20 accent-indigo-600"/></label><span className="h-6 w-px bg-slate-200"/>
      <button type="button" onClick={duplicateSelected} className="rounded p-1.5 text-slate-600 hover:bg-white" title="Duplicate"><Glyph name="duplicate"/></button><button type="button" onClick={() => moveLayer('back')} className="rounded p-1.5 text-slate-600 hover:bg-white" title="Send backward"><Glyph name="front"/></button><button type="button" onClick={() => moveLayer('front')} className="rotate-180 rounded p-1.5 text-slate-600 hover:bg-white" title="Bring forward"><Glyph name="front"/></button><button type="button" onClick={() => commit(current => current.map(item => item.id === selectedItem.id ? { ...item, locked: !item.locked } : item))} className={`rounded p-1.5 ${selectedItem.locked ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white'}`} title={selectedItem.locked ? 'Unlock' : 'Lock'}><Glyph name="lock"/></button><button type="button" onClick={deleteSelected} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Glyph name="trash"/>Delete</button>
    </div>}

    <div className="flex min-h-0 flex-1">
    <main ref={stageRef} onPointerDown={onStagePointerDown} onPointerMove={event => { if (tool === 'line' && connectorStart) setConnectorPreview(worldPoint(event.clientX, event.clientY)); }} onWheel={event => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); setViewport(value => ({ ...value, zoom: clamp(value.zoom * (event.deltaY < 0 ? 1.08 : 0.93), 0.2, 3) })); } }} className="relative min-h-0 flex-1 touch-none overflow-hidden bg-white" style={{ cursor: tool === 'hand' ? 'grab' : tool === 'eraser' ? 'cell' : tool === 'pen' || tool === 'highlighter' || tool === 'line' ? 'crosshair' : 'default', backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`, backgroundPosition: `${viewport.x * viewport.zoom}px ${viewport.y * viewport.zoom}px` }}>
      <div className="absolute origin-top-left" style={{ transform: `translate(${viewport.x * viewport.zoom}px, ${viewport.y * viewport.zoom}px) scale(${viewport.zoom})` }}>{sortedItems(items).map(item => <ItemRenderer key={item.id} item={item} selected={selectedIds.includes(item.id) || selectedId === item.id} childLocked={childLockedByFrame(item, items)} connectorMode={tool === 'line'} onSelect={selectItem} onConnectorPoint={onItemConnectorPoint} onMove={(id, x, y) => applyItems(moveFrameAndChildren(itemsRef.current, id, x, y))} onResize={(id, x, y, width, height) => updateLive(id, { x, y, width, height })} onText={(id, content) => updateLive(id, { content })} onStart={beginInteraction} onEnd={endInteraction} onEndpointDrag={onEndpointDrag}/>)}{connectorStart && connectorPreview && <svg width="1" height="1" className="pointer-events-none absolute left-0 top-0 overflow-visible" aria-hidden="true"><path d={connectorPath({ start: connectorStart.point, end: connectorPreview }, 'curved')} fill="none" stroke="#4f46e5" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round"/><circle cx={connectorStart.point.x} cy={connectorStart.point.y} r="6" fill="white" stroke="#4f46e5" strokeWidth="3"/><circle cx={connectorPreview.x} cy={connectorPreview.y} r="5" fill="#4f46e5"/></svg>}</div>
      <div data-canvas-ui="true" onPointerDown={event => event.stopPropagation()} className="absolute bottom-3 left-2 right-2 z-40 flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg md:bottom-auto md:left-3 md:right-auto md:top-3 md:flex-col md:overflow-visible" aria-label="Creation tools">
        <RailButton tool="select" activeTool={tool} label="Select (V)" icon="select" onClick={() => activateTool('select')}/><RailButton tool="hand" activeTool={tool} label="Hand (H)" icon="hand" onClick={() => activateTool('hand')}/><span className="mx-1 h-6 w-px bg-slate-200 md:my-1 md:h-px md:w-6"/><RailButton tool="note" activeTool={tool} label="Sticky note (N)" icon="note" onClick={() => activateTool('note')}/><RailButton tool="text" activeTool={tool} label="Text (T)" icon="text" onClick={() => activateTool('text')}/>
        <div className="relative"><RailButton tool="shape" activeTool={tool} label="Shapes (R)" icon="shape" onClick={() => setShapeMenu(open => !open)}/>{shapeMenu && <div className="absolute bottom-12 left-1/2 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-xl md:bottom-auto md:left-12 md:top-0 md:translate-x-0">{SHAPES.map(shape => <button type="button" key={shape.kind} onClick={() => { setShapeKind(shape.kind); activateTool('shape'); setShapeMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-100"><span className={`h-5 w-7 border border-slate-500 ${shape.kind === 'circle' ? 'rounded-full' : shape.kind === 'rounded' ? 'rounded-md' : ''}`}/>{shape.label}</button>)}</div>}</div>
        <RailButton tool="line" activeTool={tool} label="Connector (L)" icon="line" onClick={() => activateTool('line')}/><RailButton tool="pen" activeTool={tool} label="Pen (P)" icon="pen" onClick={() => activateTool('pen')}/><RailButton tool="highlighter" activeTool={tool} label="Highlighter (Shift+P)" icon="highlight" onClick={() => activateTool('highlighter')}/><RailButton tool="eraser" activeTool={tool} label="Eraser (E)" icon="eraser" onClick={() => activateTool('eraser')}/><RailButton tool="frame" activeTool={tool} label="Frame (F)" icon="frame" onClick={() => activateTool('frame')}/>
      </div>
      {connectorStart && <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-md">Choose an end point · Esc to cancel</div>}
      {presenting && presentFrame && <div data-canvas-ui="true" data-testid="present-overlay" onPointerDown={event => event.stopPropagation()} className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm shadow-lg">
        <span className="text-xs font-semibold text-slate-500">{presentIndex + 1} / {walkable.length}</span>
        <strong data-testid="present-frame-title">{presentFrame.title || 'Frame'}</strong>
        <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={() => stepPresent(-1)} aria-label="Previous frame">Prev</button>
        <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={() => stepPresent(1)} aria-label="Next frame">Next</button>
      </div>}
      {!items.length && !connectorStart && <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 -translate-y-1/2 text-center"><div className="text-lg font-semibold text-slate-800">Start creating</div><p className="mt-1 text-sm leading-6 text-slate-500">Add your diagram, choose a tool, or upload an image. Drag to draw shapes and frames, or click start and end points for a connector.</p></div>}
      <div data-canvas-ui="true" onPointerDown={event => event.stopPropagation()} className="absolute bottom-16 right-3 z-40 flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-md md:bottom-3"><button type="button" onClick={() => setViewport(value => ({ ...value, zoom: clamp(value.zoom / 1.15, 0.2, 3) }))} className="rounded p-2 text-slate-600 hover:bg-slate-100" title="Zoom out"><Glyph name="zoomOut"/></button><button type="button" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })} className="min-w-14 rounded px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">{Math.round(viewport.zoom * 100)}%</button><button type="button" onClick={() => setViewport(value => ({ ...value, zoom: clamp(value.zoom * 1.15, 0.2, 3) }))} className="rounded p-2 text-slate-600 hover:bg-slate-100" title="Zoom in"><Glyph name="zoomIn"/></button></div>
    </main>
    <aside className="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-slate-50" aria-label="Frames">
      <div className="flex items-center justify-between px-3 py-2"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Frames</h2><button type="button" onClick={wrapSelection} className="rounded px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50">Create frame from selection</button></div>
      <ol className="min-h-0 flex-1 overflow-auto px-2 pb-3" aria-label="Frame list">
        {frames.map((frame, index) => {
          const active = presenting ? presentFrame?.id === frame.id : selectedId === frame.id;
          return <li key={frame.id} className={`mb-1 rounded-md border px-2 py-2 ${active ? 'border-indigo-300 bg-white' : 'border-transparent hover:bg-white'} ${frame.hidden ? 'opacity-60' : ''}`}>
            <button type="button" className="w-full truncate text-left text-sm font-semibold" onClick={() => presenting && !frame.hidden ? startPresent(frame.id) : selectItem(frame.id)}>{index + 1}. {frame.title || 'Frame'}</button>
            <div className="mt-1 flex gap-1">
              <button type="button" className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100" onClick={() => followFrame(frame)} aria-label={`Follow ${frame.title || 'Frame'}`}>Follow</button>
              <button type="button" className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100" onClick={() => !frame.hidden && startPresent(frame.id)} disabled={frame.hidden === true} aria-label={`Present ${frame.title || 'Frame'}`}>Present</button>
              <button type="button" className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100" onClick={() => commit(current => current.map(item => item.id === frame.id ? { ...item, hidden: !item.hidden } : item))} aria-label={`${frame.hidden ? 'Show' : 'Hide'} ${frame.title || 'Frame'}`}>{frame.hidden ? 'Show' : 'Hide'}</button>
            </div>
          </li>;
        })}
        {!frames.length && <li className="px-1 py-3 text-xs leading-5 text-slate-500">Draw a frame (F) or create one from the selection. Present walks this list.</li>}
      </ol>
    </aside>
    </div>
  </div>;
}
