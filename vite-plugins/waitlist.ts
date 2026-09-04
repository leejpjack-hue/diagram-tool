import { appendFileSync, mkdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import type { Plugin } from 'vite';
import { normalizeWaitlist } from '../src/waitlist/validate.ts';

const BODY_LIMIT = 8_192;

function waitlistFile(): string {
  return process.env.WAITLIST_FILE?.trim() || resolve(process.cwd(), 'data/waitlist.jsonl');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(raw: string, contentType: string): unknown {
  if (!raw.trim()) return {};
  if (contentType.includes('application/json')) {
    return JSON.parse(raw) as unknown;
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
}

function persist(payload: Record<string, unknown>): void {
  const file = waitlistFile();
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(payload)}\n`, 'utf8');
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    sendJson(res, 200, { ok: true, service: 'waitlist' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody = parseBody(await readBody(req), req.headers['content-type'] ?? '');
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid body.' });
    return;
  }

  const parsed = normalizeWaitlist(parsedBody);
  if (!parsed.ok) {
    sendJson(res, 400, { ok: false, error: parsed.error });
    return;
  }

  persist({
    ...parsed.value,
    createdAt: new Date().toISOString(),
  });
  sendJson(res, 201, { ok: true });
}

export function waitlistApi(): Plugin {
  return {
    name: 'waitlist-api',
    configureServer(server) {
      server.middlewares.use('/api/waitlist', (req, res) => {
        void handle(req, res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/waitlist', (req, res) => {
        void handle(req, res);
      });
    },
  };
}
