import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createContext } from '../packages/cli/dist/index.js';
import { add } from '../packages/cli/dist/commands/add.js';
import { diff } from '../packages/cli/dist/commands/diff.js';
import { loadCatalog } from '../packages/mcp/dist/tools/search.js';
import { generateCode } from '../packages/mcp/dist/tools/generate.js';
import { officeRuleConsumerLines } from './office-consumer-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRegistry = JSON.parse(
  fs.readFileSync(path.join(root, 'registry/registry.json'), 'utf8')
);
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'zui-consumer-'));
try {
  const ctx = createContext({ cwd, log: () => {} });
  assert.deepEqual(ctx.registry, sourceRegistry, 'CLI bundled registry is stale; rebuild @zui/cli');
  const sourceFiles = new Set([
    ...sourceRegistry.sharedFiles,
    ...sourceRegistry.items.flatMap((item) => [...item.files, item.meta]),
  ]);
  for (const file of sourceFiles) {
    assert.deepEqual(
      fs.readFileSync(path.join(ctx.registryRoot, file)),
      fs.readFileSync(path.join(root, file)),
      `CLI bundled source is stale: ${file}; rebuild @zui/cli`
    );
  }
  const added = await add({ ctx, names: [], all: true });
  assert.deepEqual(added.warnings, []);
  assert.equal(added.items.length, sourceRegistry.items.length);
  const compared = await diff({ ctx, names: ctx.allItems().map((item) => item.name) });
  assert.ok(compared.files.every((file) => file.state === 'same'));

  const examples = path.join(cwd, 'src/examples');
  fs.mkdirSync(examples, { recursive: true });
  const catalog = loadCatalog();
  assert.deepEqual(
    [...catalog.values()],
    [...loadCatalog(root).values()],
    'MCP bundled component metadata is stale; rebuild @zui/mcp'
  );
  assert.equal(
    catalog.size,
    sourceRegistry.items.filter((item) => item.type === 'registry:component').length
  );
  for (const entry of catalog.values()) {
    const result = generateCode(catalog, entry.name);
    assert.equal(result.ok, true);
    fs.writeFileSync(path.join(examples, `${entry.name}.tsx`), result.code);
  }
  fs.writeFileSync(
    path.join(examples, 'office-subpaths.tsx'),
    [
      "import { OfficeStudio, createOfficeStudioDocument, type OfficeStudioHandle, type StudioPdfSearchResult, type StudioSheetChart, type StudioSheetStructureEdit } from '@zui/react/office-studio';",
      "import { OfficeEditor, type OfficeEditorConfig } from '@zui/react/office-editor';",
      'export function OfficeSubpathsExample({ config, documentServerUrl }: { config: OfficeEditorConfig; documentServerUrl: string }) {',
      "  return <><OfficeEditor config={config} documentServerUrl={documentServerUrl} /><OfficeStudio defaultValue={createOfficeStudioDocument('word')} onPrint={async (document) => { void document; }} /></>;",
      '}',
      'export function printStudio(handle: OfficeStudioHandle) { return handle.print(); }',
      'export type OfficeSearchHit = StudioPdfSearchResult;',
      'export type OfficeChart = StudioSheetChart;',
      'export type OfficeStructureEdit = StudioSheetStructureEdit;',
      ...officeRuleConsumerLines(),
    ].join('\n')
  );
  fs.writeFileSync(path.join(cwd, 'src/styles.d.ts'), "declare module '*.css';\n");
  const workspacePackages = new Map([
    ['@zui/react', 'ui'],
    ['@zui/tokens', 'tokens'],
    ['@zui/icons', 'icons'],
    ['@zui/i18n', 'i18n'],
  ]);
  const dependencies = new Set([
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
    '@zui/react',
    ...added.dependencies,
  ]);
  for (const name of dependencies) {
    const folder = workspacePackages.get(name);
    const candidates = folder
      ? [path.join(root, 'packages', folder)]
      : ['packages/ui/node_modules', 'packages/i18n/node_modules', 'node_modules'].map((modules) =>
          path.join(root, modules, name)
        );
    const source = candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(source, `Declared consumer dependency is not installed: ${name}`);
    const destination = path.join(cwd, 'node_modules', name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(fs.realpathSync(source), destination, 'dir');
  }
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ private: true, type: 'module' })
  );
  fs.writeFileSync(
    path.join(cwd, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['src'],
    })
  );
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(cwd, 'tsconfig.json')],
    { stdio: 'inherit' }
  );
  console.log(
    `Consumer passed: ${added.items.length} registry items, ${added.written.length} files, ${catalog.size} MCP examples and Office subpaths; bundled sources current, diff unchanged`
  );
} finally {
  fs.rmSync(cwd, { recursive: true, force: true });
}
