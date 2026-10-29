import { useEffect, useMemo, useState } from 'react';
import { typeMessagesPreviewRows } from '../../parser/plainSequence';

/** Same debounce cap as Type steps: the list updates within 150 ms of input. */
const PREVIEW_DEBOUNCE_MS = 100;
const PREVIEW_OPEN_KEY = 'diagram-tool-type-messages-preview-open';
const NARROW_QUERY = '(max-width: 640px)';

function storedOpen(): boolean | null {
  try {
    const value = localStorage.getItem(PREVIEW_OPEN_KEY);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // Private mode: follow the viewport default.
  }
  return null;
}

function viewportIsNarrow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

function useNarrowPreview(): boolean {
  const [narrow, setNarrow] = useState(viewportIsNarrow);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(NARROW_QUERY);
    const listener = () => setNarrow(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  return narrow;
}

export function TypeMessagesPreview({
  text,
  onFocusLine,
}: {
  text: string;
  onFocusLine: (lineIndex: number) => void;
}) {
  const narrow = useNarrowPreview();
  const [remembered, setRemembered] = useState<boolean | null>(storedOpen);
  const open = remembered ?? !narrow;
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(text), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text]);

  const rows = useMemo(() => typeMessagesPreviewRows(shown), [shown]);
  const warnings = rows.reduce((count, row) => count + (row.warning ? 1 : 0), 0);
  const lineWord = rows.length === 1 ? 'line' : 'lines';
  const warningWord = warnings === 1 ? 'warning' : 'warnings';

  const toggle = () => {
    const next = !open;
    setRemembered(next);
    try {
      localStorage.setItem(PREVIEW_OPEN_KEY, next ? '1' : '0');
    } catch {
      // The in-memory choice still applies for this visit.
    }
  };

  return (
    <div data-testid="type-messages-preview" className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="type-messages-preview-toggle"
          aria-expanded={open}
          aria-controls="type-messages-preview-list"
          onClick={toggle}
          className="text-[11px] font-semibold text-indigo-700"
        >
          {open ? '▾' : '▸'} Understood as
        </button>
        <p data-testid="type-messages-preview-summary" aria-live="polite" className="text-[11px] text-slate-500">
          {rows.length} {lineWord}, {warnings} {warningWord}
        </p>
      </div>
      {open && rows.length === 0 && (
        <p data-testid="type-messages-preview-empty" className="mt-1 text-[11px] text-slate-500">
          No messages typed yet. Type one message per line, e.g. User asks Agent: plan my trip. The board stays as it is until Build board.
        </p>
      )}
      {open && (
        <ul id="type-messages-preview-list" aria-label="Understood as" className="mt-1 space-y-1">
          {rows.map(row => {
            const className = 'flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-[11px]';
            const body = (
              <>
                <span data-testid="type-messages-preview-summary-line" className="text-slate-800">{row.summary}</span>
                {row.warning && (
                  <span data-testid="type-messages-preview-warning" className="text-amber-800">{row.warning}</span>
                )}
              </>
            );
            if (row.warning) {
              return (
                <li key={row.lineIndex}>
                  <button
                    type="button"
                    data-testid="type-messages-preview-row"
                    data-warning="true"
                    onClick={() => onFocusLine(row.lineIndex)}
                    className={`${className} hover:bg-amber-50`}
                  >
                    {body}
                  </button>
                </li>
              );
            }
            return (
              <li
                key={row.lineIndex}
                data-testid="type-messages-preview-row"
                className={className}
              >
                {body}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
