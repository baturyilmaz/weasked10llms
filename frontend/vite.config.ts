import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow access from network
    hmr: {
        protocol: 'wss', // Use wss for secure websocket HMR
        host: 'https://93f1-78-187-70-17.ngrok-free.app',
    },
    // Allow specific host for tunnel access
    allowedHosts: ['.ngrok-free.app'],
    // Proxy API requests to the backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
})
