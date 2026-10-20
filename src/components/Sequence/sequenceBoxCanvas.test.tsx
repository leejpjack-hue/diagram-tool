import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SequenceCanvas } from './SequenceCanvas';
import { useDiagramStore } from '../../store/diagramStore';

const LIFECYCLE = `sequenceDiagram
title Lifecycle
box Clients
participant U as User
participant B as Browser
end
U->>B: open
create participant W as Worker
B->>W: start job
destroy W
B->>U: closed
`;

const PLAIN = `sequenceDiagram
participant U as User
U->>U: hi
`;

function renderSequence(dslText: string) {
  useDiagramStore.setState({
    dslText,
    parsedDiagram: null,
    diagramMode: 'sequence',
    iconStyle: 'clean',
    error: null,
    walkThroughStep: null,
    walkThroughStack: [],
  });
  return render(<SequenceCanvas />);
}

describe('Sequence box, create, and destroy', () => {
  it('keeps a plain lifeline on the historical coordinates', () => {
    const { container } = renderSequence(PLAIN);
    const line = container.querySelector('[data-seq-lifeline="U"]');
    expect(line?.getAttribute('y1')).toBe('88');
    expect(line?.getAttribute('y2')).toBe('204');
    expect(container.querySelector('[data-testid="seq-box"]')).toBeNull();
    expect(container.querySelector('[data-testid="seq-destroy"]')).toBeNull();
  });

  it('draws the box label, starts the created lifeline lower, and stops it at the X', () => {
    const { container } = renderSequence(LIFECYCLE);
    const box = container.querySelector('[data-testid="seq-box"]');
    expect(box?.textContent).toContain('Clients');
    expect(container.querySelectorAll('[data-seq-participant="U"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-seq-participant="W"]')).toHaveLength(1);
    expect(container.querySelector('[data-seq-participant="W"]')?.textContent).toContain('Worker');

    const user = container.querySelector('[data-seq-lifeline="U"]');
    const worker = container.querySelector('[data-seq-lifeline="W"]');
    const userY1 = Number(user?.getAttribute('y1'));
    const userY2 = Number(user?.getAttribute('y2'));
    const workerY1 = Number(worker?.getAttribute('y1'));
    const workerY2 = Number(worker?.getAttribute('y2'));
    expect(workerY1).toBeGreaterThan(userY1);
    expect(workerY2).toBeLessThan(userY2);

    const marker = container.querySelector('[data-testid="seq-destroy"]');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('data-seq-destroy')).toBe('W');
    const cross = marker?.querySelector('line');
    expect(Number(cross?.getAttribute('y1')) + 6).toBe(workerY2);

    const userHeader = container.querySelector('[data-seq-participant="U"]');
    const workerHeader = container.querySelector('[data-seq-participant="W"]');
    const userTop = Number(userHeader?.querySelector('rect')?.getAttribute('y'));
    const workerTop = Number(workerHeader?.querySelector('rect')?.getAttribute('y'));
    expect(workerTop).toBeGreaterThan(userTop);
    expect(container.textContent).toContain('closed');
  });
});
