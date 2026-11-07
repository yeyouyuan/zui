import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  version: string;
};
const outDir = 'dist/browser';
const docsDir = `../../docs/dist/cdn/v${version}`;

const licensePlugin = {
  name: 'zui-browser-license',
  closeBundle() {
    const root = new URL('../../', import.meta.url);
    const license = readFileSync(new URL('LICENSE', root), 'utf8');
    const react = readFileSync(new URL('node_modules/react/LICENSE', import.meta.url), 'utf8');
    const reactDom = readFileSync(
      new URL('node_modules/react-dom/LICENSE', import.meta.url),
      'utf8'
    );
    writeFileSync(
      join(outDir, 'LICENSE.txt'),
      ['ZUI', license, 'React', react, 'React DOM', reactDom].join('\n\n')
    );
    mkdirSync(docsDir, { recursive: true });
    for (const name of ['zui.global.js', 'zui.css', 'LICENSE.txt']) {
      copyFileSync(join(outDir, name), join(docsDir, name));
    }
  },
};

export default defineConfig({
  plugins: [react(), licensePlugin],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: 'src/browser.ts',
      name: 'ZUI',
      formats: ['iife'],
      fileName: () => 'zui.global.js',
      cssFileName: 'zui',
    },
    cssCodeSplit: false,
  },
});
