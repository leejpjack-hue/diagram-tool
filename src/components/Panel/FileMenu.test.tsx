import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileMenu } from './FileMenu';
import { CURSOR_MCP_FOLDER_SENTENCE, CURSOR_MCP_PRIVACY_SENTENCE, cursorMcpJsonSnippet } from '../../utils/cursorMcpSnippet';

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
});
