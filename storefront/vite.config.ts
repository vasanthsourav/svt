import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server on 5180; API calls to /api and /uploads are proxied to the backend (4100).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,            // bind to 0.0.0.0 so phones on the same Wi-Fi can open it
    allowedHosts: true,    // allow LAN IP + cloudflared/ngrok tunnel hostnames
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4100', changeOrigin: true }
    }
  }
})
