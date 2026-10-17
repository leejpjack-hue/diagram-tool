import { useEffect, useMemo, useState } from 'react';
import { StyleIcon } from '../Canvas/icons/styles/StyleIcon';
import { resolveFace, resolveIconStyle, type IconStyleId } from '../Canvas/iconStyles';
import { useDiagramStore } from '../../store/diagramStore';
import {
  typeStepsPreviewRows,
  typeStepsPreviewSummary,
  type PreviewKind,
  type TypeStepsPreviewRow,
} from '../../parser/typeStepsPreview';
import type { PlainStepRole } from '../../parser/plainSteps';

/** Debounce cap from DT-AI-28: the list updates within 150 ms of input. */
const PREVIEW_DEBOUNCE_MS = 100;
const PREVIEW_OPEN_KEY = 'diagram-tool-type-steps-preview-open';
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

function IconBadge({
  iconStyle,
  role,
  nodeType,
}: {
  iconStyle: IconStyleId;
  role?: PlainStepRole;
  nodeType?: string;
}) {
  const face = resolveFace(iconStyle, { role, nodeType });
  const onFill = iconStyle === 'bold';
  const onBlueprint = iconStyle === 'blueprint';
  return (
    <span
      data-testid="type-steps-preview-icon"
      data-icon-style={iconStyle}
      data-icon-name={face.icon}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: onBlueprint ? 2 : 4,
        background: onFill ? face.color : onBlueprint ? face.canvas : 'transparent',
        flexShrink: 0,
      }}
    >
      <StyleIcon
        name={face.icon}
        size={14}
        strokeWidth={face.iconStroke}
        filled={onFill}
        color={onFill ? '#ffffff' : face.color}
        role={role}
        kind={face.kind}
        decorative
      />
    </span>
  );
}

function RoleMark({ role, iconStyle }: { role: PlainStepRole; iconStyle: IconStyleId }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-700">
      <IconBadge role={role} iconStyle={iconStyle} />
      <span data-testid="type-steps-preview-role">{role}</span>
    </span>
  );
}

function KindMark({ kind, iconStyle }: { kind: PreviewKind; iconStyle: IconStyleId }) {
  const nodeType = kind === 'decision' ? 'decision' : kind === 'data' ? 'data' : undefined;
  return <IconBadge iconStyle={iconStyle} nodeType={nodeType} />;
}

function RowBody({ row, iconStyle }: { row: TypeStepsPreviewRow; iconStyle: IconStyleId }) {
  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-2">
        {row.roles.length > 0
          ? row.roles.map(role => <RoleMark key={role} role={role} iconStyle={iconStyle} />)
          : <KindMark kind={row.kind} iconStyle={iconStyle} />}
        <span
          data-testid="type-steps-preview-kind"
          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600"
        >
          {row.kindTag}
        </span>
      </span>
      <span data-testid="type-steps-preview-label" className="text-slate-800">{row.label}</span>
      {row.note && (
        <span data-testid="type-steps-preview-note" className="text-slate-500">{row.note}</span>
      )}
      {row.warning && (
        <span data-testid="type-steps-preview-warning" className="text-amber-800">{row.warning}</span>
      )}
    </>
  );
}

export function TypeStepsPreview({
  text,
  onFocusLine,
}: {
  text: string;
  onFocusLine: (lineIndex: number) => void;
}) {
  const iconStyle = resolveIconStyle(useDiagramStore(s => s.iconStyle));
  const narrow = useNarrowPreview();
  const [remembered, setRemembered] = useState<boolean | null>(storedOpen);
  const open = remembered ?? !narrow;
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(text), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text]);

  const rows = useMemo(() => typeStepsPreviewRows(shown), [shown]);
  const summary = typeStepsPreviewSummary(rows);

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
    <div data-testid="type-steps-preview" className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="type-steps-preview-toggle"
          aria-expanded={open}
          aria-controls="type-steps-preview-list"
          onClick={toggle}
          className="text-[11px] font-semibold text-indigo-700"
        >
          {open ? '▾' : '▸'} Understood as
        </button>
        <p data-testid="type-steps-preview-summary" aria-live="polite" className="text-[11px] text-slate-500">
          {summary}
        </p>
      </div>
      {open && (
        <ul id="type-steps-preview-list" aria-label="Understood as" className="mt-1 space-y-1">
          {rows.map(row => {
            const className = 'flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded px-1 py-0.5 text-left text-[11px]';
            if (row.warning) {
              return (
                <li key={row.lineIndex}>
                  <button
                    type="button"
                    data-testid="type-steps-preview-row"
                    data-kind={row.kind}
                    data-warning="true"
                    onClick={() => onFocusLine(row.lineIndex)}
                    className={`${className} hover:bg-amber-50`}
                  >
                    <RowBody row={row} iconStyle={iconStyle} />
                  </button>
                </li>
              );
            }
            return (
              <li
                key={row.lineIndex}
                data-testid="type-steps-preview-row"
                data-kind={row.kind}
                className={className}
              >
                <RowBody row={row} iconStyle={iconStyle} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
