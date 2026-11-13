import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as {
  version: string;
};
const outDir = 'dist/browser';
const docsDir = `../../docs/dist/cdn/v${version}`;

const licensePlugin: Plugin = {
  name: 'zui-browser-license',
  generateBundle(_options, bundle) {
    const root = new URL('../../', import.meta.url);
    const license = readFileSync(new URL('LICENSE', root), 'utf8');
    const dependencies = new Map<string, { directory: string; name: string; version: string }>();
    const roots = new Map<string, string | null>();
    const packageRoot = (moduleId: string): string | null => {
      const file = moduleId.split('?')[0];
      if (!isAbsolute(file)) return null;
      const start = dirname(file);
      if (roots.has(start)) return roots.get(start) ?? null;
      let directory = start;
      while (true) {
        const manifestFile = join(directory, 'package.json');
        if (existsSync(manifestFile)) {
          const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
            name?: string;
            version?: string;
          };
          if (manifest.name) {
            const result = manifest.name.startsWith('@zui/') ? null : directory;
            roots.set(start, result);
            if (result)
              dependencies.set(`${manifest.name}@${manifest.version ?? ''}`, {
                directory,
                name: manifest.name,
                version: manifest.version ?? '',
              });
            return result;
          }
        }
        const parent = dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
      roots.set(start, null);
      return null;
    };
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') continue;
      for (const moduleId of Object.keys(output.modules)) packageRoot(moduleId);
    }
    const notices = [...dependencies.values()]
      .sort((left, right) =>
        `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`, 'en')
      )
      .map(({ directory, name, version }) => {
        const files = readdirSync(directory, { withFileTypes: true })
          .filter(
            (file) => file.isFile() && /^(?:licen[cs]e|notice|copying)(?:$|[._-])/i.test(file.name)
          )
          .map((file) => file.name)
          .sort();
        if (!files.length)
          throw new Error(`Bundled dependency has no license notice: ${name}@${version}`);
        return [
          `${name}@${version}`,
          ...files.map((file) => `${file}\n${readFileSync(join(directory, file), 'utf8')}`),
        ].join('\n\n');
      });
    this.emitFile({
      type: 'asset',
      fileName: 'LICENSE.txt',
      source: ['ZUI', license, ...notices].join('\n\n'),
    });
  },
  closeBundle() {
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
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
