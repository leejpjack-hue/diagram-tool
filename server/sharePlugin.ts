import type { Plugin } from 'vite';
import { handleShareHttp } from './shareHost';
import { resolveShareStoreDirectory } from './shareStorePath';
import { createFileShareStore, type ShareStore } from './shareStore';

function attachShareHost(middlewares: { use: (handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void }, store: ShareStore) {
  middlewares.use((req, res, next) => {
    void handleShareHttp(req, res, store, next);
  });
}

export function shareHostPlugin(directory = resolveShareStoreDirectory()): Plugin {
  const store = createFileShareStore(directory);
  return {
    name: 'diagram-tool-share-host',
    configureServer(server) {
      attachShareHost(server.middlewares, store);
    },
    configurePreviewServer(server) {
      attachShareHost(server.middlewares, store);
    },
  };
}
