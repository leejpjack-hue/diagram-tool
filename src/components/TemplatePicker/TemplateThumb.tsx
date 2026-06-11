import type { ReactElement } from 'react';
import type { DiagramTemplate } from './templates';

// Stylized mini-preview kinds. Derived from a template's tags/category so the
// gallery shows a visual hint of each diagram's shape, Lucidchart-style.
type ThumbKind =
  | 'tiers'
  | 'flow'
  | 'tree'
  | 'class'
  | 'network'
  | 'swimlane'
  | 'bpmn'
  | 'gantt'
  | 'cards'
  | 'sequence';

function thumbKindFor(t: DiagramTemplate): ThumbKind {
  if (t.mode === 'gantt') return 'gantt';
  if (t.mode === 'sequence') return 'sequence';
  const has = (tag: string) => t.tags.includes(tag);
  if (has('presentation') || has('cards')) return 'cards';
  if (has('uml') || has('er') || has('class')) return 'class';
  if (has('swimlane')) return 'swimlane';
  if (has('bpmn')) return 'bpmn';
  if (has('network')) return 'network';
  if (has('c4')) return 'tree';
  if (t.category === 'Flow') return 'flow';
  return 'tiers';
}

const STROKE = '#94a3b8';

function Tiers() {
  return (
    <>
      <rect x="100" y="8" width="80" height="20" rx="5" fill="#c7d2fe" stroke="#6366f1" />
      <rect x="40" y="46" width="80" height="20" rx="5" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="160" y="46" width="80" height="20" rx="5" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="70" y="84" width="60" height="20" rx="10" fill="#bbf7d0" stroke="#10b981" />
      <rect x="160" y="84" width="60" height="20" rx="10" fill="#bbf7d0" stroke="#10b981" />
      {/* orthogonal elbows — templates use edges: orthogonal */}
      <path d="M140 28 V37 H80 V46 M140 28 V37 H200 V46 M80 66 V75 H100 V84 M200 66 V75 H190 V84" stroke={STROKE} fill="none" />
    </>
  );
}

function Flow() {
  return (
    <>
      {/* green start → blue process → amber decision → red end, matching canvas colours */}
      <rect x="20" y="44" width="52" height="24" rx="12" fill="#bbf7d0" stroke="#10b981" />
      <rect x="96" y="44" width="56" height="24" rx="5" fill="#dbeafe" stroke="#3b82f6" />
      <path d="M196 40 L222 56 L196 72 L170 56 Z" fill="#fef3c7" stroke="#f59e0b" />
      <rect x="238" y="44" width="36" height="24" rx="12" fill="#fecaca" stroke="#ef4444" />
      <path d="M72 56 L96 56 M152 56 L170 56 M222 56 L238 56" stroke={STROKE} />
    </>
  );
}

function Tree() {
  return (
    <>
      <rect x="110" y="6" width="70" height="22" rx="5" fill="#c7d2fe" stroke="#6366f1" />
      <rect x="30" y="46" width="64" height="20" rx="5" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="114" y="46" width="64" height="20" rx="5" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="198" y="46" width="64" height="20" rx="5" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="72" y="84" width="56" height="18" rx="4" fill="#dbeafe" stroke="#3b82f6" />
      <rect x="160" y="84" width="56" height="18" rx="4" fill="#dbeafe" stroke="#3b82f6" />
      <path d="M145 28 L62 46 M145 28 L146 46 M145 28 L230 46 M100 66 L100 84 M188 66 L188 84" stroke={STROKE} fill="none" />
    </>
  );
}

function ClassThumb() {
  return (
    <>
      {[
        { x: 30, c: '#bfdbfe', s: '#3b82f6' },
        { x: 120, c: '#e9d5ff', s: '#8b5cf6' },
        { x: 210, c: '#bbf7d0', s: '#10b981' },
      ].map(({ x, c, s }) => (
        <g key={x}>
          <rect x={x} y="24" width="64" height="64" rx="4" fill="#fff" stroke={s} />
          <rect x={x} y="24" width="64" height="18" rx="4" fill={c} stroke={s} />
          <path d={`M${x} 60 L${x + 64} 60`} stroke={s} />
          <path d={`M${x + 8} 50 h40 M${x + 8} 70 h36 M${x + 8} 79 h44`} stroke="#cbd5e1" />
        </g>
      ))}
      <path d="M94 56 L120 56 M184 56 L210 56" stroke={STROKE} />
    </>
  );
}

function Network() {
  return (
    <>
      <circle cx="60" cy="32" r="14" fill="#bfdbfe" stroke="#3b82f6" />
      <circle cx="150" cy="22" r="14" fill="#ddd6fe" stroke="#8b5cf6" />
      <circle cx="236" cy="36" r="14" fill="#bfdbfe" stroke="#3b82f6" />
      <circle cx="100" cy="84" r="14" fill="#bbf7d0" stroke="#10b981" />
      <circle cx="196" cy="86" r="14" fill="#fde68a" stroke="#f59e0b" />
      <path d="M70 42 L92 74 M150 36 L104 74 M150 36 L192 74 M226 46 L204 76 M74 32 L136 24 M164 26 L222 34" stroke={STROKE} fill="none" />
    </>
  );
}

function Swimlane() {
  return (
    <>
      <rect x="16" y="12" width="258" height="28" rx="4" fill="#eff6ff" stroke="#bfdbfe" />
      <rect x="16" y="42" width="258" height="28" rx="4" fill="#f5f3ff" stroke="#ddd6fe" />
      <rect x="16" y="72" width="258" height="28" rx="4" fill="#ecfdf5" stroke="#a7f3d0" />
      <rect x="40" y="18" width="44" height="16" rx="8" fill="#bfdbfe" stroke="#3b82f6" />
      <rect x="120" y="48" width="44" height="16" rx="3" fill="#ddd6fe" stroke="#8b5cf6" />
      <rect x="200" y="78" width="44" height="16" rx="8" fill="#bbf7d0" stroke="#10b981" />
      <path d="M84 26 L120 52 M164 60 L200 82" stroke={STROKE} fill="none" />
    </>
  );
}

function Bpmn() {
  return (
    <>
      <circle cx="36" cy="56" r="12" fill="#bbf7d0" stroke="#10b981" />
      <rect x="72" y="42" width="56" height="28" rx="6" fill="#dbeafe" stroke="#3b82f6" />
      <path d="M178 38 L200 56 L178 74 L156 56 Z" fill="#fef3c7" stroke="#f59e0b" />
      <rect x="216" y="42" width="32" height="28" rx="6" fill="#e9d5ff" stroke="#8b5cf6" />
      <circle cx="268" cy="56" r="12" fill="#fecaca" stroke="#ef4444" strokeWidth="2.5" />
      <path d="M48 56 L72 56 M128 56 L156 56 M200 56 L216 56 M248 56 L256 56" stroke={STROKE} />
    </>
  );
}

function Gantt() {
  return (
    <>
      {[24, 72, 120, 168, 216, 264].map((x) => (
        <path key={x} d={`M${x} 8 V104`} stroke="#e2e8f0" />
      ))}
      <rect x="24" y="16" width="86" height="13" rx="6" fill="#3b82f6" />
      <rect x="58" y="36" width="110" height="13" rx="6" fill="#8b5cf6" />
      <rect x="96" y="56" width="86" height="13" rx="6" fill="#10b981" />
      <rect x="140" y="76" width="100" height="13" rx="6" fill="#f59e0b" />
      <path d="M252 96 l9 -9 l9 9 l-9 9 Z" fill="#ef4444" />
    </>
  );
}

function Cards() {
  return (
    <>
      <rect x="22" y="30" width="70" height="52" rx="9" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="2" />
      <rect x="110" y="30" width="70" height="52" rx="9" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="2" />
      <rect x="198" y="30" width="70" height="52" rx="9" fill="#d1fae5" stroke="#10b981" strokeWidth="2" />
      <text x="40" y="62" fontSize="22">🧑‍💻</text>
      <text x="128" y="62" fontSize="22">⚙️</text>
      <text x="216" y="62" fontSize="22">🗄️</text>
      <path d="M92 56 L110 56 M180 56 L198 56" stroke={STROKE} strokeWidth="2" />
    </>
  );
}

function Sequence() {
  const xs = [56, 145, 234];
  const colors = ['#6366f1', '#0ea5e9', '#10b981'];
  return (
    <>
      {xs.map((x, i) => (
        <g key={x}>
          <rect x={x - 28} y={10} width={56} height={18} rx={6} fill={colors[i]} />
          <rect x={x - 28} y={84} width={56} height={18} rx={6} fill={colors[i]} opacity={0.85} />
          <path d={`M${x} 28 V84`} stroke={colors[i]} strokeOpacity={0.4} strokeDasharray="4 4" />
        </g>
      ))}
      <path d="M56 42 H140" stroke="#6366f1" strokeWidth="1.8" />
      <path d="M140 42 l-7 -4 v8 Z" fill="#6366f1" />
      <path d="M145 56 H229" stroke="#0ea5e9" strokeWidth="1.8" />
      <path d="M229 56 l-7 -4 v8 Z" fill="#0ea5e9" />
      <path d="M234 70 H61" stroke="#10b981" strokeWidth="1.8" strokeDasharray="6 4" />
      <path d="M61 70 l7 -4 v8 Z" fill="#10b981" />
    </>
  );
}

const THUMBS: Record<ThumbKind, () => ReactElement> = {
  tiers: Tiers,
  flow: Flow,
  tree: Tree,
  class: ClassThumb,
  network: Network,
  swimlane: Swimlane,
  bpmn: Bpmn,
  gantt: Gantt,
  cards: Cards,
  sequence: Sequence,
};

export function TemplateThumb({ template }: { template: DiagramTemplate }) {
  const Kind = THUMBS[thumbKindFor(template)];
  return (
    <svg
      viewBox="0 0 290 112"
      className="w-full h-28 rounded-md border border-gray-100 bg-gradient-to-b from-slate-50 to-white"
      role="img"
      aria-label={`${template.name} preview`}
    >
      <Kind />
    </svg>
  );
}
