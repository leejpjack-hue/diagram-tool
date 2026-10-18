import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SequenceCanvas } from './SequenceCanvas';
import { useDiagramStore } from '../../store/diagramStore';

const SRC = `sequenceDiagram
title Styled
%% role A ai
participant A
actor U as User
participant V as Vector DB
participant N as Nora
U->>A: ask
Note over U: remember
loop Daily
  A->>V: write
end
`;

function renderSequence(iconStyle: 'clean' | 'line' | 'bold' | 'blueprint', step: number | null = null) {
  useDiagramStore.setState({
    dslText: SRC,
    parsedDiagram: null,
    diagramMode: 'sequence',
    iconStyle,
    error: null,
    walkThroughStep: step,
    walkThroughStack: [],
  });
  return render(<SequenceCanvas />);
}

describe('Sequence role cards and icon styles', () => {
  it('paints role icons on Clean and leaves an unknown name on today\'s palette', () => {
    const { container } = renderSequence('clean');
    expect(container.querySelector('.sequence-canvas')?.getAttribute('data-icon-style')).toBe('clean');

    const agent = container.querySelector('[data-seq-participant="A"]');
    const user = container.querySelector('[data-seq-participant="U"]');
    const db = container.querySelector('[data-seq-participant="V"]');
    const nora = container.querySelector('[data-seq-participant="N"]');
    expect(agent?.getAttribute('data-role')).toBe('ai');
    expect(user?.getAttribute('data-role')).toBe('human');
    expect(db?.getAttribute('data-role')).toBe('data');
    expect(nora?.hasAttribute('data-role')).toBe(false);

    expect(agent?.querySelector('rect')?.getAttribute('fill')).toBe('#6d28d9');
    expect(agent?.querySelector('[data-node-icon="sparkles"]')).not.toBeNull();
    expect(user?.querySelector('[data-node-icon="user"]')).not.toBeNull();
    expect(db?.querySelector('[data-node-icon="database"]')).not.toBeNull();

    const noraFill = nora?.querySelector('rect');
    expect(noraFill?.getAttribute('fill')).toBe('#10b981');
    expect(noraFill?.getAttribute('opacity')).toBe('0.92');
    expect(noraFill?.getAttribute('rx')).toBe('10');
    expect(nora?.querySelector('[data-node-icon]')).toBeNull();
    expect(nora?.querySelector('text')?.textContent).toContain('Nora');

    const lifeline = container.querySelector('line[stroke-dasharray="5 5"]');
    expect(lifeline?.getAttribute('stroke-opacity')).toBe('0.35');
    expect(lifeline?.getAttribute('stroke-width')).toBe('1.5');
    expect(container.querySelector('[data-seq-grid]')).toBeNull();
    const message = container.querySelector('line[marker-end]');
    expect(message?.getAttribute('stroke')).toBe('#1d4ed8');
    expect(message?.getAttribute('stroke-width')).toBe('1.8');
    expect(message?.hasAttribute('stroke-dasharray')).toBe(false);
    expect(message?.parentElement?.querySelector('text')?.getAttribute('fill')).toBe('#334155');
  });

  it('applies Blueprint to headers, messages, frames, and notes, and keeps the walk highlight', () => {
    const { container } = renderSequence('blueprint', 0);
    expect(container.querySelector('[data-icon-style]')?.getAttribute('data-icon-style')).toBe('blueprint');
    expect(container.querySelector('[data-seq-grid="blueprint"]')).not.toBeNull();

    const agent = container.querySelector('[data-seq-participant="A"]');
    expect(agent?.getAttribute('data-role')).toBe('ai');
    expect(agent?.querySelector('rect')?.getAttribute('fill')).toBe('#0b1f3a');
    expect(agent?.querySelector('rect')?.getAttribute('rx')).toBe('2');
    expect(agent?.querySelector('text')?.getAttribute('fill')).toBe('#e0f2fe');

    const note = container.querySelector('text');
    expect(container.querySelector('rect[fill="#fcd34d"], rect[stroke="#fcd34d"]')).not.toBeNull();
    expect(note).not.toBeNull();

    const frame = container.querySelector('rect[stroke="#7dd3fc"]');
    expect(frame?.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(container.querySelector('[data-walk-current="true"]')).toHaveAttribute('opacity', '1');
    expect(container.querySelector('[data-walk-index="1"]')).toHaveAttribute('opacity', '0.35');
    expect(container.querySelectorAll('[data-seq-participant="A"][data-walk-header="hot"]')).toHaveLength(2);
  });
});
