import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../store/diagramStore';
import {
  readEditorStamp,
  readSyncRevision,
  revisionsMatch,
  type OpenRevision,
  type PersistedStamp,
} from './openRevision';

const emptyPersisted = (): PersistedStamp => ({
  boards: [],
  versions: [],
  spaces: [],
  templates: [],
});

function revision(patch: Partial<OpenRevision> = {}): OpenRevision {
  return {
    project: { view: 'editor', boardId: 'board-1', lastOpenedAt: '2026-11-07T00:00:00.000Z' },
    editor: {
      dslText: 'diagram: architecture\ntitle: Keep',
      diagramMode: 'architecture',
      iconStyle: 'clean',
      showStepNumbers: false,
      selectedNodeId: null,
      historyIndex: -1,
      history: [],
    },
    dashboard: {
      selection: [],
      query: '',
      modeFilter: 'all',
      tagFilter: '',
      menuFor: null,
      boardView: 'home',
    },
    persisted: emptyPersisted(),
    ...patch,
  };
}

describe('open revision', () => {
  beforeEach(() => {
    useDiagramStore.setState({
      dslText: 'diagram: architecture\ntitle: Keep',
      diagramMode: 'architecture',
      iconStyle: 'clean',
      showStepNumbers: false,
      selectedNodeId: null,
      history: [],
      historyIndex: -1,
    });
  });

  it('matches a copied snapshot', () => {
    const current = revision();
    expect(revisionsMatch(current, revision())).toBe(true);
  });

  it('treats selection, undo history, identity, open, and stored metadata as changes', () => {
    const current = revision();
    expect(revisionsMatch(current, revision({
      editor: { ...current.editor, selectedNodeId: 'api' },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      editor: { ...current.editor, historyIndex: 1, history: [{ ...current.editor, diagramMode: 'architecture', iconStyle: 'clean', showStepNumbers: false }] },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      project: { ...current.project, view: 'dashboard' },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      project: { ...current.project, boardId: 'board-2' },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      project: { ...current.project, lastOpenedAt: '2026-11-07T00:00:01.000Z' },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      dashboard: { ...current.dashboard!, selection: ['board-1'] },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      persisted: {
        ...emptyPersisted(),
        boards: [{
          id: 'board-1',
          title: 'Keep',
          description: '',
          mode: 'architecture',
          dslText: current.editor.dslText,
          tags: [],
          starred: true,
          spaceId: null,
          deletedAt: null,
          lastOpenedAt: current.project.lastOpenedAt,
          iconStyle: null,
          showStepNumbers: false,
          templateSourceId: null,
          presentationUpdatedAt: null,
          presentationItemIds: [],
        }],
      },
    }))).toBe(false);
    expect(revisionsMatch(current, revision({
      persisted: {
        ...emptyPersisted(),
        versions: [{
          id: 'version-1',
          boardId: 'board-1',
          name: 'Checkpoint',
          mode: 'architecture',
          dslText: current.editor.dslText,
          createdAt: '2026-11-07T00:00:02.000Z',
          automatic: false,
        }],
      },
    }))).toBe(false);
  });

  it('reads selection and undo from the existing editor store', () => {
    const before = readSyncRevision(
      { view: 'editor', boardId: 'board-1', lastOpenedAt: null },
      null,
    );
    useDiagramStore.getState().setSelectedNode('api');
    const selected = readEditorStamp();
    expect(selected.selectedNodeId).toBe('api');
    expect(revisionsMatch(
      { ...before, persisted: emptyPersisted() },
      { ...readSyncRevision({ view: 'editor', boardId: 'board-1', lastOpenedAt: null }, null), persisted: emptyPersisted() },
    )).toBe(false);

    useDiagramStore.getState().setDslText('diagram: architecture\ntitle: Edited');
    const edited = readEditorStamp();
    useDiagramStore.getState().undo();
    const undone = readEditorStamp();
    expect(undone.historyIndex).toBeLessThan(edited.historyIndex);
    expect(undone.dslText).toBe('diagram: architecture\ntitle: Keep');
  });
});
