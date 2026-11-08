import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BUILD === 'true' ? '/zui/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Puck 只在懒加载的 Builder 路由中使用；将其两组大依赖保持为
          // 独立路由级 chunk，避免单个 Builder chunk 越过 Vite 的 500 kB
          // 预算，同时不把编辑器代码抬到文档站首屏。
          if (id.includes('/@dnd-kit+')) return 'puck-dnd';
          if (id.includes('/@tanstack+virtual-core@')) return 'puck-virtual';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/translate': 'http://127.0.0.1:8787',
    },
  },
});
