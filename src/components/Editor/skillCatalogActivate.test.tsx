import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';
import { activateSkill, getSkillCatalog, runTypeToFlow } from '../../utils/skillsHost';
import fixture from '../../../fixtures/type-to-flow/spike-output.json';

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

async function activateTypeToFlow() {
  fireEvent.click(await screen.findByRole('button', { name: 'Activate type-to-flow' }));
}

beforeEach(() => {
  catalog.mockReset();
  activate.mockReset();
  run.mockReset();
  catalog.mockResolvedValue([{
    name: 'type-to-flow',
    description: 'Convert a workflow.',
    location: '/workspace/.agents/skills/type-to-flow',
  }]);
  activate.mockResolvedValue('activated');
  run.mockResolvedValue(fixture);
});

describe('catalog activate leaves the board intact until map succeeds', () => {
  it('does not change the board when activate fails', async () => {
    activate.mockRejectedValue(new Error('Skill not found.'));
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: 'Receive request' } });
    await activateTypeToFlow();
    expect(await screen.findByTestId('skill-activate-error')).toHaveTextContent('Skill not found.');
    expect(run).not.toHaveBeenCalled();
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);
  });

  it('does not change the board when mapping fails after activate', async () => {
    run.mockRejectedValue(new Error('Skill unavailable.'));
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: 'Receive request' } });
    await activateTypeToFlow();
    expect(await screen.findByTestId('skill-activate-error')).toHaveTextContent('Skill unavailable.');
    expect(activate).toHaveBeenCalledWith('type-to-flow');
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);
    expect(screen.queryByTestId('skill-mermaid-pane')).not.toBeInTheDocument();
  });

  it('maps the board only after activate and a valid run', async () => {
    setup();
    fireEvent.click(screen.getByTestId('toggle-type-steps'));
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: 'Receive request' } });
    await activateTypeToFlow();
    expect(await screen.findByTestId('skill-activate-note')).toHaveTextContent('mapped it onto this board');
    expect(activate).toHaveBeenCalledWith('type-to-flow');
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ text: 'Receive request' }));
    expect(useDiagramStore.getState().dslText).not.toBe(ORIGINAL);
    expect(useDiagramStore.getState().dslText).toContain(`title: "${fixture.flow.title}"`);
    expect(screen.getByTestId('skill-mermaid-pane')).toHaveTextContent(/flowchart TD/);
  });

  it('activates a non-mapping skill without changing the board', async () => {
    catalog.mockResolvedValue([{
      name: 'review-notes',
      description: 'Summarise a board in plain language.',
      location: '/workspace/.agents/skills/review-notes',
    }]);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Activate review-notes' }));
    expect(await screen.findByTestId('skill-activate-note')).toHaveTextContent('The board was not changed.');
    expect(run).not.toHaveBeenCalled();
    expect(useDiagramStore.getState().dslText).toBe(ORIGINAL);
  });
});
