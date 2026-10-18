import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { plainSequenceToMermaid } from '../../parser/plainSequence';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const HANDWRITTEN = `sequenceDiagram
title Hand written
participant A as Actor
participant B as System
A->>B: First message
`;

function renderSequence(dsl = HANDWRITTEN) {
  useDiagramStore.setState({
    dslText: dsl,
    parsedDiagram: null,
    diagramMode: 'sequence',
    error: null,
    history: [],
    historyIndex: -1,
  });
  return render(<DSLEditor />);
}

describe('Type messages panel', () => {
  it('is on sequence boards and hidden on flow, architecture, and gantt', () => {
    const first = renderSequence();
    expect(screen.getByTestId('toggle-type-messages')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle-type-steps')).toBeNull();
    expect(screen.queryByTestId('toggle-type-parts')).toBeNull();
    first.unmount();

    const sources = {
      flow: 'diagram: flow\ntitle: X\n',
      architecture: 'diagram: architecture\ntitle: X\nservice A {}\n',
      gantt: 'diagram: gantt\ntitle: X\n',
    };
    for (const diagramMode of ['flow', 'architecture', 'gantt'] as const) {
      useDiagramStore.setState({ diagramMode, dslText: sources[diagramMode], parsedDiagram: null });
      const view = render(<DSLEditor />);
      expect(screen.queryByTestId('toggle-type-messages')).toBeNull();
      if (diagramMode === 'flow') expect(screen.getByTestId('toggle-type-steps')).toBeInTheDocument();
      if (diagramMode === 'architecture') expect(screen.getByTestId('toggle-type-parts')).toBeInTheDocument();
      view.unmount();
    }
  });

  it('shows Walk through only when the sequence has a message', () => {
    const empty = renderSequence('sequenceDiagram\nparticipant A\nparticipant B\nNote over A: hi');
    expect(screen.queryByTestId('walk-through')).toBeNull();
    empty.unmount();

    renderSequence();
    expect(screen.getByTestId('walk-through')).toBeInTheDocument();
  });

  it('opens a hand-written board onto an empty box and does not change the source', () => {
    renderSequence();
    fireEvent.click(screen.getByTestId('toggle-type-messages'));
    expect(screen.getByTestId('type-messages-input')).toHaveValue('');
    expect(screen.getByTestId('type-messages-handwritten-hint')).toBeInTheDocument();
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
  });

  it('refills the box from a board Type messages built', () => {
    const typed = 'Human: User asks Agent: plan my trip';
    renderSequence(plainSequenceToMermaid(typed, { title: 'Hand written' }));
    fireEvent.click(screen.getByTestId('toggle-type-messages'));
    expect(screen.getByTestId('type-messages-input')).toHaveValue(typed);
    expect(screen.queryByTestId('type-messages-handwritten-hint')).toBeNull();
  });

  it('replaces the source on Build and undo restores it', () => {
    renderSequence();
    fireEvent.click(screen.getByTestId('toggle-type-messages'));
    fireEvent.change(screen.getByTestId('type-messages-input'), {
      target: { value: 'User asks Agent: plan\nAgent replies User: done' },
    });
    fireEvent.click(screen.getByTestId('build-messages'));

    const built = useDiagramStore.getState().dslText;
    expect(built).toContain('sequenceDiagram');
    expect(built).toContain('User->>Agent: plan');
    expect(built).toContain('Agent-->>User: done');
    expect(built).toContain('%% @type-messages');
    expect(screen.getByText('2 participants, 2 messages')).toBeInTheDocument();
    expect(useDiagramStore.getState().diagramMode).toBe('sequence');

    act(() => {
      useDiagramStore.getState().undo();
    });
    expect(useDiagramStore.getState().dslText).toBe(HANDWRITTEN);
  });
});
