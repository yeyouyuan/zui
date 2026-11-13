import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { loadCatalog, resolveRepoRoot } from '../dist/tools/search.js';
import { formatAttribute, generateCode } from '../dist/tools/generate.js';
import { handleLine, SERVER_VERSION } from '../dist/index.js';

const catalog = loadCatalog();
test('catalog resolves every shipped component from bundled data', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../data/registry/registry.json', import.meta.url), 'utf8')
  );
  assert.equal(
    catalog.size,
    registry.items.filter((item) => item.type === 'registry:component').length
  );
  assert.ok(catalog.has('officeeditor'));
  assert.ok(catalog.has('officestudio'));
  assert.equal(resolveRepoRoot(), fileURLToPath(new URL('../data', import.meta.url)));
});
test('server reports the published package version', () => {
  assert.equal(SERVER_VERSION, '0.4.0');
  const initialized = JSON.parse(
    handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }))
  );
  assert.equal(initialized.result.serverInfo.version, SERVER_VERSION);
});
test('explicit false survives JSX generation', () => {
  assert.equal(formatAttribute('preview', false), ' preview={false}');
  assert.equal(formatAttribute('size', 0), ' size={0}');
});
test('all components have generated examples with real imports and required props', () => {
  for (const entry of catalog.values()) {
    const result = generateCode(catalog, entry.name);
    assert.equal(result.ok, true);
    assert.match(result.code, /import/);
  }
  assert.match(generateCode(catalog, 'Select').code, /options=/);
  assert.match(generateCode(catalog, 'Combobox').code, /options=/);
  assert.match(generateCode(catalog, 'VirtualTable').code, /height=/);
  assert.match(generateCode(catalog, 'Progress').code, /aria-label="Task progress"/);
  assert.match(generateCode(catalog, 'Message').code, /useMessage/);
  assert.doesNotMatch(generateCode(catalog, 'Notification').code, /import \{ Notification \}/);
});
test('Office examples accept backend configuration and expose standalone document creation', () => {
  const editor = generateCode(catalog, 'OfficeEditor');
  assert.equal(editor.ok, true);
  assert.match(editor.code, /type OfficeEditorConfig/);
  assert.match(editor.code, /documentServerUrl=\{documentServerUrl\}/);
  assert.match(editor.code, /config=\{config\}/);
  assert.match(editor.code, /documentServerUrl: string; config: OfficeEditorConfig/);
  assert.doesNotMatch(editor.code, /https?:\/\//);
  const studio = generateCode(catalog, 'OfficeStudio');
  assert.equal(studio.ok, true);
  assert.match(studio.code, /createOfficeStudioDocument\('word'\)/);
  assert.match(studio.code, /onSave, onImport and onExport/);
  assert.doesNotMatch(studio.code, /documentServerUrl/);
});
test('RPC gives useful failures and recognizes all three tools', () => {
  const call = (name, args) =>
    JSON.parse(
      handleLine(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        })
      )
    );
  assert.equal(JSON.parse(handleLine('{')).error.code, -32700);
  assert.equal(call('zui_get_component_api', { name: 'unknown' }).result.isError, true);
  assert.equal(
    call('zui_search_components', { query: 'button' }).result.structuredContent.results[0].name,
    'Button'
  );
  assert.match(
    call('zui_generate_code', { component: 'Image', props: { preview: false } }).result
      .structuredContent.code,
    /preview=\{false\}/
  );
});
test('stdio server handles split input and exits after EOF', async () => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../dist/index.js', import.meta.url))],
    { cwd: '/tmp' }
  );
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  const done = new Promise((resolve, reject) => {
    child.on('exit', resolve);
    child.on('error', reject);
  });
  child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"initial');
  child.stdin.end('ize"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
  assert.equal(await done, 0);
  const lines = output.trim().split('\n').map(JSON.parse);
  assert.equal(lines[0].result.serverInfo.name, '@zui/mcp');
  assert.equal(lines[1].result.tools.length, 3);
});
