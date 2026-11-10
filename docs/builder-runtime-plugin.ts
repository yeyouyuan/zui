import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Vite already depends on esbuild. Resolve its bundled copy, without adding a dependency.
const require = createRequire(import.meta.url);
const bundler = require(require.resolve('esbuild', { paths: [require.resolve('vite')] })) as {
  build(options: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }>;
};

export function builderRuntimePlugin(): Plugin {
  const publicId = 'virtual:zui-builder-runtime';
  const resolvedId = `\0${publicId}`;
  let cached: Promise<string> | undefined;
  return {
    name: 'zui-standalone-page-runtime',
    resolveId(id) {
      if (id === publicId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      cached ??= bundler
        .build({
          entryPoints: [
            fileURLToPath(new URL('./src/pages/builder/builder-runtime.tsx', import.meta.url)),
          ],
          bundle: true,
          write: false,
          minify: true,
          format: 'iife',
          platform: 'browser',
          target: ['es2022'],
          jsx: 'automatic',
          loader: { '.css': 'empty' },
          define: {
            'process.env.NODE_ENV': '"production"',
            'import.meta': '{"env":{"DEV":false,"PROD":true,"MODE":"production"}}',
          },
          legalComments: 'inline',
        })
        .then((result) => result.outputFiles[0].text);
      try {
        return `export default ${JSON.stringify(await cached)}`;
      } catch (error) {
        cached = undefined;
        throw error;
      }
    },
    handleHotUpdate(context) {
      if (
        !context.file.includes('/pages/builder/') &&
        !context.file.includes('/packages/') &&
        !context.file.endsWith('/components/CodeBlock.tsx')
      )
        return;
      cached = undefined;
      const module = context.server.moduleGraph.getModuleById(resolvedId);
      if (module) {
        context.server.moduleGraph.invalidateModule(module);
        return [...context.modules, module];
      }
    },
  };
}
