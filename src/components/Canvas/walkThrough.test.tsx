// DT-AI-14 — read-only walk-through on Flow boards.
// Component tests render the real DSLEditor toolbar (Walk through control)
// next to the real DiagramCanvas; Monaco is stubbed since jsdom cannot load it.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { DiagramCanvas } from './DiagramCanvas';
import { DSLEditor } from '../Editor/DSLEditor';
import App from '../../App';
import { useDiagramStore } from '../../store/diagramStore';
import { parseDiagram } from '../../parser/parser';
import { AI_PROMPT_TEXT } from '../Editor/aiPrompt';
import { setSupabaseClientForTests, type SupabaseClientLike } from '../../lib/supabase';
import { buildBoardDocument } from '../../utils/boardFormat';
import type { BoardMode } from '../../utils/boardManager';
import type { DiagramNode, ParsedDiagram } from '../../store/types';

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

// DT-AI-18 — a decision with two unlabelled outgoing edges.
const UNLABELLED_FORK_DSL = `diagram: flow
title: "Unlabelled fork"
A -> B
A -> C
`;

// DT-AI-18 — four labelled outgoing edges to exercise the 3-path cap.
const CAP_FORK_DSL = `diagram: flow
title: "Cap fork"
A ->|"one"| B
A ->|"two"| C
A ->|"three"| D
A ->|"four"| E
`;

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
    // Enter: only step 1 is current; no trail nodes yet.
    expect(container.querySelector('[data-testid="walk-through-node-trail"]')).toBeNull();
  });

  it('Next/Prev buttons move one step; decision branches walked in Copy-as-steps order', () => {
    const { container } = setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    // DT-AI-21: after two Next hops the first node is trail-mid (0.55), not 0.15.
    const askAfterTwo = container.querySelector('[data-id="ask"]') as HTMLElement;
    expect(askAfterTwo.style.opacity).toBe('0.55');
    expect(
      container.querySelector('[data-testid="walk-through-node-trail"][data-node-id="ask"]'),
    ).not.toBeNull();

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
    expect(container.querySelector('[data-testid="walk-through-node-trail"]')).toBeNull();
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

describe('walk-through note (DT-AI-15)', () => {
  const NOTED_FLOW_DSL = FLOW_DSL.replace(
    'node Ask {\n  label: "Human ask"',
    'node Ask {\n  label: "Human ask"\n  note: "uses the last 3 tickets"',
  );

  it('shows the current step note under the caption; steps without a note unchanged', () => {
    setup(NOTED_FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    // Step 1 (Ask) carries the note on a second line under the caption.
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Human ask');
    expect(screen.getByTestId('walk-through-note')).toHaveTextContent('uses the last 3 tickets');

    // Step 2 (Model) has no note → no note line, caption exactly as DT-AI-14.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 2 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Model');
    expect(screen.queryByTestId('walk-through-note')).toBeNull();
  });
});

describe('walk-through fork / arrived-by lines (DT-AI-18)', () => {
  // The worked example at the end of AI_PROMPT_TEXT, everything after the
  // "Example" line — same extraction rule as copyAiPrompt.test.tsx.
  function exampleFromPrompt(): string {
    const idx = AI_PROMPT_TEXT.indexOf('Example');
    expect(idx).toBeGreaterThan(-1);
    const lineEnd = AI_PROMPT_TEXT.indexOf('\n', idx);
    return AI_PROMPT_TEXT.slice(lineEnd + 1).trim();
  }

  function typeAndBuild(steps: string) {
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: steps } });
    fireEvent.click(screen.getByTestId('build-steps'));
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
  }

  it('Copy AI prompt worked example: decision step shows where each answer leads; No step shows the arrived-by line', () => {
    setup(EMPTY_FLOW_DSL);
    typeAndBuild(exampleFromPrompt());
    fireEvent.click(screen.getByTestId('toast-action'));

    // Step 4 of 7 is the decision; its fork line lists both branches in edge order.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 7');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('it bounces');
    expect(screen.getByTestId('walk-through-paths')).toHaveTextContent('Yes → Retry once · No → Flag for review');
    expect(screen.getByTestId('walk-through-paths')).toHaveAttribute(
      'title',
      'Yes → Retry once · No → Flag for review',
    );

    // The Yes step announces how it was reached; the No step likewise.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Retry once');
    expect(screen.getByTestId('walk-through-from')).toHaveTextContent('If “it bounces”: Yes');

    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Flag for review');
    expect(screen.getByTestId('walk-through-from')).toHaveTextContent('If “it bounces”: No');
    // Flag for review has one outgoing edge → no fork line here.
    expect(screen.queryByTestId('walk-through-paths')).toBeNull();
  });

  it('unlabelled 2-way fork shows bare arrows and no arrived-by line', () => {
    setup(UNLABELLED_FORK_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 3');
    expect(screen.getByTestId('walk-through-paths')).toHaveTextContent('→ B · → C');

    // Targets of an unlabelled fork get no arrived-by line.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 2 of 3');
    expect(screen.queryByTestId('walk-through-from')).toBeNull();
    expect(screen.queryByTestId('walk-through-paths')).toBeNull();
  });

  it('caps the fork line at 3 paths with a +N more tail; title holds the full text', () => {
    setup(CAP_FORK_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    const paths = screen.getByTestId('walk-through-paths');
    expect(paths).toHaveTextContent('one → B · two → C · three → D · +1 more');
    expect(paths).toHaveAttribute('title', 'one → B · two → C · three → D · +1 more');
  });
});

describe('walk-through choose (DT-AI-19)', () => {
  // The worked example at the end of AI_PROMPT_TEXT, everything after the
  // "Example" line — same extraction rule as copyAiPrompt.test.tsx.
  function exampleFromPrompt(): string {
    const idx = AI_PROMPT_TEXT.indexOf('Example');
    expect(idx).toBeGreaterThan(-1);
    const lineEnd = AI_PROMPT_TEXT.indexOf('\n', idx);
    return AI_PROMPT_TEXT.slice(lineEnd + 1).trim();
  }

  function typeAndBuild(steps: string) {
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: steps } });
    fireEvent.click(screen.getByTestId('build-steps'));
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
  }

  it('worked example: clicking the No choose button jumps to the No target with its arrived-by line', () => {
    setup(EMPTY_FLOW_DSL);
    typeAndBuild(exampleFromPrompt());
    fireEvent.click(screen.getByTestId('toast-action'));

    // Advance to the decision (step 4 of 7) — the fork line gains choose buttons.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 7');
    expect(screen.getByTestId('walk-through-paths')).toHaveTextContent('Yes → Retry once · No → Flag for review');

    const choose = screen.getByTestId('walk-through-choose');
    expect(within(choose).getByTestId('walk-through-choose-0')).toHaveTextContent('Yes');
    expect(within(choose).getByTestId('walk-through-choose-1')).toHaveTextContent('No');

    // Choose No: the walk jumps to that branch's target step only.
    fireEvent.click(within(choose).getByTestId('walk-through-choose-1'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 6 of 7');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Flag for review');
    expect(screen.getByTestId('walk-through-from')).toHaveTextContent('If “it bounces”: No');

    // Prev follows the path taken: back to the decision, not the topological prior.
    fireEvent.click(screen.getByTestId('walk-through-prev'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 7');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('it bounces');

    // Next keeps today's linear/topo advance for full-board tours.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Retry once');
  });

  it('choose on an unlabelled 2-way fork jumps to the target; Prev undoes the jump', () => {
    setup(UNLABELLED_FORK_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 3');
    const choose = screen.getByTestId('walk-through-choose');
    expect(within(choose).getByTestId('walk-through-choose-0')).toHaveTextContent('→ B');
    expect(within(choose).getByTestId('walk-through-choose-1')).toHaveTextContent('→ C');

    fireEvent.click(within(choose).getByTestId('walk-through-choose-1'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 3 of 3');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('C');
    expect(screen.queryByTestId('walk-through-from')).toBeNull();

    fireEvent.click(screen.getByTestId('walk-through-prev'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 3');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('A');
  });
});

describe('walk-through path highlights (DT-AI-20)', () => {
  // The worked example at the end of AI_PROMPT_TEXT, everything after the
  // "Example" line — same extraction rule as copyAiPrompt.test.tsx.
  function exampleFromPrompt(): string {
    const idx = AI_PROMPT_TEXT.indexOf('Example');
    expect(idx).toBeGreaterThan(-1);
    const lineEnd = AI_PROMPT_TEXT.indexOf('\n', idx);
    return AI_PROMPT_TEXT.slice(lineEnd + 1).trim();
  }

  function typeAndBuild(steps: string) {
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: steps } });
    fireEvent.click(screen.getByTestId('build-steps'));
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
  }

  const displayLabel = (n: DiagramNode): string =>
    n.type === 'flow' ? (n.properties.label ?? n.name) : n.name;

  function edgeIdOf(parsed: ParsedDiagram, fromLabel: string, toLabel: string): string {
    const from = parsed.nodes.find(n => displayLabel(n) === fromLabel);
    const to = parsed.nodes.find(n => displayLabel(n) === toLabel);
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    const edge = parsed.edges.find(e => e.from === from!.id && e.to === to!.id);
    expect(edge).toBeDefined();
    return edge!.id;
  }

  function activeEdgeId(container: HTMLElement): string | null {
    return container.querySelector('[data-testid="walk-through-edge-active"]')?.getAttribute('data-edge-id') ?? null;
  }

  function trailEdgeIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('[data-testid="walk-through-edge-trail"]'))
      .map(el => el.getAttribute('data-edge-id'))
      .filter((id): id is string => id !== null)
      .sort();
  }

  function nodeIdOf(parsed: ParsedDiagram, label: string): string {
    const node = parsed.nodes.find(n => displayLabel(n) === label);
    expect(node).toBeDefined();
    return node!.id;
  }

  function nodeEl(container: HTMLElement, id: string): HTMLElement {
    return container.querySelector(`[data-id="${id}"]`) as HTMLElement;
  }

  function trailNodeIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('[data-testid="walk-through-node-trail"]'))
      .map(el => el.getAttribute('data-node-id'))
      .filter((id): id is string => id !== null)
      .sort();
  }

  // DT-AI-21 mid-opacity constant for session-path trail nodes (DiagramCanvas
  // WALK_TRAIL_NODE_OPACITY). Inclusive range allowed by acceptance: 0.45–0.65.
  const TRAIL_MID_OPACITY = '0.55';

  it('worked example: Choose No marks the edge into Flag for review active and earlier hops as trail; Exit clears', () => {
    const { container } = setup(EMPTY_FLOW_DSL);
    typeAndBuild(exampleFromPrompt());
    fireEvent.click(screen.getByTestId('toast-action'));

    // Next to the decision (step 4 of 7): its arrived-by edge is active, and
    // its fork arms are NOT pre-highlighted.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 7');
    const parsed = useDiagramStore.getState().parsedDiagram!;
    const yesEdge = edgeIdOf(parsed, 'it bounces', 'Retry once');
    const noEdge = edgeIdOf(parsed, 'it bounces', 'Flag for review');
    expect(activeEdgeId(container)).toBe(edgeIdOf(parsed, 'Send the reply', 'it bounces'));
    expect(trailEdgeIds(container)).toEqual([
      edgeIdOf(parsed, 'read the support ticket', 'Draft a reply'),
      edgeIdOf(parsed, 'Draft a reply', 'Send the reply'),
    ].sort());
    for (const el of container.querySelectorAll(`[data-id="${yesEdge}"], [data-id="${noEdge}"]`)) {
      expect(el.getAttribute('data-testid')).toBeNull();
    }
    // The untaken fork arm is neither active nor in the trail.
    expect(trailEdgeIds(container)).not.toContain(yesEdge);

    // Choose No → the taken edge becomes active; the session path so far trails.
    fireEvent.click(within(screen.getByTestId('walk-through-choose')).getByTestId('walk-through-choose-1'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Flag for review');
    expect(activeEdgeId(container)).toBe(noEdge);
    expect(trailEdgeIds(container)).toEqual([
      edgeIdOf(parsed, 'Draft a reply', 'Send the reply'),
      edgeIdOf(parsed, 'Send the reply', 'it bounces'),
      edgeIdOf(parsed, 'read the support ticket', 'Draft a reply'),
    ].sort());
    // The active edge is not also marked as trail.
    expect(trailEdgeIds(container)).not.toContain(noEdge);

    // DT-AI-21: taken-path nodes are current or trail-mid; untaken Yes target
    // stays at heavy dim with no trail marker.
    const pathLabels = [
      'read the support ticket',
      'Draft a reply',
      'Send the reply',
      'it bounces',
      'Flag for review',
    ];
    const flagId = nodeIdOf(parsed, 'Flag for review');
    const retryId = nodeIdOf(parsed, 'Retry once');
    for (const label of pathLabels) {
      const id = nodeIdOf(parsed, label);
      const el = nodeEl(container, id);
      if (id === flagId) {
        expect(el.style.opacity).toBe('1');
        expect(trailNodeIds(container)).not.toContain(id);
      } else {
        expect(el.style.opacity).toBe(TRAIL_MID_OPACITY);
        expect(trailNodeIds(container)).toContain(id);
      }
    }
    expect(nodeEl(container, retryId).style.opacity).toBe('0.15');
    expect(trailNodeIds(container)).not.toContain(retryId);

    // Exit clears both trail and active markers (edges + nodes) and restores
    // default opacities (empty string / unset).
    fireEvent.click(screen.getByTestId('walk-through-exit'));
    expect(container.querySelector('[data-testid="walk-through-edge-active"]')).toBeNull();
    expect(container.querySelector('[data-testid="walk-through-edge-trail"]')).toBeNull();
    expect(container.querySelector('[data-testid="walk-through-node-trail"]')).toBeNull();
    expect(nodeEl(container, flagId).style.opacity).toBe('');
    expect(nodeEl(container, retryId).style.opacity).toBe('');
    expect(nodeEl(container, nodeIdOf(parsed, 'read the support ticket')).style.opacity).toBe('');
  });

  it('linear no-fork board: each arrival highlights its single incoming edge; prior hops trail', () => {
    const { container } = setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));

    const parsed = useDiagramStore.getState().parsedDiagram!;
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Model');
    expect(activeEdgeId(container)).toBe(edgeIdOf(parsed, 'Human ask', 'Model'));
    // After one hop: prior node is trail-mid; neighbour not yet visited stays 0.15.
    expect(nodeEl(container, 'ask').style.opacity).toBe(TRAIL_MID_OPACITY);
    expect(nodeEl(container, 'model').style.opacity).toBe('1');
    expect(nodeEl(container, 'tool').style.opacity).toBe('0.15');
    expect(trailNodeIds(container)).toEqual(['ask']);

    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Tool');
    expect(activeEdgeId(container)).toBe(edgeIdOf(parsed, 'Model', 'Tool'));
    expect(trailEdgeIds(container)).toEqual([edgeIdOf(parsed, 'Human ask', 'Model')]);
    // After two Next hops the first node is trail-mid, not 0.15.
    expect(nodeEl(container, 'ask').style.opacity).toBe(TRAIL_MID_OPACITY);
    expect(nodeEl(container, 'model').style.opacity).toBe(TRAIL_MID_OPACITY);
    expect(nodeEl(container, 'tool').style.opacity).toBe('1');
    expect(trailNodeIds(container)).toEqual(['ask', 'model']);
  });
});

describe('walk-through Copy path (DT-AI-22)', () => {
  function exampleFromPrompt(): string {
    const idx = AI_PROMPT_TEXT.indexOf('Example');
    expect(idx).toBeGreaterThan(-1);
    const lineEnd = AI_PROMPT_TEXT.indexOf('\n', idx);
    return AI_PROMPT_TEXT.slice(lineEnd + 1).trim();
  }

  function typeAndBuild(steps: string) {
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: steps } });
    fireEvent.click(screen.getByTestId('build-steps'));
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
  }

  function mockClipboard(): { writeText: ReturnType<typeof vi.fn> } {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    return { writeText };
  }

  it('shows Copy path next to Prev/Next/Exit while walking and removes it after Exit', () => {
    setup(FLOW_DSL);
    expect(screen.queryByTestId('walk-through-copy-path')).toBeNull();
    fireEvent.click(screen.getByTestId('walk-through'));
    expect(screen.getByTestId('walk-through-copy-path')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('walk-through-exit'));
    expect(screen.queryByTestId('walk-through-copy-path')).toBeNull();
  });

  it('worked example: Choose No copies the numbered taken path with (No) appended; Retry once excluded', async () => {
    const { writeText } = mockClipboard();
    setup(EMPTY_FLOW_DSL);
    typeAndBuild(exampleFromPrompt());
    fireEvent.click(screen.getByTestId('toast-action'));

    // Next to the decision (step 4 of 7), then Choose No.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(within(screen.getByTestId('walk-through-choose')).getByTestId('walk-through-choose-1'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Flag for review');

    // Copy path → one numbered line per taken hop; the fork hop carries (No).
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      [
        '1. read the support ticket',
        '2. Draft a reply',
        '3. Send the reply',
        '4. it bounces',
        '5. Flag for review (No)',
      ].join('\n'),
    );
  });

  it('button flips to Copied for a short moment, then back to Copy path', async () => {
    mockClipboard();
    setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByTestId('walk-through-copy-path')).toHaveTextContent('Copy path'),
      { timeout: 3000 },
    );
  });

  it('step 1 with empty stack copies a single numbered line for the start node', async () => {
    const { writeText } = mockClipboard();
    setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 6');
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('1. Human ask');
  });

  it('unlabelled fork: choosing an arm copies the target line with no branch suffix', async () => {
    const { writeText } = mockClipboard();
    setup(UNLABELLED_FORK_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));
    fireEvent.click(within(screen.getByTestId('walk-through-choose')).getByTestId('walk-through-choose-1'));
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(['1. A', '2. C'].join('\n'));
  });

  it('clipboard failure stays silent on the board and keeps the Copy path label', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    Object.assign(navigator, { clipboard: { writeText } });
    setup(FLOW_DSL);
    fireEvent.click(screen.getByTestId('walk-through'));
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    // Give the rejected promise a tick to settle.
    await waitFor(() => {
      expect(screen.getByTestId('walk-through-copy-path')).toHaveTextContent('Copy path');
      expect(screen.queryByText('Copied')).toBeNull();
    });
  });
});

describe('Shared read-only banner Walk through (DT-AI-23)', () => {
  function mockSharedClient(input: { title: string; mode: BoardMode; dslText: string }): SupabaseClientLike {
    const payload = buildBoardDocument(input, '2026-10-16T09:00:00.000Z');
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithOtp: async () => ({ error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: () => {
        throw new Error('unexpected from() in shared read-only test');
      },
      rpc: vi.fn(async () => ({
        data: [
          {
            id: 'shared-row-1',
            title: input.title,
            payload,
            updated_at: '2026-10-16T09:00:00.000Z',
          },
        ],
        error: null,
      })),
    };
  }

  beforeEach(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    useDiagramStore.setState({
      isReadOnlyShared: false,
      sharedBoardTitle: null,
      walkThroughStep: null,
      walkThroughStack: [],
    });
  });

  afterEach(() => {
    setSupabaseClientForTests(undefined);
    window.history.replaceState({}, '', '/');
    useDiagramStore.setState({
      isReadOnlyShared: false,
      sharedBoardTitle: null,
      walkThroughStep: null,
      walkThroughStack: [],
    });
  });

  it('shows Walk through beside Save a copy on a shared Flow board with steps, starts walk, and preserves read-only on Exit', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    setSupabaseClientForTests(
      mockSharedClient({
        title: 'Shared AI Workflow',
        mode: 'flow',
        dslText: FLOW_DSL,
      }),
    );
    window.history.replaceState({}, '', '/app/?share=tok_flow_23');

    const { container } = render(<App />);

    const banner = await screen.findByTestId('shared-readonly-banner');
    expect(banner).toHaveTextContent('Shared AI Workflow');
    expect(within(banner).getByTestId('shared-save-local-copy')).toBeInTheDocument();
    const walkBtn = within(banner).getByTestId('shared-walk-through');
    expect(walkBtn).toHaveAccessibleName('Walk through');

    // Click starts walk-through at step 1 via the existing store/canvas path.
    fireEvent.click(walkBtn);
    expect(useDiagramStore.getState().walkThroughStep).toBe(0);
    expect(useDiagramStore.getState().isReadOnlyShared).toBe(true);
    expect(screen.getByTestId('walk-through-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 1 of 6');
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Human ask');

    // Advance to the decision (step 4: Check) — trails, Choose, and Copy path work as normal.
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Step 4 of 6');
    expect(container.querySelector('[data-testid="walk-through-node-trail"]')).not.toBeNull();

    // Choose branch at decision ('ok' -> Reply).
    fireEvent.click(within(screen.getByTestId('walk-through-choose')).getByTestId('walk-through-choose-1'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('Reply');

    // Copy path works on shared Flow board.
    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      ['1. Human ask', '2. Model', '3. Tool', '4. Check', '5. Reply (ok)'].join('\n'),
    );

    // Exit leaves isReadOnlyShared true and the amber banner intact.
    fireEvent.click(screen.getByTestId('walk-through-exit'));
    expect(screen.queryByTestId('walk-through-overlay')).toBeNull();
    expect(useDiagramStore.getState().walkThroughStep).toBeNull();
    expect(useDiagramStore.getState().isReadOnlyShared).toBe(true);
    expect(screen.getByTestId('shared-readonly-banner')).toBeInTheDocument();
  });

  it.each([
    {
      label: 'empty Flow board (zero walk steps)',
      mode: 'flow' as BoardMode,
      dslText: EMPTY_FLOW_DSL,
    },
    {
      label: 'Architecture board',
      mode: 'architecture' as BoardMode,
      dslText: ARCH_DSL,
    },
    {
      label: 'Sequence board',
      mode: 'sequence' as BoardMode,
      dslText: 'sequenceDiagram\nAlice->>Bob: hi',
    },
    {
      label: 'Gantt board',
      mode: 'gantt' as BoardMode,
      dslText: 'diagram: gantt\ntitle: Plan\nstart: 2026-10-16\ntask T1 {\n  start: 2026-10-16\n  end: 2026-10-18\n}',
    },
  ])('hides Walk through on shared $label with no crash and no toast spam', async ({ mode, dslText }) => {
    setSupabaseClientForTests(
      mockSharedClient({
        title: `Shared ${mode}`,
        mode,
        dslText,
      }),
    );
    window.history.replaceState({}, '', `/app/?share=tok_${mode}`);

    render(<App />);

    const banner = await screen.findByTestId('shared-readonly-banner');
    expect(within(banner).getByTestId('shared-save-local-copy')).toBeInTheDocument();
    expect(within(banner).queryByTestId('shared-walk-through')).toBeNull();
    expect(screen.queryByTestId('toast-item')).toBeNull();
  });
});

describe('walk-through loop target (DT-AI-25)', () => {
  function mockClipboard(): { writeText: ReturnType<typeof vi.fn> } {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    return { writeText };
  }

  it('Choose offers the loop target and Copy path shows the revisit', async () => {
    const { writeText } = mockClipboard();
    setup(EMPTY_FLOW_DSL);
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), {
      target: {
        value: 'Model: draft reply\nCheck: quality ok?\nIf no then go back to draft reply\nSend',
      },
    });
    fireEvent.click(screen.getByTestId('build-steps'));
    expect(screen.getByTestId('toast-item')).toHaveTextContent('Built 4 steps onto the board · 1 Model · 1 Check');
    expect(screen.getByTestId('toast-item')).not.toHaveTextContent('not found');

    fireEvent.click(screen.getByTestId('toast-action'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    fireEvent.click(screen.getByTestId('walk-through-next'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('no');

    const choose = screen.getByTestId('walk-through-choose');
    expect(within(choose).getByTestId('walk-through-choose-0')).toHaveTextContent('Yes');
    fireEvent.click(within(choose).getByTestId('walk-through-choose-0'));
    expect(screen.getByTestId('walk-through-caption')).toHaveTextContent('draft reply');

    fireEvent.click(screen.getByTestId('walk-through-copy-path'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      ['1. draft reply', '2. quality ok?', '3. no', '4. draft reply (Yes)'].join('\n'),
    );
  });
});
