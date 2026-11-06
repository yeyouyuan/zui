/** 构建 CLI/MCP 的独立离线数据包，发布后无需原仓库目录。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './generate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const name = process.argv[2];
if (!['cli', 'mcp'].includes(name)) throw new Error('用法：node registry/scripts/bundle.mjs cli|mcp');
const destination = path.join(root, 'packages', name, 'data');
const registry = generate();
const files = new Set([
  ...registry.sharedFiles,
  ...registry.items.flatMap((item) => [...item.files, item.meta]),
  'CONTRACTS-V3.md', 'docs/public/llms.txt',
]);
fs.rmSync(destination, { recursive: true, force: true });
for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) continue;
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
fs.mkdirSync(path.join(destination, 'registry'), { recursive: true });
fs.writeFileSync(path.join(destination, 'registry/registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
