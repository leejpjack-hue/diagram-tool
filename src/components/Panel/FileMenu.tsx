import { useState, useRef, useEffect } from 'react';
import { saveManager, type SavedDiagram, type SavedDiagramMode } from '../../utils/saveManager';
import {
  CURSOR_MCP_FOLDER_SENTENCE,
  CURSOR_MCP_PRIVACY_SENTENCE,
  cursorMcpJsonSnippet,
} from '../../utils/cursorMcpSnippet';
import { extractBoardTitle } from '../../utils/sourceText';
import { interpretOpenedFile, serializeBoardFile, upsertOpenedBoard } from '../../utils/boardFile';
import { assertImportSize } from '../../utils/importSanitizer';
import {
  OPEN_FILE_ACCEPT,
  boardFileHandles,
  canUseFileSystemAccess,
  downloadBoardJson,
  isAbortError,
  mustSaveBoardJsonAsNewFile,
  pickBoardFileToOpen,
  pickBoardFileToSave,
  readHandleText,
  suggestedBoardFilename,
  writeHandleText,
  type FileSystemFileHandleLike,
} from '../../utils/fileSystemAccess';
import { boardManager, type Board, type BoardMode } from '../../utils/boardManager';

interface FileMenuProps {
  currentDsl: string;
  mode: SavedDiagramMode;
  boardMode?: BoardMode;
  currentBoardId?: string | null;
  onLoad: (diagram: SavedDiagram) => void;
  onNew: () => void;
  onOpenWorkspaceBoard?: (board: Board) => void;
  notify?: (type: 'success' | 'error', message: string) => void;
}

export function FileMenu({
  currentDsl,
  mode,
  boardMode,
  currentBoardId = null,
  onLoad,
  onNew,
  onOpenWorkspaceBoard,
  notify,
}: FileMenuProps) {
  const activeMode: BoardMode = boardMode ?? mode;
  const [isOpen, setIsOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [recentDiagrams, setRecentDiagrams] = useState<SavedDiagram[]>([]);
  const [linkedToDisk, setLinkedToDisk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openBoardInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const snippet = cursorMcpJsonSnippet();
  const canReload = Boolean(currentBoardId && linkedToDisk && boardFileHandles.has(currentBoardId));

  const handleOpen = () => {
    setRecentDiagrams(saveManager.getRecentDiagrams());
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  useEffect(() => {
    if (!connectOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setConnectOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [connectOpen]);

  const handleNew = () => {
    if (saveManager.hasUnsavedChanges(currentDsl)) {
      if (!confirm('You have unsaved changes. Start a new diagram anyway?')) {
        return;
      }
    }
    onNew();
    handleClose();
  };

  useEffect(() => {
    setLinkedToDisk(Boolean(currentBoardId && boardFileHandles.has(currentBoardId)));
  }, [currentBoardId]);

  const notifyFileError = (error: unknown) => {
    if (isAbortError(error)) return;
    notify?.('error', error instanceof Error ? error.message : "That file couldn't be opened.");
  };

  const snapshotCurrentBoard = async (): Promise<Pick<Board, 'title' | 'mode' | 'dslText'> & Partial<Board>> => {
    let existing: Board | undefined;
    try {
      existing = currentBoardId ? await boardManager.get(currentBoardId) : undefined;
    } catch {
      existing = undefined;
    }
    const title = extractBoardTitle(currentDsl, activeMode) || existing?.title || 'Untitled board';
    return {
      ...(existing ?? { title, mode: activeMode, dslText: currentDsl }),
      title,
      mode: activeMode,
      dslText: currentDsl,
    };
  };

  const applyOpenedText = async (
    text: string,
    handle?: FileSystemFileHandleLike,
    replaceId?: string,
    filename?: string,
  ) => {
    const opened = await interpretOpenedFile(filename ?? handle?.name ?? 'diagram', text);
    const mappedId = replaceId ?? (handle ? await boardFileHandles.findBoardId(handle) : undefined);
    const board = await upsertOpenedBoard(boardManager, opened.portable, mappedId);
    if (handle) {
      boardFileHandles.set(board.id, handle, opened.format);
      setLinkedToDisk(true);
    }
    onOpenWorkspaceBoard?.(board);
    notify?.('success', `Opened "${board.title}"`);
  };

  const handleOpenBoardFile = () => {
    handleClose();
    if (canUseFileSystemAccess()) {
      void (async () => {
        try {
          const picked = await pickBoardFileToOpen();
          if (!picked) return;
          await applyOpenedText(picked.text, picked.handle);
        } catch (error) {
          notifyFileError(error);
        }
      })();
      return;
    }
    openBoardInputRef.current?.click();
  };

  const handleOpenBoardInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      assertImportSize(file);
      const text = await file.text();
      assertImportSize(file, text);
      await applyOpenedText(text, undefined, undefined, file.name);
    } catch (error) {
      notifyFileError(error);
    }
  };

  const handleSaveAs = async () => {
    handleClose();
    try {
      const snapshot = await snapshotCurrentBoard();
      const text = serializeBoardFile(snapshot);
      const filename = suggestedBoardFilename(snapshot.title);
      if (canUseFileSystemAccess()) {
        const handle = await pickBoardFileToSave(filename);
        if (!handle) return;
        await writeHandleText(handle, text);
        if (currentBoardId) {
          boardFileHandles.set(currentBoardId, handle);
          setLinkedToDisk(true);
        }
        notify?.('success', `Saved "${snapshot.title}"`);
        return;
      }
      downloadBoardJson(text, filename);
      notify?.('success', `Downloaded "${snapshot.title}"`);
    } catch (error) {
      notifyFileError(error);
    }
  };

  const handleSaveToDisk = async () => {
    const handle = currentBoardId ? boardFileHandles.get(currentBoardId) : undefined;
    const format = currentBoardId ? boardFileHandles.getFormat(currentBoardId) : undefined;
    if (!handle || mustSaveBoardJsonAsNewFile(handle, format)) {
      await handleSaveAs();
      return;
    }
    handleClose();
    try {
      const snapshot = await snapshotCurrentBoard();
      await writeHandleText(handle, serializeBoardFile(snapshot));
      notify?.('success', `Saved "${snapshot.title}"`);
    } catch (error) {
      notifyFileError(error);
    }
  };

  const handleReloadFromDisk = async () => {
    if (!currentBoardId) return;
    const handle = boardFileHandles.get(currentBoardId);
    if (!handle) return;
    handleClose();
    try {
      const text = await readHandleText(handle);
      const opened = await interpretOpenedFile(handle.name ?? 'diagram', text);
      const board = await upsertOpenedBoard(boardManager, opened.portable, currentBoardId);
      onOpenWorkspaceBoard?.(board);
      notify?.('success', `Reloaded "${board.title}" from disk`);
    } catch (error) {
      notifyFileError(error);
    }
  };

  const handleExport = () => {
    const saved = saveManager.saveDiagram({
      title: extractBoardTitle(currentDsl, mode) || 'Untitled Diagram',
      dslText: currentDsl,
      mode,
    });
    saveManager.exportToFile(saved);
    handleClose();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
    handleClose();
  };

  const handleConnectCursor = () => {
    handleClose();
    setCopyState('idle');
    setConnectOpen(true);
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState('copied');
      notify?.('success', 'Copied mcp.json snippet. Nothing is uploaded.');
    } catch {
      setCopyState('failed');
      notify?.('error', 'Could not copy the snippet.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const diagram = await saveManager.importFromFile(file);
      onLoad(diagram);
      notify?.('success', `Opened "${diagram.title}"`);
    } catch (err) {
      notify?.('error', err instanceof Error ? err.message : "That file couldn't be opened.");
    }

    // Reset input
    e.target.value = '';
  };

  const handleLoadRecent = (diagram: SavedDiagram) => {
    if (saveManager.hasUnsavedChanges(currentDsl)) {
      if (!confirm('You have unsaved changes. Open this diagram anyway?')) {
        return;
      }
    }
    onLoad(diagram);
    handleClose();
  };

  const handleClearRecent = () => {
    if (confirm('Remove all diagrams from the recent list?')) {
      saveManager.clearRecent();
      setRecentDiagrams([]);
    }
  };

  // Close on outside click
  const handleBlur = (e: React.FocusEvent) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      handleClose();
    }
  };

  return (
    <div className="relative" ref={menuRef} onBlur={handleBlur}>
      {/* Menu Button */}
      <button
        type="button"
        onClick={handleOpen}
        className="btn btn-secondary"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="File"
      >
        📄 File
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="file-menu"
          role="menu"
          className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleNew}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📄</span>
              <span>New diagram</span>
            </button>

            <button
              type="button"
              aria-label="Open…"
              title="JSON board, Mermaid, native DSL, or draw.io"
              onClick={handleOpenBoardFile}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📂</span>
              <span>Open…</span>
            </button>

            <button
              type="button"
              aria-label="Save"
              onClick={() => void handleSaveToDisk()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>💾</span>
              <span>Save</span>
              <span className="ml-auto text-xs text-gray-400">Ctrl+S</span>
            </button>

            <button
              type="button"
              aria-label="Save As…"
              onClick={() => void handleSaveAs()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>💾</span>
              <span>Save As…</span>
            </button>

            <button
              type="button"
              aria-label="Reload from disk"
              disabled={!canReload}
              onClick={() => void handleReloadFromDisk()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span>↻</span>
              <span>Reload from disk</span>
            </button>

            <button
              onClick={handleExport}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📥</span>
              <span>Download backup (.diagram)</span>
            </button>

            <button
              onClick={handleImport}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📤</span>
              <span>Open backup file…</span>
            </button>

            <button
              type="button"
              onClick={handleConnectCursor}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>🔌</span>
              <span>Connect Cursor</span>
            </button>
            <p className="px-4 py-2 text-[11px] leading-4 text-gray-500">
              {CURSOR_MCP_FOLDER_SENTENCE}
            </p>
          </div>

          {/* Divider */}
          {recentDiagrams.length > 0 && (
            <>
              <div className="border-t border-gray-200" />
              
              {/* Recent Diagrams */}
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">
                  Recent diagrams
                </div>
                
                {recentDiagrams.map((diagram) => (
                  <button
                    key={diagram.id}
                    onClick={() => handleLoadRecent(diagram)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{diagram.title}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(diagram.updatedAt)}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 capitalize ml-2">
                      {diagram.mode}
                    </span>
                  </button>
                ))}

                <button
                  onClick={handleClearRecent}
                  className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                >
                  Clear recent diagrams
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".diagram,.json"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={openBoardInputRef}
        data-testid="open-board-file"
        type="file"
        accept={OPEN_FILE_ACCEPT}
        onChange={event => void handleOpenBoardInput(event)}
        className="hidden"
      />

      {connectOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={() => setConnectOpen(false)}
        >
          <div
            data-testid="connect-cursor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-cursor-title"
            className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="connect-cursor-title" className="text-base font-bold text-slate-950">
                Connect Cursor
              </h2>
              <p data-testid="connect-cursor-privacy" className="mt-1 text-sm text-slate-600">
                {CURSOR_MCP_PRIVACY_SENTENCE} {CURSOR_MCP_FOLDER_SENTENCE}
              </p>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                mcp.json snippet
              </p>
              <pre
                data-testid="connect-cursor-snippet"
                className="max-h-72 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-800"
              >{snippet}</pre>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setConnectOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  data-testid="connect-cursor-copy"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  onClick={() => void handleCopySnippet()}
                >
                  {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy snippet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
