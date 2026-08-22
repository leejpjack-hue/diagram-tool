import { useEffect, useMemo, useState } from 'react';
import {
  measureBoardSize,
  readBoardSizeCountOverride,
  type BoardSizeDeckItem,
  type BoardSizeSnapshot,
} from '../../utils/boardSizeMeter';

function useDevBoardSizeOverride(): number | null {
  const [override, setOverride] = useState<number | null>(() => readBoardSizeCountOverride());

  useEffect(() => {
    if (import.meta.env.DEV !== true) return;
    const sync = () => setOverride(readBoardSizeCountOverride());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return import.meta.env.DEV === true ? override : null;
}

export function useBoardSizeSnapshot(
  nodeCount: number,
  edgeCount: number,
  deckItems: readonly BoardSizeDeckItem[],
): BoardSizeSnapshot {
  const objectCountOverride = useDevBoardSizeOverride();
  return useMemo(
    () => measureBoardSize({ nodeCount, edgeCount, deckItems, objectCountOverride }),
    [nodeCount, edgeCount, deckItems, objectCountOverride],
  );
}

const CHIP_TONE: Record<BoardSizeSnapshot['state'], string> = {
  Smooth: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Heavy: 'border-amber-200 bg-amber-50 text-amber-950',
  'Split me': 'border-red-200 bg-red-50 text-red-800',
};

const BANNER_TONE: Record<BoardSizeSnapshot['state'], string> = {
  Smooth: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  Heavy: 'border-amber-200 bg-amber-50 text-amber-950',
  'Split me': 'border-red-200 bg-red-50 text-red-900',
};

export function BoardSizeMeter({ snapshot }: { snapshot: BoardSizeSnapshot }) {
  return (
    <span
      role="status"
      data-testid="board-size-meter"
      data-state={snapshot.state}
      data-object-count={snapshot.objectCount}
      title="Local board size. Nothing is sent anywhere."
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-normal normal-case ${CHIP_TONE[snapshot.state]}`}
    >
      {snapshot.statusLine}
    </span>
  );
}

export function BoardSizeWarnBanner({ snapshot }: { snapshot: BoardSizeSnapshot }) {
  if (!snapshot.warnCopy && !snapshot.imageHeavyCopy) return null;

  return (
    <div
      role="status"
      data-testid="board-size-warn"
      data-state={snapshot.state}
      className={`shrink-0 border-b px-4 py-2 text-center text-sm font-semibold ${BANNER_TONE[snapshot.state]}`}
    >
      {snapshot.warnCopy && <div>{snapshot.warnCopy}</div>}
      {snapshot.imageHeavyCopy && <div>{snapshot.imageHeavyCopy}</div>}
    </div>
  );
}
