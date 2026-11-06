import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BUILD === 'true' ? '/zui/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api/translate': 'http://127.0.0.1:8787',
    },
  },
});
