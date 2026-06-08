import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(() => {
  const useKumoApp = process.env.VITE_KUMO_APP === '1'

  return {
    plugins: [useKumoApp ? react() : vue()],
    build: useKumoApp
      ? {
          rollupOptions: {
            input: fileURLToPath(new URL('./index.kumo.html', import.meta.url)),
          },
        }
      : undefined,
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
  }
})
