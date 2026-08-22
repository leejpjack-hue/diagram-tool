import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileMenu } from './FileMenu';

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
});
