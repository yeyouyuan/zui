import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(
  new URL('../src/pages/components/official-office-demo.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(code, {
  module,
  exports: module.exports,
  require,
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  Date,
  URLSearchParams,
  btoa,
});

const { createOfficialOfficeDemoConfig, ONLYOFFICE_OFFICIAL_DEMO_SERVER, usesOfficialOfficeDemo } =
  module.exports;
const secret = 'NsOb2yUBaI9yme0wbkGAapi';
const fromBase64Url = (value) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

test('GitHub Pages 自动启用官方 Demo，查询参数可以显式切换模式', () => {
  assert.equal(usesOfficialOfficeDemo({ hostname: 'yeyouyuan.github.io', search: '' }), true);
  assert.equal(
    usesOfficialOfficeDemo({ hostname: '127.0.0.1', search: '?office-demo=official' }),
    true
  );
  assert.equal(
    usesOfficialOfficeDemo({ hostname: 'yeyouyuan.github.io', search: '?office-demo=local' }),
    false
  );
  assert.equal(usesOfficialOfficeDemo({ hostname: 'docs.example.com', search: '' }), false);
});

test('官方在线 Demo 为三种格式生成可验证的样例配置', async () => {
  assert.equal(ONLYOFFICE_OFFICIAL_DEMO_SERVER, 'https://api.docs.onlyoffice.com/');
  const expected = {
    word: ['word', 'docx'],
    excel: ['cell', 'xlsx'],
    pdf: ['pdf', 'pdf'],
  };

  for (const [kind, [documentType, extension]] of Object.entries(expected)) {
    const config = await createOfficialOfficeDemoConfig(kind);
    assert.equal(config.documentType, documentType);
    assert.equal(config.document.fileType, extension);
    assert.equal(
      config.document.url,
      `https://static.onlyoffice.com/assets/docs/samples/demo.${extension}`
    );
    assert.equal(config.editorConfig.callbackUrl, '');
    assert.equal(config.editorConfig.lang, 'zh-CN');
    assert.equal(config.editorConfig.mode, 'edit');
    assert.equal(config.editorConfig.customization.autosave, false);

    const [header, payload, signature] = config.token.split('.');
    assert.deepEqual(JSON.parse(fromBase64Url(header)), { typ: 'JWT', alg: 'HS256' });
    const unsigned = structuredClone(config);
    delete unsigned.token;
    assert.deepEqual(JSON.parse(fromBase64Url(payload)), unsigned);
    assert.equal(
      signature,
      createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    );
  }
});
