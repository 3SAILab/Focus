import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import portDiscoveryPlugin from './vite-plugin-port-discovery'

// https://vite.dev/config/
export default defineConfig({
  base: './',  // 使用相对路径，解决 Electron 中 file:// 协议的资源加载问题
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
  esbuild: {
    // 生产环境移除 console 和 debugger
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : ['debugger']
  }
})
