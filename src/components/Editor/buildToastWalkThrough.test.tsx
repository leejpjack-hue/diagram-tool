// DT-AI-16 — Build success toast offers Walk through on the built board.
// Renders the real DSLEditor (Monaco stubbed for jsdom) next to the real
// DiagramCanvas so the walk-through overlay can be asserted.
import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { DiagramCanvas } from '../Canvas/DiagramCanvas';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const EMPTY_FLOW_DSL = 'diagram: flow\ntitle: "Empty"\n';
const STEPS_TEXT = 'Draft reply\nthen Send reply\nthen Archive thread';

function setup() {
  const parsed = parseDiagram(EMPTY_FLOW_DSL);
  useDiagramStore.setState({
    dslText: EMPTY_FLOW_DSL,
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

function typeAndBuild(steps: string) {
  fireEvent.click(screen.getByTestId('toggle-type-steps'));
  fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: steps } });
  fireEvent.click(screen.getByTestId('build-steps'));
  expect(screen.getByTestId('toast-item')).toBeInTheDocument();
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
  vi.useRealTimers();
});

describe('Build toast Walk through (DT-AI-16)', () => {
  it('success toast keeps its text and gains a Walk through button', async () => {
    setup();
    await typeAndBuild(STEPS_TEXT);

    expect(screen.getByTestId('toast-item')).toHaveTextContent(/Built 3 steps onto the board/);
    const action = screen.getByTestId('toast-action');
    expect(action).toHaveAccessibleName('Walk through');
    // DT-AI-11 unchanged: the Type steps panel stays open after Build.
    expect(screen.getByTestId('type-steps-input')).toBeInTheDocument();
  });

  it('clicking Walk through dismisses the toast and starts at step 1 of M', async () => {
    setup();
    await typeAndBuild(STEPS_TEXT);

    fireEvent.click(screen.getByTestId('toast-action'));

    expect(screen.queryByTestId('toast-item')).toBeNull();
    expect(screen.getByTestId('walk-through-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 3');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Draft reply');
    expect(useDiagramStore.getState().walkThroughStep).toBe(0);
  });

  it('no Walk through button when Build fails to parse', async () => {
    setup();
    await typeAndBuild('then\nthen');

    expect(screen.getByTestId('toast-item')).toHaveTextContent(/No steps found/);
    expect(screen.queryByTestId('toast-action')).toBeNull();
  });

  it('no Walk through button on the empty-input toast', async () => {
    setup();
    await typeAndBuild('   ');

    expect(screen.getByTestId('toast-item')).toHaveTextContent(/Type one step per line first/);
    expect(screen.queryByTestId('toast-action')).toBeNull();
  });

  it('auto-dismiss pauses while the pointer is on the toast, resumes with remaining time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await typeAndBuild(STEPS_TEXT);
    const toastItem = screen.getByTestId('toast-item');

    // Let 1.5s of the 3s budget elapse, then hover.
    act(() => { vi.advanceTimersByTime(1500); });
    fireEvent.mouseEnter(toastItem);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();

    // On leave, the remaining 1.5s (not a fresh 3s) dismisses the toast.
    fireEvent.mouseLeave(toastItem);
    act(() => { vi.advanceTimersByTime(1400); });
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByTestId('toast-item')).toBeNull();
  });

  it('keyboard focus on the toast also pauses auto-dismiss', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await typeAndBuild(STEPS_TEXT);

    fireEvent.focus(screen.getByTestId('toast-action'));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('toast-action'));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('toast-item')).toBeNull();
  });
});
