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
import { boardManager, normalizeBoard, type Board, type BoardMode } from '../../utils/boardManager';
import {
  CLOUD_UNAVAILABLE_COPY,
  buildShareUrl,
  cloudBoardLinks,
  getCurrentCloudUser,
  getSupabaseClient,
  isCloudConfigured,
  listMyCloudDiagrams,
  loadCloudDiagramById,
  revokeCloudDiagramShare,
  saveDiagramToCloud,
  sendMagicLink,
  shareCloudDiagram,
  signOutCloud,
  type CloudDiagramSummary,
  type CloudUser,
} from '../../lib/supabase';
import { useDiagramStore } from '../../store/diagramStore';

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
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<'account' | 'save' | 'load' | 'share'>('account');
  const [emailInput, setEmailInput] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [cloudDiagrams, setCloudDiagrams] = useState<CloudDiagramSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openBoardInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const snippet = cursorMcpJsonSnippet();
  const canReload = Boolean(currentBoardId && linkedToDisk && boardFileHandles.has(currentBoardId));
  const cloudAvailable = isCloudConfigured();

  useEffect(() => {
    const client = getSupabaseClient();
    let mounted = true;
    void getCurrentCloudUser(client).then(user => {
      if (mounted) setCloudUser(user);
    });
    if (!client) {
      return () => {
        mounted = false;
      };
    }
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setCloudUser(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? null }
          : null,
      );
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [cloudAvailable]);

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
    if (!connectOpen && !authOpen && !loadOpen && !shareOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setConnectOpen(false);
      setAuthOpen(false);
      setLoadOpen(false);
      setShareOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [connectOpen, authOpen, loadOpen, shareOpen]);

  const openAuthPrompt = (reason: 'account' | 'save' | 'load' | 'share') => {
    handleClose();
    setAuthReason(reason);
    setMagicLinkSent(false);
    setAuthError(isCloudConfigured() ? '' : CLOUD_UNAVAILABLE_COPY);
    setAuthOpen(true);
  };

  const handleSendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      await sendMagicLink(emailInput);
      setMagicLinkSent(true);
      notify?.('success', 'Check your email for the sign-in link.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not send sign-in link.';
      setAuthError(msg);
      notify?.('error', msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    handleClose();
    try {
      await signOutCloud();
      setCloudUser(null);
      setAuthOpen(false);
      notify?.('success', 'Signed out');
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  const handleCloudSave = async () => {
    handleClose();
    if (!isCloudConfigured()) {
      openAuthPrompt('save');
      notify?.('error', CLOUD_UNAVAILABLE_COPY);
      return;
    }
    const activeUser = cloudUser ?? (await getCurrentCloudUser());
    if (!activeUser) {
      openAuthPrompt('save');
      return;
    }
    setCloudUser(activeUser);
    try {
      const snapshot = await snapshotCurrentBoard();
      const saved = await saveDiagramToCloud({
        board: snapshot,
        localBoardId: currentBoardId,
      });
      notify?.('success', `Saved "${saved.title}" to cloud`);
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not save to cloud.');
    }
  };

  const handleCloudLoadOpen = async () => {
    handleClose();
    if (!isCloudConfigured()) {
      openAuthPrompt('load');
      notify?.('error', CLOUD_UNAVAILABLE_COPY);
      return;
    }
    const activeUser = cloudUser ?? (await getCurrentCloudUser());
    if (!activeUser) {
      openAuthPrompt('load');
      return;
    }
    setCloudUser(activeUser);
    setLoadOpen(true);
    setCloudLoading(true);
    try {
      const items = await listMyCloudDiagrams();
      setCloudDiagrams(items);
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not load cloud diagrams.');
    } finally {
      setCloudLoading(false);
    }
  };

  const handlePickCloudDiagram = async (item: CloudDiagramSummary) => {
    if (!confirm(`Replace the current board with "${item.title}"? Other local boards will stay untouched.`)) {
      return;
    }
    try {
      const { record, portable } = await loadCloudDiagramById(item.id);
      let board: Board;
      try {
        board = await upsertOpenedBoard(boardManager, portable, currentBoardId ?? undefined);
      } catch {
        const now = record.updated_at || new Date().toISOString();
        board = normalizeBoard({
          id: currentBoardId || portable.id || record.id,
          title: portable.title,
          description: portable.description ?? '',
          mode: portable.mode,
          dslText: portable.dslText,
          thumbnail: portable.thumbnail,
          presentation: portable.presentation,
          tags: portable.tags ?? [],
          starred: Boolean(portable.starred),
          createdAt: record.created_at || now,
          updatedAt: now,
        });
      }
      cloudBoardLinks.set(board.id, {
        cloudId: record.id,
        shareToken: record.share_token,
        updatedAt: record.updated_at,
      });
      useDiagramStore.getState().setReadOnlyShared(false);
      if (onOpenWorkspaceBoard) {
        onOpenWorkspaceBoard(board);
      } else {
        onLoad({
          id: board.id,
          title: board.title,
          dslText: board.dslText,
          mode: board.mode === 'flow' ? 'flow' : 'architecture',
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        });
      }
      setLoadOpen(false);
      notify?.('success', `Opened "${board.title}" from cloud`);
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not open cloud diagram.');
    }
  };

  const handleCloudShareOpen = async () => {
    handleClose();
    if (!isCloudConfigured()) {
      openAuthPrompt('share');
      notify?.('error', CLOUD_UNAVAILABLE_COPY);
      return;
    }
    const activeUser = cloudUser ?? (await getCurrentCloudUser());
    if (!activeUser) {
      openAuthPrompt('share');
      return;
    }
    setCloudUser(activeUser);
    const existingLink = cloudBoardLinks.get(currentBoardId);
    setShareUrl(existingLink?.shareToken ? buildShareUrl(existingLink.shareToken) : '');
    setShareOpen(true);
  };

  const handleGenerateOrRotateShare = async () => {
    setShareBusy(true);
    try {
      let link = cloudBoardLinks.get(currentBoardId);
      if (!link?.cloudId) {
        const snapshot = await snapshotCurrentBoard();
        const saved = await saveDiagramToCloud({
          board: snapshot,
          localBoardId: currentBoardId,
        });
        link = { cloudId: saved.id, shareToken: saved.share_token, updatedAt: saved.updated_at };
      }
      const shared = await shareCloudDiagram({
        cloudId: link.cloudId,
        localBoardId: currentBoardId,
      });
      setShareUrl(shared.shareUrl);
      try {
        await navigator.clipboard?.writeText(shared.shareUrl);
      } catch {
        // Ignore clipboard errors in non-secure test contexts; shareUrl is still shown.
      }
      notify?.('success', 'Share link copied');
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not generate share link.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleRevokeShare = async () => {
    const link = cloudBoardLinks.get(currentBoardId);
    if (!link?.cloudId) return;
    setShareBusy(true);
    try {
      await revokeCloudDiagramShare({
        cloudId: link.cloudId,
        localBoardId: currentBoardId,
      });
      setShareUrl('');
      notify?.('success', 'Share link revoked');
    } catch (error) {
      notify?.('error', error instanceof Error ? error.message : 'Could not revoke share link.');
    } finally {
      setShareBusy(false);
    }
  };

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
      {/* Menu Button + Header Account/Sign-in Chrome */}
      <div className="flex items-center gap-2">
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
        {cloudUser ? (
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
            <span data-testid="header-signed-in-email" className="max-w-[140px] truncate font-medium">
              {cloudUser.email ?? 'Signed in'}
            </span>
            <button
              type="button"
              data-testid="header-sign-out"
              onClick={() => void handleSignOut()}
              className="font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="header-sign-in"
            onClick={() => openAuthPrompt('account')}
            className="btn btn-secondary"
          >
            Sign in
          </button>
        )}
      </div>

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
            <p data-testid="open-file-accept-copy" className="px-4 pb-2 text-[11px] leading-4 text-gray-500">
              JSON board, Mermaid, native DSL, or draw.io
            </p>

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

            <div className="my-1 border-t border-gray-200" />
            <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 flex items-center justify-between">
              <span>Cloud</span>
              {!cloudAvailable && (
                <span data-testid="cloud-unavailable-status" className="font-medium normal-case text-amber-700">
                  {CLOUD_UNAVAILABLE_COPY}
                </span>
              )}
            </div>

            {cloudUser ? (
              <div className="px-4 py-1.5 flex items-center justify-between gap-2 text-xs text-slate-700">
                <span data-testid="cloud-signed-in-email" className="truncate font-medium" title={cloudUser.email ?? ''}>
                  {cloudUser.email ?? 'Signed in'}
                </span>
                <button
                  type="button"
                  data-testid="cloud-sign-out"
                  onClick={() => void handleSignOut()}
                  className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="cloud-sign-in"
                onClick={() => openAuthPrompt('account')}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <span>🔑</span>
                <span>Sign in…</span>
              </button>
            )}

            <button
              type="button"
              data-testid="cloud-save-button"
              aria-label="Save to cloud"
              onClick={() => void handleCloudSave()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>☁️</span>
              <span>Save to cloud</span>
            </button>

            <button
              type="button"
              data-testid="cloud-load-button"
              aria-label="Load from cloud"
              onClick={() => void handleCloudLoadOpen()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>📥</span>
              <span>Load from cloud…</span>
            </button>

            <button
              type="button"
              data-testid="cloud-share-button"
              aria-label="Share"
              onClick={() => void handleCloudShareOpen()}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <span>🔗</span>
              <span>Share…</span>
            </button>
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

      {authOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={() => setAuthOpen(false)}
        >
          <div
            data-testid="cloud-auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-auth-title"
            className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="cloud-auth-title" className="text-base font-bold text-slate-950">
                {authReason === 'save'
                  ? 'Sign in to save to cloud'
                  : authReason === 'load'
                    ? 'Sign in to load from cloud'
                    : authReason === 'share'
                      ? 'Sign in to share this board'
                      : 'Sign in to DiagramTool Cloud'}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Use an email magic link to sync boards across devices. Your local workspace stays unchanged.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {!cloudAvailable && (
                <div
                  data-testid="cloud-unavailable-banner"
                  role="status"
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
                >
                  {CLOUD_UNAVAILABLE_COPY} — local IndexedDB workspace continues to work.
                </div>
              )}
              {magicLinkSent ? (
                <div
                  data-testid="cloud-auth-check-email"
                  role="status"
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
                >
                  <p className="font-semibold">Check your email</p>
                  <p className="mt-1 text-xs">
                    We sent a magic sign-in link to <strong>{emailInput.trim()}</strong>.
                  </p>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={event => void handleSendMagicLink(event)}>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">Email address</span>
                    <input
                      type="email"
                      required
                      data-testid="cloud-auth-email"
                      aria-label="Email address"
                      placeholder="you@example.com"
                      value={emailInput}
                      onChange={event => setEmailInput(event.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </label>
                  {authError && (
                    <p data-testid="cloud-auth-error" role="alert" className="text-xs font-medium text-red-600">
                      {authError}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => setAuthOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      data-testid="cloud-auth-submit"
                      disabled={authBusy}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {authBusy ? 'Sending…' : 'Send magic link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {loadOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={() => setLoadOpen(false)}
        >
          <div
            data-testid="cloud-load-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-load-title"
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="cloud-load-title" className="text-base font-bold text-slate-950">
                Load from cloud
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Pick one of your saved cloud boards to open in this workspace.
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto p-5">
              {cloudLoading ? (
                <p className="text-sm text-slate-500">Loading your cloud diagrams…</p>
              ) : cloudDiagrams.length === 0 ? (
                <p className="text-sm text-slate-500">No cloud diagrams saved yet.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {cloudDiagrams.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`cloud-load-item-${item.id}`}
                      onClick={() => void handlePickCloudDiagram(item)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50 px-2 rounded"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="text-xs text-slate-500">Updated {formatDate(item.updated_at)}</div>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600">Open</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setLoadOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
          onMouseDown={() => setShareOpen(false)}
        >
          <div
            data-testid="cloud-share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-share-title"
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="cloud-share-title" className="text-base font-bold text-slate-950">
                Share read-only link
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Anyone with the share link can view this board in read-only mode without signing in.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {shareUrl && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Share URL</label>
                  <input
                    type="text"
                    readOnly
                    data-testid="cloud-share-url"
                    value={shareUrl}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {shareUrl && (
                  <button
                    type="button"
                    data-testid="cloud-share-revoke"
                    disabled={shareBusy}
                    onClick={() => void handleRevokeShare()}
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke link
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setShareOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  data-testid="cloud-share-generate"
                  disabled={shareBusy}
                  onClick={() => void handleGenerateOrRotateShare()}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {shareUrl ? 'Rotate & copy link' : 'Generate & copy link'}
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
