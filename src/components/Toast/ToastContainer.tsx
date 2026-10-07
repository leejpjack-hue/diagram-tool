import { useEffect, useRef, useState } from 'react';
import type { Toast, ToastType } from '../../utils/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  // DT-AI-16: top-20 keeps the stack below the 64px sticky header
  // (z-index 100) so toast buttons receive clicks and focus.
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const styles: Record<ToastType, string> = {
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    warning: 'bg-yellow-500 border-yellow-600',
    info: 'bg-blue-500 border-blue-600',
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  // DT-AI-16: toasts with an action pause auto-dismiss while the pointer or
  // keyboard focus is on the toast; the remaining time carries over on resume.
  // Toasts without an action keep the original set-it-and-forget timing.
  const hasAction = Boolean(toast.action);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration ?? 0);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    if (hasAction && paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onRemove(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [toast.id, toast.duration, hasAction, paused, onRemove]);

  const holdDismissal = hasAction ? () => setPaused(true) : undefined;
  const releaseDismissal = hasAction ? () => setPaused(false) : undefined;

  return (
    <div
      className={`
        ${styles[toast.type]}
        text-white px-4 py-3 rounded-lg shadow-lg
        border-l-4 flex items-start gap-3
        animate-slide-in-right
      `}
      data-testid="toast-item"
      onMouseEnter={holdDismissal}
      onMouseLeave={releaseDismissal}
      onFocusCapture={holdDismissal}
      onBlurCapture={releaseDismissal}
    >
      <span className="text-lg font-bold flex-shrink-0">
        {icons[toast.type]}
      </span>
      <div className="flex-1 text-sm font-medium">
        {toast.message}
        {toast.action && (
          <button
            type="button"
            data-testid="toast-action"
            onClick={() => {
              onRemove(toast.id);
              toast.action!.onSelect();
            }}
            className="ml-2 rounded border border-white/70 bg-white/15 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-white hover:text-gray-200 flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}
