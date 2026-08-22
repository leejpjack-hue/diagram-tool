import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE_IMAGE_HEAVY_COPY,
  BOARD_SIZE_SOFT_WARN_COPY,
  BOARD_SIZE_STATE_HEAVY,
  BOARD_SIZE_STATE_SMOOTH,
  BOARD_SIZE_STATE_SPLIT_ME,
  BOARD_SIZE_STRONG_WARN_COPY,
  measureBoardSize,
} from '../../utils/boardSizeMeter';
import { BoardSizeMeter, BoardSizeWarnBanner } from './BoardSizeMeter';

describe('BoardSizeMeter', () => {
  it('shows the Smooth status line for a small board', () => {
    const snapshot = measureBoardSize({ nodeCount: 4, edgeCount: 3, deckItems: [] });
    render(<BoardSizeMeter snapshot={snapshot} />);
    expect(screen.getByTestId('board-size-meter')).toHaveTextContent('7 objects · Smooth');
    expect(screen.getByTestId('board-size-meter')).toHaveAttribute('data-state', BOARD_SIZE_STATE_SMOOTH);
  });

  it('renders the 1,000-object warn copy', () => {
    const snapshot = measureBoardSize({ nodeCount: 1000, edgeCount: 0, deckItems: [] });
    render(
      <>
        <BoardSizeMeter snapshot={snapshot} />
        <BoardSizeWarnBanner snapshot={snapshot} />
      </>,
    );
    expect(screen.getByTestId('board-size-meter')).toHaveTextContent('1,000 objects · Heavy');
    expect(screen.getByTestId('board-size-warn')).toHaveTextContent(BOARD_SIZE_SOFT_WARN_COPY);
    expect(screen.getByTestId('board-size-warn')).toHaveAttribute('data-state', BOARD_SIZE_STATE_HEAVY);
  });

  it('renders the 5,000-object Split me copy', () => {
    const snapshot = measureBoardSize({
      nodeCount: 0,
      edgeCount: 0,
      deckItems: [],
      objectCountOverride: 5000,
    });
    render(
      <>
        <BoardSizeMeter snapshot={snapshot} />
        <BoardSizeWarnBanner snapshot={snapshot} />
      </>,
    );
    expect(screen.getByTestId('board-size-meter')).toHaveTextContent('5,000 objects · Split me');
    expect(screen.getByTestId('board-size-warn')).toHaveTextContent(BOARD_SIZE_STRONG_WARN_COPY);
    expect(screen.getByTestId('board-size-warn')).toHaveAttribute('data-state', BOARD_SIZE_STATE_SPLIT_ME);
  });

  it('renders the image-heavy copy when the cheap image threshold is crossed', () => {
    const snapshot = measureBoardSize({
      nodeCount: 0,
      edgeCount: 0,
      deckItems: Array.from({ length: 50 }, () => ({ type: 'image', content: 'data:image/png;base64,AAAA' })),
    });
    render(<BoardSizeWarnBanner snapshot={snapshot} />);
    expect(screen.getByTestId('board-size-warn')).toHaveTextContent(BOARD_SIZE_IMAGE_HEAVY_COPY);
  });

  it('hides the warn banner while the board is Smooth', () => {
    const snapshot = measureBoardSize({ nodeCount: 1, edgeCount: 0, deckItems: [] });
    const { container } = render(<BoardSizeWarnBanner snapshot={snapshot} />);
    expect(container).toBeEmptyDOMElement();
  });
});
