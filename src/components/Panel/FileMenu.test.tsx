import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileMenu } from './FileMenu';
import { CURSOR_MCP_PRIVACY_SENTENCE, cursorMcpJsonSnippet } from '../../utils/cursorMcpSnippet';

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
    expect(screen.getByTestId('connect-cursor-snippet')).toHaveTextContent('DIAGRAM_TOOL_DIR');
    expect(screen.getByTestId('connect-cursor-snippet').textContent).toBe(cursorMcpJsonSnippet());

    fireEvent.click(screen.getByTestId('connect-cursor-copy'));
    expect(writeText).toHaveBeenCalledWith(cursorMcpJsonSnippet());
  });
});
