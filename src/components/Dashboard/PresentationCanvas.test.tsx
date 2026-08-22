import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../../utils/boardManager';
import { boardManager } from '../../utils/boardManager';
import { PresentationCanvas } from './PresentationCanvas';

vi.mock('../../utils/boardManager', async importOriginal => {
  const actual = await importOriginal<typeof import('../../utils/boardManager')>();
  return {
    ...actual,
    boardManager: {
      ...actual.boardManager,
      setPresentation: vi.fn().mockResolvedValue(undefined),
    },
  };
});

const board: Board = {
  id: 'board-1',
  title: 'Architecture review',
  description: '',
  mode: 'architecture',
  dslText: 'diagram: architecture',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  tags: [],
  starred: false,
  schemaVersion: 2,
};

function setup() {
  return render(
    <PresentationCanvas
      board={board}
      currentDiagramImage={null}
      onClose={vi.fn()}
      notify={vi.fn()}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PresentationCanvas creation tools', () => {
  it('draws a shape, duplicates it, and undoes the duplicate', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes (R)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));

    const stage = screen.getByRole('main');
    fireEvent.pointerDown(stage, { clientX: 120, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 240 });
    fireEvent.pointerUp(window);

    expect(screen.getByLabelText('Shape text')).toBeInTheDocument();
    expect(screen.getByText('Presentation canvas · 1 object')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Duplicate'));
    expect(screen.getByText('Presentation canvas · 2 objects')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Undo (Ctrl/⌘ Z)'));
    expect(screen.getByText('Presentation canvas · 1 object')).toBeInTheDocument();

    await waitFor(() => expect(boardManager.setPresentation).toHaveBeenCalled());
  });

  it('creates a persistent freehand drawing and supports keyboard deletion', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pen (P)' }));
    const stage = screen.getByRole('main');
    fireEvent.pointerDown(stage, { clientX: 80, clientY: 90 });
    fireEvent.pointerMove(window, { clientX: 110, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 100 });
    fireEvent.pointerUp(window);

    expect(screen.getByText('Presentation canvas · 1 object')).toBeInTheDocument();
    expect(screen.getByText('drawing')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.getByText('Presentation canvas · 0 objects')).toBeInTheDocument();

    await waitFor(() => expect(boardManager.setPresentation).toHaveBeenLastCalledWith('board-1', []));
  });

  it('does not draw through the creation toolbar when changing persistent tools', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pen (P)' }));
    const frame = screen.getByRole('button', { name: 'Frame (F)' });
    fireEvent.pointerDown(frame, { clientX: 20, clientY: 300 });
    fireEvent.click(frame);
    expect(screen.getByText('Presentation canvas · 0 objects')).toBeInTheDocument();
  });

  it('creates a curved connector by clicking its start and end points', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Connector (L)' }));
    const stage = screen.getByRole('main');

    fireEvent.pointerDown(stage, { clientX: 140, clientY: 150 });
    expect(screen.getByText('Choose an end point · Esc to cancel')).toBeInTheDocument();
    expect(screen.getByText('Presentation canvas · 0 objects')).toBeInTheDocument();

    fireEvent.pointerMove(stage, { clientX: 310, clientY: 260 });
    fireEvent.pointerDown(stage, { clientX: 310, clientY: 260 });

    expect(screen.getByText('Presentation canvas · 1 object')).toBeInTheDocument();
    const route = screen.getByLabelText('Connector route');
    expect(route).toHaveValue('curved');
    fireEvent.change(route, { target: { value: 'elbow' } });
    expect(route).toHaveValue('elbow');
  });

  it('allows connector endpoints to be placed on existing objects', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes (R)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    const stage = screen.getByRole('main');
    fireEvent.pointerDown(stage, { clientX: 120, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 220 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole('button', { name: 'Connector (L)' }));
    fireEvent.pointerDown(screen.getByLabelText('Shape text'), { clientX: 220, clientY: 170 });
    expect(screen.getByText('Choose an end point · Esc to cancel')).toBeInTheDocument();
    fireEvent.pointerDown(stage, { clientX: 420, clientY: 280 });

    expect(screen.getByText('Presentation canvas · 2 objects')).toBeInTheDocument();
    expect(screen.getByLabelText('Connector route')).toHaveValue('curved');
    expect(screen.getByTestId('deck-connector')).toHaveAttribute('data-start-id');
    expect(screen.getByTestId('deck-connector').getAttribute('data-start-id')).not.toBe('');
    expect(screen.getByTestId('deck-connector')).toHaveAttribute('data-end-id', '');
  });

  it('attaches a connector to two shapes and reflows it when one is dragged', () => {
    render(
      <PresentationCanvas
        board={{
          ...board,
          presentation: {
            updatedAt: '2026-08-22T00:00:00.000Z',
            items: [
              { id: 'a', type: 'shape', content: 'A', x: 40, y: 40, width: 120, height: 80, style: { shape: 'rectangle' } },
              { id: 'b', type: 'shape', content: 'B', x: 320, y: 40, width: 120, height: 80, style: { shape: 'rectangle' } },
            ],
          },
        }}
        currentDiagramImage={null}
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connector (L)' }));
    const [shapeA, shapeB] = screen.getAllByLabelText('Shape text');
    fireEvent.pointerDown(shapeA, { clientX: 100, clientY: 80 });
    fireEvent.pointerDown(shapeB, { clientX: 380, clientY: 80 });

    const connector = screen.getByTestId('deck-connector');
    expect(connector).toHaveAttribute('data-start-id', 'a');
    expect(connector).toHaveAttribute('data-end-id', 'b');
    fireEvent.change(screen.getByLabelText('Connector label'), { target: { value: 'owns' } });
    fireEvent.change(screen.getByLabelText('Line style'), { target: { value: 'dashed' } });
    fireEvent.change(screen.getByLabelText('Connector route'), { target: { value: 'straight' } });
    expect(screen.getByLabelText('Connector route')).toHaveValue('straight');
    const before = connector.getAttribute('style');

    fireEvent.click(screen.getByRole('button', { name: 'Select (V)' }));
    fireEvent.pointerDown(shapeA.closest('[data-item-id="a"]')!, { clientX: 80, clientY: 70 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 70 });
    fireEvent.pointerUp(window);

    const after = screen.getByTestId('deck-connector');
    expect(after).toHaveAttribute('data-start-id', 'a');
    expect(after).toHaveAttribute('data-end-id', 'b');
    expect(after.getAttribute('style')).not.toBe(before);
    fireEvent.pointerDown(after);
    expect(screen.getByLabelText('Connector label')).toHaveValue('owns');
  });

  it('creates a frame from selection without flattening children', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Shapes (R)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    const stage = screen.getByRole('main');
    fireEvent.pointerDown(stage, { clientX: 120, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 220 });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole('button', { name: 'Create frame from selection' }));
    expect(screen.getByText('Presentation canvas · 2 objects')).toBeInTheDocument();
    expect(screen.getByLabelText('Shape text')).toBeInTheDocument();
    expect(screen.getByLabelText('Frame title')).toHaveValue('Frame');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('presents titled frames in outline order and skips a hidden frame', () => {
    render(
      <PresentationCanvas
        board={{
          ...board,
          presentation: {
            updatedAt: '2026-08-22T00:00:00.000Z',
            items: [
              { id: 'intro', type: 'frame', title: 'Intro', content: '', x: 0, y: 0, width: 220, height: 140 },
              { id: 'review', type: 'frame', title: 'Review', content: '', x: 280, y: 0, width: 220, height: 140 },
              { id: 'secret', type: 'frame', title: 'Secret', content: '', x: 0, y: 400, width: 400, height: 240, hidden: true },
            ],
          },
        }}
        currentDiagramImage={null}
        onClose={vi.fn()}
        notify={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Present deck' }));
    expect(screen.getByTestId('present-frame-title')).toHaveTextContent('Intro');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('present-frame-title')).toHaveTextContent('Review');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('present-frame-title')).toHaveTextContent('Review');
    fireEvent.click(screen.getByRole('button', { name: 'Present Review' }));
    expect(screen.getByTestId('present-frame-title')).toHaveTextContent('Review');
  });
});
