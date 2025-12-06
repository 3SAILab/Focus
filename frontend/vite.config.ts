import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import portDiscoveryPlugin from './vite-plugin-port-discovery'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    portDiscoveryPlugin({
      backendPortFile: 'sigma-backend.port',
      defaultBackendPort: 8080,
      frontendPortFile: 'sigma-frontend.port',
      enableFrontendPortFile: true
    })
  ],
  server: {
    port: 5174,
    strictPort: false, // Allow Vite to try next port if 5174 is occupied
  },
})
