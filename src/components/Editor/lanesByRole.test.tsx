import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { plainStepsToDSL } from '../../parser/plainSteps';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const STEPS = 'Human: ask\nModel: draft\nTool: search\nCheck: review\nSend';

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

function checkbox() {
  return screen.getByTestId('type-steps-lanes-by-role') as HTMLInputElement;
}

describe('Lanes by role (DT-AI-27)', () => {
  it('defaults the checkbox off', () => {
    setup();
    openTypeSteps();
    expect(checkbox().checked).toBe(false);
  });

  it('build with the box off matches today, and Load steps leaves it off', () => {
    setup();
    openTypeSteps();
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: STEPS } });
    fireEvent.click(screen.getByTestId('build-steps'));

    const title = '"Empty"';
    expect(useDiagramStore.getState().dslText).toBe(plainStepsToDSL(STEPS, { title }));
    expect(useDiagramStore.getState().dslText).not.toMatch(/^lane /m);

    fireEvent.click(checkbox());
    expect(checkbox().checked).toBe(true);
    fireEvent.click(screen.getByTestId('load-steps'));
    expect(checkbox().checked).toBe(false);
  });

  it('build with the box on emits role lanes, and Load steps ticks it', () => {
    setup();
    openTypeSteps();
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: STEPS } });
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByTestId('build-steps'));

    const dsl = useDiagramStore.getState().dslText;
    expect(dsl).toBe(plainStepsToDSL(STEPS, { title: '"Empty"', lanesByRole: true }));
    expect(dsl).toContain('lane Human');
    expect(dsl).toContain('lane "AI agent"');
    expect(dsl).toContain('lane Tool');
    expect(useDiagramStore.getState().parsedDiagram?.lanes?.map(lane => lane.name)).toEqual([
      'Human',
      'AI agent',
      'Tool',
      'Check',
      'Other',
    ]);

    fireEvent.click(checkbox());
    expect(checkbox().checked).toBe(false);
    fireEvent.click(screen.getByTestId('load-steps'));
    expect(checkbox().checked).toBe(true);
    expect((screen.getByTestId('type-steps-input') as HTMLTextAreaElement).value).toBe(STEPS);
  });
});
