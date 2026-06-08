import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(() => ({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000',
      '/ws': {
        target: process.env.VITE_BACKEND_WS_TARGET || 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
}))
