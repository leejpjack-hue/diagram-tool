import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { activateSkill, getSkillCatalog, runTypeToFlow } from '../../utils/skillsHost';
import ambiguous from '../../../fixtures/type-to-flow/ambiguous-decision.json';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

vi.mock('../../utils/skillsHost', async () => {
  const actual = await vi.importActual<typeof import('../../utils/skillsHost')>('../../utils/skillsHost');
  return {
    ...actual,
    getSkillCatalog: vi.fn(),
    activateSkill: vi.fn(),
    runTypeToFlow: vi.fn(),
  };
});

const catalog = vi.mocked(getSkillCatalog);
const activate = vi.mocked(activateSkill);
const run = vi.mocked(runTypeToFlow);

const ORIGINAL = 'diagram: flow\ntitle: "Keep me"\n\nstart Begin\nnode Begin {\n  label: "Begin"\n  type: process\n}\n';
const STEPS = 'Start review\nIf approved?\nSend the reply\nDone';

function setup() {
  useDiagramStore.setState({
    dslText: ORIGINAL,
    parsedDiagram: null,
    diagramMode: 'flow',
    error: null,
    isReadOnlyShared: false,
  });
  return render(<DSLEditor />);
}

beforeEach(() => {
  catalog.mockReset();
  activate.mockReset();
  run.mockReset();
  catalog.mockResolvedValue([]);
  activate.mockResolvedValue('activated');
  run.mockResolvedValue(ambiguous);
});

describe('ambiguous decision edges wait for confirm', () => {
  it('lists the named sentence and cancel leaves the board byte-identical', async () => {
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: STEPS } });
    fireEvent.click(screen.getByTestId('run-type-to-flow'));

    expect(await screen.findByTestId('ambiguity-list')).toBeInTheDocument();
    expect(screen.getByTestId('ambiguity-name')).toHaveTextContent('n2');
    expect(screen.getByTestId('ambiguity-sentence')).toHaveTextContent(ambiguous.ambiguities[0].sentence);
    expect(screen.getByTestId('ambiguity-sentence').textContent?.split('.').length).toBe(2);
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);
    expect(screen.queryByTestId('skill-mermaid-pane')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ambiguity-cancel'));
    expect(screen.queryByTestId('ambiguity-list')).not.toBeInTheDocument();
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);
  });

  it('confirm writes the inferred no edge and edit writes a different no edge', async () => {
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: STEPS } });
    fireEvent.click(screen.getByTestId('run-type-to-flow'));
    await screen.findByTestId('ambiguity-list');
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);

    fireEvent.change(screen.getByTestId('ambiguity-no-target-n2'), { target: { value: 'n3' } });
    fireEvent.click(screen.getByTestId('ambiguity-confirm'));

    const committed = useDiagramStore.getState().dslText;
    expect(committed).not.toBe(ORIGINAL);
    expect(committed).toContain('n2 ->|"no"| n3');
    expect(committed).not.toContain('n2 ->|"no"| n4');
    expect(await screen.findByTestId('skill-mermaid-pane')).toHaveTextContent('n2 -->|"no"| n3');
  });

  it('activate holds the same list and does not map until confirm', async () => {
    catalog.mockResolvedValue([{
      name: 'type-to-flow',
      description: 'Convert a workflow.',
      location: '/workspace/.agents/skills/type-to-flow',
    }]);
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: STEPS } });
    fireEvent.click(await screen.findByRole('button', { name: 'Activate type-to-flow' }));

    expect(await screen.findByTestId('skill-activate-note')).toHaveTextContent('The board was not changed.');
    expect(await screen.findByTestId('ambiguity-sentence')).toHaveTextContent(ambiguous.ambiguities[0].sentence);
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);

    fireEvent.click(screen.getByTestId('ambiguity-confirm'));
    expect(useDiagramStore.getState().dslText).toContain('n2 ->|"no"| n4');
  });
});
