import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
})
