import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Vite already depends on esbuild. Resolve its bundled copy, without adding a dependency.
const require = createRequire(import.meta.url);
const bundler = require(require.resolve('esbuild', { paths: [require.resolve('vite')] })) as {
  build(options: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }>;
};

// chevrotain 的主入口再导出 diagrams 工具，其源码模板内嵌 <script src=…> 外链；
// CJS 命名空间引入让摇树失效，离线导出禁止任何外链，因此在打包层替换该模块。
const chevrotainDiagramsStub = {
  name: 'zui-builder-chevrotain-diagrams-stub',
  setup(build: { onLoad(options: unknown, callback: (args: unknown) => unknown): void }) {
    build.onLoad(
      { filter: /chevrotain[\\/]lib(?:_esm)?[\\/]src[\\/]diagrams[\\/]render_public\.js$/ },
      () => ({
        contents:
          'exports.createSyntaxDiagramsCode = () => { throw new Error("语法图仅在完整 chevrotain 环境可用，离线运行时不包含。"); };',
        loader: 'js' as const,
      })
    );
  },
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
          plugins: [chevrotainDiagramsStub],
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
