import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { URL } from 'node:url';
import { prepareOfficeFonts, trueTypeFromWoff } from '../../scripts/office-fonts.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const fontkit = require('@pdf-lib/fontkit');
const fontRoot = dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
const sourceFile = (weight) => `noto-sans-sc-chinese-simplified-${weight}-normal.woff`;
const sourceFont = (weight) => readFileSync(join(fontRoot, 'files', sourceFile(weight)));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'zui-office-fonts-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

// Sum independently from the converter, with the sfnt's prescribed 32-bit wrap.
function sfntChecksum(bytes) {
  assert.equal(bytes.length % 4, 0);
  let total = 0n;
  for (let index = 0; index < bytes.length; index += 4) total += BigInt(bytes.readUInt32BE(index));
  return Number(total & 0xffffffffn);
}

for (const weight of [400, 700]) {
  test(`Noto Sans SC ${weight} 保留真实 family、字重、版权与全部中文字形`, () => {
    const woff = sourceFont(weight);
    const originalHash = sha256(woff);
    const original = fontkit.create(woff);
    const convertedBytes = trueTypeFromWoff(woff);
    const converted = fontkit.create(convertedBytes);
    assert.equal(convertedBytes.readUInt32BE(0), 0x00010000);
    assert.equal(sfntChecksum(convertedBytes), 0xb1b0afba);
    assert.equal(sha256(woff), originalHash, 'conversion leaves the source unchanged');
    assert.equal(converted.familyName, 'Noto Sans SC Thin');
    assert.equal(converted.subfamilyName, weight === 400 ? 'Regular' : 'Bold');
    assert.equal(converted['OS/2'].usWeightClass, weight);
    assert.deepEqual(converted.name.records, original.name.records);
    assert.equal(converted.numGlyphs, original.numGlyphs);
    assert.ok(converted.numGlyphs > 8000);
    assert.deepEqual(converted.characterSet, original.characterSet);
    for (const character of '中文在线编辑预览项目文件保存粗体测试') {
      const codepoint = character.codePointAt(0);
      assert.equal(converted.hasGlyphForCodePoint(codepoint), true, character);
      assert.equal(
        converted.glyphForCodePoint(codepoint).path.toSVG(),
        original.glyphForCodePoint(codepoint).path.toSVG(),
        character
      );
    }
  });
}

test('无效、截断和校验和损坏的 WOFF 不生成 TrueType', () => {
  const good = sourceFont(400);
  const invalid = [];
  invalid.push(good.subarray(0, 43));
  const woff2 = Buffer.from(good);
  woff2.writeUInt32BE(0x774f4632, 0);
  invalid.push(woff2);
  const cff = Buffer.from(good);
  cff.writeUInt32BE(0x4f54544f, 4);
  invalid.push(cff);
  const noTables = Buffer.from(good);
  noTables.writeUInt16BE(0, 12);
  invalid.push(noTables);
  const outside = Buffer.from(good);
  outside.writeUInt32BE(good.length + 4, 44 + 4);
  invalid.push(outside);
  const badChecksum = Buffer.from(good);
  badChecksum.writeUInt32BE((badChecksum.readUInt32BE(44 + 16) + 1) >>> 0, 44 + 16);
  invalid.push(badChecksum);
  for (const bytes of invalid) assert.throws(() => trueTypeFromWoff(bytes), /Office 中文字体/);
});

test('运行时生成两种 TrueType、原始 OFL 和可核验来源的 SHA-256 清单', (t) => {
  const directory = join(temporary(t), 'fonts.local');
  const result = prepareOfficeFonts({ outputDirectory: directory });
  assert.equal(result.changed, true);
  assert.equal(result.manifest.fonts.length, 2);
  assert.deepEqual(
    result.manifest.fonts.map((font) => font.weight),
    [400, 700]
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')),
    result.manifest
  );
  const license = readFileSync(join(fontRoot, 'LICENSE'));
  assert.equal(readFileSync(join(directory, 'NotoSansSC-OFL.txt')).equals(license), true);
  assert.equal(result.manifest.license.sha256, sha256(license));
  assert.match(license.toString(), /SIL OPEN FONT LICENSE Version 1\.1/);
  for (const font of result.manifest.fonts) {
    const generated = readFileSync(join(directory, font.file));
    assert.equal(font.sha256, sha256(generated));
    assert.equal(font.sourceSha256, sha256(sourceFont(font.weight)));
    assert.equal(font.size, generated.length);
    assert.equal(sfntChecksum(generated), 0xb1b0afba);
    assert.equal(fontkit.create(generated)['OS/2'].usWeightClass, font.weight);
  }
});

test('重复启动复用相同字体；损坏的本地字体、许可证和清单会恢复', (t) => {
  const directory = join(temporary(t), 'fonts.local');
  const first = prepareOfficeFonts({ outputDirectory: directory });
  const names = [
    'NotoSansSC-Regular.ttf',
    'NotoSansSC-Bold.ttf',
    'NotoSansSC-OFL.txt',
    'manifest.json',
  ];
  const initial = names.map((file) => statSync(join(directory, file)).mtimeMs);
  assert.equal(prepareOfficeFonts({ outputDirectory: directory }).changed, false);
  assert.deepEqual(
    names.map((file) => statSync(join(directory, file)).mtimeMs),
    initial
  );
  for (const file of ['NotoSansSC-Regular.ttf', 'NotoSansSC-OFL.txt', 'manifest.json'])
    writeFileSync(join(directory, file), 'damaged cached file');
  const repaired = prepareOfficeFonts({ outputDirectory: directory });
  assert.equal(repaired.changed, true);
  assert.deepEqual(repaired.manifest, first.manifest);
  assert.equal(
    sha256(readFileSync(join(directory, 'NotoSansSC-Regular.ttf'))),
    first.manifest.fonts[0].sha256
  );
  assert.equal(
    sha256(readFileSync(join(directory, 'NotoSansSC-OFL.txt'))),
    first.manifest.license.sha256
  );
  assert.deepEqual(
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')),
    first.manifest
  );
});

test('许可证缺失或不匹配时拒绝生成，也不覆盖现有文件', (t) => {
  const root = temporary(t);
  const directory = join(root, 'fonts.local');
  const customRoot = join(root, 'source');
  mkdirSync(customRoot);
  mkdirSync(directory);
  writeFileSync(join(directory, 'NotoSansSC-Regular.ttf'), 'existing font');
  writeFileSync(
    join(customRoot, 'package.json'),
    JSON.stringify({ name: '@fontsource/noto-sans-sc', version: 'test', license: 'MIT' })
  );
  copyFileSync(join(fontRoot, 'LICENSE'), join(customRoot, 'LICENSE'));
  assert.throws(
    () => prepareOfficeFonts({ fontRoot: customRoot, outputDirectory: directory }),
    /SIL Open Font License/
  );
  writeFileSync(
    join(customRoot, 'package.json'),
    JSON.stringify({ name: '@fontsource/noto-sans-sc', version: 'test', license: 'OFL-1.1' })
  );
  writeFileSync(join(customRoot, 'LICENSE'), 'missing license');
  assert.throws(
    () => prepareOfficeFonts({ fontRoot: customRoot, outputDirectory: directory }),
    /SIL Open Font License/
  );
  assert.equal(readFileSync(join(directory, 'NotoSansSC-Regular.ttf'), 'utf8'), 'existing font');
  assert.equal(existsSync(join(directory, 'manifest.json')), false);
});

test('源字体损坏时不写入部分运行时字体', (t) => {
  const root = temporary(t);
  const customRoot = join(root, 'source');
  const directory = join(root, 'fonts.local');
  mkdirSync(join(customRoot, 'files'), { recursive: true });
  copyFileSync(join(fontRoot, 'package.json'), join(customRoot, 'package.json'));
  copyFileSync(join(fontRoot, 'LICENSE'), join(customRoot, 'LICENSE'));
  copyFileSync(
    join(fontRoot, 'files', sourceFile(400)),
    join(customRoot, 'files', sourceFile(400))
  );
  writeFileSync(join(customRoot, 'files', sourceFile(700)), 'invalid bold font');
  assert.throws(
    () => prepareOfficeFonts({ fontRoot: customRoot, outputDirectory: directory }),
    /Office 中文字体/
  );
  assert.equal(existsSync(directory), false);
});
