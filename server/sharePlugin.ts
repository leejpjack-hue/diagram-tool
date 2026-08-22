import type { Plugin } from 'vite';
import { handleShareHttp } from './shareHost';
import { resolveShareStoreDirectory } from './shareStorePath';
import { createFileShareStore, type ShareStore } from './shareStore';

function attachShareHost(middlewares: { use: (handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void }, getStore: () => ShareStore) {
  middlewares.use((req, res, next) => {
    void handleShareHttp(req, res, getStore(), next);
  });
}

export function shareHostPlugin(directory?: string): Plugin {
  let store: ShareStore | undefined;
  const getStore = () => {
    store ??= createFileShareStore(directory ?? resolveShareStoreDirectory());
    return store;
  };
  return {
    name: 'diagram-tool-share-host',
    configureServer(server) {
      attachShareHost(server.middlewares, getStore);
    },
    configurePreviewServer(server) {
      attachShareHost(server.middlewares, getStore);
    },
  };
}
