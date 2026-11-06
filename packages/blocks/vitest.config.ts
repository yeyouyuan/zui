import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@zui/react': new URL('../ui/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [new URL('../ui/src/test/setup.ts', import.meta.url).pathname],
    include: ['tests/**/*.test.tsx'],
    css: false,
  },
});
