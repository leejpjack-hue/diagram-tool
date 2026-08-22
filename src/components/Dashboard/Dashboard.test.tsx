import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { WORKSPACE_UNAVAILABLE_TITLE } from '../Workspace/WorkspaceStatus';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  listSpaces: vi.fn(),
  listTemplates: vi.fn(),
  listActivity: vi.fn(),
  getPreferences: vi.fn(),
  getStorageUsage: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('../../utils/boardManager', async importOriginal => {
  const actual = await importOriginal<typeof import('../../utils/boardManager')>();
  return {
    ...actual,
    boardManager: {
      list: mocks.list,
      listSpaces: mocks.listSpaces,
      listTemplates: mocks.listTemplates,
      listActivity: mocks.listActivity,
      getPreferences: mocks.getPreferences,
      getStorageUsage: mocks.getStorageUsage,
      subscribe: mocks.subscribe,
    },
  };
});

function renderDashboard() {
  return render(
    <Dashboard onOpen={vi.fn()} onCreate={vi.fn()} onPublish={vi.fn()} notify={vi.fn()} />,
  );
}

beforeEach(() => {
  mocks.list.mockReset();
  mocks.listSpaces.mockResolvedValue([]);
  mocks.listTemplates.mockResolvedValue([]);
  mocks.listActivity.mockResolvedValue([]);
  mocks.getPreferences.mockResolvedValue({
    id: 'dashboard',
    layout: 'grid',
    density: 'comfortable',
    sort: 'lastOpened',
    sidebarCollapsed: false,
  });
  mocks.getStorageUsage.mockResolvedValue({ usage: 0, quota: 0 });
  mocks.subscribe.mockReturnValue(() => {});
});

describe('Dashboard workspace recovery', () => {
  it('shows Local workspace unavailable on IndexedDB quota failure, not a blank board', async () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    mocks.list.mockRejectedValue(quota);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('workspace-error-banner')).toHaveTextContent(WORKSPACE_UNAVAILABLE_TITLE);
    });
    expect(screen.getByText(/out of storage for local boards/i)).toBeInTheDocument();
    expect(screen.getByText('Your boards could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No boards here yet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBeGreaterThan(0);
  });

  it('shows Local workspace unavailable when IndexedDB cannot be opened', async () => {
    mocks.list.mockRejectedValue(new Error('Unable to open local workspace storage.'));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('workspace-error-banner')).toHaveTextContent(WORKSPACE_UNAVAILABLE_TITLE);
    });
    expect(screen.getByText('Unable to open local workspace storage.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Untitled/ })).not.toBeInTheDocument();
  });
});
