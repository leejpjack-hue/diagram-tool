import type { C4Level } from '../../store/types';

interface Props {
  current: C4Level | 'all';
  available: C4Level[];
  onChange: (level: C4Level | 'all') => void;
}

const LEVEL_META: Record<C4Level, { label: string; desc: string; color: string }> = {
  context:   { label: 'Context',   desc: 'L1', color: '#0EA5E9' },
  container: { label: 'Container', desc: 'L2', color: '#22C55E' },
  component: { label: 'Component', desc: 'L3', color: '#F59E0B' },
  code:      { label: 'Code',      desc: 'L4', color: '#EF4444' },
};

const ORDER: C4Level[] = ['context', 'container', 'component', 'code'];

/**
 * Floating switcher for C4 hierarchical drill-down.
 * Only renders when at least one node has an explicit level.
 */
export function C4LevelSwitcher({ current, available, onChange }: Props) {
  if (available.length === 0) return null;

  // Stable order: only show levels that exist in the diagram, plus "All".
  const presentLevels = ORDER.filter(l => available.includes(l));

  return (
    <div className="absolute top-4 right-4 z-10 bg-[#1E293B]/90 backdrop-blur-md rounded-lg shadow-2xl border border-white/10 p-2 flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 px-2 font-semibold">C4</span>
      <button
        onClick={() => onChange('all')}
        className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
          current === 'all'
            ? 'bg-white text-slate-900'
            : 'text-slate-300 hover:bg-white/10'
        }`}
      >
        All
      </button>
      {presentLevels.map(level => {
        const meta = LEVEL_META[level];
        const active = current === level;
        return (
          <button
            key={level}
            onClick={() => onChange(level)}
            title={`${meta.label} (${meta.desc})`}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              active ? 'text-white' : 'text-slate-300 hover:bg-white/10'
            }`}
            style={active ? { background: meta.color } : undefined}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
