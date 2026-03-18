import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // 允许外网访问
    port: 5173,
    allowedHosts: ['test.weareall.world', 'kf.weareall.world', '.weareall.world'],
    // HMR 配置 - 通过 Cloudflare 访问时使用 WSS
    hmr: {
      protocol: 'wss',
      host: 'test.weareall.world',
      clientPort: 443
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})