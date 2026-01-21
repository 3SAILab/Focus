import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import portDiscoveryPlugin from './vite-plugin-port-discovery'

// 前端 Console 日志开关
// 从环境变量读取，如果未设置则默认为 false（生产环境移除 console）
// 设置方法：在 package.json 的 build:frontend 脚本中添加 ENABLE_FRONTEND_CONSOLE=true
const ENABLE_FRONTEND_CONSOLE = process.env.ENABLE_FRONTEND_CONSOLE === 'true';

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
    // 根据 ENABLE_FRONTEND_CONSOLE 开关决定是否保留 console
    // 调试时设置为 true，正式发布时设置为 false
    drop: ENABLE_FRONTEND_CONSOLE 
      ? ['debugger']  // 保留 console，只移除 debugger
      : (process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : ['debugger'])  // 生产环境移除 console
  }
})
