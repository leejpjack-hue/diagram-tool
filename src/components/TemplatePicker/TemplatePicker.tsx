import { useState, useMemo } from 'react';
import { TEMPLATES, templateMatchesQuery, type DiagramTemplate, type TemplateCategory } from './templates';
import { TemplateThumb } from './TemplateThumb';

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (tpl: DiagramTemplate) => void;
}

const CATEGORIES: (TemplateCategory | 'All')[] = ['All', 'Workshop', 'Architecture', 'Flow', 'Sequence', 'Gantt'];

const CATEGORY_BADGE: Record<TemplateCategory, string> = {
  Architecture: 'bg-purple-100 text-purple-700',
  Flow: 'bg-blue-100 text-blue-700',
  Sequence: 'bg-sky-100 text-sky-700',
  Gantt: 'bg-emerald-100 text-emerald-700',
  Workshop: 'bg-amber-100 text-amber-800',
};

export function TemplatePicker({ open, onClose, onPick }: TemplatePickerProps) {
  const [category, setCategory] = useState<TemplateCategory | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (category !== 'All' && t.category !== category) return false;
      return templateMatchesQuery(t, query);
    });
  }, [category, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[min(980px,94vw)] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Template Gallery</h2>
            <p className="text-xs text-gray-500">Start from a professionally designed pattern</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-1">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  category === c
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search templates..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {filtered.length} template{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12">No templates match your search.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onPick(t); onClose(); }}
                  className="text-left border border-gray-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 transition-all bg-white group"
                >
                  <TemplateThumb template={t} />
                  <div className="flex items-center gap-2 mt-3 mb-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${CATEGORY_BADGE[t.category]}`}>
                      {t.category}
                    </span>
                    {t.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-indigo-600">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
