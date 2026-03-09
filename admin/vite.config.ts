import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 管理后台独立配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5168,  // 管理后台独立端口
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})