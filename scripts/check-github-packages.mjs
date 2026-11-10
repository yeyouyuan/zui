import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: { local: { type: 'boolean', default: false }, dir: { type: 'string' } },
});
const directory = path.resolve(root, values.dir || '.release/github-packages');
const release = JSON.parse(fs.readFileSync(path.join(directory, 'github-packages.json'), 'utf8'));
const owner = release.repository.split('/')[0].toLowerCase();
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'zui-github-consumer-'));
let server;
try {
  let registry = 'https://npm.pkg.github.com/';
  if (values.local) {
    const packages = new Map(
      release.packages.map((entry) => {
        const tarball = path.resolve(directory, entry.filename);
        assert.equal(path.dirname(tarball), directory);
        const manifest = JSON.parse(
          execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' })
        );
        return [entry.name, { ...entry, manifest, tarball }];
      })
    );
    server = http.createServer((request, response) => {
      const requested = decodeURIComponent(request.url.split('?')[0]).slice(1);
      if (requested.startsWith('tarballs/')) {
        const entry = [...packages.values()].find(
          ({ filename }) => requested === 'tarballs/' + filename
        );
        if (entry) {
          response.setHeader('content-type', 'application/octet-stream');
          response.end(fs.readFileSync(entry.tarball));
          return;
        }
      }
      const entry = packages.get(requested);
      if (entry) {
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            name: entry.name,
            'dist-tags': { latest: entry.version },
            versions: {
              [entry.version]: {
                ...entry.manifest,
                dist: {
                  tarball: registry + 'tarballs/' + entry.filename,
                  integrity: entry.integrity,
                  shasum: entry.shasum,
                },
              },
            },
          })
        );
        return;
      }
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'Package not found' }));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    registry = 'http://127.0.0.1:' + server.address().port + '/';
  }
  const dependencies = Object.fromEntries(
    release.packages.map((entry) => [entry.sourceName, 'npm:' + entry.name + '@' + entry.version])
  );
  Object.assign(dependencies, {
    react: '19.0.0',
    'react-dom': '19.0.0',
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
  });
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies })
  );
  let npmrc = 'registry=https://registry.npmjs.org/\n@' + owner + ':registry=' + registry + '\n';
  if (!values.local) npmrc += '//npm.pkg.github.com/:_authToken=' + '$' + '{NODE_AUTH_TOKEN}\n';
  fs.writeFileSync(path.join(cwd, '.npmrc'), npmrc);
  await new Promise((resolve, reject) => {
    const child = spawn(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
      {
        cwd,
        env: { ...process.env, npm_config_cache: path.join(cwd, '.cache') },
        stdio: 'inherit',
      }
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Consumer install exited ' + code))
    );
  });
  const installed = [];
  for (const entry of release.packages) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(cwd, 'node_modules', entry.sourceName, 'package.json'), 'utf8')
    );
    assert.equal(manifest.name, entry.name);
    assert.equal(manifest.version, entry.version);
    if (!values.local) {
      const integrity = JSON.parse(
        execFileSync(
          'npm',
          ['view', entry.name + '@' + entry.version, 'dist.integrity', '--json'],
          {
            cwd,
            encoding: 'utf8',
            env: { ...process.env, npm_config_cache: path.join(cwd, '.cache') },
          }
        )
      );
      assert.equal(
        integrity,
        entry.integrity,
        entry.name + ' registry integrity differs from release tarball'
      );
    }
    installed.push({
      sourceName: entry.sourceName,
      name: manifest.name,
      version: manifest.version,
    });
  }
  fs.writeFileSync(
    path.join(cwd, 'check.mjs'),
    [
      "import assert from 'node:assert/strict';",
      "import { createRequire } from 'node:module';",
      "import React from 'react';",
      "import { renderToStaticMarkup } from 'react-dom/server';",
      "import { Button } from '@zui/react';",
      'const require = createRequire(import.meta.url);',
      "for (const name of ['tokens', 'icons', 'i18n', 'react', 'blocks']) assert.ok(Object.keys(await import('@zui/' + name)).length);",
      "assert.equal(typeof require('@zui/react').Button, 'function');",
      "assert.match(renderToStaticMarkup(React.createElement(Button, null, 'Installed ZUI')), /Installed ZUI/);",
      "require.resolve('@zui/react/styles.css');",
      "require.resolve('@zui/tokens/css');",
      "console.log('Installed ESM, CommonJS, React 19 SSR, CSS and dependency aliases passed');",
    ].join('\n')
  );
  execFileSync(process.execPath, ['check.mjs'], { cwd, stdio: 'inherit' });
  const cli = execFileSync(
    process.execPath,
    [path.join(cwd, 'node_modules/@zui/cli/dist/index.js'), 'list'],
    { cwd, encoding: 'utf8' }
  );
  for (const name of ['button', 'splitter', 'kanban'])
    assert.ok(cli.includes(name), 'Installed CLI finds ' + name);
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ];
  const mcp = execFileSync(
    process.execPath,
    [path.join(cwd, 'node_modules/@zui/mcp/dist/index.js')],
    {
      cwd,
      encoding: 'utf8',
      input: requests.map((request) => JSON.stringify(request)).join('\n') + '\n',
    }
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(mcp[0].result.serverInfo.version, release.version);
  assert.equal(mcp[1].result.tools.length, 3);
  fs.writeFileSync(
    path.join(cwd, 'consumer.tsx'),
    [
      "import { Button } from '@zui/react';",
      "import { DashboardBlock } from '@zui/blocks';",
      "import { tokens } from '@zui/tokens';",
      "import { Search } from '@zui/icons';",
      "import { useAutoTranslate } from '@zui/i18n';",
      "export const example = <><Button variant='primary'>发布检查</Button><DashboardBlock /><Search /></>;",
      'export const api = { tokens, useAutoTranslate };',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(cwd, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
      },
      include: ['consumer.tsx'],
    })
  );
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(cwd, 'tsconfig.json')],
    { stdio: 'inherit' }
  );
  fs.writeFileSync(
    path.join(directory, values.local ? 'consumer-local.json' : 'consumer-registry.json'),
    JSON.stringify(
      {
        version: release.version,
        registry: values.local ? 'local tarballs through npm aliases' : registry,
        packages: installed,
        checks: [
          'ESM',
          'CommonJS',
          'React 19 SSR',
          'CSS exports',
          'CLI registry',
          'MCP stdio',
          'strict TypeScript declarations',
        ],
      },
      null,
      2
    ) + '\n'
  );
  console.log(
    'GitHub Packages consumer passed: ' + installed.length + ' packages at ' + release.version
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(cwd, { recursive: true, force: true });
}
