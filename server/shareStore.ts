import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export interface ShareBoardDocument {
  version: string;
  kind: 'board';
  exportedAt: string;
  board: {
    title: string;
    mode: string;
    dslText: string;
    source?: { kind: string; text: string };
    nodes?: unknown[];
    edges?: unknown[];
    frames?: unknown[];
    comments?: unknown[];
    [key: string]: unknown;
  };
}

export interface ShareRecord {
  token: string;
  manageToken: string;
  document: ShareBoardDocument;
  createdAt: string;
}

export interface ShareStore {
  put(record: ShareRecord): Promise<void>;
  get(token: string): Promise<ShareRecord | undefined>;
  delete(token: string): Promise<boolean>;
}

export function createShareToken(): string {
  return randomBytes(18).toString('base64url');
}

export function isShareToken(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}

export function createMemoryShareStore(): ShareStore {
  const records = new Map<string, ShareRecord>();
  return {
    async put(record) {
      records.set(record.token, record);
    },
    async get(token) {
      return records.get(token);
    },
    async delete(token) {
      return records.delete(token);
    },
  };
}

export function createFileShareStore(directory: string): ShareStore {
  mkdirSync(directory, { recursive: true });
  return {
    async put(record) {
      if (!isShareToken(record.token)) throw new Error('Invalid share token.');
      writeFileSync(join(directory, `${record.token}.json`), JSON.stringify(record));
    },
    async get(token) {
      if (!isShareToken(token)) return undefined;
      try {
        return JSON.parse(readFileSync(join(directory, `${token}.json`), 'utf8')) as ShareRecord;
      } catch {
        return undefined;
      }
    },
    async delete(token) {
      if (!isShareToken(token)) return false;
      try {
        unlinkSync(join(directory, `${token}.json`));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function isShareBoardDocument(value: unknown): value is ShareBoardDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  if (document.version !== '3.0') return false;
  if (document.kind !== 'board') return false;
  if (!document.board || typeof document.board !== 'object') return false;
  const board = document.board as Record<string, unknown>;
  return typeof board.title === 'string' && typeof board.dslText === 'string' && typeof board.mode === 'string';
}

export function publicShareDocument(document: ShareBoardDocument): ShareBoardDocument {
  return document;
}
