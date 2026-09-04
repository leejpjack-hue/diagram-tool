import { normalizeWaitlist } from '../src/waitlist/validate.ts';

declare const caches: {
  default: {
    put(request: Request, response: Response): Promise<void>;
  };
};

export interface Env {
  ASSETS?: { fetch: typeof fetch };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

async function persistSignup(payload: Record<string, unknown>): Promise<void> {
  const cache = caches.default;
  const email = String(payload.email ?? 'unknown');
  const request = new Request(`https://waitlist.internal/${encodeURIComponent(email)}`);
  await cache.put(
    request,
    new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=31536000' },
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/waitlist' || url.pathname === '/api/waitlist/') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return json({ ok: true, service: 'waitlist' });
      }
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'Method not allowed.' }, 405);
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: 'Invalid body.' }, 400);
      }

      const parsed = normalizeWaitlist(body);
      if (!parsed.ok) {
        return json({ ok: false, error: parsed.error }, 400);
      }

      await persistSignup({
        ...parsed.value,
        createdAt: new Date().toISOString(),
      });
      return json({ ok: true }, 201);
    }

    if (url.pathname === '/app') {
      url.pathname = '/app/';
      request = new Request(url, request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};
