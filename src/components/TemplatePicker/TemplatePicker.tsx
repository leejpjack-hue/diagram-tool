import { useState, useMemo } from 'react';
import { TEMPLATES, type DiagramTemplate, type TemplateCategory } from './templates';

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (tpl: DiagramTemplate) => void;
}

const CATEGORIES: (TemplateCategory | 'All')[] = ['All', 'Architecture', 'Flow'];

export function TemplatePicker({ open, onClose, onPick }: TemplatePickerProps) {
  const [category, setCategory] = useState<TemplateCategory | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (category !== 'All' && t.category !== category) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.includes(q))
      );
    });
  }, [category, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-[min(920px,92vw)] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
            <p className="text-xs text-gray-500">Start from a pre-built pattern</p>
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
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  category === c
                    ? 'bg-indigo-600 text-white'
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
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12">No templates match your search.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onPick(t); onClose(); }}
                  className="text-left border border-gray-200 rounded-lg p-4 hover:border-indigo-500 hover:shadow-md transition-all bg-white group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
                      t.category === 'Architecture' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {t.category}
                    </span>
                    {t.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-indigo-600">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
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
