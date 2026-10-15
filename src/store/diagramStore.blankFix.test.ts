import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiagramStore } from './diagramStore';

describe('diagramStore setDiagramMode (DT-SAVE-01 blank-page fix)', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      diagramMode: 'architecture',
      dslText: 'diagram: architecture\ntitle: t',
      parsedDiagram: null,
      isReadOnlyShared: false,
      sharedBoardTitle: null,
    });
  });

  it('does not notify subscribers when mode is unchanged', () => {
    const listener = vi.fn();
    const unsub = useDiagramStore.subscribe(listener);

    useDiagramStore.getState().setDiagramMode('architecture');
    expect(listener).not.toHaveBeenCalled();

    useDiagramStore.getState().setDiagramMode('flow');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().diagramMode).toBe('flow');

    useDiagramStore.getState().setDiagramMode('flow');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
  });
});
