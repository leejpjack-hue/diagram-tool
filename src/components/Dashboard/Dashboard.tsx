import { useMemo, useRef, useState } from 'react';
import { boardManager, type Board, type BoardMode } from '../../utils/boardManager';
import { TemplateThumb } from '../TemplatePicker/TemplateThumb';
import type { DiagramTemplate, TemplateCategory } from '../TemplatePicker/templates';

// Miro-style home dashboard: every diagram (architecture, workflow, sequence,
// Gantt, …) lives on a board card with a title and description. Boards are
// stored in the browser (localStorage) and can be saved to / opened from
// files for backup and sharing.

interface DashboardProps {
  onOpen: (board: Board) => void;
  onCreate: (mode: BoardMode) => void;
  notify: (type: 'success' | 'error', message: string) => void;
}

const MODE_META: Record<BoardMode, { label: string; badge: string; category: TemplateCategory }> = {
  architecture: { label: 'Architecture', badge: 'bg-purple-100 text-purple-700', category: 'Architecture' },
  flow: { label: 'Workflow', badge: 'bg-blue-100 text-blue-700', category: 'Flow' },
  sequence: { label: 'Sequence', badge: 'bg-sky-100 text-sky-700', category: 'Sequence' },
  gantt: { label: 'Gantt', badge: 'bg-emerald-100 text-emerald-700', category: 'Gantt' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// TemplateThumb draws a stylized preview per diagram kind — reuse it for
// board cards by shaping the board like a template.
function boardAsTemplate(b: Board): DiagramTemplate {
  return {
    id: b.id,
    name: b.title,
    description: b.description,
    category: MODE_META[b.mode].category,
    mode: b.mode,
    tags: [],
    dsl: b.dslText,
  };
}

export function Dashboard({ onOpen, onCreate, notify }: DashboardProps) {
  const [boards, setBoards] = useState<Board[]>(() => boardManager.list());
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setBoards(boardManager.list());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter(b =>
      b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q),
    );
  }, [boards, query]);

  const commitTitle = (id: string) => {
    const value = draft.trim();
    if (value) boardManager.update(id, { title: value });
    setEditingTitle(null);
    refresh();
  };

  const commitDesc = (id: string) => {
    boardManager.update(id, { description: draft.trim() });
    setEditingDesc(null);
    refresh();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await boardManager.importFromFile(file);
      refresh();
      notify('success', imported.length === 1
        ? `Opened "${imported[0].title}"`
        : `Imported ${imported.length} boards`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : "That file couldn't be opened.");
    }
  };

  const handleDelete = (b: Board) => {
    if (!confirm(`Delete "${b.title}"? This can't be undone.`)) return;
    boardManager.remove(b.id);
    setMenuFor(null);
    refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50" onClick={() => { setMenuFor(null); setNewMenuOpen(false); }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header row */}
        <div className="flex items-center gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              Boards
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              All your diagrams in one place — stored in this browser.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Search boards…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              title="Open a board file (.board / .boards / .diagram)"
            >
              Open file…
            </button>
            <button
              onClick={() => {
                if (boards.length === 0) { notify('error', 'Nothing to save yet — create a board first.'); return; }
                boardManager.exportAll();
              }}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              title="Save every board to one backup file"
            >
              Save all…
            </button>
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setNewMenuOpen(o => !o)}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                + New board
              </button>
              {newMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden py-1">
                  {(Object.keys(MODE_META) as BoardMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => { setNewMenuOpen(false); onCreate(m); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
                    >
                      <span className={`w-2.5 h-2.5 rounded ${MODE_META[m].badge.split(' ')[0]}`} />
                      {MODE_META[m].label} diagram
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Board grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <div className="text-5xl mb-4">🗂️</div>
            {boards.length === 0 ? (
              <>
                <div className="text-lg font-medium text-slate-600 mb-1">No boards yet</div>
                <div className="text-sm">Create your first board with “+ New board”, or open a saved file.</div>
              </>
            ) : (
              <div className="text-sm">No boards match your search.</div>
            )}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {filtered.map(b => (
              <div
                key={b.id}
                className="relative bg-white border border-slate-200 rounded-xl overflow-visible hover:shadow-lg hover:-translate-y-0.5 transition-all group"
              >
                {/* Thumbnail opens the board */}
                <button className="block w-full text-left p-3 pb-0" onClick={() => onOpen(b)} title={`Open "${b.title}"`}>
                  <TemplateThumb template={boardAsTemplate(b)} />
                </button>

                <div className="p-3">
                  {/* Title (click to rename) */}
                  {editingTitle === b.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => commitTitle(b.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitTitle(b.id); if (e.key === 'Escape') setEditingTitle(null); }}
                      className="w-full text-sm font-semibold text-slate-900 border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  ) : (
                    <div
                      className="text-sm font-semibold text-slate-900 truncate cursor-text hover:bg-slate-50 rounded px-1.5 py-0.5 -mx-1.5"
                      title="Click to rename"
                      onClick={() => { setDraft(b.title); setEditingTitle(b.id); }}
                    >
                      {b.title}
                    </div>
                  )}

                  {/* Description (click to edit) */}
                  {editingDesc === b.id ? (
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={() => commitDesc(b.id)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitDesc(b.id); } if (e.key === 'Escape') setEditingDesc(null); }}
                      rows={2}
                      className="w-full mt-1 text-xs text-slate-600 border border-indigo-300 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      placeholder="What does this board show?"
                    />
                  ) : (
                    <div
                      className={`mt-1 text-xs leading-relaxed line-clamp-2 cursor-text hover:bg-slate-50 rounded px-1.5 py-0.5 -mx-1.5 ${b.description ? 'text-slate-600' : 'text-slate-400 italic'}`}
                      title="Click to edit the description"
                      onClick={() => { setDraft(b.description); setEditingDesc(b.id); }}
                    >
                      {b.description || 'Add a description…'}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${MODE_META[b.mode].badge}`}>
                      {MODE_META[b.mode].label}
                    </span>
                    <span className="text-[11px] text-slate-400">Edited {timeAgo(b.updatedAt)}</span>

                    {/* ⋯ menu */}
                    <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}
                        className="w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 font-bold"
                        title="Board actions"
                      >
                        ⋯
                      </button>
                      {menuFor === b.id && (
                        <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden py-1 text-sm">
                          <button className="w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { setMenuFor(null); onOpen(b); }}>Open</button>
                          <button className="w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { boardManager.exportBoard(b); setMenuFor(null); }}>Save to file</button>
                          <button className="w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { boardManager.duplicate(b.id); setMenuFor(null); refresh(); }}>Duplicate</button>
                          <button className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" onClick={() => handleDelete(b)}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".board,.boards,.diagram,.json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
