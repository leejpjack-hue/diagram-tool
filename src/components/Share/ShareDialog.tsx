import { useState } from 'react';
import { buildBoardDocument } from '../../utils/boardFormat';
import type { Board } from '../../utils/boardManager';
import {
  clearPublishedShare,
  publishShare,
  readPublishedShare,
  revokeShare,
  rotateShare,
  writePublishedShare,
  type PublishedShare,
} from '../../utils/shareLinks';

interface ShareDialogProps {
  board: Board;
  onClose: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
}

export function ShareDialog({ board, onClose, notify }: ShareDialogProps) {
  const [share, setShare] = useState<PublishedShare | null>(() => readPublishedShare(board.id));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      const published = await publishShare(buildBoardDocument(board));
      const next = { boardId: board.id, ...published };
      writePublishedShare(next);
      setShare(next);
      notify('success', 'View link published. Your local board is unchanged.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not publish the view link.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!share) return;
    setBusy(true);
    try {
      await revokeShare(share.token, share.manageToken);
      clearPublishedShare(board.id);
      setShare(null);
      notify('success', 'View link revoked. That URL now returns 404.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not revoke the view link.');
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!share) return;
    setBusy(true);
    try {
      const published = await rotateShare(share.token, share.manageToken);
      const next = { boardId: board.id, ...published };
      writePublishedShare(next);
      setShare(next);
      notify('success', 'New view link ready. The previous URL now returns 404.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Could not replace the view link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!share) return;
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${board.title}`}
      >
        <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Share a view link</h2>
            <p className="mt-0.5 text-xs text-slate-500">Publish a snapshot. Anyone with the link can view it with no sign-in.</p>
          </div>
          <button className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            This copies the current board as format 3.0 JSON. Publishing does not move or delete the local board. Autosave stays on this device.
          </p>
          {share ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">View link</span>
                <input
                  data-testid="share-view-url"
                  readOnly
                  value={share.url}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void copy()}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  data-testid="share-rotate"
                  disabled={busy}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  onClick={() => void rotate()}
                >
                  Replace link
                </button>
                <button
                  type="button"
                  data-testid="share-revoke"
                  disabled={busy}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                  onClick={() => void revoke()}
                >
                  Revoke link
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              data-testid="share-publish"
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void publish()}
            >
              Publish view link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
