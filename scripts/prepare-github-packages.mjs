import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: { owner: { type: 'string' }, out: { type: 'string' } },
});
const owner = (values.owner || process.env.GITHUB_REPOSITORY_OWNER || '').toLowerCase();
assert.match(owner, /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/, 'Provide a GitHub owner with --owner');
const output = path.resolve(root, values.out || '.release/github-packages');
const repository = process.env.GITHUB_REPOSITORY || owner + '/zui';
assert.equal(repository.split('/')[0].toLowerCase(), owner);
const folders = ['tokens', 'icons', 'i18n', 'ui', 'blocks', 'cli', 'mcp'];
const packages = folders.map((folder) => ({
  folder,
  source: path.join(root, 'packages', folder),
  manifest: JSON.parse(
    fs.readFileSync(path.join(root, 'packages', folder, 'package.json'), 'utf8')
  ),
}));
const names = new Map(
  packages.map(({ manifest }) => [
    manifest.name,
    '@' + owner + '/zui-' + manifest.name.split('/')[1],
  ])
);
const version = packages[0].manifest.version;
assert.match(version, /^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?$/);
assert.ok(
  packages.every(({ manifest }) => manifest.version === version),
  'Release package versions must agree'
);
if (process.env.GITHUB_EVENT_NAME === 'release') {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    'v' + version,
    'Release tag must match package versions'
  );
}
fs.mkdirSync(output, { recursive: true });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'zui-github-pack-'));
const entries = [];
const npm = (args, cwd) =>
  JSON.parse(
    execFileSync('npm', args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: path.join(temporary, 'cache') },
    })
  );
try {
  for (const { folder, source, manifest } of packages) {
    assert.equal(manifest.private, undefined, manifest.name + ' must be publishable');
    const [original] = npm(
      ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary],
      source
    );
    const stage = path.join(temporary, folder);
    fs.mkdirSync(stage);
    execFileSync('tar', [
      '-xzf',
      path.join(temporary, original.filename),
      '-C',
      stage,
      '--strip-components=1',
    ]);
    const published = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
    published.name = names.get(manifest.name);
    published.repository = { type: 'git', url: 'git+https://github.com/' + repository + '.git' };
    published.homepage = 'https://github.com/' + repository + '#readme';
    published.bugs = { url: 'https://github.com/' + repository + '/issues' };
    published.publishConfig = { registry: 'https://npm.pkg.github.com', access: 'public' };
    delete published.devDependencies;
    delete published.scripts;
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(published[field] || {})) {
        if (names.has(name)) {
          published[field][name] = 'npm:' + names.get(name) + '@' + version;
        } else {
          assert.ok(!range.startsWith('workspace:'), 'Unmapped dependency: ' + name);
        }
      }
    }
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(published, null, 2) + '\n');
    const [packed] = npm(
      ['pack', '--ignore-scripts', '--json', '--pack-destination', output],
      stage
    );
    const files = packed.files.map(({ path: name }) => name);
    for (const required of ['README.md', 'LICENSE'])
      assert.ok(files.includes(required), published.name + ' needs ' + required);
    assert.ok(
      files.some((name) => name.startsWith('dist/')),
      published.name + ' needs built output'
    );
    assert.ok(!files.some((name) => /(?:\.test\.|\.stories\.|node_modules\/)/.test(name)));
    if (folder === 'cli' || folder === 'mcp')
      assert.ok(files.includes('data/registry/registry.json'));
    if (folder === 'ui') {
      for (const name of ['zui.global.js', 'zui.css', 'LICENSE.txt'])
        assert.ok(files.includes('dist/browser/' + name));
    }
    entries.push({
      sourceName: manifest.name,
      name: published.name,
      version,
      filename: packed.filename,
      integrity: packed.integrity,
      shasum: packed.shasum,
      size: packed.size,
      files: files.length,
    });
    console.log(
      manifest.name + ' -> ' + published.name + '@' + version + ' (' + files.length + ' files)'
    );
  }
  fs.writeFileSync(
    path.join(output, 'github-packages.json'),
    JSON.stringify({ repository, version, packages: entries }, null, 2) + '\n'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
