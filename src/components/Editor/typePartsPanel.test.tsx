import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { plainArchitectureToDSL } from '../../parser/plainArchitecture';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const OPEN_KEY = 'diagram-tool-type-parts-preview-open';

afterEach(() => {
  localStorage.removeItem(OPEN_KEY);
});

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

  it('shows Walk through only when a connection is numbered', () => {
    const plain = renderArchitecture();
    expect(screen.queryByTestId('walk-through')).toBeNull();
    plain.unmount();

    renderArchitecture(`diagram: architecture
title: Path
service A {}
service B {}
edge A -> B { label: "question" step: 2 }
`);
    expect(screen.getByTestId('walk-through')).toBeInTheDocument();
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

  it('shows explicit empty state, live preview rows, warning focus, and inline error near Type parts', async () => {
    renderArchitecture();
    fireEvent.click(screen.getByTestId('toggle-type-parts'));

    expect(screen.getByTestId('type-parts-preview-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('type-parts-preview-summary')).toHaveTextContent('0 lines, 0 warnings');
    expect(screen.getByTestId('type-parts-preview-empty')).toHaveTextContent('No parts typed yet.');

    // Clicking Build on empty input surfaces an inline error near Type parts and keeps the board unchanged.
    fireEvent.click(screen.getByTestId('build-parts'));
    expect(screen.getByTestId('type-parts-error')).toHaveTextContent('Type one part per line first.');
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);

    // Typing clears the inline error and updates the live preview without changing the board.
    fireEvent.change(screen.getByTestId('type-parts-input'), {
      target: { value: 'User -> Chat app: asks\nnot a connection' },
    });
    expect(screen.queryByTestId('type-parts-error')).toBeNull();
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);

    await waitFor(() => {
      expect(screen.getByTestId('type-parts-preview-summary')).toHaveTextContent('2 lines, 1 warning');
    });
    expect(screen.queryByTestId('type-parts-preview-empty')).toBeNull();
    const rows = screen.getAllByTestId('type-parts-preview-row');
    expect(rows[0]).toHaveTextContent('User (user) → Chat app · "asks"');
    expect(rows[1]).toHaveTextContent("This line wasn't understood.");

    fireEvent.click(rows[1]);
    const input = screen.getByTestId('type-parts-input') as HTMLTextAreaElement;
    expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('not a connection');
  });
});
