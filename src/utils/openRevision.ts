import { useDiagramStore } from '../store/diagramStore';

/** Identity already tracked for the open project. lastOpenedAt changes on every real open. */
export interface ProjectIdentity {
  view: string;
  boardId: string | null;
  lastOpenedAt: string | null;
}

/**
 * Scalars already on the session. The current source string is compared in place.
 * Undo history bodies, other boards, versions, and templates are not copied.
 */
export interface OpenEpoch {
  project: ProjectIdentity;
  historyIndex: number;
  selectedNodeId: string | null;
  dslText: string;
  diagramMode: string;
  iconStyle: string;
  showStepNumbers: boolean;
  dashboardSelection: string[];
}

export const OPEN_FEEDBACK = {
  chooseImport: 'Choose a local file to import.',
  chooseOpen: 'Choose a local file to open.',
  checking: 'Checking the selected file.',
  cancelled: 'File selection cancelled.',
} as const;

export function readOpenEpoch(project: ProjectIdentity, dashboardSelection: readonly string[]): OpenEpoch {
  const editor = useDiagramStore.getState();
  return {
    project: { ...project },
    historyIndex: editor.historyIndex,
    selectedNodeId: editor.selectedNodeId,
    dslText: editor.dslText,
    diagramMode: editor.diagramMode,
    iconStyle: editor.iconStyle,
    showStepNumbers: editor.showStepNumbers,
    dashboardSelection: [...dashboardSelection].sort(),
  };
}

export function sameOpenEpoch(left: OpenEpoch, right: OpenEpoch): boolean {
  return left.project.view === right.project.view
    && left.project.boardId === right.project.boardId
    && left.project.lastOpenedAt === right.project.lastOpenedAt
    && left.historyIndex === right.historyIndex
    && left.selectedNodeId === right.selectedNodeId
    && left.dslText === right.dslText
    && left.diagramMode === right.diagramMode
    && left.iconStyle === right.iconStyle
    && left.showStepNumbers === right.showStepNumbers
    && left.dashboardSelection.length === right.dashboardSelection.length
    && left.dashboardSelection.every((id, index) => id === right.dashboardSelection[index]);
}
