import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileMenu } from './FileMenu';
import { CURSOR_MCP_FOLDER_SENTENCE, CURSOR_MCP_PRIVACY_SENTENCE, cursorMcpJsonSnippet } from '../../utils/cursorMcpSnippet';
import { OPEN_BOARD_FILE_ERRORS } from '../../utils/boardFile';
import { OPEN_FILE_ACCEPT, boardFileHandles } from '../../utils/fileSystemAccess';

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
});
