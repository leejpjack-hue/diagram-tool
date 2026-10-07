// DT-AI-17 — Copy AI prompt: the fixed constant (length + format), the
// clipboard copy and error paths with toasts, and a round-trip that feeds the
// prompt's own worked example through Type steps → Build board so the prompt
// and the parser can never drift apart.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { AI_PROMPT_TEXT } from './aiPrompt';
import { useDiagramStore } from '../../store/diagramStore';
import { plainStepsToDSL } from '../../parser/plainSteps';
import { statsFromPlainStepsDsl } from './buildFromStepsPanel';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

// The worked example is everything after the "Example" line, so an edit to the
// prompt's example is exactly what this suite re-verifies.
function exampleFromPrompt(): string {
  const idx = AI_PROMPT_TEXT.indexOf('Example');
  expect(idx).toBeGreaterThan(-1);
  const lineEnd = AI_PROMPT_TEXT.indexOf('\n', idx);
  return AI_PROMPT_TEXT.slice(lineEnd + 1).trim();
}

function setup() {
  useDiagramStore.setState({
    dslText: 'diagram: flow\ntitle: "Empty"\n',
    parsedDiagram: null,
    diagramMode: 'flow',
    error: null,
  });
  return render(<DSLEditor />);
}

function openTypeSteps() {
  fireEvent.click(screen.getByTestId('toggle-type-steps'));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AI_PROMPT_TEXT constant (DT-AI-17)', () => {
  it('is a single constant of at most 1200 characters', () => {
    expect(AI_PROMPT_TEXT.length).toBeLessThanOrEqual(1200);
  });

  it('mentions the supported role words, then, If/then/else, and the note separator', () => {
    for (const fragment of [
      'Human:', 'User:', 'Model:', 'Assistant:', 'AI:', 'Tool:', 'Check:', 'System:',
      'then', 'If', 'else', ' — ',
    ]) {
      expect(AI_PROMPT_TEXT).toContain(fragment);
    }
  });

  it('carries one worked example of 4–6 lines', () => {
    const lines = exampleFromPrompt().split('\n').filter(l => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines.length).toBeLessThanOrEqual(6);
  });
});

describe('Copy AI prompt button (DT-AI-17)', () => {
  it('copies the constant and shows the success toast "AI prompt copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    openTypeSteps();

    fireEvent.click(screen.getByTestId('copy-ai-prompt'));

    expect(writeText).toHaveBeenCalledWith(AI_PROMPT_TEXT);
    expect(await screen.findByTestId('toast-item')).toHaveTextContent('AI prompt copied');
  });

  it('clipboard failure shows an error toast and changes nothing', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    openTypeSteps();

    fireEvent.click(screen.getByTestId('copy-ai-prompt'));

    const toast = await screen.findByTestId('toast-item');
    expect(toast).toHaveTextContent(/clipboard blocked/i);
    expect(toast).not.toHaveTextContent('AI prompt copied');
    // No clipboard content, no state change: the steps textarea is untouched.
    expect((screen.getByTestId('type-steps-input') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('prompt worked example round-trip (DT-AI-17)', () => {
  it('Build board parses the example into the expected steps, roles and notes', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    setup();
    openTypeSteps();

    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: exampleFromPrompt() } });
    fireEvent.click(screen.getByTestId('build-steps'));

    // 7 steps with 1 Model and 1 Tool role, from the example's 5 lines: the
    // If line contributes the decision node plus its two branches.
    expect(screen.getByTestId('toast-item')).toHaveTextContent('Built 7 steps onto the board · 1 Model · 1 Tool');

    const parsed = useDiagramStore.getState().parsedDiagram;
    expect(parsed?.mode).toBe('flow');
    const flowNodes = parsed!.nodes.filter(n => n.type === 'flow');
    expect(flowNodes).toHaveLength(7);

    const roles = flowNodes.map(n => n.properties.role).filter(Boolean);
    expect(roles.sort()).toEqual(['model', 'tool']);

    const noted = flowNodes.filter(n => n.properties.note);
    expect(noted).toHaveLength(1);
    expect(noted[0].properties.label).toBe('Draft a reply');
    expect(noted[0].properties.note).toBe('reuse the last 3 tickets');

    // Decision node with Yes/No branches from the If/then/else line.
    const decisions = flowNodes.filter(n => n.properties.nodeType === 'decision');
    expect(decisions).toHaveLength(1);
    const branchLabels = useDiagramStore.getState().parsedDiagram!.edges
      .map(e => e.label)
      .filter(Boolean)
      .sort();
    expect(branchLabels).toEqual(['No', 'Yes']);
  });

  it('the same example round-trips through the parser without a component', () => {
    const stats = statsFromPlainStepsDsl(plainStepsToDSL(exampleFromPrompt()));
    expect(stats.stepCount).toBe(7);
    expect(stats.roles).toEqual({ human: 0, model: 1, tool: 1, check: 0 });
  });
});
