import { useEffect, useRef, useState } from 'react';
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
  arrivedBy?: string; // DT-AI-18: `If “<source>”: <label>` when this step was reached via a labelled branch edge
  paths?: string; // DT-AI-18: `Yes → Retry once · No → Flag for review` when this step has 2+ outgoing edges
  choices?: { label: string }[]; // DT-AI-19: one choose button per outgoing edge, board edge order (2+ edges only)
  onChoose?: (index: number) => void; // DT-AI-19: jump the walk to the chosen branch target
  pathText?: string; // DT-AI-22: numbered session-path labels for Copy path (undefined on non-flow boards)
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
export function WalkThroughOverlay({ step, total, label, role, note, arrivedBy, paths, choices, onChoose, pathText, onPrev, onNext, onExit }: WalkThroughOverlayProps) {
  // DT-AI-22 — Copy path: writes the session path text to the clipboard and
  // briefly flips the label to "Copied". Failures are swallowed (silent), and
  // any pending reset timer is cleared on unmount.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);
  const handleCopyPath = () => {
    if (!pathText) return;
    navigator.clipboard
      .writeText(pathText)
      .then(() => {
        setCopied(true);
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => {
          setCopied(false);
          copyTimerRef.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard blocked → stay silent on the board, no throw.
      });
  };

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
        {note || arrivedBy || paths ? (
          <span className="flex flex-col items-start">
            {caption}
            {note ? (
              <span data-testid="walk-through-note" className="text-[11px] font-normal text-slate-500">
                {note}
              </span>
            ) : null}
            {arrivedBy ? (
              <span
                data-testid="walk-through-from"
                title={arrivedBy}
                className="max-w-[280px] truncate text-[11px] font-normal text-slate-500"
              >
                {arrivedBy}
              </span>
            ) : null}
            {paths ? (
              <span
                data-testid="walk-through-paths"
                title={paths}
                className="max-w-[280px] truncate text-[11px] font-normal text-slate-500"
              >
                {paths}
              </span>
            ) : null}
            {choices && choices.length >= 2 && onChoose ? (
              <span data-testid="walk-through-choose" className="mt-0.5 flex flex-wrap items-center gap-1">
                {choices.map((choice, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`walk-through-choose-${i}`}
                    title={choice.label}
                    onClick={() => onChoose(i)}
                    className="max-w-[160px] truncate rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
                  >
                    {choice.label}
                  </button>
                ))}
              </span>
            ) : null}
          </span>
        ) : caption}
        <span className="w-px h-4 bg-slate-200" />
        <button
          type="button"
          data-testid="walk-through-copy-path"
          onClick={handleCopyPath}
          disabled={!pathText}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Copy path'}
        </button>
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
