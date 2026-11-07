import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../store/diagramStore';
import { readOpenEpoch, sameOpenEpoch, type OpenEpoch, type ProjectIdentity } from './openRevision';

const project: ProjectIdentity = { view: 'editor', boardId: 'board-1', lastOpenedAt: '2026-11-07T00:00:00.000Z' };

function epoch(patch: Partial<OpenEpoch> = {}): OpenEpoch {
  return {
    project,
    historyIndex: 0,
    selectedNodeId: null,
    dslText: 'diagram: architecture\ntitle: Keep',
    diagramMode: 'architecture',
    iconStyle: 'clean',
    showStepNumbers: false,
    dashboardSelection: [],
    ...patch,
  };
}

describe('open epoch', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      dslText: 'diagram: architecture\ntitle: Keep',
      diagramMode: 'architecture',
      iconStyle: 'clean',
      showStepNumbers: false,
      selectedNodeId: null,
      history: [],
      historyIndex: 0,
    });
  });

  it('matches project identity, editor scalars, and dashboard selection without reading storage', () => {
    const current = readOpenEpoch(project, []);
    expect(sameOpenEpoch(current, readOpenEpoch(project, []))).toBe(true);
    expect(sameOpenEpoch(epoch(), epoch({ project: { ...project, view: 'dashboard' } }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({ project: { ...project, boardId: 'board-2' } }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({
      project: { ...project, lastOpenedAt: '2026-11-07T00:00:01.000Z' },
    }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({ historyIndex: 1 }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({ selectedNodeId: 'api' }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({ dslText: 'diagram: architecture\ntitle: Edited' }))).toBe(false);
    expect(sameOpenEpoch(epoch(), epoch({ dashboardSelection: ['board-1'] }))).toBe(false);
  });

  it('sees undo and selection from the editor store', () => {
    const before = readOpenEpoch(project, []);
    useDiagramStore.getState().setSelectedNode('api');
    expect(sameOpenEpoch(before, readOpenEpoch(project, []))).toBe(false);
    useDiagramStore.getState().setSelectedNode(null);
    useDiagramStore.getState().setDslText('diagram: architecture\ntitle: Edited');
    const edited = readOpenEpoch(project, []);
    useDiagramStore.getState().undo();
    expect(sameOpenEpoch(edited, readOpenEpoch(project, []))).toBe(false);
    expect(useDiagramStore.getState().dslText).toBe('diagram: architecture\ntitle: Keep');
  });
});
