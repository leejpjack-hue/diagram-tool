import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boardManager,
  filterAndSortBoards,
  type ActivityEntry,
  type Board,
  type BoardMode,
  type BoardSort,
  type BoardVersion,
  type DashboardPreferences,
  type PersonalTemplate,
  type Space,
} from '../../utils/boardManager';
import { TEMPLATES, type DiagramTemplate, type TemplateCategory } from '../TemplatePicker/templates';
import { TemplateThumb } from '../TemplatePicker/TemplateThumb';
import { BrandLogo } from '../BrandLogo';

export interface DashboardCreateRequest {
  mode: BoardMode;
  title?: string;
  dslText?: string;
  templateSourceId?: string;
  spaceId?: string;
}

interface DashboardProps {
  onOpen: (board: Board) => void | Promise<void>;
  onCreate: (request: DashboardCreateRequest) => void | Promise<void>;
  onPublish: (board: Board) => void | Promise<void>;
  notify: (type: 'success' | 'error', message: string) => void;
}

type DashboardView = 'home' | 'recent' | 'starred' | 'templates' | 'all' | 'trash' | 'activity' | `space:${string}`;
type CreateTab = 'blank' | 'templates' | 'import' | 'existing';
type IconName = 'home' | 'clock' | 'star' | 'template' | 'boards' | 'folder' | 'trash' | 'activity' | 'search' | 'plus' | 'upload' | 'storage' | 'menu' | 'grid' | 'list' | 'filter' | 'more' | 'present' | 'download' | 'copy' | 'edit' | 'history' | 'chevron' | 'close' | 'check' | 'command';

const MODE_META: Record<BoardMode, { label: string; badge: string; dot: string; category: TemplateCategory }> = {
  architecture: { label: 'Architecture', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', category: 'Architecture' },
  flow: { label: 'Workflow', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', category: 'Flow' },
  sequence: { label: 'Sequence', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500', category: 'Sequence' },
  gantt: { label: 'Gantt', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Gantt' },
};

const SPACE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const DEFAULT_PREFS: DashboardPreferences = { id: 'dashboard', layout: 'grid', density: 'comfortable', sort: 'lastOpened', sidebarCollapsed: false };

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>,
    template: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>,
    boards: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    folder: <path d="M3 6.5h7l2 2h9v10.5H3Z"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    activity: <path d="M3 12h4l2-6 4 12 2-6h6"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v5h14v-5"/></>,
    storage: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    grid: <><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></>,
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z"/>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    present: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></>,
    download: <><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/></>,
    edit: <><path d="m4 16-1 5 5-1L19 9l-4-4Z"/><path d="m13 7 4 4"/></>,
    history: <><path d="M4 4v6h6"/><path d="M5.5 16A8 8 0 1 0 5 9"/><path d="M12 8v5l3 2"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    command: <><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function timeAgo(iso?: string): string {
  if (!iso) return 'Never opened';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function boardAsTemplate(board: Board): DiagramTemplate {
  return { id: board.id, name: board.title, description: board.description, category: MODE_META[board.mode].category, mode: board.mode, tags: board.tags, dsl: board.dslText };
}

function BoardThumbnail({ board }: { board: Board }) {
  if (board.thumbnail) return <img src={board.thumbnail} alt={`Preview of ${board.title}`} className="h-full w-full object-cover" draggable={false} />;
  return <TemplateThumb template={boardAsTemplate(board)} />;
}

function Modal({ title, subtitle, onClose, children, width = 'max-w-3xl' }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`max-h-[90vh] w-full ${width} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl`} onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
          <div><h2 className="text-base font-bold text-slate-950">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>
          <button className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="max-h-[calc(90vh-73px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="mb-3 rounded-lg bg-slate-100 p-3 text-slate-500"><Icon name={icon} className="h-6 w-6" /></div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function Dashboard({ onOpen, onCreate, onPublish, notify }: DashboardProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [trashBoards, setTrashBoards] = useState<Board[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFS);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<DashboardView>('home');
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<BoardMode | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<CreateTab>('blank');
  const [organizeBoard, setOrganizeBoard] = useState<Board | null>(null);
  const [versionBoard, setVersionBoard] = useState<Board | null>(null);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [storageOpen, setStorageOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextBoards, nextTrash, nextSpaces, nextTemplates, nextActivity, nextPreferences, nextStorage] = await Promise.all([
        boardManager.list(), boardManager.list({ deleted: true }), boardManager.listSpaces(), boardManager.listTemplates(), boardManager.listActivity(80), boardManager.getPreferences(), boardManager.getStorageUsage(),
      ]);
      setBoards(nextBoards); setTrashBoards(nextTrash); setSpaces(nextSpaces); setTemplates(nextTemplates); setActivity(nextActivity); setPreferences(nextPreferences); setStorage(nextStorage); setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Local workspace storage could not be opened.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const unsubscribe = boardManager.subscribe(() => { void refresh(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [refresh]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') { setMenuFor(null); setSelected(new Set()); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const allTags = useMemo(() => [...new Set(boards.flatMap(board => board.tags))].sort(), [boards]);
  const activeSpaceId = view.startsWith('space:') ? view.slice(6) : undefined;
  const currentSpace = spaces.find(space => space.id === activeSpaceId);
  const recent = useMemo(() => filterAndSortBoards(boards, { sort: 'lastOpened' }).slice(0, 6), [boards]);
  const filteredBoards = useMemo(() => {
    let source = view === 'trash' ? trashBoards : boards;
    if (view === 'recent') source = filterAndSortBoards(source, { sort: 'lastOpened' }).slice(0, 24);
    return filterAndSortBoards(source, {
      search: query,
      mode: modeFilter,
      tag: tagFilter || undefined,
      starred: view === 'starred',
      deleted: view === 'trash',
      spaceId: activeSpaceId,
      sort: preferences.sort,
    });
  }, [activeSpaceId, boards, modeFilter, preferences.sort, query, tagFilter, trashBoards, view]);

  const updatePreferences = async (patch: Partial<Omit<DashboardPreferences, 'id'>>) => setPreferences(await boardManager.updatePreferences(patch));
  const selectView = (next: DashboardView) => { setView(next); setSelected(new Set()); setMobileNavOpen(false); setMenuFor(null); };
  const launchCreate = (tab: CreateTab = 'blank') => { setCreateTab(tab); setCreateOpen(true); setMenuFor(null); };
  const createFrom = async (request: DashboardCreateRequest) => { setCreateOpen(false); await onCreate({ ...request, spaceId: request.spaceId ?? activeSpaceId ?? preferences.defaultSpaceId }); };
  const openBoard = async (board: Board) => { const opened = await boardManager.markOpened(board.id); await onOpen(opened ?? board); };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const imported = await boardManager.importFromFile(file);
      setCreateOpen(false); notify('success', imported.length === 1 ? `Imported “${imported[0].title}”` : `Imported ${imported.length} boards`);
    } catch (error) { notify('error', error instanceof Error ? error.message : 'That file could not be imported.'); }
  };

  const toggleStar = async (board: Board) => { await boardManager.update(board.id, { starred: !board.starred }); };
  const trashBoard = async (board: Board) => { await boardManager.trash(board.id); setMenuFor(null); notify('success', `Moved “${board.title}” to Trash`); };
  const permanentlyDelete = async (board: Board) => {
    if (!confirm(`Permanently delete “${board.title}”? This cannot be undone.`)) return;
    await boardManager.remove(board.id); setMenuFor(null);
  };
  const duplicateBoard = async (board: Board) => { await boardManager.duplicate(board.id); setMenuFor(null); notify('success', 'Board duplicated'); };
  const saveTemplate = async (board: Board) => { await boardManager.saveAsTemplate(board.id); setMenuFor(null); notify('success', 'Saved to personal templates'); };

  const toggleSelected = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const bulkTrash = async () => { await Promise.all([...selected].map(id => boardManager.trash(id))); setSelected(new Set()); notify('success', 'Boards moved to Trash'); };
  const bulkStar = async () => { await boardManager.bulkUpdate([...selected], { starred: true }); setSelected(new Set()); };
  const bulkExport = async () => { await boardManager.exportBoards(boards.filter(board => selected.has(board.id))); setSelected(new Set()); };

  const openVersions = async (board: Board) => { setVersionBoard(board); setVersions(await boardManager.listVersions(board.id)); setMenuFor(null); };
  const createCheckpoint = async () => {
    if (!versionBoard) return;
    const name = prompt('Checkpoint name', `Checkpoint ${new Date().toLocaleDateString()}`);
    if (!name) return;
    await boardManager.createVersion(versionBoard.id, name); setVersions(await boardManager.listVersions(versionBoard.id));
  };

  const viewTitle = currentSpace?.name ?? ({ home: 'Home', recent: 'Recent boards', starred: 'Starred', templates: 'Templates', all: 'All boards', trash: 'Trash', activity: 'Activity' } as Record<string, string>)[view] ?? 'Boards';
  const viewSubtitle = view === 'trash' ? 'Boards are permanently removed after 30 days.' : currentSpace ? `${filteredBoards.length} board${filteredBoards.length === 1 ? '' : 's'} in this Space` : 'Your diagrams, timelines, and presentations in one place.';

  const navItems: Array<{ id: DashboardView; label: string; icon: IconName; count?: number }> = [
    { id: 'home', label: 'Home', icon: 'home' }, { id: 'recent', label: 'Recent', icon: 'clock' }, { id: 'starred', label: 'Starred', icon: 'star', count: boards.filter(board => board.starred).length }, { id: 'templates', label: 'Templates', icon: 'template' }, { id: 'all', label: 'All boards', icon: 'boards', count: boards.length }, { id: 'activity', label: 'Activity', icon: 'activity' }, { id: 'trash', label: 'Trash', icon: 'trash', count: trashBoards.length },
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-white text-slate-900" onClick={() => setMenuFor(null)}>
      <aside className={`${preferences.sidebarCollapsed ? 'w-[72px]' : 'w-56'} ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-[120] flex flex-col border-r border-slate-200 bg-slate-50 transition-all md:relative md:translate-x-0`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <BrandLogo size={32} />
          {!preferences.sidebarCollapsed && <div className="min-w-0"><div className="truncate text-sm font-bold">DiagramTool</div><div className="text-[10px] font-semibold uppercase text-slate-400">Local workspace</div></div>}
          <button className="ml-auto hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-200 md:block" onClick={() => void updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed })} aria-label="Toggle sidebar"><Icon name="chevron" className={`h-4 w-4 transition-transform ${preferences.sidebarCollapsed ? '' : 'rotate-180'}`} /></button>
          <button className="ml-auto rounded-md p-1.5 text-slate-500 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="space-y-0.5">
            {navItems.slice(0, 6).map(item => <NavButton key={item.id} active={view === item.id} item={item} collapsed={preferences.sidebarCollapsed} onClick={() => selectView(item.id)} />)}
          </div>
          <div className="my-3 border-t border-slate-200" />
          <div className="mb-1 flex items-center px-2">
            {!preferences.sidebarCollapsed && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Spaces</span>}
            <button className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => setSpaceOpen(true)} title="New Space"><Icon name="plus" className="h-3.5 w-3.5" /></button>
          </div>
          {spaces.map(space => <NavButton key={space.id} active={activeSpaceId === space.id} item={{ label: space.name, icon: 'folder', count: boards.filter(board => board.spaceId === space.id).length }} collapsed={preferences.sidebarCollapsed} onClick={() => selectView(`space:${space.id}`)} color={space.color} />)}
          {!preferences.sidebarCollapsed && spaces.length === 0 && <button className="w-full px-2 py-2 text-left text-xs text-slate-400 hover:text-indigo-600" onClick={() => setSpaceOpen(true)}>Create your first Space</button>}
          <div className="my-3 border-t border-slate-200" />
          {navItems.slice(6).map(item => <NavButton key={item.id} active={view === item.id} item={item} collapsed={preferences.sidebarCollapsed} onClick={() => selectView(item.id)} />)}
        </nav>
        <button className="m-2 flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2 text-left hover:border-indigo-200 hover:bg-indigo-50" onClick={() => setStorageOpen(true)} title="Local storage">
          <Icon name="storage" className="h-4 w-4 shrink-0 text-slate-500" />
          {!preferences.sidebarCollapsed && <div className="min-w-0 flex-1"><div className="flex justify-between text-[11px] font-semibold"><span>Local storage</span><span>{formatBytes(storage.usage)}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, storage.quota ? storage.usage / storage.quota * 100 : 0)}%` }} /></div></div>}
        </button>
      </aside>
      {mobileNavOpen && <button className="fixed inset-0 z-[110] bg-slate-950/30 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 md:px-6">
          <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="relative max-w-xl flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search titles, descriptions, tags, and DSL" className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-20 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"/><button onClick={() => setCommandOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">⌘ K</button></div>
          <button className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex" onClick={() => fileInputRef.current?.click()}><Icon name="upload" /> Import</button>
          <button className="flex h-10 items-center gap-2 rounded-md bg-indigo-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700" onClick={() => launchCreate()}><Icon name="plus" /> <span className="hidden sm:inline">Create new</span><span className="sm:hidden">Create</span></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
            {loadError && <div className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"><Icon name="storage" className="mt-0.5 h-5 w-5"/><div><div className="font-semibold">Local workspace unavailable</div><div>{loadError}</div><button onClick={() => void refresh()} className="mt-2 font-semibold underline">Try again</button></div></div>}
            <div className="mb-6 flex flex-wrap items-end gap-4"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950">{viewTitle}</h1><p className="mt-1 text-sm text-slate-500">{viewSubtitle}</p></div>{currentSpace && <button className="ml-auto text-xs font-semibold text-slate-500 hover:text-indigo-600" onClick={() => setSpaceOpen(true)}>Manage Space</button>}</div>

            {loading ? <DashboardSkeleton /> : view === 'templates' ? (
              <TemplatesView templates={templates} onUseBuiltIn={template => void createFrom({ mode: template.mode, title: template.name, dslText: template.dsl, templateSourceId: template.id })} onUsePersonal={async template => { const used = await boardManager.useTemplate(template.id); if (used) await createFrom({ mode: used.mode, title: used.name, dslText: used.dslText, templateSourceId: used.id }); }} onDeletePersonal={template => void boardManager.removeTemplate(template.id)} />
            ) : view === 'activity' ? <ActivityView activity={activity} onOpen={async entry => { if (!entry.boardId) return; const board = await boardManager.get(entry.boardId); if (board && !board.deletedAt) await openBoard(board); }} /> : (
              <>
                {view === 'home' && <HomeStart templates={TEMPLATES.slice(0, 4)} recent={recent} onQuickCreate={mode => void createFrom({ mode })} onUseTemplate={template => void createFrom({ mode: template.mode, title: template.name, dslText: template.dsl, templateSourceId: template.id })} onOpen={board => void openBoard(board)} onBrowseTemplates={() => selectView('templates')} />}
                <section className={view === 'home' ? 'mt-10' : ''}>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h2 className="mr-auto text-base font-bold text-slate-900">{view === 'home' ? 'All boards' : viewTitle}<span className="ml-2 text-sm font-medium text-slate-400">{filteredBoards.length}</span></h2>
                    <select value={modeFilter} onChange={event => setModeFilter(event.target.value as BoardMode | 'all')} className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400" aria-label="Filter by diagram type"><option value="all">All types</option>{Object.entries(MODE_META).map(([mode, meta]) => <option key={mode} value={mode}>{meta.label}</option>)}</select>
                    {allTags.length > 0 && <select value={tagFilter} onChange={event => setTagFilter(event.target.value)} className="h-9 max-w-36 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600" aria-label="Filter by tag"><option value="">All tags</option>{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select>}
                    <select value={preferences.sort} onChange={event => void updatePreferences({ sort: event.target.value as BoardSort })} className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600" aria-label="Sort boards"><option value="lastOpened">Last opened</option><option value="updated">Last modified</option><option value="created">Date created</option><option value="name">Name</option></select>
                    {preferences.layout === 'grid' && <select value={preferences.density} onChange={event => void updatePreferences({ density: event.target.value as DashboardPreferences['density'] })} className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600" aria-label="Board density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>}
                    <div className="flex h-9 rounded-md border border-slate-200 p-0.5"><button className={`rounded p-1.5 ${preferences.layout === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400'}`} onClick={() => void updatePreferences({ layout: 'grid' })} aria-label="Grid view"><Icon name="grid" /></button><button className={`rounded p-1.5 ${preferences.layout === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400'}`} onClick={() => void updatePreferences({ layout: 'list' })} aria-label="List view"><Icon name="list" /></button></div>
                  </div>
                  {(modeFilter !== 'all' || tagFilter || query) && <div className="mb-4 flex flex-wrap gap-2">{query && <FilterChip label={`Search: ${query}`} onClear={() => setQuery('')} />}{modeFilter !== 'all' && <FilterChip label={MODE_META[modeFilter].label} onClear={() => setModeFilter('all')} />}{tagFilter && <FilterChip label={`#${tagFilter}`} onClear={() => setTagFilter('')} />}</div>}
                  {filteredBoards.length === 0 ? <EmptyState icon={view === 'trash' ? 'trash' : 'boards'} title={view === 'trash' ? 'Trash is empty' : query || modeFilter !== 'all' || tagFilter ? 'No matching boards' : 'No boards here yet'} description={view === 'trash' ? 'Deleted boards stay here for 30 days before permanent removal.' : 'Create a blank diagram, start from a template, or adjust the active filters.'} action={view !== 'trash' && <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => launchCreate()}>Create a board</button>} /> : (
                    <div className={preferences.layout === 'grid' ? `grid gap-4 ${preferences.density === 'compact' ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]'}` : 'space-y-2'}>
                      {filteredBoards.map(board => <BoardCard key={board.id} board={board} space={spaces.find(space => space.id === board.spaceId)} layout={preferences.layout} selected={selected.has(board.id)} menuOpen={menuFor === board.id} trashView={view === 'trash'} onOpen={() => void openBoard(board)} onSelect={() => toggleSelected(board.id)} onToggleStar={() => void toggleStar(board)} onMenu={event => { event.stopPropagation(); setMenuFor(current => current === board.id ? null : board.id); }} onEdit={() => { setOrganizeBoard(board); setMenuFor(null); }} onPresent={() => void onPublish(board)} onDuplicate={() => void duplicateBoard(board)} onTemplate={() => void saveTemplate(board)} onVersions={() => void openVersions(board)} onExport={() => void boardManager.exportBoard(board)} onTrash={() => void trashBoard(board)} onRestore={() => void boardManager.restore(board.id)} onDelete={() => void permanentlyDelete(board)} />)}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {selected.size > 0 && view !== 'trash' && <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-slate-950 p-1.5 text-white shadow-xl"><span className="px-2 text-xs font-semibold">{selected.size} selected</span><button className="rounded-md px-2.5 py-2 text-xs font-semibold hover:bg-white/10" onClick={() => void bulkStar()}><Icon name="star" className="mr-1 inline h-3.5 w-3.5"/>Star</button><select className="rounded-md bg-slate-800 px-2 py-2 text-xs font-semibold" defaultValue="" onChange={event => { if (event.target.value) void boardManager.bulkUpdate([...selected], { spaceId: event.target.value === 'none' ? undefined : event.target.value }).then(() => setSelected(new Set())); }} aria-label="Move selected boards"><option value="" disabled>Move to…</option><option value="none">No Space</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select><button className="rounded-md p-2 hover:bg-white/10" onClick={() => void bulkExport()} title="Export selected"><Icon name="download" /></button><button className="rounded-md p-2 text-red-300 hover:bg-red-500/20" onClick={() => void bulkTrash()} title="Move selected to Trash"><Icon name="trash" /></button><button className="rounded-md p-2 hover:bg-white/10" onClick={() => setSelected(new Set())} title="Clear selection"><Icon name="close" /></button></div>}

      {createOpen && <CreateDialog tab={createTab} onTab={setCreateTab} spaces={spaces} boards={boards} templates={templates} onClose={() => setCreateOpen(false)} onCreate={request => void createFrom(request)} onImport={() => fileInputRef.current?.click()} />}
      {organizeBoard && <OrganizeDialog board={organizeBoard} spaces={spaces} onClose={() => setOrganizeBoard(null)} onSave={async patch => { await boardManager.update(organizeBoard.id, patch, patch.title && patch.title !== organizeBoard.title ? 'renamed' : 'updated'); setOrganizeBoard(null); }} />}
      {versionBoard && <Modal title={`Version history · ${versionBoard.title}`} subtitle="Named checkpoints and the latest 20 automatic saves stay on this device." onClose={() => setVersionBoard(null)}><div className="p-5"><button className="mb-4 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void createCheckpoint()}>Create checkpoint</button>{versions.length === 0 ? <EmptyState icon="history" title="No versions yet" description="Create a checkpoint before making a major change." /> : <div className="divide-y divide-slate-200">{versions.map(version => <div key={version.id} className="flex items-center gap-3 py-3"><div className="rounded-md bg-slate-100 p-2 text-slate-500"><Icon name="history" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{version.name}</div><div className="text-xs text-slate-500">{new Date(version.createdAt).toLocaleString()} · {version.automatic ? 'Automatic' : 'Named checkpoint'}</div></div><button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50" onClick={async () => { const restored = await boardManager.restoreVersion(version.id); if (restored) { setVersionBoard(null); notify('success', 'Version restored'); } }}>Restore</button></div>)}</div>}</div></Modal>}
      {spaceOpen && <SpaceDialog spaces={spaces} defaultSpaceId={preferences.defaultSpaceId} onDefault={spaceId => void updatePreferences({ defaultSpaceId: spaceId || undefined })} onClose={() => setSpaceOpen(false)} />}
      {storageOpen && <StorageDialog storage={storage} boards={boards} versionsCount={activity.length} onClose={() => setStorageOpen(false)} onExport={() => void boardManager.exportAll()} onClear={async () => { const count = await boardManager.clearOldVersions(); notify('success', count ? `Removed ${count} old automatic versions` : 'No old versions to remove'); }} />}
      {commandOpen && <CommandPalette boards={boards} onClose={() => setCommandOpen(false)} onOpen={board => void openBoard(board)} onCreate={mode => void createFrom({ mode })} />}
      <input ref={fileInputRef} type="file" accept=".board,.boards,.diagram,.json" onChange={handleImport} className="hidden" />
    </div>
  );
}

function NavButton({ item, active, collapsed, onClick, color }: { item: { label: string; icon: IconName; count?: number }; active: boolean; collapsed: boolean; onClick: () => void; color?: string }) {
  return <button onClick={onClick} title={collapsed ? item.label : undefined} className={`flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm font-medium transition ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-950'}`}><span style={color ? { color } : undefined}><Icon name={item.icon} /></span>{!collapsed && <><span className="min-w-0 flex-1 truncate text-left">{item.label}</span>{Boolean(item.count) && <span className="text-[10px] font-semibold text-slate-400">{item.count}</span>}</>}</button>;
}

function HomeStart({ templates, recent, onQuickCreate, onUseTemplate, onOpen, onBrowseTemplates }: { templates: DiagramTemplate[]; recent: Board[]; onQuickCreate: (mode: BoardMode) => void; onUseTemplate: (template: DiagramTemplate) => void; onOpen: (board: Board) => void; onBrowseTemplates: () => void }) {
  return <><section><div className="mb-3 flex items-center"><h2 className="text-base font-bold">Start creating</h2><button onClick={onBrowseTemplates} className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800">Browse all templates</button></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{(Object.keys(MODE_META) as BoardMode[]).map(mode => <button key={mode} className="group flex min-h-28 flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:shadow-sm" onClick={() => onQuickCreate(mode)}><div className={`flex h-9 w-9 items-center justify-center rounded-md text-white ${MODE_META[mode].dot}`}><Icon name="plus" /></div><div><div className="text-sm font-semibold group-hover:text-indigo-700">Blank {MODE_META[mode].label}</div><div className="mt-0.5 text-[11px] text-slate-400">Start clean</div></div></button>)}{templates.map(template => <button key={template.id} className="hidden min-h-28 overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:border-indigo-300 hover:shadow-sm xl:block" onClick={() => onUseTemplate(template)}><div className="h-16 overflow-hidden"><TemplateThumb template={template} /></div><div className="truncate px-2.5 py-2 text-xs font-semibold">{template.name}</div></button>)}</div></section>{recent.length > 0 && <section className="mt-9"><div className="mb-3 flex items-center"><h2 className="text-base font-bold">Pick up where you left off</h2><span className="ml-2 text-xs text-slate-400">Recently opened</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{recent.map(board => <button key={board.id} onClick={() => onOpen(board)} className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:border-indigo-300 hover:shadow-sm"><div className="aspect-[16/10] overflow-hidden bg-slate-100"><BoardThumbnail board={board}/></div><div className="p-2.5"><div className="truncate text-xs font-semibold group-hover:text-indigo-700">{board.title}</div><div className="mt-1 text-[10px] text-slate-400">Opened {timeAgo(board.lastOpenedAt)}</div></div></button>)}</div></section>}</>;
}

function BoardCard(props: { board: Board; space?: Space; layout: 'grid' | 'list'; selected: boolean; menuOpen: boolean; trashView: boolean; onOpen: () => void; onSelect: () => void; onToggleStar: () => void; onMenu: (event: React.MouseEvent) => void; onEdit: () => void; onPresent: () => void; onDuplicate: () => void; onTemplate: () => void; onVersions: () => void; onExport: () => void; onTrash: () => void; onRestore: () => void; onDelete: () => void }) {
  const { board, space, layout, selected } = props;
  if (layout === 'list') return <div className={`group relative flex items-center gap-3 rounded-lg border p-2 transition ${selected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'}`}><input type="checkbox" checked={selected} onChange={props.onSelect} onClick={event => event.stopPropagation()} className="h-4 w-4 accent-indigo-600" aria-label={`Select ${board.title}`}/><button onClick={props.onOpen} className="h-14 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100"><BoardThumbnail board={board}/></button><button onClick={props.onOpen} className="min-w-0 flex-1 text-left"><div className="truncate text-sm font-semibold">{board.title}</div><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${MODE_META[board.mode].badge}`}>{MODE_META[board.mode].label}</span>{space && <span>{space.name}</span>}<span>Opened {timeAgo(board.lastOpenedAt)}</span></div></button><button onClick={props.onToggleStar} className={`rounded p-2 ${board.starred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`} aria-label={board.starred ? 'Unstar board' : 'Star board'}><Icon name="star" /></button><BoardMenu {...props} /></div>;
  return <article className={`group relative overflow-visible rounded-lg border bg-white transition ${selected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'}`}><div className="relative aspect-[16/10] rounded-t-lg bg-slate-100"><button className="h-full w-full overflow-hidden rounded-t-lg" onClick={props.onOpen}><BoardThumbnail board={board}/></button><label className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded bg-white shadow-sm transition ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`} onClick={event => event.stopPropagation()}><input type="checkbox" checked={selected} onChange={props.onSelect} className="h-4 w-4 accent-indigo-600" aria-label={`Select ${board.title}`}/></label><div className="absolute right-2 top-2 flex gap-1"><button onClick={props.onToggleStar} className={`rounded-md bg-white/95 p-1.5 shadow-sm transition ${board.starred ? 'text-amber-500' : 'text-slate-400 opacity-0 hover:text-amber-500 group-hover:opacity-100 group-focus-within:opacity-100'}`} aria-label={board.starred ? 'Unstar board' : 'Star board'}><Icon name="star" /></button><BoardMenu {...props} /></div>{board.presentation?.items.length ? <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-slate-950/75 px-1.5 py-1 text-[10px] font-semibold text-white"><Icon name="present" className="h-3 w-3"/>{board.presentation.items.length}</span> : null}</div><div className="p-3"><button className="block w-full text-left" onClick={props.onOpen}><h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 group-hover:text-indigo-700">{board.title}</h3></button><div className="mt-2 flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${MODE_META[board.mode].badge}`}>{MODE_META[board.mode].label}</span>{space && <span className="min-w-0 truncate text-[10px] font-medium text-slate-500" style={{ color: space.color }}>● {space.name}</span>}</div>{board.tags.length > 0 && <div className="mt-2 flex gap-1 overflow-hidden">{board.tags.slice(0, 3).map(tag => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">#{tag}</span>)}</div>}<div className="mt-2 text-[11px] text-slate-400">Opened {timeAgo(board.lastOpenedAt)}</div></div></article>;
}

function BoardMenu(props: Parameters<typeof BoardCard>[0]) {
  return <div className="relative" onClick={event => event.stopPropagation()}><button onClick={props.onMenu} className="rounded-md bg-white/95 p-1.5 text-slate-500 shadow-sm opacity-0 transition hover:text-slate-950 group-hover:opacity-100 group-focus-within:opacity-100" aria-label={`Actions for ${props.board.title}`}><Icon name="more" /></button>{props.menuOpen && <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl">{props.trashView ? <><MenuItem icon="history" label="Restore" onClick={props.onRestore}/><MenuItem icon="trash" label="Delete permanently" danger onClick={props.onDelete}/></> : <><MenuItem icon="edit" label="Edit details" onClick={props.onEdit}/><MenuItem icon="present" label="Present" onClick={props.onPresent}/><MenuItem icon="copy" label="Duplicate" onClick={props.onDuplicate}/><MenuItem icon="template" label="Save as template" onClick={props.onTemplate}/><MenuItem icon="history" label="Version history" onClick={props.onVersions}/><MenuItem icon="download" label="Export board" onClick={props.onExport}/><div className="my-1 border-t border-slate-100"/><MenuItem icon="trash" label="Move to Trash" danger onClick={props.onTrash}/></>}</div>}</div>;
}

function MenuItem({ icon, label, onClick, danger }: { icon: IconName; label: string; onClick: () => void; danger?: boolean }) { return <button className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`} onClick={onClick}><Icon name={icon}/>{label}</button>; }
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) { return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{label}<button onClick={onClear} aria-label={`Clear ${label}`}><Icon name="close" className="h-3 w-3"/></button></span>; }

function CreateDialog({ tab, onTab, spaces, boards, templates, onClose, onCreate, onImport }: { tab: CreateTab; onTab: (tab: CreateTab) => void; spaces: Space[]; boards: Board[]; templates: PersonalTemplate[]; onClose: () => void; onCreate: (request: DashboardCreateRequest) => void; onImport: () => void }) {
  const [spaceId, setSpaceId] = useState('');
  const tabs: Array<{ id: CreateTab; label: string }> = [{ id: 'blank', label: 'Blank' }, { id: 'templates', label: 'Templates' }, { id: 'import', label: 'Import' }, { id: 'existing', label: 'From a board' }];
  return <Modal title="Create a board" subtitle="Start clean, use a pattern, import work, or branch from an existing board." onClose={onClose} width="max-w-5xl"><div className="flex border-b border-slate-200 px-5">{tabs.map(item => <button key={item.id} onClick={() => onTab(item.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>{item.label}</button>)}</div><div className="p-5"><div className="mb-5 flex items-center gap-3"><label className="text-xs font-semibold text-slate-600">Create in</label><select value={spaceId} onChange={event => setSpaceId(event.target.value)} className="rounded-md border border-slate-200 px-2.5 py-2 text-sm"><option value="">No Space</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></div>{tab === 'blank' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(MODE_META) as BoardMode[]).map(mode => <button key={mode} onClick={() => onCreate({ mode, spaceId: spaceId || undefined })} className="rounded-lg border border-slate-200 p-4 text-left hover:border-indigo-400 hover:bg-indigo-50"><div className={`mb-8 flex h-10 w-10 items-center justify-center rounded-md text-white ${MODE_META[mode].dot}`}><Icon name="plus"/></div><div className="font-semibold">Blank {MODE_META[mode].label}</div><div className="mt-1 text-xs text-slate-500">Open a clean DSL canvas.</div></button>)}</div>}{tab === 'templates' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...TEMPLATES, ...templates.map(template => ({ id: template.id, name: template.name, description: template.description, category: MODE_META[template.mode].category, mode: template.mode, tags: ['personal'], dsl: template.dslText } satisfies DiagramTemplate))].map(template => <button key={template.id} onClick={() => onCreate({ mode: template.mode, title: template.name, dslText: template.dsl, templateSourceId: template.id, spaceId: spaceId || undefined })} className="rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-400"><TemplateThumb template={template}/><div className="mt-3 text-sm font-semibold">{template.name}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{template.description}</div></button>)}</div>}{tab === 'import' && <button onClick={onImport} className="flex min-h-60 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"><Icon name="upload" className="mb-3 h-8 w-8"/><span className="font-semibold">Choose a board or backup file</span><span className="mt-1 text-xs">.board, .boards, .diagram, or JSON</span></button>}{tab === 'existing' && <div className="grid gap-2 sm:grid-cols-2">{boards.map(board => <button key={board.id} onClick={() => onCreate({ mode: board.mode, title: `${board.title} (copy)`, dslText: board.dslText, spaceId: spaceId || board.spaceId })} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 text-left hover:border-indigo-400"><div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-slate-100"><BoardThumbnail board={board}/></div><div className="min-w-0"><div className="truncate text-sm font-semibold">{board.title}</div><div className="text-xs text-slate-500">{MODE_META[board.mode].label}</div></div></button>)}</div>}</div></Modal>;
}

function OrganizeDialog({ board, spaces, onClose, onSave }: { board: Board; spaces: Space[]; onClose: () => void; onSave: (patch: Partial<Board>) => void }) {
  const [title, setTitle] = useState(board.title); const [description, setDescription] = useState(board.description); const [spaceId, setSpaceId] = useState(board.spaceId ?? ''); const [tags, setTags] = useState(board.tags.join(', '));
  return <Modal title="Board details" subtitle="Organize this board without changing its diagram." onClose={onClose} width="max-w-lg"><form className="space-y-4 p-5" onSubmit={event => { event.preventDefault(); onSave({ title: title.trim() || board.title, description: description.trim(), spaceId: spaceId || undefined, tags: tags.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(Boolean) }); }}><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Title</span><input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"/></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Space</span><select value={spaceId} onChange={event => setSpaceId(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">No Space</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Tags</span><input value={tags} onChange={event => setTags(event.target.value)} placeholder="architecture, payments, v2" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"/><span className="mt-1 block text-[11px] text-slate-400">Separate tags with commas.</span></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">Cancel</button><button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Save changes</button></div></form></Modal>;
}

function SpaceDialog({ spaces, defaultSpaceId, onDefault, onClose }: { spaces: Space[]; defaultSpaceId?: string; onDefault: (spaceId: string) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [color, setColor] = useState(SPACE_COLORS[0]);
  return <Modal title="Manage Spaces" subtitle="Group related boards into simple local folders." onClose={onClose} width="max-w-lg"><div className="p-5"><form className="flex gap-2" onSubmit={async event => { event.preventDefault(); if (!name.trim()) return; await boardManager.createSpace(name, color); setName(''); }}><input value={name} onChange={event => setName(event.target.value)} placeholder="New Space name" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"/><select value={color} onChange={event => setColor(event.target.value)} className="rounded-md border border-slate-200 px-2" aria-label="Space color">{SPACE_COLORS.map(value => <option key={value} value={value}>{value}</option>)}</select><button className="rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white">Add</button></form><label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Default Space for new boards</span><select value={defaultSpaceId ?? ''} onChange={event => onDefault(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">No default Space</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><div className="mt-5 divide-y divide-slate-200">{spaces.map(space => <div key={space.id} className="flex items-center gap-3 py-3"><span className="h-3 w-3 rounded" style={{ background: space.color }}/><span className="flex-1 text-sm font-semibold">{space.name}</span><button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { if (confirm(`Delete Space “${space.name}”? Boards will become unfiled.`)) void boardManager.removeSpace(space.id); }} aria-label={`Delete ${space.name}`}><Icon name="trash"/></button></div>)}{spaces.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No Spaces yet.</div>}</div></div></Modal>;
}

function TemplatesView({ templates, onUseBuiltIn, onUsePersonal, onDeletePersonal }: { templates: PersonalTemplate[]; onUseBuiltIn: (template: DiagramTemplate) => void; onUsePersonal: (template: PersonalTemplate) => void; onDeletePersonal: (template: PersonalTemplate) => void }) {
  return <div className="space-y-9">{templates.length > 0 && <section><h2 className="mb-4 text-base font-bold">Personal templates</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{templates.map(template => <div key={template.id} className="group relative rounded-lg border border-slate-200 p-3 hover:border-indigo-300"><button className="w-full text-left" onClick={() => onUsePersonal(template)}>{template.thumbnail ? <div className="aspect-[16/10] overflow-hidden rounded-md bg-slate-100"><img src={template.thumbnail} alt="" className="h-full w-full object-cover"/></div> : <TemplateThumb template={{ id: template.id, name: template.name, description: template.description, category: MODE_META[template.mode].category, mode: template.mode, tags: ['personal'], dsl: template.dslText }}/>}<div className="mt-3 text-sm font-semibold">{template.name}</div><div className="mt-1 text-xs text-slate-500">Used {template.useCount} time{template.useCount === 1 ? '' : 's'}</div></button><button onClick={() => onDeletePersonal(template)} className="absolute right-4 top-4 rounded bg-white p-1.5 text-slate-400 opacity-0 shadow group-hover:opacity-100" aria-label={`Delete ${template.name}`}><Icon name="trash"/></button></div>)}</div></section>}<section><h2 className="mb-4 text-base font-bold">Built-in templates</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{TEMPLATES.map(template => <button key={template.id} onClick={() => onUseBuiltIn(template)} className="rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-400 hover:shadow-sm"><TemplateThumb template={template}/><div className="mt-3 text-sm font-semibold">{template.name}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{template.description}</div></button>)}</div></section></div>;
}

function ActivityView({ activity, onOpen }: { activity: ActivityEntry[]; onOpen: (entry: ActivityEntry) => void }) { return activity.length === 0 ? <EmptyState icon="activity" title="No activity yet" description="Board creation, organization, exports, and recovery actions appear here." /> : <div className="max-w-3xl divide-y divide-slate-200">{activity.map(entry => <button key={entry.id} onClick={() => onOpen(entry)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"><div className="rounded-md bg-slate-100 p-2 text-slate-500"><Icon name="activity"/></div><div className="min-w-0 flex-1"><div className="text-sm"><span className="font-semibold">{entry.boardTitle}</span> <span className="text-slate-500">{entry.type}</span></div>{entry.detail && <div className="text-xs text-slate-500">{entry.detail}</div>}</div><time className="text-xs text-slate-400">{timeAgo(entry.createdAt)}</time></button>)}</div>; }

function StorageDialog({ storage, boards, versionsCount, onClose, onExport, onClear }: { storage: { usage: number; quota: number }; boards: Board[]; versionsCount: number; onClose: () => void; onExport: () => void; onClear: () => void }) { const percent = storage.quota ? storage.usage / storage.quota * 100 : 0; return <Modal title="Local storage" subtitle="Your workspace stays in this browser and works without an account." onClose={onClose} width="max-w-lg"><div className="space-y-5 p-5"><div><div className="flex justify-between text-sm font-semibold"><span>{formatBytes(storage.usage)} used</span><span className="text-slate-400">{formatBytes(storage.quota)} available</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, percent)}%` }}/></div></div><div className="grid grid-cols-3 gap-3"><div className="rounded-md bg-slate-50 p-3"><div className="text-xl font-bold">{boards.length}</div><div className="text-xs text-slate-500">Boards</div></div><div className="rounded-md bg-slate-50 p-3"><div className="text-xl font-bold">{boards.filter(board => board.thumbnail).length}</div><div className="text-xs text-slate-500">Previews</div></div><div className="rounded-md bg-slate-50 p-3"><div className="text-xl font-bold">{versionsCount}</div><div className="text-xs text-slate-500">Recent events</div></div></div><div className="space-y-2"><button onClick={onExport} className="flex w-full items-center gap-3 rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"><Icon name="download"/><div><div className="text-sm font-semibold">Export complete backup</div><div className="text-xs text-slate-500">Download boards, Spaces, and personal templates.</div></div></button><button onClick={onClear} className="flex w-full items-center gap-3 rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"><Icon name="history"/><div><div className="text-sm font-semibold">Clean old automatic versions</div><div className="text-xs text-slate-500">Keep named checkpoints and the newest automatic saves.</div></div></button></div></div></Modal>; }

function CommandPalette({ boards, onClose, onOpen, onCreate }: { boards: Board[]; onClose: () => void; onOpen: (board: Board) => void; onCreate: (mode: BoardMode) => void }) { const [query, setQuery] = useState(''); const matches = filterAndSortBoards(boards, { search: query }).slice(0, 8); return <div className="fixed inset-0 z-[160] flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh]" onMouseDown={onClose}><div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}><div className="relative border-b border-slate-200"><Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search boards or run a command" className="h-14 w-full pl-12 pr-4 text-sm outline-none" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}/></div><div className="max-h-[55vh] overflow-y-auto p-2">{!query && <><div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase text-slate-400">Create</div>{(Object.keys(MODE_META) as BoardMode[]).map(mode => <button key={mode} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-slate-100" onClick={() => { onClose(); onCreate(mode); }}><span className={`h-2.5 w-2.5 rounded ${MODE_META[mode].dot}`}/><span className="font-medium">New {MODE_META[mode].label}</span></button>)}</>}<div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase text-slate-400">Boards</div>{matches.map(board => <button key={board.id} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-100" onClick={() => { onClose(); onOpen(board); }}><span className={`h-2.5 w-2.5 rounded ${MODE_META[board.mode].dot}`}/><span className="min-w-0 flex-1 truncate text-sm font-medium">{board.title}</span><span className="text-xs text-slate-400">{MODE_META[board.mode].label}</span></button>)}{matches.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-400">No matching boards.</div>}</div></div></div>; }

function DashboardSkeleton() { return <div className="animate-pulse"><div className="mb-4 h-5 w-32 rounded bg-slate-100"/><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 rounded-lg bg-slate-100"/>)}</div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[16/12] rounded-lg bg-slate-100"/>)}</div></div>; }
