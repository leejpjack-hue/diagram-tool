import { useDiagramStore } from '../store/diagramStore';
import {
  boardManager,
  type Board,
  type BoardVersion,
  type PersonalTemplate,
  type Space,
} from './boardManager';

/** Identity of the open project. lastOpenedAt changes on every real open. */
export interface ProjectIdentity {
  view: string;
  boardId: string | null;
  lastOpenedAt: string | null;
}

/** Dashboard selection and filters. Board text lives on the persisted stamp. */
export interface DashboardSlice {
  selection: string[];
  query: string;
  modeFilter: string;
  tagFilter: string;
  menuFor: string | null;
  boardView: string;
}

interface EditorStamp {
  dslText: string;
  diagramMode: string;
  iconStyle: string;
  showStepNumbers: boolean;
  selectedNodeId: string | null;
  historyIndex: number;
  history: Array<{
    dslText: string;
    diagramMode: string;
    iconStyle: string;
    showStepNumbers: boolean;
  }>;
}

interface BoardStamp {
  id: string;
  title: string;
  description: string;
  mode: string;
  dslText: string;
  tags: string[];
  starred: boolean;
  spaceId: string | null;
  deletedAt: string | null;
  lastOpenedAt: string | null;
  iconStyle: string | null;
  showStepNumbers: boolean;
  templateSourceId: string | null;
  presentationUpdatedAt: string | null;
  presentationItemIds: string[];
}

interface VersionStamp {
  id: string;
  boardId: string;
  name: string;
  mode: string;
  dslText: string;
  createdAt: string;
  automatic: boolean;
}

interface SpaceStamp {
  id: string;
  name: string;
  color: string;
  order: number;
  updatedAt: string;
}

interface TemplateStamp {
  id: string;
  name: string;
  mode: string;
  dslText: string;
  updatedAt: string;
  useCount: number;
}

export interface PersistedStamp {
  boards: BoardStamp[];
  versions: VersionStamp[];
  spaces: SpaceStamp[];
  templates: TemplateStamp[];
}

export interface OpenRevision {
  project: ProjectIdentity;
  editor: EditorStamp;
  dashboard: DashboardSlice | null;
  persisted: PersistedStamp;
}

export const OPEN_FEEDBACK = {
  chooseImport: 'Choose a local file to import.',
  chooseOpen: 'Choose a local file to open.',
  checking: 'Checking the selected file.',
  cancelled: 'File selection cancelled.',
} as const;

function boardStamp(board: Board): BoardStamp {
  return {
    id: board.id,
    title: board.title,
    description: board.description,
    mode: board.mode,
    dslText: board.dslText,
    tags: [...board.tags].sort(),
    starred: board.starred,
    spaceId: board.spaceId ?? null,
    deletedAt: board.deletedAt ?? null,
    lastOpenedAt: board.lastOpenedAt ?? null,
    iconStyle: board.iconStyle ?? null,
    showStepNumbers: board.showStepNumbers === true,
    templateSourceId: board.templateSourceId ?? null,
    presentationUpdatedAt: board.presentation?.updatedAt ?? null,
    presentationItemIds: board.presentation?.items.map(item => item.id).sort() ?? [],
  };
}

function versionStamp(version: BoardVersion): VersionStamp {
  return {
    id: version.id,
    boardId: version.boardId,
    name: version.name,
    mode: version.mode,
    dslText: version.dslText,
    createdAt: version.createdAt,
    automatic: version.automatic,
  };
}

function spaceStamp(space: Space): SpaceStamp {
  return {
    id: space.id,
    name: space.name,
    color: space.color,
    order: space.order,
    updatedAt: space.updatedAt,
  };
}

function templateStamp(template: PersonalTemplate): TemplateStamp {
  return {
    id: template.id,
    name: template.name,
    mode: template.mode,
    dslText: template.dslText,
    updatedAt: template.updatedAt,
    useCount: template.useCount,
  };
}

export function readEditorStamp(): EditorStamp {
  const state = useDiagramStore.getState();
  return {
    dslText: state.dslText,
    diagramMode: state.diagramMode,
    iconStyle: state.iconStyle,
    showStepNumbers: state.showStepNumbers,
    selectedNodeId: state.selectedNodeId,
    historyIndex: state.historyIndex,
    history: state.history.map(entry => ({
      dslText: entry.dslText,
      diagramMode: entry.diagramMode,
      iconStyle: entry.iconStyle ?? 'clean',
      showStepNumbers: entry.showStepNumbers === true,
    })),
  };
}

export function readSyncRevision(project: ProjectIdentity, dashboard: DashboardSlice | null): Omit<OpenRevision, 'persisted'> {
  return {
    project: { ...project },
    editor: readEditorStamp(),
    dashboard: dashboard
      ? { ...dashboard, selection: [...dashboard.selection].sort() }
      : null,
  };
}

/** Boards, versions, spaces, and templates already stored for this workspace. */
export async function readPersistedStamp(): Promise<PersistedStamp> {
  const [boards, trash, versions, spaces, templates] = await Promise.all([
    boardManager.list(),
    boardManager.list({ deleted: true }),
    boardManager.listAllVersions(),
    boardManager.listSpaces(),
    boardManager.listTemplates(),
  ]);
  return {
    boards: [...boards, ...trash].map(boardStamp).sort((a, b) => a.id.localeCompare(b.id)),
    versions: versions.map(versionStamp).sort((a, b) => a.id.localeCompare(b.id)),
    spaces: spaces.map(spaceStamp).sort((a, b) => a.id.localeCompare(b.id)),
    templates: templates.map(templateStamp).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export interface OpenBaseline {
  sync: Omit<OpenRevision, 'persisted'>;
  persisted: Promise<PersistedStamp>;
  persistedFailure: () => unknown;
}

/**
 * Snapshot at the gesture. The persisted read starts immediately and is not
 * awaited, so the file picker can still open in the same turn.
 */
export function captureOpenBaseline(project: ProjectIdentity, dashboard: DashboardSlice | null): OpenBaseline {
  let failure: unknown;
  const persisted = readPersistedStamp().then(
    value => value,
    error => {
      failure = error;
      return { boards: [], versions: [], spaces: [], templates: [] };
    },
  );
  return {
    sync: readSyncRevision(project, dashboard),
    persisted,
    persistedFailure: () => failure,
  };
}

export function revisionsMatch(left: OpenRevision, right: OpenRevision): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** True when project identity, editor history/selection, and stored boards still match. */
export async function openBaselineStillCurrent(
  baseline: OpenBaseline,
  project: ProjectIdentity,
  dashboard: DashboardSlice | null,
): Promise<boolean> {
  const [thenPersisted, nowPersisted] = await Promise.all([
    baseline.persisted,
    readPersistedStamp(),
  ]);
  const failure = baseline.persistedFailure();
  if (failure) throw failure;
  const nowSync = readSyncRevision(project, dashboard);
  return revisionsMatch(
    { ...baseline.sync, persisted: thenPersisted },
    { ...nowSync, persisted: nowPersisted },
  );
}
