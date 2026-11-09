import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { minify } from 'terser';
import MagicString from 'magic-string';

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true, tsconfigPath: './tsconfig.json' }),
    {
      name: 'zui-compact-esm',
      renderChunk: {
        order: 'post',
        async handler(code, _chunk, options) {
          if (options.format !== 'es') return null;
          // Vite leaves ESM library whitespace intact to protect PURE comments.
          // Terser preserves those annotations explicitly, so consumers can still
          // remove unused components while the complete entry stays in budget.
          const result = await minify(code, {
            module: true,
            // Compact output without further expression rewrites.
            compress: false,
            format: {
              comments: false,
              preserve_annotations: true,
            },
            sourceMap: { asObject: true },
          });
          if (!result.code) throw new Error('ESM compression produced no code');
          return {
            code: result.code,
            map: typeof result.map === 'string' ? result.map : JSON.stringify(result.map),
          };
        },
      },
    },
    {
      name: 'zui-esm-annotations',
      renderChunk: {
        order: 'post',
        handler(code, _chunk, options) {
          if (options.format !== 'es') return null;
          // Rollup expects PURE immediately before a call; Terser places
          // annotations on return statements. A separate hook lets Rollup
          // compose this edit's map with the minifier's source map.
          const output = new MagicString(code);
          const returnOffsets = new Set<number>();
          const visit = (value: unknown): void => {
            if (!value || typeof value !== 'object') return;
            const node = value as Record<string, unknown>;
            if (node.type === 'ReturnStatement' && typeof node.start === 'number') {
              returnOffsets.add(node.start);
            }
            Object.values(node).forEach(visit);
          };
          visit(this.parse(code));
          for (const match of code.matchAll(/\/\* @__PURE__ \*\/\s*return\b/g)) {
            // Ignore lookalikes inside strings, templates, or regular expressions.
            if (!returnOffsets.has(match.index + match[0].length - 'return'.length)) continue;
            output.overwrite(match.index, match.index + match[0].length, 'return /* @__PURE__ */');
          }
          return { code: output.toString(), map: output.generateMap({ hires: true }) };
        },
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { assetFileNames: 'style[extname]', banner: "'use client';" },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});
