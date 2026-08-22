import { describe, expect, it } from 'vitest';
import { routeShareRequest } from './shareHost';
import { createMemoryShareStore, type ShareBoardDocument } from './shareStore';

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
