import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

function rewriteAppPath(req: IncomingMessage): void {
  const url = req.url ?? '';
  const [path, query] = url.split('?');
  if (path !== '/app') return;
  req.url = query ? `/app/?${query}` : '/app/';
}

export function appFallback(): Plugin {
  return {
    name: 'app-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppPath(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewriteAppPath(req);
        next();
      });
    },
  };
}
