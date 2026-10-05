// DT-AI-14 — read-only walk-through on Flow boards.
// Component tests render the real DSLEditor toolbar (Walk through control)
// next to the real DiagramCanvas; Monaco is stubbed since jsdom cannot load it.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { DiagramCanvas } from './DiagramCanvas';
import { DSLEditor } from '../Editor/DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

// Fixture flow with a decision and roles (same shape as the AI workflow
// template). Copy as steps produces 6 lines for this board, "Model: Model"
// visited twice — once as a step, once as the decision's else branch.
const FLOW_DSL = `diagram: flow
title: "AI workflow"
Ask -> Model
Model -> Tool
Tool -> Check
Check ->|retry| Model
Check ->|ok| Reply
node Ask {
  label: "Human ask"
  role: human
}
node Model {
  label: "Model"
  role: model
}
node Tool {
  label: "Tool"
  role: tool
}
node Check {
  type: decision
  label: "Check"
  role: check
}
node Reply {
  label: "Reply"
  role: human
}
`;

const EMPTY_FLOW_DSL = 'diagram: flow\ntitle: "Empty"\n';
const ARCH_DSL = `diagram: architecture
title: "Arch"
service web { }
`;

function setup(dsl: string) {
  const parsed = parseDiagram(dsl);
  useDiagramStore.setState({
    dslText: dsl,
    parsedDiagram: parsed,
    diagramMode: parsed.mode,
    walkThroughStep: null,
    selectedNodeId: null,
    error: null,
  });
  return render(
    <ReactFlowProvider>
      <DSLEditor />
      <DiagramCanvas />
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverMock;
});

afterEach(() => {
  useDiagramStore.setState({ walkThroughStep: null });
});

describe('Walk through control (DT-AI-14)', () => {
  it('shows Walk through next to Copy as steps on a Flow board with steps', () => {
    setup(FLOW_DSL);
    const toolbar = screen.getByTestId('copy-as-steps').parentElement!;
    expect(within(toolbar).getByTestId('walk-through')).toBeEnabled();
    expect(screen.queryByTestId('walk-through-unavailable')).toBeNull();
  });

  it('is disabled with the teachable message on an empty Flow board', () => {
    setup(EMPTY_FLOW_DSL);
    expect(screen.getByTestId('walk-through')).toBeDisabled();
    expect(screen.getByTestId('walk-through-unavailable')).toHaveTextContent(/No steps on this board yet/);
  });

  it('is hidden on non-Flow boards', () => {
    setup(ARCH_DSL);
    expect(screen.queryByTestId('walk-through')).toBeNull();
    expect(screen.queryByTestId('walk-through-unavailable')).toBeNull();
  });
});

describe('walk-through session (enter, next, prev, exit)', () => {
  it('enter highlights step 1, dims other nodes; incoming edges stay visible', () => {
    const { container } = setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Human ask');
    expect(screen.getByTestId('walk-through-role')).toHaveTextContent('Human');

    const askNode = container.querySelector('[data-id="Ask"]') as HTMLElement;
    const modelNode = container.querySelector('[data-id="Model"]') as HTMLElement;
    expect(askNode.style.opacity).toBe('1');
    expect(modelNode.style.opacity).toBe('0.15');
  });

  it('Next/Prev buttons move one step; decision branches walked in Copy-as-steps order', () => {
    const { container } = setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Check');
    // The decision's incoming edge stays visible; everything else dims.
    const checkNode = container.querySelector('[data-id="Check"]') as HTMLElement;
    expect(checkNode.style.opacity).toBe('1');

    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 5 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Reply');

    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 6 of 6');
    expect(screen.getByTestId('walk-through-next')).toBeDisabled();

    fireEvent.click(screen.getByTestId('walk-through-prev'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 5 of 6');

    fireEvent.click(screen.getByTestId('walk-through-exit'));
    expect(screen.queryByTestId('walk-through-overlay')).toBeNull();
    const modelNode = container.querySelector('[data-id="Model"]') as HTMLElement;
    expect(modelNode.style.opacity).toBe('');
  });

  it('Left/Right arrow keys step and Esc exits', () => {
    setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 2 of 6');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 2 of 6');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('walk-through-overlay')).toBeNull();
    // Re-entering starts from step 1 again.
    fireEvent.click(screen.getByTestId('walk-through'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 6');
  });

  it('walk-through never touches undo history or the DSL source', () => {
    setup(FLOW_DSL);
    const store = useDiagramStore.getState();
    const dslBefore = store.dslText;
    const historyBefore = store.history;

    fireEvent.click(screen.getByTestId('walk-through'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-exit'));

    const after = useDiagramStore.getState();
    expect(after.dslText).toBe(dslBefore);
    expect(after.history).toBe(historyBefore);
    expect(after.walkThroughStep).toBeNull();
  });
});
