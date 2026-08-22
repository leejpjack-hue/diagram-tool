import type { BoardDocument } from './boardFormat';

const STORAGE_KEY = 'diagram-tool.share-links';

export interface PublishedShare {
  boardId: string;
  token: string;
  manageToken: string;
  url: string;
  createdAt: string;
}

export interface SharePublishResult {
  token: string;
  manageToken: string;
  url: string;
  createdAt: string;
}

export function viewTokenFromPath(pathname = window.location.pathname): string | null {
  const match = pathname.match(/^\/view\/([A-Za-z0-9_-]{16,64})\/?$/);
  return match?.[1] ?? null;
}

export function readPublishedShare(boardId: string): PublishedShare | null {
  const all = readAllPublishedShares();
  return all[boardId] ?? null;
}

export function writePublishedShare(share: PublishedShare): void {
  const all = readAllPublishedShares();
  all[share.boardId] = share;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearPublishedShare(boardId: string): void {
  const all = readAllPublishedShares();
  delete all[boardId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function publishShare(document: BoardDocument): Promise<SharePublishResult> {
  const response = await fetch('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(document),
  });
  return readShareResponse(response, 'Could not publish the view link.');
}

export async function fetchShareSnapshot(token: string): Promise<BoardDocument> {
  const response = await fetch(`/api/shares/${token}`, { headers: { Accept: 'application/json' } });
  if (response.status === 404) {
    throw new ShareGoneError();
  }
  if (!response.ok) {
    throw new Error('Could not load this view link.');
  }
  const document = await response.json() as BoardDocument;
  if (document.version !== '3.0' || document.kind !== 'board') {
    throw new Error('This snapshot is not a format 3.0 board.');
  }
  return document;
}

export async function revokeShare(token: string, manageToken: string): Promise<void> {
  const response = await fetch(`/api/shares/${token}/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Share-Manage-Token': manageToken,
    },
    body: JSON.stringify({ manageToken }),
  });
  if (response.status === 404) throw new ShareGoneError();
  if (!response.ok) throw new Error('Could not revoke the view link.');
}

export async function rotateShare(token: string, manageToken: string): Promise<SharePublishResult> {
  const response = await fetch(`/api/shares/${token}/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Share-Manage-Token': manageToken,
    },
    body: JSON.stringify({ manageToken }),
  });
  return readShareResponse(response, 'Could not replace the view link.');
}

export class ShareGoneError extends Error {
  constructor() {
    super('This view link is gone.');
    this.name = 'ShareGoneError';
  }
}

async function readShareResponse(response: Response, fallback: string): Promise<SharePublishResult> {
  if (response.status === 404) throw new ShareGoneError();
  if (!response.ok) throw new Error(fallback);
  const payload = await response.json() as SharePublishResult;
  if (!payload.token || !payload.manageToken || !payload.url) {
    throw new Error(fallback);
  }
  return payload;
}

function readAllPublishedShares(): Record<string, PublishedShare> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PublishedShare>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
