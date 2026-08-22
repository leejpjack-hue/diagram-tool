import { describe, expect, it } from 'vitest';
import { routeShareRequest } from './shareHost';
import { createMemoryShareStore, createShareToken, type ShareBoardDocument } from './shareStore';

const snapshot = (): ShareBoardDocument => ({
  version: '3.0',
  kind: 'board',
  exportedAt: '2026-08-22T12:00:00.000Z',
  board: {
    title: 'Board A',
    mode: 'architecture',
    dslText: 'diagram: architecture\ntitle: Board A\nservice Gateway\nservice API',
    nodes: [{ id: 'gateway' }, { id: 'api' }],
    edges: [],
    frames: [],
    comments: [],
  },
});

describe('view-only share host', () => {
  it('publishes a format 3.0 snapshot and serves it until revoke', async () => {
    const store = createMemoryShareStore();
    const created = await routeShareRequest({
      method: 'POST',
      pathname: '/api/shares',
      body: snapshot(),
      origin: 'http://localhost:5173',
    }, store);

    expect(created).toMatchObject({ kind: 'response', status: 201 });
    if (created.kind !== 'response') throw new Error('expected publish response');
    const payload = created.body as { token: string; manageToken: string; url: string };

    const viewed = await routeShareRequest({
      method: 'GET',
      pathname: `/api/shares/${payload.token}`,
      origin: 'http://localhost:5173',
    }, store);
    expect(viewed).toMatchObject({ kind: 'response', status: 200 });
    if (viewed.kind !== 'response') throw new Error('expected snapshot');
    const document = viewed.body as ShareBoardDocument;
    expect(document.version).toBe('3.0');
    expect(document.board.title).toBe('Board A');
    expect(document.board.nodes).toHaveLength(2);
    expect(JSON.stringify(document)).not.toContain(payload.manageToken);

    const page = await routeShareRequest({
      method: 'GET',
      pathname: `/view/${payload.token}`,
      origin: 'http://localhost:5173',
    }, store);
    expect(page).toEqual({ kind: 'viewer' });

    const revoked = await routeShareRequest({
      method: 'POST',
      pathname: `/api/shares/${payload.token}/revoke`,
      manageToken: payload.manageToken,
      origin: 'http://localhost:5173',
    }, store);
    expect(revoked).toMatchObject({ kind: 'response', status: 204 });

    const missing = await routeShareRequest({
      method: 'GET',
      pathname: `/view/${payload.token}`,
      origin: 'http://localhost:5173',
    }, store);
    expect(missing).toMatchObject({ kind: 'response', status: 404 });
  });

  it('rotates to a new token and 404s the old one', async () => {
    const store = createMemoryShareStore();
    const created = await routeShareRequest({
      method: 'POST',
      pathname: '/api/shares',
      body: snapshot(),
      origin: 'https://diagram-tool.teqcon.uk',
    }, store);
    if (created.kind !== 'response') throw new Error('expected publish response');
    const first = created.body as { token: string; manageToken: string; url: string };

    const rotated = await routeShareRequest({
      method: 'POST',
      pathname: `/api/shares/${first.token}/rotate`,
      manageToken: first.manageToken,
      origin: 'https://diagram-tool.teqcon.uk',
    }, store);
    expect(rotated).toMatchObject({ kind: 'response', status: 201 });
    if (rotated.kind !== 'response') throw new Error('expected rotate response');
    const next = rotated.body as { token: string; url: string };
    expect(next.token).not.toBe(first.token);
    expect(next.url).toBe(`https://diagram-tool.teqcon.uk/view/${next.token}`);

    const oldLink = await routeShareRequest({
      method: 'GET',
      pathname: `/view/${first.token}`,
      origin: 'https://diagram-tool.teqcon.uk',
    }, store);
    expect(oldLink).toMatchObject({ kind: 'response', status: 404 });

    const newLink = await routeShareRequest({
      method: 'GET',
      pathname: `/view/${next.token}`,
      origin: 'https://diagram-tool.teqcon.uk',
    }, store);
    expect(newLink).toEqual({ kind: 'viewer' });
  });

  it('issues unguessable tokens and does not list them without the secret', async () => {
    const tokens = Array.from({ length: 12 }, () => createShareToken());
    expect(new Set(tokens).size).toBe(12);
    expect(tokens.every(token => /^[A-Za-z0-9_-]{24}$/.test(token))).toBe(true);
    expect(tokens[1]).not.toBe(tokens[0]);
    expect(tokens.some((token, index) => index > 0 && token === incrementToken(tokens[0], index))).toBe(false);

    const store = createMemoryShareStore();
    const created = await routeShareRequest({
      method: 'POST',
      pathname: '/api/shares',
      body: snapshot(),
      origin: 'http://localhost:5173',
    }, store);
    if (created.kind !== 'response') throw new Error('expected publish response');
    const payload = created.body as { token: string; manageToken: string };

    const listed = await routeShareRequest({
      method: 'GET',
      pathname: '/api/shares',
      origin: 'http://localhost:5173',
    }, store);
    expect(listed).toMatchObject({ kind: 'response', status: 404 });
    expect(JSON.stringify(listed)).not.toContain(payload.token);
    expect(JSON.stringify(listed)).not.toContain(payload.manageToken);
  });

  it('runs the presentation sanitizer on publish so remote and SVG images are not stored', async () => {
    const store = createMemoryShareStore();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJ0hREFU';
    const created = await routeShareRequest({
      method: 'POST',
      pathname: '/api/shares',
      body: {
        ...snapshot(),
        board: {
          ...snapshot().board,
          comments: [{ id: 'c1', text: 'nope' }],
          frames: [{ id: 'f1' }],
          thumbnail: 'https://evil.example/thumb.png',
          presentation: {
            items: [
              { id: 'ok', type: 'note', content: 'keep', x: 0, y: 0, width: 10, height: 10 },
              { id: 'remote', type: 'image', content: 'https://evil.example/x.png', x: 0, y: 0, width: 10, height: 10 },
              { id: 'svg', type: 'image', content: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+', x: 0, y: 0, width: 10, height: 10 },
              { id: 'raster', type: 'image', content: png, x: 0, y: 0, width: 10, height: 10 },
            ],
          },
        },
      },
      origin: 'http://localhost:5173',
    }, store);
    if (created.kind !== 'response') throw new Error('expected publish response');
    const payload = created.body as { token: string };

    const viewed = await routeShareRequest({
      method: 'GET',
      pathname: `/api/shares/${payload.token}`,
      origin: 'http://localhost:5173',
    }, store);
    if (viewed.kind !== 'response') throw new Error('expected snapshot');
    const document = viewed.body as ShareBoardDocument;
    const items = (document.board.presentation as { items?: Array<{ id: string; content: string }> } | undefined)?.items ?? [];
    expect(items.map(item => item.id)).toEqual(['ok', 'raster']);
    expect(JSON.stringify(document)).not.toContain('evil.example');
    expect(JSON.stringify(document)).not.toContain('image/svg+xml');
    expect(document.board.comments).toEqual([]);
    expect(document.board.frames).toEqual([]);
    expect(document.board.thumbnail).toBeUndefined();
  });

  it('rejects silent or invalid publish payloads', async () => {
    const store = createMemoryShareStore();
    const rejected = await routeShareRequest({
      method: 'POST',
      pathname: '/api/shares',
      body: { version: '2.0', kind: 'board' },
      origin: 'http://localhost:5173',
    }, store);
    expect(rejected).toMatchObject({ kind: 'response', status: 400 });
  });
});

function incrementToken(token: string, steps: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const chars = token.split('');
  let carry = steps;
  for (let index = chars.length - 1; index >= 0 && carry > 0; index -= 1) {
    const next = alphabet.indexOf(chars[index]) + carry;
    chars[index] = alphabet[next % alphabet.length];
    carry = Math.floor(next / alphabet.length);
  }
  return chars.join('');
}
