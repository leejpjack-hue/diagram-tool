import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { WORKSPACE_UNAVAILABLE_TITLE } from '../Workspace/WorkspaceStatus';
import type { Board } from '../../utils/boardManager';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  listSpaces: vi.fn(),
  listTemplates: vi.fn(),
  listActivity: vi.fn(),
  getPreferences: vi.fn(),
  getStorageUsage: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  markOpened: vi.fn(),
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
      markOpened: mocks.markOpened,
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
  mocks.markOpened.mockReset();
  mocks.markOpened.mockImplementation(async (id: string) => {
    const boards = await mocks.list() as Board[];
    return boards.find(board => board.id === id) ?? null;
  });
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

  it('lists a skill-authored board on Home with an editable-text mark', async () => {
    const authored: Board = {
      id: 'skill-intake',
      title: 'Intake',
      description: '',
      mode: 'flow',
      dslText: 'diagram: flow\ntitle: Intake\nstart FNOL\n',
      createdAt: '2026-11-27T00:00:00.000Z',
      updatedAt: '2026-11-27T00:00:00.000Z',
      lastOpenedAt: '2026-11-27T00:00:00.000Z',
      tags: [],
      starred: false,
      schemaVersion: 2,
      skillAuthored: true,
    };
    const plain: Board = { ...authored, id: 'plain', title: 'Notes', skillAuthored: undefined };
    mocks.list.mockResolvedValue([authored, plain]);

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Intake' })).toBeInTheDocument();
    expect(screen.getAllByTestId('skill-authored-mark').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('skill-authored-mark')[0]).toHaveTextContent('Written by a skill, editable as text');
    const notes = screen.getByRole('heading', { name: 'Notes' }).closest('article');
    const intake = screen.getByRole('heading', { name: 'Intake' }).closest('article');
    expect(notes).toBeTruthy();
    expect(intake).toBeTruthy();
    expect(notes).not.toHaveTextContent('Written by a skill, editable as text');
    expect(within(notes as HTMLElement).getByTestId('human-authored-mark')).toHaveTextContent('Written by a human');
    expect(within(intake as HTMLElement).queryByTestId('human-authored-mark')).not.toBeInTheDocument();
    expect(within(notes as HTMLElement).getByTestId('board-last-edited')).toHaveTextContent(/^Edited /);
    expect(within(notes as HTMLElement).getByTestId('board-last-edited')).toHaveAttribute('datetime', authored.updatedAt);
    expect(within(intake as HTMLElement).getByTestId('board-last-edited')).toHaveAttribute('datetime', authored.updatedAt);
    expect(within(notes as HTMLElement).getByRole('button', { name: 'Open as text' })).toBeInTheDocument();
    expect(within(intake as HTMLElement).getByRole('button', { name: 'Open as text' })).toBeInTheDocument();
  });

  it('opens a human-typed board and a skill board as text from Home', async () => {
    const authored: Board = {
      id: 'skill-intake',
      title: 'Intake',
      description: '',
      mode: 'flow',
      dslText: 'diagram: flow\ntitle: Intake\nstart FNOL\n',
      createdAt: '2026-11-27T00:00:00.000Z',
      updatedAt: '2026-11-26T12:00:00.000Z',
      lastOpenedAt: '2026-11-27T00:00:00.000Z',
      tags: [],
      starred: false,
      schemaVersion: 2,
      skillAuthored: true,
    };
    const plain: Board = { ...authored, id: 'plain', title: 'Notes', skillAuthored: undefined, updatedAt: '2026-11-25T08:00:00.000Z' };
    mocks.list.mockResolvedValue([authored, plain]);
    const onOpenAsText = vi.fn();
    render(
      <Dashboard onOpen={vi.fn()} onOpenAsText={onOpenAsText} onCreate={vi.fn()} onPublish={vi.fn()} notify={vi.fn()} />,
    );

    const notes = (await screen.findByRole('heading', { name: 'Notes' })).closest('article') as HTMLElement;
    const intake = screen.getByRole('heading', { name: 'Intake' }).closest('article') as HTMLElement;
    fireEvent.click(within(notes).getByRole('button', { name: 'Open as text' }));
    fireEvent.click(within(intake).getByRole('button', { name: 'Open as text' }));

    await waitFor(() => {
      expect(onOpenAsText).toHaveBeenCalledWith(expect.objectContaining({ id: 'plain', title: 'Notes', skillAuthored: undefined }));
      expect(onOpenAsText).toHaveBeenCalledWith(expect.objectContaining({ id: 'skill-intake', title: 'Intake', skillAuthored: true }));
    });
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

  it('offers the typed AI workflow starter on Home alongside blank and workshop cards (#137)', async () => {
    mocks.list.mockResolvedValue([]);
    const onCreate = vi.fn();
    render(
      <Dashboard onOpen={vi.fn()} onCreate={onCreate} onPublish={vi.fn()} notify={vi.fn()} />,
    );

    const starterCard = await screen.findByTestId('template-card-flow-ai-workflow');
    expect(starterCard).toHaveTextContent('AI workflow');
    expect(starterCard).toHaveTextContent('Plain-words AI pipeline — Human ask, Model, Tool, Check, Reply');
    expect(screen.getByRole('button', { name: /Blank Workflow/i })).toBeInTheDocument();
    expect(screen.getByTestId('template-card-workshop-retro')).toBeInTheDocument();

    fireEvent.click(starterCard);
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'flow',
          title: 'AI workflow',
          templateSourceId: 'flow-ai-workflow',
          dslText: expect.stringContaining('diagram: flow'),
        }),
      );
    });
  });

  it('starts a blank Home workflow as typed steps (#151)', async () => {
    mocks.list.mockResolvedValue([]);
    const onCreate = vi.fn();
    render(
      <Dashboard onOpen={vi.fn()} onCreate={onCreate} onPublish={vi.fn()} notify={vi.fn()} />,
    );

    const blankFlow = await screen.findByTestId('home-blank-flow');
    expect(blankFlow).toHaveTextContent('Type the steps');
    fireEvent.click(blankFlow);
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'flow', asText: true }),
      );
    });
    expect(onCreate.mock.calls[0][0].dslText).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: /Blank Architecture/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(2);
    });
    expect(onCreate.mock.calls[1][0]).toEqual(expect.objectContaining({ mode: 'architecture' }));
    expect(onCreate.mock.calls[1][0].asText).toBeUndefined();
  });
});
