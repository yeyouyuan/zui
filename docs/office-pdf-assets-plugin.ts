import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { trueTypeFromWoff } from '../scripts/office-fonts.mjs';

/** Serve/emit PDF.js support assets locally, including documents with unembedded CJK fonts. */
export function officePdfAssetsPlugin(): Plugin {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('pdfjs-dist/package.json'));
  const files = new Map<string, string>();
  const fontRoot = dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
  const font = trueTypeFromWoff(
    readFileSync(join(fontRoot, 'files/noto-sans-sc-chinese-simplified-400-normal.woff'))
  );
  files.set(
    'NotoSansSC-OFL.txt',
    join(dirname(require.resolve('@fontsource/noto-sans-sc/package.json')), 'LICENSE')
  );
  for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
    for (const file of readdirSync(join(root, directory), { withFileTypes: true })) {
      if (file.isFile()) files.set(`${directory}/${file.name}`, join(root, directory, file.name));
    }
  }
  return {
    name: 'zui-office-pdf-assets',
    configureServer(server) {
      const base = server.config.base.replace(/\/$/, '');
      server.middlewares.use(`${base}/office-pdf-assets/`, (request, response, next) => {
        const key = (request.url ?? '').split('?')[0].replace(/^\//, '');
        if (key === 'NotoSansSC.ttf') {
          response.setHeader('Content-Type', 'font/ttf');
          response.end(font);
          return;
        }
        const filename = files.get(key);
        if (!filename) {
          next();
          return;
        }
        response.setHeader(
          'Content-Type',
          key.endsWith('.wasm')
            ? 'application/wasm'
            : key.endsWith('.js')
              ? 'text/javascript'
              : 'application/octet-stream'
        );
        const stream = createReadStream(filename);
        stream.on('error', () => {
          response.statusCode = 500;
          response.end();
        });
        stream.pipe(response);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'office-pdf-assets/NotoSansSC.ttf', source: font });
      for (const [key, filename] of files)
        this.emitFile({
          type: 'asset',
          fileName: `office-pdf-assets/${key}`,
          source: readFileSync(filename),
        });
    },
  };
}
