import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sanitizePublishedSnapshot } from './presentationSanitizer';
import {
  createShareToken,
  isShareBoardDocument,
  isShareToken,
  publicShareDocument,
  type ShareStore,
} from './shareStore';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const VIEW_PATH = /^\/view\/([A-Za-z0-9_-]+)\/?$/;
const SHARE_PATH = /^\/api\/shares\/?$/;
const SHARE_ITEM_PATH = /^\/api\/shares\/([A-Za-z0-9_-]+)\/?$/;
const SHARE_REVOKE_PATH = /^\/api\/shares\/([A-Za-z0-9_-]+)\/revoke\/?$/;
const SHARE_ROTATE_PATH = /^\/api\/shares\/([A-Za-z0-9_-]+)\/rotate\/?$/;

export interface ShareRouteInput {
  method: string;
  pathname: string;
  body?: unknown;
  manageToken?: string;
  origin: string;
}

export type ShareResponse = { kind: 'response'; status: number; body?: unknown; contentType?: string };

export type ShareRouteResult =
  | { kind: 'unhandled' }
  | { kind: 'viewer' }
  | ShareResponse;

export async function routeShareRequest(input: ShareRouteInput, store: ShareStore): Promise<ShareRouteResult> {
  const method = input.method.toUpperCase();
  const path = input.pathname;

  const viewMatch = path.match(VIEW_PATH);
  if (method === 'GET' && viewMatch) {
    const token = viewMatch[1];
    if (!isShareToken(token) || !(await store.get(token))) {
      return {
        kind: 'response',
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: viewMissingPage(),
      };
    }
    return { kind: 'viewer' };
  }

  if (SHARE_PATH.test(path) && method !== 'POST') {
    return json(404, { error: 'not_found' });
  }

  if (method === 'POST' && SHARE_PATH.test(path)) {
    if (!isShareBoardDocument(input.body)) {
      return json(400, { error: 'invalid_snapshot', message: 'Publish a format 3.0 board snapshot.' });
    }
    const token = createShareToken();
    const manageToken = createShareToken();
    const createdAt = new Date().toISOString();
    await store.put({
      token,
      manageToken,
      createdAt,
      document: sanitizePublishedSnapshot(input.body),
    });
    return json(201, {
      token,
      manageToken,
      url: `${input.origin}/view/${token}`,
      createdAt,
    });
  }

  const getMatch = path.match(SHARE_ITEM_PATH);
  if (method === 'GET' && getMatch) {
    const record = isShareToken(getMatch[1]) ? await store.get(getMatch[1]) : undefined;
    if (!record) return json(404, { error: 'not_found' });
    return json(200, publicShareDocument(sanitizePublishedSnapshot(record.document)));
  }

  const revokeMatch = path.match(SHARE_REVOKE_PATH);
  if (method === 'POST' && revokeMatch) {
    const auth = await authorizeShare(store, revokeMatch[1], input.manageToken);
    if (!auth.ok) return auth.result;
    await store.delete(auth.record.token);
    return { kind: 'response', status: 204 };
  }

  const rotateMatch = path.match(SHARE_ROTATE_PATH);
  if (method === 'POST' && rotateMatch) {
    const auth = await authorizeShare(store, rotateMatch[1], input.manageToken);
    if (!auth.ok) return auth.result;
    const token = createShareToken();
    const createdAt = new Date().toISOString();
    await store.put({
      token,
      manageToken: auth.record.manageToken,
      createdAt,
      document: sanitizePublishedSnapshot(auth.record.document),
    });
    await store.delete(auth.record.token);
    return json(201, {
      token,
      manageToken: auth.record.manageToken,
      url: `${input.origin}/view/${token}`,
      createdAt,
    });
  }

  return { kind: 'unhandled' };
}

export async function handleShareHttp(
  req: IncomingMessage,
  res: ServerResponse,
  store: ShareStore,
  next: () => void,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof Error && error.message === 'payload_too_large') {
      writeShareResponse(res, json(413, { error: 'too_large' }));
      return;
    }
    writeShareResponse(res, json(400, { error: 'invalid_json' }));
    return;
  }

  const result = await routeShareRequest({
    method: req.method ?? 'GET',
    pathname: url.pathname,
    body,
    manageToken: manageTokenFrom(req, body),
    origin: requestOrigin(req),
  }, store);

  if (result.kind === 'unhandled' || result.kind === 'viewer') {
    next();
    return;
  }
  writeShareResponse(res, result);
}

function manageTokenFrom(req: IncomingMessage, body: unknown): string | undefined {
  const header = req.headers['x-share-manage-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (body && typeof body === 'object' && 'manageToken' in body) {
    const value = (body as { manageToken?: unknown }).manageToken;
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function requestOrigin(req: IncomingMessage): string {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '');
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const proto = (typeof protoHeader === 'string' ? protoHeader.split(',')[0] : 'http').trim();
  const host = (typeof hostHeader === 'string' ? hostHeader.split(',')[0] : 'localhost:5173').trim();
  return `${proto}://${host}`;
}

async function authorizeShare(
  store: ShareStore,
  token: string,
  manageToken: string | undefined,
): Promise<{ ok: true; record: NonNullable<Awaited<ReturnType<ShareStore['get']>>> } | { ok: false; result: ShareResponse }> {
  if (!isShareToken(token)) return { ok: false, result: json(404, { error: 'not_found' }) };
  const record = await store.get(token);
  if (!record) return { ok: false, result: json(404, { error: 'not_found' }) };
  if (!manageToken || !secretEqual(manageToken, record.manageToken)) {
    return { ok: false, result: json(403, { error: 'forbidden' }) };
  }
  return { ok: true, record };
}

function secretEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function json(status: number, body: unknown): ShareResponse {
  return { kind: 'response', status, body, contentType: 'application/json; charset=utf-8' };
}

function writeShareResponse(res: ServerResponse, result: ShareResponse): void {
  res.statusCode = result.status;
  res.setHeader('Cache-Control', 'no-store');
  if (result.status === 204) {
    res.end();
    return;
  }
  if (result.contentType) res.setHeader('Content-Type', result.contentType);
  if (result.contentType?.startsWith('application/json')) {
    res.end(JSON.stringify(result.body ?? {}));
    return;
  }
  res.end(typeof result.body === 'string' ? result.body : '');
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload_too_large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return undefined;
  return JSON.parse(text);
}

function viewMissingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>View link gone</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
    main { max-width: 28rem; padding: 2rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { margin: 0; color: #475569; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>This view link is gone</h1>
    <p>The owner revoked or replaced it. Anyone with a live link can view the snapshot with no sign-in.</p>
  </main>
</body>
</html>`;
}
