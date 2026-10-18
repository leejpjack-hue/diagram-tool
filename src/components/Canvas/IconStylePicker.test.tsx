import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconStylePicker } from './IconStylePicker';
import { useDiagramStore } from '../../store/diagramStore';

describe('IconStylePicker mode gate', () => {
  it('shows on architecture and flow, and stays hidden on sequence, gantt, and c4', () => {
    for (const diagramMode of ['architecture', 'flow'] as const) {
      useDiagramStore.setState({ diagramMode, iconStyle: 'clean', isReadOnlyShared: false });
      const view = render(<IconStylePicker />);
      expect(screen.getByTestId('icon-style-picker')).toBeInTheDocument();
      view.unmount();
    }

    for (const diagramMode of ['sequence', 'gantt', 'c4'] as const) {
      useDiagramStore.setState({ diagramMode, iconStyle: 'bold', isReadOnlyShared: false });
      const view = render(<IconStylePicker />);
      expect(screen.queryByTestId('icon-style-picker')).toBeNull();
      view.unmount();
    }
  });

  it('stays hidden on a read-only shared architecture board', () => {
    useDiagramStore.setState({ diagramMode: 'architecture', iconStyle: 'line', isReadOnlyShared: true });
    render(<IconStylePicker />);
    expect(screen.queryByTestId('icon-style-picker')).toBeNull();
  });
});
