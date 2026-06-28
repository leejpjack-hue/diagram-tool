import { useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';

// Shape library: a collapsible palette floating over the canvas. Clicking a
// shape appends a ready-made DSL block (the source of truth) and re-parses,
// so the new node appears on the canvas and in the editor at once.

interface ShapeDef {
  label: string;
  glyph: string; // small emoji/char preview
  accent: string;
  // Builds the DSL block for a fresh node with the given unique name.
  dsl: (name: string) => string;
}

const ARCHITECTURE_SHAPES: ShapeDef[] = [
  { label: 'Service', glyph: '⚙️', accent: '#8b5cf6', dsl: n => `service ${n} {\n  type: microservice\n  tech: "Edit me"\n}` },
  { label: 'API', glyph: '⚡', accent: '#3b82f6', dsl: n => `service ${n} {\n  type: api\n  tech: "Edit me"\n}` },
  { label: 'Database', glyph: '🗄️', accent: '#ec4899', dsl: n => `database ${n} {\n  type: postgresql\n}` },
  { label: 'Queue', glyph: '📨', accent: '#10b981', dsl: n => `queue ${n} {\n  type: kafka\n}` },
  { label: 'Cloud', glyph: '☁️', accent: '#f59e0b', dsl: n => `cloud ${n} {\n  provider: aws\n  kind: lambda\n}` },
  { label: 'Class', glyph: '📦', accent: '#0d9488', dsl: n => `class ${n} {\n  attributes: id: int\n  methods: run(): void\n}` },
  { label: 'Card', glyph: '✨', accent: '#6366f1', dsl: n => `service ${n} {\n  icon: "✨"\n  color: "#6366f1"\n  tech: "Edit me"\n}` },
  // Sticky-note annotation — call out a risk, decision, or piece of context.
  { label: 'Note', glyph: '📝', accent: '#fbbf24', dsl: n => `note "${n.replace(/^NewNote/, 'Add a note…')}" {\n  color: "#fbbf24"\n}` },
];

const FLOW_SHAPES: ShapeDef[] = [
  { label: 'Process', glyph: '▭', accent: '#3b82f6', dsl: n => `node ${n} {\n  label: ${n}\n}` },
  { label: 'Decision', glyph: '◇', accent: '#f59e0b', dsl: n => `node ${n} {\n  type: decision\n  label: ${n}?\n}` },
  { label: 'Data', glyph: '▱', accent: '#3b82f6', dsl: n => `node ${n} {\n  type: data\n  label: ${n}\n}` },
  { label: 'Document', glyph: '🗎', accent: '#3b82f6', dsl: n => `node ${n} {\n  type: document\n  label: ${n}\n}` },
  { label: 'Manual input', glyph: '⌨', accent: '#3b82f6', dsl: n => `node ${n} {\n  type: manualinput\n  label: ${n}\n}` },
  { label: 'Start event', glyph: '○', accent: '#10b981', dsl: n => `node ${n} {\n  type: eventstart\n  label: ${n}\n}` },
  { label: 'End event', glyph: '◉', accent: '#ef4444', dsl: n => `node ${n} {\n  type: eventend\n  label: ${n}\n}` },
  { label: 'XOR gateway', glyph: '✕', accent: '#f59e0b', dsl: n => `node ${n} {\n  type: gatewayexclusive\n  label: ${n}?\n}` },
  { label: 'AND gateway', glyph: '✚', accent: '#f59e0b', dsl: n => `node ${n} {\n  type: gatewayparallel\n  label: ${n}\n}` },
  { label: 'Subprocess', glyph: '⊞', accent: '#8b5cf6', dsl: n => `node ${n} {\n  type: subprocesscollapsed\n  label: ${n}\n}` },
];

// Find a name like Step2 that doesn't appear in the DSL yet.
function uniqueName(dsl: string, base: string): string {
  const clean = base.replace(/[^A-Za-z0-9]/g, '');
  if (!new RegExp(`\\b${clean}\\b`).test(dsl)) return clean;
  for (let i = 2; i < 100; i++) {
    if (!new RegExp(`\\b${clean}${i}\\b`).test(dsl)) return `${clean}${i}`;
  }
  return `${clean}${Date.now() % 1000}`;
}

export function ShapeLibrary() {
  const { dslText, setDslText, setParsedDiagram, diagramMode } = useDiagramStore();
  const [open, setOpen] = useState(false);

  if (diagramMode === 'gantt') return null;
  const shapes = diagramMode === 'flow' ? FLOW_SHAPES : ARCHITECTURE_SHAPES;

  const insert = (shape: ShapeDef) => {
    const name = uniqueName(dslText, `New${shape.label}`);
    const next = `${dslText.replace(/\s+$/, '')}\n\n${shape.dsl(name)}\n`;
    setDslText(next);
    try {
      setParsedDiagram(parseDiagram(next));
    } catch (err) {
      console.error('Shape insert parse error:', err);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
        title={open ? 'Hide the shape library' : 'Add shapes to the canvas'}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <circle cx="17.5" cy="6.5" r="3.5" />
          <path d="M17.5 13.5 L21 20 H14 Z" strokeLinejoin="round" />
          <rect x="3" y="14" width="7" height="7" rx="3.5" />
        </svg>
        Shapes
      </button>

      {open && (
        <div className="mt-2 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-slate-200 p-2 w-44">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 px-1 pb-1.5">
            Click to add
          </div>
          <div className="grid grid-cols-2 gap-1">
            {shapes.map(s => (
              <button
                key={s.label}
                onClick={() => insert(s)}
                className="flex flex-col items-center gap-1 rounded-md border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors px-1.5 py-2"
                title={`Add a ${s.label.toLowerCase()} to the diagram`}
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm"
                  style={{ background: s.accent }}
                >
                  {s.glyph}
                </span>
                <span className="text-[10px] font-medium text-slate-600 leading-tight text-center">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
