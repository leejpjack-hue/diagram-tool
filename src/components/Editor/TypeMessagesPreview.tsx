import { useEffect, useMemo, useState } from 'react';
import { typeMessagesPreviewRows } from '../../parser/plainSequence';

/** Same debounce cap as Type steps: the list updates within 150 ms of input. */
const PREVIEW_DEBOUNCE_MS = 100;

export function TypeMessagesPreview({
  text,
  onFocusLine,
}: {
  text: string;
  onFocusLine: (lineIndex: number) => void;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(text), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text]);

  const rows = useMemo(() => typeMessagesPreviewRows(shown), [shown]);
  const warnings = rows.reduce((count, row) => count + (row.warning ? 1 : 0), 0);
  const lineWord = rows.length === 1 ? 'line' : 'lines';
  const warningWord = warnings === 1 ? 'warning' : 'warnings';

  return (
    <div data-testid="type-messages-preview" className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-indigo-700">Understood as</p>
        <p data-testid="type-messages-preview-summary" aria-live="polite" className="text-[11px] text-slate-500">
          {rows.length} {lineWord}, {warnings} {warningWord}
        </p>
      </div>
      <ul aria-label="Understood as" className="mt-1 space-y-1">
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
    </div>
  );
}
