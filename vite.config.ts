import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appFallback } from './vite-plugins/app-fallback'
import { waitlistApi } from './vite-plugins/waitlist'

export default defineConfig({
  plugins: [react(), waitlistApi(), appFallback()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
  preview: {
    // Allow the production hostname (requests arrive via nginx reverse proxy
    // with Host: diagram.teqcon.uk). Without this, Vite preview replies 403.
    allowedHosts: ['diagram.teqcon.uk', 'diagram-tool.teqcon.uk'],
  },
})
