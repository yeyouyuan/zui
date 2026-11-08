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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'zui-consumer-'));
try {
  const ctx = createContext({ cwd, log: () => {} });
  const added = await add({ ctx, names: [], all: true });
  assert.deepEqual(added.warnings, []);
  assert.equal(added.items.length, 87);
  const compared = await diff({ ctx, names: ctx.allItems().map((item) => item.name) });
  assert.ok(compared.files.every((file) => file.state === 'same'));

  const examples = path.join(cwd, 'src/examples');
  fs.mkdirSync(examples, { recursive: true });
  const catalog = loadCatalog();
  for (const entry of catalog.values()) {
    const result = generateCode(catalog, entry.name);
    assert.equal(result.ok, true);
    fs.writeFileSync(path.join(examples, `${entry.name}.tsx`), result.code);
  }
  fs.writeFileSync(path.join(cwd, 'src/styles.d.ts'), "declare module '*.css';\n");
  fs.mkdirSync(path.join(cwd, 'node_modules/@zui'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'node_modules/@types'), { recursive: true });
  for (const name of ['react', 'react-dom', '@types/react', '@types/react-dom']) {
    fs.symlinkSync(
      path.join(root, 'packages/ui/node_modules', name),
      path.join(cwd, 'node_modules', name),
      'dir'
    );
  }
  for (const [name, folder] of [
    ['react', 'ui'],
    ['tokens', 'tokens'],
    ['icons', 'icons'],
    ['i18n', 'i18n'],
  ]) {
    fs.symlinkSync(
      path.join(root, 'packages', folder),
      path.join(cwd, 'node_modules/@zui', name),
      'dir'
    );
  }
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
    `Consumer passed: ${added.items.length} registry items, ${added.written.length} files, ${catalog.size} MCP examples; diff unchanged`
  );
} finally {
  fs.rmSync(cwd, { recursive: true, force: true });
}
