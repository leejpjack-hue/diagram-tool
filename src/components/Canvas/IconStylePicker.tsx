import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDiagramStore } from '../../store/diagramStore';
import {
  ICON_STYLE_IDS,
  ICON_STYLES,
  type IconStyleId,
  type StyleNodeKind,
} from './iconStyles';
import { StyleIcon } from './icons/styles/StyleIcon';

const PREVIEW: StyleNodeKind[] = ['agent', 'tool', 'human'];

/**
 * Flow-only Style menu. Hidden by the parent on other board types, and hidden
 * here while a share link is read-only.
 */
export function IconStylePicker() {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  const setIconStyle = useDiagramStore(s => s.setIconStyle);
  const readOnly = useDiagramStore(s => s.isReadOnlyShared);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const listId = useId();

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 280;
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
      setBox({ top: rect.bottom + 6, left });
    };
    place();
    const index = Math.max(0, ICON_STYLE_IDS.indexOf(iconStyle));
    optionRefs.current[index]?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open, iconStyle]);

  if (readOnly) return null;

  const onOptionKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (index + 1) % ICON_STYLE_IDS.length;
      optionRefs.current[next]?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (index - 1 + ICON_STYLE_IDS.length) % ICON_STYLE_IDS.length;
      optionRefs.current[next]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      optionRefs.current[ICON_STYLE_IDS.length - 1]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIconStyle(ICON_STYLE_IDS[index]);
      close(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="icon-style-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={`Style: ${ICON_STYLES[iconStyle].name}`}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
      >
        Style
      </button>
      {open && box && createPortal(
        <div
          ref={popoverRef}
          id={listId}
          role="listbox"
          aria-label="Diagram style"
          data-testid="icon-style-menu"
          style={{ position: 'fixed', top: box.top, left: box.left, width: 280, zIndex: 80 }}
          className="rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {ICON_STYLE_IDS.map((id, index) => (
            <button
              key={id}
              ref={el => { optionRefs.current[index] = el; }}
              type="button"
              role="option"
              data-testid={`icon-style-option-${id}`}
              aria-checked={iconStyle === id}
              onClick={() => {
                setIconStyle(id);
                close(true);
              }}
              onKeyDown={event => onOptionKey(event, index)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <StylePreview id={id} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-slate-900">{ICON_STYLES[id].name}</span>
              </span>
              {iconStyle === id && <span aria-hidden className="text-[11px] font-semibold text-indigo-700">On</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

function StylePreview({ id }: { id: IconStyleId }) {
  const tokens = ICON_STYLES[id];
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-1 rounded px-1 py-1"
      style={{ background: tokens.pane }}
    >
      {PREVIEW.map(kind => {
        const type = tokens.types[kind];
        const solid = tokens.shape.fill === 'solid';
        const blueprint = tokens.shape.fill === 'canvas';
        return (
          <span
            key={kind}
            className="inline-flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              borderRadius: blueprint ? 2 : 4,
              background: solid ? type.color : blueprint ? tokens.canvas : '#ffffff',
              border: solid ? 'none' : `1px solid ${blueprint ? type.color : '#cbd5e1'}`,
              color: tokens.icon.color === 'white' ? '#ffffff' : type.color,
            }}
          >
            {tokens.icon.show ? (
              <StyleIcon
                name={type.icon}
                size={12}
                strokeWidth={1.5}
                filled={tokens.icon.filled}
                markColor={solid ? type.color : undefined}
                decorative
              />
            ) : (
              <span style={{ width: 6, height: 6, borderRadius: 99, background: type.color }} />
            )}
          </span>
        );
      })}
    </span>
  );
}
