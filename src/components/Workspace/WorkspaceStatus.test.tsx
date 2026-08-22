import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner, OFFLINE_BANNER_TEXT, WORKSPACE_UNAVAILABLE_TITLE, WorkspaceErrorBanner } from './WorkspaceStatus';

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online });
}

afterEach(() => {
  setNavigatorOnline(true);
  vi.restoreAllMocks();
});

describe('OfflineBanner', () => {
  it('shows the airplane-mode copy when navigator.onLine is false', () => {
    setNavigatorOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(OFFLINE_BANNER_TEXT);
  });

  it('stays hidden while the browser is online', () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('appears when the window fires an offline event', () => {
    setNavigatorOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    setNavigatorOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(OFFLINE_BANNER_TEXT)).toBeInTheDocument();
  });
});

describe('WorkspaceErrorBanner', () => {
  it('shows the recovery path instead of a blank workspace', () => {
    const onRetry = vi.fn();
    render(
      <WorkspaceErrorBanner
        message="This browser is out of storage for local boards. Export a backup or clear old automatic saves, then try again."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('workspace-error-banner')).toHaveTextContent(WORKSPACE_UNAVAILABLE_TITLE);
    expect(screen.getByText(/out of storage/i)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
