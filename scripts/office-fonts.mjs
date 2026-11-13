import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { inflateSync } from 'node:zlib';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checksumMagic = 0xb1b0afba;
const fontFiles = [
  { weight: 400, file: 'NotoSansSC-Regular.ttf' },
  { weight: 700, file: 'NotoSansSC-Bold.ttf' },
];

function checksum(bytes, head = false) {
  const padded = Buffer.alloc((bytes.length + 3) & ~3);
  bytes.copy(padded);
  if (head) padded.writeUInt32BE(0, 8);
  let value = 0;
  for (let offset = 0; offset < padded.length; offset += 4)
    value = (value + padded.readUInt32BE(offset)) >>> 0;
  return value;
}

/** Restore the original sfnt tables without changing names, metrics or glyphs. */
export function trueTypeFromWoff(woff) {
  const input = Buffer.from(woff);
  if (
    input.length < 44 ||
    input.readUInt32BE(0) !== 0x774f4646 ||
    input.readUInt32BE(4) !== 0x00010000
  )
    throw new Error('Office 中文字体必须是包含 TrueType 字形的 WOFF 文件。');
  const count = input.readUInt16BE(12);
  const size = input.readUInt32BE(16);
  if (
    !count ||
    input.readUInt16BE(14) !== 0 ||
    input.readUInt32BE(8) !== input.length ||
    44 + count * 20 > input.length ||
    size < 12 + count * 16 ||
    size % 4 !== 0
  )
    throw new Error('Office 中文字体的 WOFF 文件头无效。');
  const font = Buffer.alloc(size);
  font.writeUInt32BE(input.readUInt32BE(4), 0);
  font.writeUInt16BE(count, 4);
  const power = 2 ** Math.floor(Math.log2(count));
  font.writeUInt16BE(power * 16, 6);
  font.writeUInt16BE(Math.log2(power), 8);
  font.writeUInt16BE(count * 16 - power * 16, 10);
  const tags = new Set();
  let offset = 12 + count * 16;
  let head = -1;
  for (let index = 0; index < count; index++) {
    const from = 44 + index * 20;
    const record = 12 + index * 16;
    const tag = input.toString('ascii', from, from + 4);
    const length = input.readUInt32BE(from + 12);
    const compressedLength = input.readUInt32BE(from + 8);
    const start = input.readUInt32BE(from + 4);
    const paddedLength = Math.ceil(length / 4) * 4;
    if (
      tags.has(tag) ||
      start < 44 + count * 20 ||
      start % 4 !== 0 ||
      compressedLength > length ||
      start + compressedLength > input.length ||
      offset + paddedLength > font.length
    )
      throw new Error('Office 中文字体的 WOFF 表范围无效。');
    tags.add(tag);
    const compressed = input.subarray(start, start + compressedLength);
    let bytes;
    try {
      bytes =
        compressedLength < length
          ? inflateSync(compressed, { maxOutputLength: length })
          : compressed;
    } catch {
      throw new Error('Office 中文字体的 WOFF 表无法解压。');
    }
    if (bytes.length !== length || (tag === 'head' && length < 54))
      throw new Error('Office 中文字体的表长度无效。');
    if (checksum(bytes, tag === 'head') !== input.readUInt32BE(from + 16))
      throw new Error('Office 中文字体的表校验和无效。');
    input.copy(font, record, from, from + 4);
    font.writeUInt32BE(input.readUInt32BE(from + 16), record + 4);
    font.writeUInt32BE(offset, record + 8);
    font.writeUInt32BE(length, record + 12);
    bytes.copy(font, offset);
    if (tag === 'head') head = offset;
    offset += paddedLength;
  }
  if (head < 0 || offset !== font.length || !tags.has('glyf') || !tags.has('loca'))
    throw new Error('Office 中文字体结构无效。');
  font.writeUInt32BE(0, head + 8);
  font.writeUInt32BE((checksumMagic - checksum(font)) >>> 0, head + 8);
  return font;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function installedFontRoot() {
  const require = createRequire(new URL('../docs/package.json', import.meta.url));
  try {
    return dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
  } catch {
    throw new Error('找不到项目中文字体，请先运行 pnpm install。');
  }
}

function writeIfChanged(filename, bytes) {
  if (existsSync(filename) && readFileSync(filename).equals(bytes)) return false;
  const temporary = `${filename}.tmp-${process.pid}`;
  writeFileSync(temporary, bytes, { mode: 0o644 });
  renameSync(temporary, filename);
  return true;
}

/** Prepare reproducible local fonts; the runtime mounts only this directory. */
export function prepareOfficeFonts(options = {}) {
  const fontRoot = options.fontRoot ?? installedFontRoot();
  const directory = options.outputDirectory ?? join(projectRoot, 'deploy/office/fonts.local');
  const fontPackage = JSON.parse(readFileSync(join(fontRoot, 'package.json'), 'utf8'));
  const license = readFileSync(join(fontRoot, 'LICENSE'));
  if (fontPackage.license !== 'OFL-1.1' || !license.includes('SIL OPEN FONT LICENSE Version 1.1'))
    throw new Error('项目中文字体必须附带完整的 SIL Open Font License 1.1。');
  const outputs = fontFiles.map(({ weight, file }) => {
    const sourceFile = `noto-sans-sc-chinese-simplified-${weight}-normal.woff`;
    const woff = readFileSync(join(fontRoot, 'files', sourceFile));
    const bytes = trueTypeFromWoff(woff);
    return { file, weight, sourceFile, sourceSha256: sha256(woff), sha256: sha256(bytes), bytes };
  });
  const manifest = {
    schema: 1,
    package: { name: fontPackage.name, version: fontPackage.version },
    license: { file: 'NotoSansSC-OFL.txt', sha256: sha256(license) },
    fonts: outputs.map(({ bytes, ...font }) => ({ ...font, size: bytes.length })),
  };
  mkdirSync(directory, { recursive: true });
  let changed = false;
  for (const { file, bytes } of outputs)
    changed = writeIfChanged(join(directory, file), bytes) || changed;
  changed = writeIfChanged(join(directory, manifest.license.file), license) || changed;
  changed =
    writeIfChanged(
      join(directory, 'manifest.json'),
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
    ) || changed;
  return { directory, changed, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = prepareOfficeFonts();
    console.log(`中文字体${result.changed ? '已生成' : '已校验'}：${result.directory}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
