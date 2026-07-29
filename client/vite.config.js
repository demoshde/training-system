import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Required for Docker
    watch: {
      usePolling: true, // Required for hot reload in Docker/WSL
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5001',
        changeOrigin: true,
        timeout: 120000, // 2 minutes timeout for large file uploads
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Increase max body size for uploads
            proxyReq.setHeader('Connection', 'keep-alive');
          });
        }
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
})
