import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { plainArchitectureToDSL } from '../../parser/plainArchitecture';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const HANDWRITTEN = `diagram: architecture
title: Hand written
service API {
  connects: DB
}
database DB {}
`;

function renderArchitecture(dsl = HANDWRITTEN) {
  useDiagramStore.setState({
    dslText: dsl,
    parsedDiagram: null,
    diagramMode: 'architecture',
    error: null,
    history: [],
    historyIndex: -1,
  });
  return render(<DSLEditor />);
}

describe('Type parts panel', () => {
  it('is on architecture boards and hidden on flow, sequence, and gantt', () => {
    const first = renderArchitecture();
    expect(screen.getByTestId('toggle-type-parts')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle-type-steps')).toBeNull();
    first.unmount();

    for (const diagramMode of ['flow', 'sequence', 'gantt'] as const) {
      useDiagramStore.setState({ diagramMode, dslText: 'diagram: flow\ntitle: X\n' });
      const view = render(<DSLEditor />);
      expect(screen.queryByTestId('toggle-type-parts')).toBeNull();
      if (diagramMode === 'flow') expect(screen.getByTestId('toggle-type-steps')).toBeInTheDocument();
      else expect(screen.queryByTestId('toggle-type-steps')).toBeNull();
      view.unmount();
    }
  });

  it('opens a hand-written board onto an empty box and does not change the source', () => {
    renderArchitecture();
    fireEvent.click(screen.getByTestId('toggle-type-parts'));
    expect(screen.getByTestId('type-parts-input')).toHaveValue('');
    expect(screen.getByTestId('type-parts-handwritten-hint')).toBeInTheDocument();
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
  });

  it('refills the box from a board Type parts built', () => {
    const typed = 'User -> Chat app: asks';
    renderArchitecture(plainArchitectureToDSL(typed, { title: 'Hand written' }));
    fireEvent.click(screen.getByTestId('toggle-type-parts'));
    expect(screen.getByTestId('type-parts-input')).toHaveValue(typed);
    expect(screen.queryByTestId('type-parts-handwritten-hint')).toBeNull();
  });

  it('replaces the source on Build and undo restores it', () => {
    renderArchitecture();
    fireEvent.click(screen.getByTestId('toggle-type-parts'));
    fireEvent.change(screen.getByTestId('type-parts-input'), { target: { value: 'A -> B: go' } });
    fireEvent.click(screen.getByTestId('build-parts'));

    const built = useDiagramStore.getState().dslText;
    expect(built).toContain('edge A -> B');
    expect(built).toContain('label: "go"');
    expect(screen.getByText('2 parts, 1 connection')).toBeInTheDocument();
    expect(useDiagramStore.getState().parsedDiagram?.nodes.map(node => node.name).sort()).toEqual(['A', 'B']);

    act(() => {
      useDiagramStore.getState().undo();
    });
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
    expect(useDiagramStore.getState().parsedDiagram?.nodes.some(node => node.name === 'API')).toBe(true);
  });
});
