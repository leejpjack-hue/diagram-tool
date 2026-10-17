import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DSLEditor } from './DSLEditor';
import { useDiagramStore } from '../../store/diagramStore';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-stub" />,
}));

const OPEN_KEY = 'diagram-tool-type-steps-preview-open';
const originalMatchMedia = window.matchMedia;

function setup() {
  useDiagramStore.setState({
    dslText: 'diagram: flow\ntitle: "Empty"\n',
    parsedDiagram: null,
    diagramMode: 'flow',
    error: null,
    iconStyle: 'clean',
  });
  return render(<DSLEditor />);
}

function openTypeSteps() {
  fireEvent.click(screen.getByTestId('toggle-type-steps'));
}

function mockNarrow(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matches && query.includes('640'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  localStorage.removeItem(OPEN_KEY);
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else Reflect.deleteProperty(window, 'matchMedia');
});

describe('Understood as preview (DT-AI-28)', () => {
  it('shows a polite summary and does not change the board until Build', async () => {
    setup();
    openTypeSteps();
    const before = useDiagramStore.getState().dslText;
    expect(screen.getByTestId('type-steps-preview-summary')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('type-steps-preview-summary')).toHaveTextContent('0 steps, 0 warnings');

    fireEvent.change(screen.getByTestId('type-steps-input'), {
      target: { value: 'Humna: ask\nModel: draft — reuse tickets' },
    });
    expect(useDiagramStore.getState().dslText).toBe(before);

    await waitFor(() => {
      expect(screen.getByTestId('type-steps-preview-summary')).toHaveTextContent('2 steps, 1 warning');
    });
    expect(screen.getByRole('list', { name: 'Understood as' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Understood as' })).not.toHaveAttribute('aria-live');

    const rows = screen.getAllByTestId('type-steps-preview-row');
    expect(rows[0]).toHaveTextContent('Did you mean Human:?');
    expect(rows[1]).toHaveTextContent('model');
    expect(rows[1]).toHaveTextContent('draft');
    expect(rows[1]).toHaveTextContent('reuse tickets');
    expect(rows[1].querySelector('[data-icon-name="user"]')).toBeNull();
    expect(rows[1].querySelector('[data-icon-name="sparkles"]')).not.toBeNull();
    expect(useDiagramStore.getState().dslText).toBe(before);

    fireEvent.click(screen.getByTestId('build-steps'));
    expect(useDiagramStore.getState().dslText).toContain('role: model');
    expect(useDiagramStore.getState().dslText).toContain('note: "reuse tickets"');
    expect(useDiagramStore.getState().dslText).not.toBe(before);
  });

  it('focuses the warning line in the textarea', async () => {
    setup();
    openTypeSteps();
    const value = 'Send\n\nHumna: ask';
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value } });
    await waitFor(() => {
      expect(screen.getByText('Did you mean Human:?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Did you mean Human:?'));
    const input = screen.getByTestId('type-steps-input') as HTMLTextAreaElement;
    expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('Humna: ask');
  });

  it('starts open, collapses on a narrow viewport, and remembers the toggle', async () => {
    setup();
    openTypeSteps();
    expect(screen.getByTestId('type-steps-preview-toggle')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: 'Ship the order' } });
    await waitFor(() => {
      expect(screen.getByTestId('type-steps-preview-row')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('type-steps-preview-toggle'));
    expect(localStorage.getItem(OPEN_KEY)).toBe('0');
    expect(screen.queryByTestId('type-steps-preview-row')).not.toBeInTheDocument();
    expect(screen.getByTestId('type-steps-preview-summary')).toHaveTextContent('1 step, 0 warnings');

    fireEvent.click(screen.getByTestId('type-steps-preview-toggle'));
    expect(localStorage.getItem(OPEN_KEY)).toBe('1');
    expect(screen.getByTestId('type-steps-preview-row')).toBeInTheDocument();
  });

  it('starts collapsed at 640px when nothing is remembered', () => {
    mockNarrow(true);
    setup();
    openTypeSteps();
    expect(screen.getByTestId('type-steps-preview-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('type-steps-preview-row')).not.toBeInTheDocument();
    expect(screen.getByTestId('type-steps-preview-summary')).toBeInTheDocument();
  });

  it('uses the active icon style on the role mark', async () => {
    setup();
    useDiagramStore.setState({ iconStyle: 'bold' });
    openTypeSteps();
    fireEvent.change(screen.getByTestId('type-steps-input'), { target: { value: 'Model: draft' } });
    await waitFor(() => {
      expect(screen.getByTestId('type-steps-preview-icon')).toHaveAttribute('data-icon-style', 'bold');
    });
    expect(screen.getByTestId('type-steps-preview-icon')).toHaveAttribute('data-icon-name', 'sparkles');
  });
});
