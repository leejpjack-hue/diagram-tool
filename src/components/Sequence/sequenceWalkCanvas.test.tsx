import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SequenceCanvas } from './SequenceCanvas';
import { useDiagramStore } from '../../store/diagramStore';

const SRC = `sequenceDiagram
participant A as Agent
participant B as Tool
participant C as Other
A->>+B: call
B-->>-A: done
C->>A: later
`;

function renderWalk(step: number | null = 0) {
  useDiagramStore.setState({
    dslText: SRC,
    parsedDiagram: null,
    diagramMode: 'sequence',
    error: null,
    walkThroughStep: step,
    walkThroughStack: [],
  });
  return render(<SequenceCanvas />);
}

describe('Sequence walk highlight', () => {
  it('highlights the current row, both headers, and the active bar, and dims the rest', () => {
    const { container } = renderWalk(0);
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('1 · Agent → Tool: call');
    const current = container.querySelector('[data-walk-current="true"]');
    expect(current).not.toBeNull();
    expect(current).toHaveAttribute('data-walk-index', '0');
    expect(current).toHaveAttribute('opacity', '1');
    expect(container.querySelector('[data-walk-index="1"]')).toHaveAttribute('opacity', '0.35');
    expect(container.querySelectorAll('[data-seq-participant="A"][data-walk-header="hot"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-seq-participant="B"][data-walk-header="hot"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-seq-participant="C"][data-walk-header="dim"]')).toHaveLength(2);
    expect(container.querySelector('[data-walk-bar="hot"]')).not.toBeNull();

    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('3 · Other → Agent: later');
    expect(container.querySelector('[data-walk-current="true"]')).toHaveAttribute('data-walk-index', '2');
    expect(container.querySelector('[data-walk-bar="dim"]')).not.toBeNull();
    expect(container.querySelector('[data-walk-bar="hot"]')).toBeNull();
    expect(container.querySelectorAll('[data-seq-participant="C"][data-walk-header="hot"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-seq-participant="B"][data-walk-header="dim"]')).toHaveLength(2);
  });
});
