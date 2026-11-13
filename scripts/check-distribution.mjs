import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(import.meta.url);
for (const name of ['icons', 'i18n', 'blocks', 'ui']) {
  const entry = new URL(`../packages/${name}/dist/index.js`, import.meta.url);
  const module = await import(entry);
  assert.ok(Object.keys(module).length > 0, `${name} exposes exports`);
  assert.match(
    fs.readFileSync(entry, 'utf8'),
    /^['"]use client['"];?/,
    `${name} preserves its client boundary`
  );
  console.log(`${name}: ESM import and client boundary passed`);
}
const ui = await import(new URL('../packages/ui/dist/index.js', import.meta.url));
const uiCommonJs = require('../packages/ui/dist/index.cjs');
for (const name of [
  'Button',
  'OfficeEditor',
  'OfficeStudio',
  'createOfficeStudioDocument',
  'isOfficeStudioDocument',
]) {
  assert.equal(typeof ui[name], 'function', `react ESM exports ${name}`);
  assert.equal(typeof uiCommonJs[name], 'function', `react CommonJS exports ${name}`);
}
assert.equal(ui.createOfficeStudioDocument('word').kind, 'word');
assert.equal(ui.isOfficeStudioDocument(ui.createOfficeStudioDocument('excel')), true);
assert.match(
  fs.readFileSync(new URL('../packages/ui/dist/index.cjs', import.meta.url), 'utf8'),
  /['"]use client['"]/
);
for (const name of ['tokens', 'icons', 'i18n', 'ui', 'blocks', 'cli', 'mcp']) {
  const cwd = new URL(`../packages/${name}/`, import.meta.url);
  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd, encoding: 'utf8' })
  );
  const files = pack.files.map((file) => file.path);
  assert.ok(
    files.some((file) => file.startsWith('dist/')),
    `${name} ships dist`
  );
  assert.ok(files.includes('README.md'), `${name} ships README`);
  assert.ok(files.includes('LICENSE'), `${name} ships LICENSE`);
  assert.ok(
    !files.some((file) => /(?:\.test\.|\.stories\.|node_modules\/)/.test(file)),
    `${name} excludes tests and dependencies`
  );
  if (name === 'cli' || name === 'mcp')
    assert.ok(files.includes('data/registry/registry.json'), `${name} ships the registry`);
  if (name === 'ui') {
    const manifest = JSON.parse(fs.readFileSync(new URL('package.json', cwd), 'utf8'));
    const exportTargets = (entry) =>
      typeof entry === 'string' ? [entry] : Object.values(entry).flatMap(exportTargets);
    for (const target of exportTargets(manifest.exports)) {
      assert.ok(files.includes(target.replace(/^\.\//, '')), `react ships export target ${target}`);
    }
    const modules = files.filter(
      (file) =>
        file.startsWith('dist/') && !file.startsWith('dist/browser/') && /\.(?:js|cjs)$/.test(file)
    );
    for (const file of modules) {
      const entry = new URL(file, cwd);
      const module = file.endsWith('.cjs') ? require(fileURLToPath(entry)) : await import(entry);
      assert.ok(Object.keys(module).length, `react lazy or shared module can load: ${file}`);
    }
    const styles = fs.readFileSync(new URL('dist/style.css', cwd), 'utf8');
    assert.match(styles, /\.z-office-editor[\s,{[]/, 'react ships OfficeEditor styles');
    assert.match(styles, /\.z-office-studio[\s,{[]/, 'react ships OfficeStudio styles');
    for (const file of ['zui.global.js', 'zui.css', 'LICENSE.txt']) {
      assert.ok(files.includes(`dist/browser/${file}`), `react ships browser ${file}`);
    }
    const browserNotices = fs.readFileSync(new URL('dist/browser/LICENSE.txt', cwd), 'utf8');
    for (const dependency of ['react', 'react-dom', '@tiptap/react', 'fast-formula-parser']) {
      assert.ok(
        browserNotices.includes(`${dependency}@`),
        `react browser ships ${dependency} license notices`
      );
    }
  }
  console.log(`${name}: npm pack passed (${files.length} files)`);
}
