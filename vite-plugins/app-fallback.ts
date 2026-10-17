import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

function pathname(req: IncomingMessage): string {
  return (req.url ?? '').split('?')[0] ?? '';
}

function rewriteAppPath(req: IncomingMessage): void {
  const url = req.url ?? '';
  const [path, query] = url.split('?');
  if (path !== '/app') return;
  req.url = query ? `/app/?${query}` : '/app/';
}

// Former API paths must not fall through to the HTML SPA fallback.
function rejectApi(req: IncomingMessage, res: ServerResponse): boolean {
  const path = pathname(req);
  if (path !== '/api' && !path.startsWith('/api/')) return false;
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end('Not found');
  return true;
}

export function appFallback(): Plugin {
  return {
    name: 'app-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (rejectApi(req, res)) return;
        rewriteAppPath(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (rejectApi(req, res)) return;
        rewriteAppPath(req);
        next();
      });
    },
  };
}
