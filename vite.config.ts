import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { shareHostPlugin } from './server/sharePlugin'
import { PRODUCTION_SHARE_STORE_DIR } from './server/shareStorePath'

// Pin SHARE_STORE_DIR before the share plugin reads it. systemd/vite preview
// often start with cwd = …/dist; a cwd-relative default would die on every ship.
if (!process.env.SHARE_STORE_DIR?.trim()) {
  process.env.SHARE_STORE_DIR = PRODUCTION_SHARE_STORE_DIR
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shareHostPlugin()],
  server: {
    fs: {
      deny: ['.share-store', '.share-store-e2e', '.share-store-e2e-preview'],
    },
  },
  preview: {
    // Allow the production hostname (requests arrive via nginx reverse proxy
    // with Host: diagram.teqcon.uk). Without this, Vite preview replies 403.
    allowedHosts: ['diagram.teqcon.uk', 'diagram-tool.teqcon.uk'],
  },
})
