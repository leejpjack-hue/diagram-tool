import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { plainGanttToDSL } from '../../parser/plainGantt';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const HANDWRITTEN = `diagram: gantt
title: Hand written
start: 2026-03-01

task FirstTask {
  start: 2026-03-01
  end: 2026-03-04
  progress: 0
}
`;

function renderGantt(dsl = HANDWRITTEN) {
  useDiagramStore.setState({
    dslText: dsl,
    parsedDiagram: null,
    diagramMode: 'gantt',
    error: null,
    history: [],
    historyIndex: -1,
  });
  return render(<DSLEditor />);
}

describe('Type tasks panel', () => {
  it('is on gantt boards and hidden on flow, architecture, and sequence', () => {
    const first = renderGantt();
    expect(screen.getByTestId('toggle-type-tasks')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle-type-steps')).toBeNull();
    expect(screen.queryByTestId('toggle-type-parts')).toBeNull();
    expect(screen.queryByTestId('toggle-type-messages')).toBeNull();
    first.unmount();

    const sources = {
      flow: 'diagram: flow\ntitle: X\n',
      architecture: 'diagram: architecture\ntitle: X\nservice A {}\n',
      sequence: 'sequenceDiagram\ntitle X\nparticipant A as Actor\n',
    };
    for (const diagramMode of ['flow', 'architecture', 'sequence'] as const) {
      useDiagramStore.setState({ diagramMode, dslText: sources[diagramMode], parsedDiagram: null });
      const view = render(<DSLEditor />);
      expect(screen.queryByTestId('toggle-type-tasks')).toBeNull();
      if (diagramMode === 'flow') expect(screen.getByTestId('toggle-type-steps')).toBeInTheDocument();
      if (diagramMode === 'architecture') expect(screen.getByTestId('toggle-type-parts')).toBeInTheDocument();
      if (diagramMode === 'sequence') expect(screen.getByTestId('toggle-type-messages')).toBeInTheDocument();
      view.unmount();
    }
  });

  it('opens a hand-written board onto an empty box and does not change the source', () => {
    renderGantt();
    fireEvent.click(screen.getByTestId('toggle-type-tasks'));
    expect(screen.getByTestId('type-tasks-input')).toHaveValue('');
    expect(screen.getByTestId('type-tasks-handwritten-hint')).toBeInTheDocument();
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
  });

  it('refills the box from a board Type tasks built', () => {
    const typed = 'Collect data — 3d — Human: Jack';
    renderGantt(plainGanttToDSL(typed, { title: 'Hand written', start: '2026-03-01' }));
    fireEvent.click(screen.getByTestId('toggle-type-tasks'));
    expect(screen.getByTestId('type-tasks-input')).toHaveValue(typed);
    expect(screen.queryByTestId('type-tasks-handwritten-hint')).toBeNull();
  });

  it('replaces the source on Build chart and undo restores it', () => {
    renderGantt();
    fireEvent.click(screen.getByTestId('toggle-type-tasks'));
    fireEvent.change(screen.getByTestId('type-tasks-input'), {
      target: { value: 'Collect data — 3d — Human: Jack\nTrain model — 5d after Collect data — AI agent' },
    });
    fireEvent.click(screen.getByTestId('build-tasks'));

    const built = useDiagramStore.getState().dslText;
    expect(built).toContain('diagram: gantt');
    expect(built).toContain('duration: 3d');
    expect(built).toContain('duration: 5d');
    expect(built).toContain('after: Collect data');
    expect(built).toContain('custom: role=ai');
    expect(built).toContain('# @type-tasks');
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(useDiagramStore.getState().diagramMode).toBe('gantt');

    act(() => {
      useDiagramStore.getState().undo();
    });
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
    expect(useDiagramStore.getState().diagramMode).toBe('gantt');
  });
});
