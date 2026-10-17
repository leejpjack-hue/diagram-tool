// DT-AI-29 — Step numbers toggle, badges, and read-only share.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { DiagramCanvas } from './DiagramCanvas';
import { DSLEditor } from '../Editor/DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';
import { plainStepsToDSL } from '../../parser/plainSteps';
import { buildBoardDocument, parsePortableImport } from '../../utils/boardFormat';
import type { Board } from '../../utils/boardManager';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const LINEAR = plainStepsToDSL('Ask the question\nDraft an answer\nReview the draft\nSend the reply');

const ARCH = `diagram: architecture
title: "Arch"
service web { }
`;

function badgeFor(step: number) {
  const badge = screen.getAllByTestId('step-number').find(
    element => element.getAttribute('data-step-number') === String(step),
  );
  expect(badge).toBeTruthy();
  return badge!;
}

function setup(dsl: string, extra: Record<string, unknown> = {}) {
  const parsed = parseDiagram(dsl);
  useDiagramStore.setState({
    dslText: dsl,
    parsedDiagram: parsed,
    diagramMode: parsed.mode,
    walkThroughStep: null,
    walkThroughStack: [],
    selectedNodeId: null,
    error: null,
    iconStyle: 'clean',
    showStepNumbers: false,
    isReadOnlyShared: false,
    history: [],
    historyIndex: -1,
    ...extra,
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
  useDiagramStore.setState({
    showStepNumbers: false,
    isReadOnlyShared: false,
    walkThroughStep: null,
    walkThroughStack: [],
    iconStyle: 'clean',
    history: [],
    historyIndex: -1,
  });
});

describe('Step numbers (DT-AI-29)', () => {
  it('is off by default and sits beside Style', () => {
    setup(LINEAR);
    const toggle = screen.getByTestId('toggle-step-numbers');
    const style = screen.getByTestId('icon-style-picker');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(style.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('step-number')).toBeNull();
  });

  it('hides the toggle on a non-Flow board', () => {
    setup(ARCH);
    expect(screen.queryByTestId('toggle-step-numbers')).toBeNull();
    expect(screen.queryByTestId('step-number')).toBeNull();
  });

  it('shows badges 1..4 in walk order and matches Walk through step 3', () => {
    const { container } = setup(LINEAR);
    fireEvent.click(screen.getByTestId('toggle-step-numbers'));
    expect(screen.getByTestId('toggle-step-numbers')).toHaveAttribute('aria-pressed', 'true');

    for (const [step, label] of [
      [1, 'Ask the question'],
      [2, 'Draft an answer'],
      [3, 'Review the draft'],
      [4, 'Send the reply'],
    ] as const) {
      const badge = badgeFor(step);
      expect(badge).toHaveAttribute('role', 'img');
      expect(badge).toHaveAttribute('aria-label', `Step ${step}`);
      expect(badge).toHaveAttribute('data-step-number', String(step));
      const node = badge.closest('.react-flow__node');
      expect(node).not.toBeNull();
      expect(node).toHaveTextContent(label);
      expect(container.querySelector('.react-flow')?.contains(badge)).toBe(true);
    }

    fireEvent.click(screen.getByTestId('walk-through'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    const caption = screen.getByTestId('walk-through-caption');
    expect(caption).toHaveTextContent('Step 3 of 4');
    expect(caption).toHaveTextContent('Review the draft');
    const step3 = badgeFor(3);
    expect(step3.closest('.react-flow__node')).toHaveTextContent('Review the draft');
  });

  it('undo turns the badges back off', () => {
    setup(LINEAR);
    fireEvent.click(screen.getByTestId('toggle-step-numbers'));
    expect(screen.getAllByTestId('step-number')).toHaveLength(4);
    act(() => {
      useDiagramStore.getState().undo();
    });
    expect(useDiagramStore.getState().showStepNumbers).toBe(false);
    expect(screen.queryAllByTestId('step-number')).toEqual([]);
  });

  it('shows saved numbers on a read-only share and hides the toggle', () => {
    const board: Board = {
      id: 'shared',
      title: 'Shared',
      description: '',
      mode: 'flow',
      dslText: LINEAR,
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
      tags: [],
      starred: false,
      schemaVersion: 2,
      showStepNumbers: true,
    };
    const portable = parsePortableImport(buildBoardDocument(board)).boards[0];
    expect(portable.showStepNumbers).toBe(true);
    setup(LINEAR, { showStepNumbers: portable.showStepNumbers === true, isReadOnlyShared: true });
    expect(screen.queryByTestId('toggle-step-numbers')).toBeNull();
    expect(badgeFor(1)).toHaveAttribute('aria-label', 'Step 1');
    expect(badgeFor(4)).toHaveAttribute('aria-label', 'Step 4');
    expect(badgeFor(3).closest('.react-flow__node')).toHaveTextContent('Review the draft');
  });
});
