import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { dir: { type: 'string' } } });
const directory = path.resolve(root, values.dir || '.release/github-packages');
const release = JSON.parse(fs.readFileSync(path.join(directory, 'github-packages.json'), 'utf8'));
const registry = 'https://npm.pkg.github.com';
for (const entry of release.packages) {
  const tarball = path.resolve(directory, entry.filename);
  assert.equal(path.dirname(tarball), directory);
  assert.equal(
    entry.integrity,
    'sha512-' + createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')
  );
  assert.ok(entry.name.startsWith('@' + release.repository.split('/')[0].toLowerCase() + '/zui-'));
  let existing;
  try {
    existing = JSON.parse(
      execFileSync(
        'npm',
        [
          'view',
          entry.name + '@' + entry.version,
          'dist.integrity',
          '--json',
          '--registry',
          registry,
        ],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
    );
  } catch (error) {
    const output = String(error.stderr) + String(error.stdout);
    if (!/\bE404\b/.test(output)) throw error;
  }
  if (existing) {
    assert.equal(
      existing,
      entry.integrity,
      entry.name + ' already exists with different contents; choose a new version'
    );
    console.log('Already published and verified: ' + entry.name + '@' + entry.version);
    continue;
  }
  execFileSync('npm', ['publish', tarball, '--ignore-scripts', '--registry', registry], {
    stdio: 'inherit',
  });
}
