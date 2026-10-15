import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileMenu } from './FileMenu';
import { CURSOR_MCP_FOLDER_SENTENCE, CURSOR_MCP_PRIVACY_SENTENCE, cursorMcpJsonSnippet } from '../../utils/cursorMcpSnippet';
import { OPEN_BOARD_FILE_ERRORS } from '../../utils/boardFile';
import { OPEN_FILE_ACCEPT, boardFileHandles } from '../../utils/fileSystemAccess';
import { buildBoardDocument } from '../../utils/boardFormat';
import {
  CLOUD_UNAVAILABLE_COPY,
  cloudBoardLinks,
  setSupabaseClientForTests,
  type SupabaseClientLike,
  type SupabaseSelectBuilder,
  type SupabaseUpdateBuilder,
} from '../../lib/supabase';

const downloadBoardJson = vi.hoisted(() => vi.fn());

vi.mock('../../utils/fileSystemAccess', async () => {
  const actual = await vi.importActual<typeof import('../../utils/fileSystemAccess')>('../../utils/fileSystemAccess');
  return { ...actual, downloadBoardJson, canUseFileSystemAccess: () => false };
});

vi.mock('../../utils/saveManager', () => ({
  saveManager: {
    getRecentDiagrams: () => [],
    hasUnsavedChanges: () => false,
    saveDiagram: vi.fn(),
    exportToFile: vi.fn(),
    importFromFile: vi.fn(),
    clearRecent: vi.fn(),
  },
}));

afterEach(() => {
  boardFileHandles.clear();
  downloadBoardJson.mockReset();
  setSupabaseClientForTests(undefined);
  cloudBoardLinks.clear();
});

describe('FileMenu', () => {
  it('closes on Escape', () => {
    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Demo\nservice API {}'}
        mode="architecture"
        onLoad={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByTestId('file-menu')).toBeVisible();
    expect(screen.getByText('New diagram')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open…' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save As…' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload from disk' })).toBeDisabled();
    expect(screen.getByText(/DIAGRAM_TOOL_DIR points at/)).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('file-menu')).not.toBeInTheDocument();
  });

  it('opens Connect Cursor with an mcp.json snippet and a nothing-is-uploaded sentence', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Demo\nservice API {}'}
        mode="architecture"
        onLoad={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByText('Connect Cursor'));

    expect(screen.getByTestId('connect-cursor-dialog')).toBeVisible();
    expect(screen.getByTestId('connect-cursor-privacy')).toHaveTextContent(CURSOR_MCP_PRIVACY_SENTENCE);
    expect(screen.getByTestId('connect-cursor-privacy')).toHaveTextContent(CURSOR_MCP_FOLDER_SENTENCE);
    expect(screen.getByTestId('connect-cursor-snippet')).toHaveTextContent('DIAGRAM_TOOL_DIR');
    expect(screen.getByTestId('connect-cursor-snippet').textContent).toBe(cursorMcpJsonSnippet());

    fireEvent.click(screen.getByTestId('connect-cursor-copy'));
    expect(writeText).toHaveBeenCalledWith(cursorMcpJsonSnippet());
  });

  it('File → Open accept lists JSON, Mermaid, native DSL, and draw.io', () => {
    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Demo\nservice API {}'}
        mode="architecture"
        onLoad={vi.fn()}
        onNew={vi.fn()}
      />,
    );
    expect(screen.getByTestId('open-board-file')).toHaveAttribute('accept', OPEN_FILE_ACCEPT);
    expect(OPEN_FILE_ACCEPT).toBe('.json,.board.json,.mmd,.mermaid,.txt,.dsl,.drawio,.xml');
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('button', { name: 'Open…' })).toHaveAttribute(
      'title',
      'JSON board, Mermaid, native DSL, or draw.io',
    );
    expect(screen.getByTestId('open-file-accept-copy')).toHaveTextContent(
      'JSON board, Mermaid, native DSL, or draw.io',
    );
  });

  it('invalid Open does not clobber the current board', async () => {
    const onOpenWorkspaceBoard = vi.fn();
    const notify = vi.fn();
    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Keep Me\nservice API {}'}
        mode="architecture"
        currentBoardId="board-keep"
        onLoad={vi.fn()}
        onNew={vi.fn()}
        onOpenWorkspaceBoard={onOpenWorkspaceBoard}
        notify={notify}
      />,
    );

    const input = screen.getByTestId('open-board-file');
    const file = new File(
      [JSON.stringify({ version: '3.0', kind: 'workspace', boards: [] })],
      'backup.boards.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith('error', expect.stringMatching(/workspace backup/i));
    });
    expect(onOpenWorkspaceBoard).not.toHaveBeenCalled();
  });

  it('unsupported Mermaid Open does not clobber the current board', async () => {
    const onOpenWorkspaceBoard = vi.fn();
    const notify = vi.fn();
    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Keep Me\nservice API {}'}
        mode="architecture"
        currentBoardId="board-keep"
        onLoad={vi.fn()}
        onNew={vi.fn()}
        onOpenWorkspaceBoard={onOpenWorkspaceBoard}
        notify={notify}
      />,
    );

    fireEvent.change(screen.getByTestId('open-board-file'), {
      target: {
        files: [new File(['erDiagram\n  CUSTOMER ||--o{ ORDER : places\n'], 'schema.mmd', { type: 'text/plain' })],
      },
    });

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith('error', OPEN_BOARD_FILE_ERRORS.unsupported);
    });
    expect(onOpenWorkspaceBoard).not.toHaveBeenCalled();
  });

  it('Save on a mermaid handle does not write JSON onto that file', async () => {
    const write = vi.fn();
    const close = vi.fn();
    const mermaidHandle = {
      name: 'checkout.mmd',
      getFile: async () => new File(['flowchart TD\nA-->B'], 'checkout.mmd'),
      createWritable: vi.fn(async () => ({ write, close })),
    };
    boardFileHandles.set('board-keep', mermaidHandle, 'source');

    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Keep Me\nservice API {}'}
        mode="architecture"
        currentBoardId="board-keep"
        onLoad={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => {
      expect(downloadBoardJson).toHaveBeenCalled();
    });
    const saved = downloadBoardJson.mock.calls[0]?.[0] as string;
    expect(JSON.parse(saved)).toMatchObject({ version: '3.0', kind: 'board' });
    expect(mermaidHandle.createWritable).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('shows Cloud save unavailable when env is unset and still allows local Save', async () => {
    setSupabaseClientForTests(null);
    const notify = vi.fn();

    render(
      <FileMenu
        currentDsl={'diagram: architecture\ntitle: Local Board\nservice API {}'}
        mode="architecture"
        onLoad={vi.fn()}
        onNew={vi.fn()}
        notify={notify}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByTestId('cloud-unavailable-status')).toHaveTextContent(CLOUD_UNAVAILABLE_COPY);

    // Local Save still works
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => {
      expect(downloadBoardJson).toHaveBeenCalled();
    });
  });

  it('signed-out Save to cloud prompts magic-link login and shows Check your email', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockClient: SupabaseClientLike = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithOtp,
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn() as unknown as SupabaseClientLike['from'],
      rpc: vi.fn(),
    };
    setSupabaseClientForTests(mockClient);

    render(
      <FileMenu
        currentDsl={'diagram: flow\ntitle: My Flow\nstart A\nA -> B\nend B'}
        mode="flow"
        onLoad={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByTestId('cloud-save-button'));

    // Login dialog opens instead of uploading
    expect(await screen.findByTestId('cloud-auth-dialog')).toBeVisible();
    expect(screen.getByText(/Sign in to save to cloud/i)).toBeVisible();

    fireEvent.change(screen.getByTestId('cloud-auth-email'), {
      target: { value: 'user@teqcon.uk' },
    });
    fireEvent.click(screen.getByTestId('cloud-auth-submit'));

    expect(await screen.findByTestId('cloud-auth-check-email')).toHaveTextContent(/Check your email/i);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'user@teqcon.uk',
      options: { emailRedirectTo: expect.stringMatching(/\/app\/$/) },
    });
  });

  it('signed-in Save, Load (with replace confirmation), and Share/Revoke work against Supabase', async () => {
    const savedDoc = buildBoardDocument({
      title: 'Cloud Loaded Board',
      mode: 'flow',
      dslText: 'diagram: flow\ntitle: Cloud Loaded Board\nstart S\nS -> E\nend E',
    });
    const upsertSpy = vi.fn();
    const updateSpy = vi.fn();
    const mockClient: SupabaseClientLike = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'u-1', email: 'jack@teqcon.uk' } } },
          error: null,
        }),
        signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => {
          const chain: SupabaseSelectBuilder = {
            eq: () => chain,
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'cloud-row-1',
                  title: 'Cloud Loaded Board',
                  updated_at: '2026-10-15T12:00:00.000Z',
                  share_token: null,
                },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'cloud-row-1',
                user_id: 'u-1',
                title: 'Cloud Loaded Board',
                payload: savedDoc,
                share_token: null,
                updated_at: '2026-10-15T12:00:00.000Z',
              },
              error: null,
            }),
          };
          return chain;
        }),
        upsert: (values: Record<string, unknown>) => {
          upsertSpy(values);
          return {
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'cloud-row-1',
                  user_id: 'u-1',
                  title: values.title,
                  payload: values.payload,
                  share_token: null,
                  updated_at: values.updated_at,
                },
                error: null,
              }),
            }),
          };
        },
        update: (values: Record<string, unknown>) => {
          updateSpy(values);
          const chain: SupabaseUpdateBuilder = {
            eq: () => chain,
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'cloud-row-1', share_token: values.share_token ?? null },
                error: null,
              }),
            }),
          };
          return chain;
        },
        delete: vi.fn(),
      })),
      rpc: vi.fn(),
    };
    setSupabaseClientForTests(mockClient);

    const notify = vi.fn();
    const onOpenWorkspaceBoard = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <FileMenu
        currentDsl={'diagram: flow\ntitle: Local Flow\nstart A\nA -> B\nend B'}
        mode="flow"
        currentBoardId="local-board-99"
        onLoad={vi.fn()}
        onNew={vi.fn()}
        onOpenWorkspaceBoard={onOpenWorkspaceBoard}
        notify={notify}
      />,
    );

    expect(await screen.findByTestId('header-signed-in-email')).toHaveTextContent('jack@teqcon.uk');

    // 1. Save to cloud
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByTestId('cloud-save-button'));
    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith('success', 'Saved "Local Flow" to cloud');
    });

    // 2. Load from cloud (confirms replace of current board)
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByTestId('cloud-load-button'));
    const itemBtn = await screen.findByTestId('cloud-load-item-cloud-row-1');
    fireEvent.click(itemBtn);
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(onOpenWorkspaceBoard).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cloud Loaded Board', mode: 'flow' }),
      );
    });

    // 3. Share & Revoke
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByTestId('cloud-share-button'));
    expect(await screen.findByTestId('cloud-share-dialog')).toBeVisible();
    fireEvent.click(screen.getByTestId('cloud-share-generate'));
    const urlInput = (await screen.findByTestId('cloud-share-url')) as HTMLInputElement;
    expect(urlInput.value).toMatch(/^https:\/\/diagram-tool\.teqcon\.uk\/app\/\?share=[a-f0-9]+$/);

    fireEvent.click(screen.getByTestId('cloud-share-revoke'));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenLastCalledWith(expect.objectContaining({ share_token: null }));
      expect(notify).toHaveBeenCalledWith('success', 'Share link revoked');
    });

    confirmSpy.mockRestore();
  });

  it('refuses oversized boards (> 1.5 MB) with a toast and allows signing out', async () => {
    const upsertSpy = vi.fn();
    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    const mockClient: SupabaseClientLike = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'u-1', email: 'jack@teqcon.uk' } } },
          error: null,
        }),
        signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: signOutSpy,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn() as unknown as ReturnType<SupabaseClientLike['from']>['select'],
        upsert: upsertSpy as unknown as ReturnType<SupabaseClientLike['from']>['upsert'],
        update: vi.fn() as unknown as ReturnType<SupabaseClientLike['from']>['update'],
      })),
      rpc: vi.fn(),
    };
    setSupabaseClientForTests(mockClient);

    const notify = vi.fn();
    const hugeDsl = `diagram: architecture\ntitle: Too Large\n# ${'a'.repeat(1600 * 1024)}`;

    render(
      <FileMenu
        currentDsl={hugeDsl}
        mode="architecture"
        onLoad={vi.fn()}
        onNew={vi.fn()}
        notify={notify}
      />,
    );

    expect(await screen.findByTestId('header-signed-in-email')).toHaveTextContent('jack@teqcon.uk');

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByTestId('cloud-save-button'));

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith('error', expect.stringMatching(/1\.5 MB cloud save limit/i));
    });
    expect(upsertSpy).not.toHaveBeenCalled();

    // Sign out clears signed-in state
    fireEvent.click(screen.getByTestId('header-sign-out'));
    await waitFor(() => {
      expect(signOutSpy).toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith('success', 'Signed out');
    });
    expect(screen.getByTestId('header-sign-in')).toBeVisible();
  });
});
