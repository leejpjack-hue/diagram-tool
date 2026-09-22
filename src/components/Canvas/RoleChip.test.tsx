import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NodeProps } from '@xyflow/react';
import { ProcessNode } from './ProcessNode';
import { RoleChip } from './RoleChip';

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    // Handle requires a live ReactFlow store; the chip tests don't need it.
    Handle: (props: Record<string, unknown>) => (
      <div data-testid="handle" data-handlepos={String(props.position)} />
    ),
  };
});

describe('RoleChip (DT-AI-03)', () => {
  it.each(['human', 'model', 'tool', 'check'] as const)('renders a %s chip', role => {
    render(<RoleChip role={role} />);
    const chip = screen.getByText(role);
    expect(chip).toHaveAttribute('data-role-chip', role);
  });

  it('renders nothing for an unknown / missing role', () => {
    // Unknown values are dropped by the parser, but the chip also defends.
    const container = render(
      <>
        {/* @ts-expect-error — simulates a malformed value reaching the DOM layer */}
        <RoleChip role="alien" />
        <RoleChip role={undefined} />
      </>,
    );
    expect(container.container.querySelectorAll('[data-role-chip]')).toHaveLength(0);
  });

  it('is static — no animation properties on the chip', () => {
    render(<RoleChip role="model" />);
    const chip = screen.getByText('model');
    const style = window.getComputedStyle(chip);
    expect(style.animationName === 'none' || style.animation === '').toBe(true);
  });
});

describe('ProcessNode role chip passthrough', () => {
  const baseProps = (role: unknown) =>
    ({ data: { label: 'Ask', role }, selected: false }) as unknown as NodeProps;

  it.each(['human', 'model', 'tool', 'check'] as const)('shows the %s chip on the node', role => {
    render(<ProcessNode {...(baseProps(role))} />);
    expect(screen.getByText(role)).toBeInTheDocument();
    expect(screen.getAllByTestId('handle').length).toBeGreaterThan(0);
  });

  it('omits the chip when the role is unknown — no crash', () => {
    const { container } = render(<ProcessNode {...(baseProps('alien'))} />);
    expect(container.querySelectorAll('[data-role-chip]')).toHaveLength(0);
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });
});
