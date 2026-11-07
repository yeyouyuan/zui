import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/CodeBlock.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
const { highlightJsx, copyCodeText } = module.exports;

const plainText = (html) =>
  html
    .replace(/<\/?span\b[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

test('高亮保留含引号注释、跨行代码和 NUL 的原文', () => {
  const code =
    "// don't change this\nconst value = 'hello';\n/* `quote */\n<Modal.Content>\u00000\u0000</Modal.Content>";
  assert.equal(plainText(highlightJsx(code)), code);
  assert.ok(highlightJsx(code).includes('<span class="tok-cmt">// don\'t change this</span>'));
});

test('类似 HTML 与注入标签的代码只以转义文本展示', () => {
  const code =
    '<img src="x" onerror="alert(1)" />\nconst example = "</code><script>alert(1)</script> &";';
  const html = highlightJsx(code);
  assert.equal(plainText(html), code);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
});

function mockCopyEnvironment({ writeText, execCommand }) {
  let removed = false;
  let focused = false;
  const textarea = {
    style: {},
    setAttribute() {},
    select() {},
    remove() {
      removed = true;
    },
  };
  class MockElement {
    focus() {
      focused = true;
    }
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: writeText ? { clipboard: { writeText } } : {},
  });
  globalThis.HTMLElement = MockElement;
  globalThis.document = {
    activeElement: new MockElement(),
    createElement: () => textarea,
    body: { appendChild() {} },
    execCommand,
  };
  return { textarea, wasRemoved: () => removed, wasFocused: () => focused };
}

test('clipboard 权限被拒绝后仍尝试兼容复制', async () => {
  const mock = mockCopyEnvironment({
    writeText: async () => {
      throw new Error('Permission denied');
    },
    execCommand: () => true,
  });
  assert.equal(await copyCodeText('hello'), true);
  assert.equal(mock.textarea.value, 'hello');
  assert.equal(mock.wasRemoved(), true);
  assert.equal(mock.wasFocused(), true);
});

test('兼容复制返回 false 或抛错时不误报成功，仍清理临时节点', async () => {
  for (const execCommand of [
    () => false,
    () => {
      throw new Error('Not supported');
    },
  ]) {
    const mock = mockCopyEnvironment({ execCommand });
    assert.equal(await copyCodeText('hello'), false);
    assert.equal(mock.wasRemoved(), true);
    assert.equal(mock.wasFocused(), true);
  }
});
