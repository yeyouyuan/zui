import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';

const require = createRequire(import.meta.url);
for (const name of ['icons', 'i18n', 'blocks', 'ui']) {
  const entry = new URL(`../packages/${name}/dist/index.js`, import.meta.url);
  const module = await import(entry);
  assert.ok(Object.keys(module).length > 0, `${name} exposes exports`);
  assert.match(fs.readFileSync(entry, 'utf8'), /^['"]use client['"];?/, `${name} preserves its client boundary`);
  console.log(`${name}: ESM import and client boundary passed`);
}
assert.equal(typeof require('../packages/ui/dist/index.cjs').Button, 'function');
assert.match(fs.readFileSync(new URL('../packages/ui/dist/index.cjs', import.meta.url), 'utf8'), /['"]use client['"]/);
for (const name of ['tokens', 'icons', 'i18n', 'ui', 'blocks', 'cli', 'mcp']) {
  const cwd = new URL(`../packages/${name}/`, import.meta.url);
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd, encoding: 'utf8' }));
  const files = pack.files.map((file) => file.path);
  assert.ok(files.some((file) => file.startsWith('dist/')), `${name} ships dist`);
  assert.ok(!files.some((file) => /(?:\.test\.|\.stories\.|node_modules\/)/.test(file)), `${name} excludes tests and dependencies`);
  if (name === 'cli' || name === 'mcp') assert.ok(files.includes('data/registry/registry.json'), `${name} ships the registry`);
  console.log(`${name}: npm pack passed (${files.length} files)`);
}
