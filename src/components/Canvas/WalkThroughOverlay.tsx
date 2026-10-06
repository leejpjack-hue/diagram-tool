import { useEffect } from 'react';
import { Panel } from '@xyflow/react';
import type { FlowNodeRole } from '../../store/types';

const ROLE_WORD: Record<FlowNodeRole, string> = {
  human: 'Human',
  model: 'Model',
  tool: 'Tool',
  check: 'Check',
};

interface WalkThroughOverlayProps {
  step: number; // 1-based
  total: number;
  label: string;
  role?: FlowNodeRole;
  note?: string; // DT-AI-15: optional why-note, shown under the caption
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

/**
 * DT-AI-14 — read-only walk-through caption and controls, rendered as a React
 * Flow panel over the board. Prev/Next move one step; Esc exits. Left/Right
 * arrow keys are handled here while walk-through is active (same input-guard
 * pattern as the canvas F2 handler). Purely view state — nothing is edited.
 */
export function WalkThroughOverlay({ step, total, label, role, note, onPrev, onNext, onExit }: WalkThroughOverlayProps) {
  // Caption kept as one span so steps without a note render exactly as
  // DT-AI-14 did; the note only wraps it in a column when present.
  const caption = (
    <span data-testid="walk-through-caption" className="text-xs font-semibold text-slate-800">
      Step {step} of {total}
      {role && ROLE_WORD[role] ? (
        <span data-testid="walk-through-role" className="ml-1 text-indigo-600">· {ROLE_WORD[role]}</span>
      ) : null}
      <span className="ml-1 font-normal text-slate-600">— {label}</span>
    </span>
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrev, onExit]);

  return (
    <Panel position="top-center" className="!m-3">
      <div
        data-testid="walk-through-overlay"
        className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur"
      >
        {note ? (
          <span className="flex flex-col items-start">
            {caption}
            <span data-testid="walk-through-note" className="text-[11px] font-normal text-slate-500">
              {note}
            </span>
          </span>
        ) : caption}
        <span className="w-px h-4 bg-slate-200" />
        <button
          type="button"
          data-testid="walk-through-prev"
          onClick={onPrev}
          disabled={step <= 1}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          data-testid="walk-through-next"
          onClick={onNext}
          disabled={step >= total}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
        <button
          type="button"
          data-testid="walk-through-exit"
          onClick={onExit}
          className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
        >
          Exit
        </button>
        <span className="text-[10px] text-slate-400">←/→ keys · Esc to exit</span>
      </div>
    </Panel>
  );
}
