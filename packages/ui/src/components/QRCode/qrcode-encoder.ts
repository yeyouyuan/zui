/**
 * QR 编码器（自研最小实现）—— Model 2，版本 1-10，纠错 L/M/Q/H。
 *
 * 支持模式：数字（Numeric）/ 字母数字（Alphanumeric）/ 字节（UTF-8，Byte）。
 * 流程：模式编码 → 纠错分块（Reed-Solomon GF(256)）→ 交错 → 矩阵布置
 * （定位/校正/时序图形 → 格式/版本信息 → 之字形布码 → 掩码选择）。
 * 纯 TS 无依赖，仅供 QRCode 组件内部与测试使用。
 */

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QRMode = 'numeric' | 'alphanumeric' | 'byte';

/** 版本某纠错级别的块结构 */
export interface QREccBlocks {
  numBlocks: number;
  ecPerBlock: number;
}

export interface QREncodeResult {
  /** 矩阵边长（模块数） */
  size: number;
  /** 模块矩阵，true = 深色 */
  modules: boolean[][];
  version: number;
  ecl: ErrorCorrectionLevel;
  mode: QRMode;
  /** 实际使用的掩码图案编号 0-7 */
  mask: number;
}

/* ---------------------------------- 表格 ---------------------------------- */

/** 每版本 1-10 各纠错级别的块结构 [numBlocks, ecPerBlock]（从标准表折算） */
const EC_BLOCKS: Record<ErrorCorrectionLevel, Array<[number, number]>> = {
  //              v1        v2        v3        v4        v5        v6        v7        v8        v9       v10
  L: [[1, 7], [1, 10], [1, 15], [1, 20], [1, 26], [2, 18], [2, 20], [2, 24], [2, 30], [4, 18]],
  M: [[1, 10], [1, 16], [1, 26], [2, 18], [2, 24], [4, 16], [4, 18], [4, 22], [5, 22], [5, 26]],
  Q: [[1, 13], [1, 22], [2, 18], [2, 26], [4, 18], [4, 24], [6, 18], [6, 22], [8, 20], [8, 24]],
  H: [[1, 17], [1, 28], [2, 22], [4, 16], [4, 22], [4, 28], [5, 26], [6, 26], [8, 24], [8, 28]],
};

export const MIN_VERSION = 1;
export const MAX_VERSION = 10;

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const MODE_BITS: Record<QRMode, number> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
};

/* --------------------------------- 容量 ---------------------------------- */

/** 版本原始数据模块数（用于推导总码字数） */
export function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** 版本总码字数 */
export function getNumTotalCodewords(version: number): number {
  return Math.floor(getNumRawDataModules(version) / 8);
}

/** 版本某纠错级别的块结构（块数 / 每块纠错码字数） */
export function getEccBlocks(version: number, ecl: ErrorCorrectionLevel): QREccBlocks {
  const [numBlocks, ecPerBlock] = EC_BLOCKS[ecl][version - 1];
  return { numBlocks, ecPerBlock };
}

/** 版本数据码字数（总码字 - 纠错码字） */
export function getNumDataCodewords(version: number, ecl: ErrorCorrectionLevel): number {
  const [numBlocks, ecPerBlock] = EC_BLOCKS[ecl][version - 1];
  return getNumTotalCodewords(version) - numBlocks * ecPerBlock;
}

/** 字段计数位宽：数字 10/12/14，字母数字 9/11/13，字节 8/16/16（按版本段） */
function getCharCountBits(mode: QRMode, version: number): number {
  const table = {
    numeric: [10, 12, 14],
    alphanumeric: [9, 11, 13],
    byte: [8, 16, 16],
  } as const;
  const index = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return table[mode][index];
}

/* -------------------------------- 模式判定 -------------------------------- */

export function detectMode(value: string): QRMode {
  if (/^[0-9]+$/.test(value)) return 'numeric';
  for (const char of value) {
    if (ALPHANUMERIC_CHARSET.indexOf(char) < 0) return 'byte';
  }
  return 'alphanumeric';
}

/* -------------------------------- 位缓冲 --------------------------------- */

class BitBuffer {
  private bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < this.bits.length; j += 1) {
        byte = (byte << 1) | this.bits[i + j];
      }
      // 不足一字节的尾部左对齐补 0（与终止符规则一致）
      byte <<= 8 - Math.min(8, this.bits.length - i);
      bytes.push(byte & 0xff);
    }
    return bytes;
  }
}

/* --------------------------------- 纠错 ---------------------------------- */

/** GF(256) 乘法（本原多项式 0x11D） */
export function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = ((z << 1) ^ ((z >> 7) * 0x11d)) & 0xff;
    z ^= ((y >> i) & 1) * x;
  }
  return z & 0xff;
}

/** Reed-Solomon 生成多项式（degree = 纠错码字数） */
export function rsComputeDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

/** Reed-Solomon 余式（追加到数据块后即为合法码字） */
export function rsComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

/* ------------------------------ 数据码字组装 ------------------------------ */

function encodeSegmentBits(buffer: BitBuffer, value: string, mode: QRMode): void {
  if (mode === 'numeric') {
    for (let i = 0; i < value.length; i += 3) {
      const chunk = value.slice(i, i + 3);
      const width = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
      buffer.push(parseInt(chunk, 10), width);
    }
    return;
  }
  if (mode === 'alphanumeric') {
    for (let i = 0; i < value.length; i += 2) {
      const a = ALPHANUMERIC_CHARSET.indexOf(value[i]);
      const b = i + 1 < value.length ? ALPHANUMERIC_CHARSET.indexOf(value[i + 1]) : -1;
      if (b >= 0) buffer.push(a * 45 + b, 11);
      else buffer.push(a, 6);
    }
    return;
  }
  // byte：UTF-8 逐字节
  const bytes = utf8Bytes(value);
  for (const byte of bytes) buffer.push(byte, 8);
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/** 组装数据码字：模式头 + 计数 + 数据 + 终止符 + 填充 0xEC/0x11 */
export function buildDataCodewords(value: string, mode: QRMode, version: number, ecl: ErrorCorrectionLevel): number[] {
  const capacity = getNumDataCodewords(version, ecl) * 8;
  const buffer = new BitBuffer();
  buffer.push(MODE_BITS[mode], 4);
  // 字节模式的计数是 UTF-8 字节数（非 UTF-16 code unit）
  buffer.push(mode === 'byte' ? utf8Bytes(value).length : value.length, getCharCountBits(mode, version));
  encodeSegmentBits(buffer, value, mode);
  // 终止符（最多 4 个 0）
  buffer.push(0, Math.min(4, capacity - buffer.length));
  // 字节对齐
  buffer.push(0, (8 - (buffer.length % 8)) % 8);
  // 填充码字 0xEC / 0x11 交替
  const bytes = buffer.toBytes();
  const target = getNumDataCodewords(version, ecl);
  for (let i = 0; bytes.length < target; i += 1) {
    bytes.push(i % 2 === 0 ? 0xec : 0x11);
  }
  return bytes;
}

/** 选最小可容纳版本 */
export function pickVersion(value: string, mode: QRMode, ecl: ErrorCorrectionLevel): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version += 1) {
    const neededBits =
      4 + getCharCountBits(mode, version) + payloadBits(value, mode);
    if (neededBits <= getNumDataCodewords(version, ecl) * 8) return version;
  }
  throw new Error(`QRCode: 内容过长（超出版本 ${MAX_VERSION} 容量）`);
}

function payloadBits(value: string, mode: QRMode): number {
  if (mode === 'numeric') {
    const full = Math.floor(value.length / 3) * 10;
    const rest = value.length % 3;
    return full + (rest === 2 ? 7 : rest === 1 ? 4 : 0);
  }
  if (mode === 'alphanumeric') {
    return Math.floor(value.length / 2) * 11 + (value.length % 2) * 6;
  }
  return utf8Bytes(value).length * 8;
}

/** 分块加纠错并交错 */
export function addEccAndInterleave(data: number[], version: number, ecl: ErrorCorrectionLevel): number[] {
  const [numBlocks, blockEccLen] = EC_BLOCKS[ecl][version - 1];
  const rawCodewords = getNumTotalCodewords(version);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsComputeDivisor(blockEccLen);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const dataLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + dataLen);
    k += dat.length;
    const ecc = rsComputeRemainder(dat, divisor);
    blocks.push(dat.concat(ecc));
  }

  // 标准交错：先交错各块数据码字（短块无末字节），再交错各块纠错码字
  const result: number[] = [];
  const maxDataLen = shortBlockLen - blockEccLen + 1;
  for (let i = 0; i < maxDataLen; i += 1) {
    for (let j = 0; j < blocks.length; j += 1) {
      if (i < blocks[j].length - blockEccLen) result.push(blocks[j][i]);
    }
  }
  for (let i = 0; i < blockEccLen; i += 1) {
    for (let j = 0; j < blocks.length; j += 1) {
      result.push(blocks[j][blocks[j].length - blockEccLen + i]);
    }
  }
  return result;
}

/* -------------------------------- 矩阵 ---------------------------------- */

function makeMatrix(version: number): { size: number; modules: boolean[][]; isFunction: boolean[][] } {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules, isFunction };
}

function setFunction(modules: boolean[][], isFunction: boolean[][], x: number, y: number, dark: boolean): void {
  modules[y][x] = dark;
  isFunction[y][x] = true;
}

/** 定位图形（含分隔符）：三个角 */
function drawFinder(modules: boolean[][], isFunction: boolean[][], size: number, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) {
        setFunction(modules, isFunction, x, y, dist !== 2 && dist !== 4);
      }
    }
  }
}

/** 校正图形位置（版本 2 起） */
function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.ceil((size - 13) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

function drawAlignment(modules: boolean[][], isFunction: boolean[][], x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(modules, isFunction, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/** 格式信息 BCH(15,5)：data(5bit) → 15bit（含 10 位 BCH 余数），末尾 XOR 0x5412 */
export function formatBits(ecl: ErrorCorrectionLevel, mask: number): number {
  const eclBits = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 }[ecl];
  const data = (eclBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) {
    rem = ((rem << 1) ^ ((rem >>> 9) * 0x537)) & 0x3ff;
  }
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

function drawFormat(modules: boolean[][], isFunction: boolean[][], size: number, ecl: ErrorCorrectionLevel, mask: number): void {
  const bits = formatBits(ecl, mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  // 左上
  for (let i = 0; i <= 5; i += 1) setFunction(modules, isFunction, 8, i, bit(i));
  setFunction(modules, isFunction, 8, 7, bit(6));
  setFunction(modules, isFunction, 8, 8, bit(7));
  setFunction(modules, isFunction, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(modules, isFunction, 14 - i, 8, bit(i));
  // 右上 / 左下（副本）
  for (let i = 0; i < 8; i += 1) setFunction(modules, isFunction, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(modules, isFunction, 8, size - 15 + i, bit(i));
  // 固定深色模块
  setFunction(modules, isFunction, 8, size - 8, true);
}

/** 版本信息（版本 ≥7）BCH(18,6) */
function drawVersionInfo(modules: boolean[][], isFunction: boolean[][], size: number, version: number): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i += 1) {
    rem = ((rem << 1) ^ ((rem >>> 11) * 0x1f25)) & 0x3ffff;
  }
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i += 1) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(modules, isFunction, a, b, dark);
    setFunction(modules, isFunction, b, a, dark);
  }
}

function drawTiming(modules: boolean[][], isFunction: boolean[][], size: number): void {
  for (let i = 0; i < size; i += 1) {
    if (!isFunction[6][i]) setFunction(modules, isFunction, i, 6, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(modules, isFunction, 6, i, i % 2 === 0);
  }
}

/** 之字形布码 */
function drawCodewords(modules: boolean[][], isFunction: boolean[][], size: number, codewords: number[]): void {
  let bitIndex = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < total) {
          modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
      }
    }
  }
}

/** 8 种掩码图案 */
export function maskAt(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function applyMask(modules: boolean[][], isFunction: boolean[][], size: number, mask: number): void {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && maskAt(mask, x, y)) {
        modules[y][x] = !modules[y][x];
      }
    }
  }
}

/** 掩码惩罚分（越低越好）：4 条标准规则 */
export function penaltyScore(modules: boolean[][], size: number): number {
  let score = 0;
  // 规则 1：同色连续 ≥5
  for (let y = 0; y < size; y += 1) {
    let runX = 1;
    let runY = 1;
    for (let x = 1; x < size; x += 1) {
      runX = modules[y][x] === modules[y][x - 1] ? runX + 1 : 1;
      if (runX === 5) score += 3;
      else if (runX > 5) score += 1;
      runY = modules[x][y] === modules[x - 1][y] ? runY + 1 : 1;
      if (runY === 5) score += 3;
      else if (runY > 5) score += 1;
    }
  }
  // 规则 2：2x2 同色块
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }
  // 规则 3：定位图形 1:1:3:1:1 + 4 浅色
  const pattern = (arr: boolean[], start: number) => {
    const expect = [true, false, true, true, true, false, true, false, false, false, false];
    let ok = true;
    for (let i = 0; i < 11; i += 1) {
      if (arr[start + i] !== expect[i]) {
        ok = false;
        break;
      }
    }
    return ok;
  };
  for (let y = 0; y < size; y += 1) {
    const row = modules[y];
    const col = [];
    for (let x = 0; x < size; x += 1) col.push(modules[x][y]);
    for (let x = 0; x + 11 <= size; x += 1) {
      if (pattern(row, x)) score += 40;
      if (pattern(row.slice().reverse(), size - x - 11)) score += 40;
      if (pattern(col, x)) score += 40;
      if (pattern(col.slice().reverse(), size - x - 11)) score += 40;
    }
  }
  // 规则 4：深色比例偏离 50%
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
    }
  }
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/* -------------------------------- 主入口 --------------------------------- */

export function encodeQR(value: string, ecl: ErrorCorrectionLevel = 'M'): QREncodeResult {
  const mode = detectMode(value);
  const version = pickVersion(value, mode, ecl);
  const dataCodewords = buildDataCodewords(value, mode, version, ecl);
  const codewords = addEccAndInterleave(dataCodewords, version, ecl);

  const { size, modules, isFunction } = makeMatrix(version);

  // 功能图形
  drawFinder(modules, isFunction, size, 3, 3);
  drawFinder(modules, isFunction, size, size - 4, 3);
  drawFinder(modules, isFunction, size, 3, size - 4);
  const positions = alignmentPositions(version);
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = 0; j < positions.length; j += 1) {
      // 与定位图形重叠的三个角不画校正图形
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === positions.length - 1) ||
        (i === positions.length - 1 && j === 0)
      ) {
        continue;
      }
      drawAlignment(modules, isFunction, positions[i], positions[j]);
    }
  }
  drawTiming(modules, isFunction, size);
  drawFormat(modules, isFunction, size, ecl, 0); // 占位，掩码选定后重画
  drawVersionInfo(modules, isFunction, size, version);

  drawCodewords(modules, isFunction, size, codewords);

  // 选掩码：8 种全试，取惩罚分最低
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(modules, isFunction, size, mask);
    drawFormat(modules, isFunction, size, ecl, mask);
    const score = penaltyScore(modules, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(modules, isFunction, size, mask); // 还原（异或自逆）
  }
  applyMask(modules, isFunction, size, bestMask);
  drawFormat(modules, isFunction, size, ecl, bestMask);

  return { size, modules, version, ecl, mode, mask: bestMask };
}

/* -------------------------------- SVG 输出 -------------------------------- */

/**
 * 矩阵 → SVG path 数据（横向游程合并成 1 模块高的矩形条）。
 * quiet 为静区模块数（标准要求 ≥4），坐标按模块单位平移。
 */
export function qrMatrixToPathData(modules: boolean[][], quiet: number): string {
  const parts: string[] = [];
  for (let y = 0; y < modules.length; y += 1) {
    const row = modules[y];
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run += 1;
      parts.push(`M${x + quiet},${y + quiet}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return parts.join('');
}
