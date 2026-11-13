import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

const directory = fileURLToPath(new URL('../packages/ui/dist/', import.meta.url));
const entry = path.join(directory, 'index.js');
// Includes the Office public API and document models. The editor implementations
// remain asynchronous and are reported separately rather than hidden in this limit.
const initialBudget = 112 * 1024;
const modules = new Map();

function readModule(file) {
  if (modules.has(file)) return modules.get(file);
  const bytes = fs.readFileSync(file);
  const source = ts.createSourceFile(
    file,
    bytes.toString('utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const module = {
    bytes: bytes.length,
    gzip: gzipSync(bytes).length,
    static: new Set(),
    dynamic: new Set(),
  };
  modules.set(file, module);
  const add = (target, kind) => {
    if (!target.startsWith('.')) return;
    const resolved = path.resolve(path.dirname(file), target);
    assert.ok(resolved.startsWith(directory), `Bundle import escapes dist: ${target}`);
    assert.ok(fs.existsSync(resolved), `Bundle is missing imported module: ${target}`);
    module[kind].add(resolved);
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, 'static');
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, 'dynamic');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return module;
}

function staticClosure(root) {
  const found = new Set();
  const queue = [root];
  while (queue.length) {
    const file = queue.pop();
    if (found.has(file)) continue;
    found.add(file);
    queue.push(...readModule(file).static);
  }
  return found;
}

function sizeOf(files) {
  return [...files].reduce(
    (size, file) => {
      const module = readModule(file);
      return { bytes: size.bytes + module.bytes, gzip: size.gzip + module.gzip };
    },
    { bytes: 0, gzip: 0 }
  );
}

const initial = staticClosure(entry);
const size = sizeOf(initial);
console.log(
  `React ESM entry: ${initial.size} static modules, ${size.bytes} bytes, ${size.gzip} gzip bytes (budget < ${initialBudget})`
);
const asynchronous = new Set();
const queue = [...initial];
const visited = new Set();
while (queue.length) {
  const file = queue.pop();
  if (visited.has(file)) continue;
  visited.add(file);
  for (const target of readModule(file).dynamic) {
    const group = staticClosure(target);
    queue.push(...group);
    if (asynchronous.has(target)) continue;
    asynchronous.add(target);
    const additional = new Set([...group].filter((part) => !initial.has(part)));
    const lazySize = sizeOf(additional);
    console.log(
      `Async ${path.basename(target)}: ${additional.size} additional modules, ${lazySize.bytes} bytes, ${lazySize.gzip} gzip bytes`
    );
  }
}
assert.ok(
  size.gzip < initialBudget,
  `React ESM entry exceeds the ${initialBudget}-byte gzip budget: ${size.gzip}`
);
