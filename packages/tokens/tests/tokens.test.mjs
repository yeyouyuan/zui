import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';

const readSource = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const tokenDocument = JSON.parse(readSource('tokens.json'));
const semanticCss = readSource('semantic.css');
const darkCss = readSource('dark.css');
const typescriptSource = readSource('index.ts');

const declarationPattern = /(--z-[a-z0-9-]+)\s*:\s*([^;]+);/g;

function declarations(source) {
  return [...source.matchAll(declarationPattern)].map((match) => ({
    name: match[1],
    value: match[2].replace(/\/\*.*?\*\//g, '').trim(),
  }));
}

function tokenLeaves(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    return [{ path: path.join('.'), value: node.$value }];
  }
  return Object.entries(node ?? {})
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, value]) => tokenLeaves(value, [...path, key]));
}

function resolvePath(root, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], root);
}

test('DTCG semantic 令牌只引用存在的 primitive 令牌', () => {
  const leaves = tokenLeaves(tokenDocument.zui.semantic, ['zui', 'semantic']);
  assert.ok(leaves.length > 0);

  for (const leaf of leaves) {
    assert.equal(typeof leaf.value, 'string', `${leaf.path} 必须使用字符串别名`);
    const references = [...leaf.value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    assert.ok(references.length > 0, `${leaf.path} 不能写入原始值`);

    for (const reference of references) {
      assert.match(reference, /^zui\.primitives\./, `${leaf.path} 必须指向 primitive 层`);
      const target = resolvePath(tokenDocument, reference);
      assert.ok(target && '$value' in target, `${leaf.path} 引用了不存在的 ${reference}`);
    }

    const expression = leaf.value.replace(/\{[^}]+\}/g, '<alias>');
    assert.ok(
      expression === '<alias>' ||
        /^color-mix\(in oklch, <alias> \d+%, transparent\)$/.test(expression),
      `${leaf.path} 使用了不受支持的别名表达式：${leaf.value}`
    );
  }
});

test('semantic.css、DTCG color 与 TypeScript tokens.color 暴露同一组变量', () => {
  const cssNames = new Set(
    declarations(semanticCss)
      .map(({ name }) => name)
      .filter((name) => name.startsWith('--z-color-'))
  );
  const dtcgNames = new Set(
    Object.keys(tokenDocument.zui.semantic.color).map((name) => `--z-color-${name}`)
  );

  const colorStart = typescriptSource.indexOf('  color: {');
  const colorEnd = typescriptSource.indexOf('\n  radius: {', colorStart);
  assert.ok(colorStart >= 0 && colorEnd > colorStart, '找不到 tokens.color 定义');
  const typescriptNames = new Set(
    [...typescriptSource.slice(colorStart, colorEnd).matchAll(/var\((--z-color-[^)]+)\)/g)].map(
      (match) => match[1]
    )
  );

  assert.deepEqual([...dtcgNames].sort(), [...cssNames].sort());
  assert.deepEqual([...typescriptNames].sort(), [...cssNames].sort());
});

test('dark.css 仅覆盖全部语义颜色，并保持主动暗色与系统暗色映射一致', () => {
  const semanticNames = new Set(
    declarations(semanticCss)
      .map(({ name }) => name)
      .filter((name) => name.startsWith('--z-color-'))
  );
  const darkDeclarations = declarations(darkCss);
  const valuesByName = new Map();

  for (const declaration of darkDeclarations) {
    assert.match(declaration.name, /^--z-color-/, `暗色主题不应覆盖尺寸令牌 ${declaration.name}`);
    assert.ok(semanticNames.has(declaration.name), `暗色主题覆盖了未知变量 ${declaration.name}`);
    const values = valuesByName.get(declaration.name) ?? [];
    values.push(declaration.value);
    valuesByName.set(declaration.name, values);
  }

  assert.deepEqual([...valuesByName.keys()].sort(), [...semanticNames].sort());
  for (const [name, values] of valuesByName) {
    assert.equal(values.length, 2, `${name} 应同时存在主动暗色和系统暗色映射`);
    assert.equal(values[0], values[1], `${name} 的两套暗色映射必须一致`);
  }
});
