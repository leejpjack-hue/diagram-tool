import { normalizeWaitlist } from '../src/waitlist/validate.ts';

export interface Env {
  ASSETS: { fetch: typeof fetch };
  WAITLIST: DurableObjectNamespace;
}

export class WaitlistStore {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ ok: false, error: 'Method not allowed.' }, { status: 405 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid body.' }, { status: 400 });
    }

    const parsed = normalizeWaitlist(body);
    if (!parsed.ok) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    await this.ctx.storage.put(`email:${parsed.value.email}`, {
      ...parsed.value,
      createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true }, { status: 201 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/waitlist' || url.pathname === '/api/waitlist/') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return Response.json({ ok: true, service: 'waitlist' }, {
          headers: { 'cache-control': 'no-store' },
        });
      }
      const stub = env.WAITLIST.get(env.WAITLIST.idFromName('signups'));
      return stub.fetch(request);
    }

    if (url.pathname === '/app') {
      url.pathname = '/app/';
      return env.ASSETS.fetch(new Request(url, request));
    }

    return env.ASSETS.fetch(request);
  },
};
