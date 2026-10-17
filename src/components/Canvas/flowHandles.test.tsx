import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeProps } from '@xyflow/react';
import { ProcessNode } from './ProcessNode';
import { DecisionNode } from './DecisionNode';
import { StartEndNode } from './StartEndNode';
import { DataNode, DocumentNode, ManualInputNode, TerminatorNode } from './FlowShapeNodes';
import { GatewayParallelNode, EventStartNode, SubprocessNode } from './BpmnShapes';
import { useDiagramStore } from '../../store/diagramStore';

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    Handle: (props: Record<string, unknown>) => (
      <div
        data-testid={String(props['data-testid'] ?? 'handle')}
        data-handleid={String(props.id)}
        data-handlepos={String(props.position)}
        data-type={String(props.type)}
      />
    ),
  };
});

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function props(data: Record<string, unknown> = { label: 'Step' }): NodeProps {
  return { data, selected: false } as unknown as NodeProps;
}

function expectFourSides(container: HTMLElement) {
  for (const side of SIDES) {
    const source = container.querySelector(`[data-handleid="source-${side}-0"]`);
    const target = container.querySelector(`[data-handleid="target-${side}-0"]`);
    expect(source?.getAttribute('data-type')).toBe('source');
    expect(target?.getAttribute('data-type')).toBe('target');
    expect(source?.getAttribute('data-handlepos')).toBe(side);
    expect(target?.getAttribute('data-handlepos')).toBe(side);
  }
  expect(container.querySelectorAll('[data-handleid]')).toHaveLength(8);
}

describe('Flow N/E/S/W handles', () => {
  afterEach(() => {
    act(() => {
      useDiagramStore.setState({ iconStyle: 'clean' });
    });
  });

  it.each([
    ['process', ProcessNode],
    ['decision', DecisionNode],
    ['start', StartEndNode],
    ['data', DataNode],
    ['document', DocumentNode],
    ['manual input', ManualInputNode],
    ['terminator', TerminatorNode],
    ['gateway', GatewayParallelNode],
    ['event', EventStartNode],
    ['subprocess', SubprocessNode],
  ] as const)('mounts connectable handles on %s', (_name, Node) => {
    useDiagramStore.setState({ iconStyle: 'clean' });
    const { container } = render(<Node {...props()} />);
    expectFourSides(container);
  });

  it('keeps the four sides on a styled process face', () => {
    useDiagramStore.setState({ iconStyle: 'line' });
    const { container } = render(<ProcessNode {...props()} />);
    expectFourSides(container);
  });

  it('adds another slot when two edges share a side', () => {
    useDiagramStore.setState({ iconStyle: 'clean' });
    const { container } = render(
      <ProcessNode
        {...props({
          label: 'Fork',
          connectionHandles: { source: { right: 2 }, target: {} },
        })}
      />,
    );
    expect(container.querySelector('[data-handleid="source-right-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="flow-handle-source-right-1"]')).toBeTruthy();
  });
});
