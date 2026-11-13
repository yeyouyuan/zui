import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'node:fs';
import { builderRuntimePlugin } from './builder-runtime-plugin';
import { officePdfAssetsPlugin } from './office-pdf-assets-plugin';

const { version } = JSON.parse(
  readFileSync(new URL('../packages/ui/package.json', import.meta.url), 'utf8')
);
const countDirectories = (path: string) =>
  readdirSync(new URL(path, import.meta.url), { withFileTypes: true }).filter((item) =>
    item.isDirectory()
  ).length;

export default defineConfig({
  // Export is lazy-loaded; prebundle its React entry so the first preview does
  // not trigger a development-server reload and interrupt the editing session.
  optimizeDeps: { include: ['react-dom/server'] },
  plugins: [
    react(),
    builderRuntimePlugin(),
    officePdfAssetsPlugin(),
    {
      name: 'zui-puck-local-font',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('@puckeditor/core') || !id.endsWith('.css')) return null;
        return {
          code: code.replace('@import "https://rsms.me/inter/inter.css";\n', ''),
          map: null,
        };
      },
    },
  ],
  base: process.env.GITHUB_PAGES_BUILD === 'true' ? '/zui/' : '/',
  define: {
    __ZUI_CATALOG__: JSON.stringify({
      version,
      components: countDirectories('../packages/ui/src/components/'),
      blocks: countDirectories('../packages/blocks/src/'),
      icons: readdirSync(new URL('../packages/icons/src/icons/', import.meta.url)).filter((name) =>
        name.endsWith('.tsx')
      ).length,
    }),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-runtime';
          // Editor kernels stay behind their dynamic imports. The shared ZUI
          // entry remains available to every route without loading them.
          if (/\/packages\/ui\/dist\/index\.(?:js|cjs)$/.test(id)) return 'zui-components';
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
      '/api/office': 'http://127.0.0.1:8790',
    },
  },
  preview: {
    proxy: { '/api/office': 'http://127.0.0.1:8790' },
  },
});
