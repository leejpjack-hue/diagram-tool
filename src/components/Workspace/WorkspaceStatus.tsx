import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OFFLINE_BANNER_TEXT = 'offline — changes on this device.';
export const WORKSPACE_UNAVAILABLE_TITLE = 'Local workspace unavailable';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      {OFFLINE_BANNER_TEXT}
    </div>
  );
}

export function WorkspaceErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="workspace-error-banner"
      className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
      </svg>
      <div>
        <div className="font-semibold">{WORKSPACE_UNAVAILABLE_TITLE}</div>
        <div>{message}</div>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
