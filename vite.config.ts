import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { shareHostPlugin } from './server/sharePlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shareHostPlugin()],
  preview: {
    // Allow the production hostname (requests arrive via nginx reverse proxy
    // with Host: diagram.teqcon.uk). Without this, Vite preview replies 403.
    allowedHosts: ['diagram.teqcon.uk', 'diagram-tool.teqcon.uk'],
  },
})
