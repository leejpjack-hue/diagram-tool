import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// DT-AI-16: an optional in-toast action (e.g. Walk through on the Build
// success toast). `onSelect` runs after the toast is dismissed.
export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
}

const TOAST_DURATION = 3000; // 3 seconds

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration?: number, action?: ToastAction) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const toast: Toast = {
      id,
      type,
      message,
      duration: duration || TOAST_DURATION,
      action,
    };

    setToasts(prev => [...prev, toast]);

    // Auto-remove after duration. Toasts with an action manage their own
    // dismiss timer in ToastItem so pointer/keyboard focus on the toast can
    // pause it; other toasts keep the original set-it-and-forget timing.
    if (toast.duration && toast.duration > 0 && !toast.action) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration);
    }

    return id;
  }, []);

  const success = useCallback((message: string, duration?: number, action?: ToastAction) => {
    return addToast('success', message, duration, action);
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    return addToast('error', message, duration || 5000); // Errors stay longer
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return addToast('warning', message, duration);
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    return addToast('info', message, duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
