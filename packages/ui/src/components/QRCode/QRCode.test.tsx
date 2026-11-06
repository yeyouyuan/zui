import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  addEccAndInterleave,
  buildDataCodewords,
  detectMode,
  encodeQR,
  formatBits,
  getEccBlocks,
  getNumDataCodewords,
  getNumTotalCodewords,
  gfMultiply,
  maskAt,
  pickVersion,
  qrMatrixToPathData,
  type ErrorCorrectionLevel,
  type QREncodeResult,
} from './qrcode-encoder';
import { QRCode } from './QRCode';

afterEach(cleanup);

/* ---------------------- 测试内置迷你解码器（回环校验用） ---------------------- */

/** 字母数字字符集（运行时拼装，避免源码内长字面量） */
const ALNUM_CHARSET =
  Array.from({ length: 10 }, (_, i) => String(i)).join('') +
  Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).join('') +
  ' $%*+-./:';

/** 标准校正图形坐标（ISO 18004 Annex E） */
function alignmentPositionsForTest(version: number): number[] {
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

/** 功能图形区域图（独立按标准区域计算，反读数据时跳过） */
function buildFunctionMap(version: number): boolean[][] {
  const size = version * 4 + 17;
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const markRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y += 1) {
      for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x += 1) fn[y][x] = true;
    }
  };
  // 定位图形 + 分隔符 + 格式信息
  markRect(0, 0, 8, 8);
  markRect(size - 8, 0, size - 1, 8);
  markRect(0, size - 8, 8, size - 1);
  // 时序图形
  markRect(0, 6, size - 1, 6);
  markRect(6, 0, 6, size - 1);
  // 版本信息（版本 ≥ 7）
  if (version >= 7) {
    markRect(size - 11, 0, size - 9, 5);
    markRect(0, size - 11, 5, size - 9);
  }
  // 校正图形
  const positions = alignmentPositionsForTest(version);
  for (const cy of positions) {
    for (const cx of positions) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) {
        continue;
      }
      markRect(cx - 2, cy - 2, cx + 2, cy + 2);
    }
  }
  return fn;
}

/** 之字形反读 + 反掩码 → 码字 */
function readCodewords(result: QREncodeResult): number[] {
  const { size, modules, version, mask } = result;
  const fn = buildFunctionMap(version);
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x]) {
          let bit = modules[y][x];
          if (maskAt(mask, x, y)) bit = !bit;
          bits.push(bit ? 1 : 0);
        }
      }
    }
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  return codewords;
}

/** 逆向去交错：还原每块（数据 + 纠错） */
function deinterleave(codewords: number[], version: number, ecl: ErrorCorrectionLevel) {
  const { numBlocks, ecPerBlock } = getEccBlocks(version, ecl);
  const rawCodewords = getNumTotalCodewords(version);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const dataLens = Array.from({ length: numBlocks }, (_, i) =>
    shortBlockLen - ecPerBlock + (i < numShortBlocks ? 0 : 1)
  );
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let k = 0;
  const maxDataLen = Math.max(...dataLens);
  for (let i = 0; i < maxDataLen; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) {
      if (i < dataLens[j]) blocks[j].push(codewords[k++]);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) blocks[j].push(codewords[k++]);
  }
  return { blocks, dataLens };
}

/** RS 校验：码字多项式在 α^0..α^(ecLen-1) 处取值全为 0 */
function eccValid(block: number[], ecLen: number): boolean {
  for (let s = 0; s < ecLen; s += 1) {
    let x = 1;
    for (let i = 0; i < s; i += 1) x = gfMultiply(x, 2);
    let acc = 0;
    for (const b of block) acc = gfMultiply(acc, x) ^ b;
    if (acc !== 0) return false;
  }
  return true;
}

/** 数据码字 → 原始字符串（数字/字母数字/UTF-8 字节） */
function parsePayload(data: number[], version: number): string {
  const bits: number[] = [];
  for (const byte of data) for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  let p = 0;
  const take = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i += 1) v = (v << 1) | bits[p++];
    return v;
  };
  const mode = take(4);
  const countBitsTable: Record<number, [number, number, number]> = {
    1: [10, 12, 14],
    2: [9, 11, 13],
    4: [8, 16, 16],
  };
  const tier = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const count = take(countBitsTable[mode][tier]);
  if (mode === 1) {
    let out = '';
    let remaining = count;
    while (remaining >= 3) {
      out += String(take(10)).padStart(3, '0');
      remaining -= 3;
    }
    if (remaining === 2) out += String(take(7)).padStart(2, '0');
    if (remaining === 1) out += String(take(4)).padStart(1, '0');
    return out;
  }
  if (mode === 2) {
    let out = '';
    for (let i = 0; i < count; i += 1) {
      if (i % 2 === 0 && i + 1 < count) {
        const pair = take(11);
        out += ALNUM_CHARSET[Math.floor(pair / 45)] + ALNUM_CHARSET[pair % 45];
        i += 1;
      } else {
        out += ALNUM_CHARSET[take(6)];
      }
    }
    return out.slice(0, count);
  }
  const bytes: number[] = [];
  for (let i = 0; i < count; i += 1) bytes.push(take(8));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 全链路回环：矩阵 → 码字 → 分块校验 → 解析字符串 */
function decodeResult(result: QREncodeResult): { decoded: string; eccOk: boolean } {
  const codewords = readCodewords(result);
  const { blocks, dataLens } = deinterleave(codewords, result.version, result.ecl);
  const { ecPerBlock } = getEccBlocks(result.version, result.ecl);
  const eccOk = blocks.every((block) => eccValid(block, ecPerBlock));
  const data: number[] = [];
  blocks.forEach((block, j) => data.push(...block.slice(0, dataLens[j])));
  return { decoded: parsePayload(data, result.version), eccOk };
}

/* ------------------------------- 组件测试 ------------------------------- */

describe('QRCode component', () => {
  it('renders svg with role="img" and aria-label containing value, default size 160', () => {
    render(<QRCode value="1234567" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('data-part', 'root');
    expect(svg).toHaveClass('z-qrcode');
    expect(svg.getAttribute('aria-label')).toContain('1234567');
    expect(svg).toHaveAttribute('width', '160');
    expect(svg).toHaveAttribute('height', '160');
    expect(svg).toHaveAttribute('data-level', 'M');
  });

  it('respects size and level props', () => {
    render(<QRCode value="1234567" size={240} level="H" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '240');
    expect(svg).toHaveAttribute('height', '240');
    expect(svg).toHaveAttribute('data-level', 'H');
  });

  it('renders viewBox with quiet zone and non-empty module path (v1 = 21 modules)', () => {
    const { container } = render(<QRCode value="1234567" />);
    const svg = container.querySelector('[data-part="root"]') as SVGSVGElement;
    expect(svg).toHaveAttribute('viewBox', '0 0 29 29');
    const path = svg.querySelector('[data-part="modules"]');
    expect(path).toBeInTheDocument();
    const d = path?.getAttribute('d') ?? '';
    expect(d.startsWith('M')).toBe(true);
    expect(d.length).toBeGreaterThan(50);
    expect(svg.querySelector('[data-part="bg"]')).toBeInTheDocument();
  });

  it('level affects matrix version for the same value', () => {
    const longDigits = '1'.repeat(45);
    const { container, rerender } = render(<QRCode value={longDigits} level="L" />);
    const svg = () => container.querySelector('[data-part="root"]') as SVGSVGElement;
    expect(svg()).toHaveAttribute('viewBox', '0 0 33 33'); // v2 = 25 模块
    rerender(<QRCode value={longDigits} level="H" />);
    expect(svg()).toHaveAttribute('viewBox', '0 0 37 37'); // v3 = 29 模块
  });

  it('color/bgColor override fills via inline style', () => {
    const { container } = render(
      <QRCode value="1234567" color="#123456" bgColor="#abcdef" />
    );
    const path = container.querySelector('[data-part="modules"]') as SVGPathElement;
    const rect = container.querySelector('[data-part="bg"]') as SVGRectElement;
    expect(path.getAttribute('style')).toContain('#123456');
    expect(rect.getAttribute('style')).toContain('#abcdef');
  });

  it('passes className and classNames to parts with data-part anchors', () => {
    const { container } = render(
      <QRCode
        value="1234567"
        className="my-root"
        classNames={{ root: 'cls-root', bg: 'cls-bg', modules: 'cls-modules' }}
      />
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-qrcode', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="bg"]')).toHaveClass('z-qrcode-bg', 'cls-bg');
    expect(root.querySelector('[data-part="modules"]')).toHaveClass('z-qrcode-modules', 'cls-modules');
  });

  it('allows aria-label override, forwards ref and native svg props', () => {
    const ref = React.createRef<SVGSVGElement>();
    render(
      <QRCode
        ref={ref}
        value="1234567"
        aria-label="扫码查看"
        id="my-qr"
        data-testid="qr"
      />
    );
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', '扫码查看');
    expect(svg).toHaveAttribute('id', 'my-qr');
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
    expect(ref.current).toBe(svg);
  });

  it('renders placeholder without modules for empty value', () => {
    const { container } = render(<QRCode value="" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', '二维码：');
    expect(container.querySelector('[data-part="modules"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-part="bg"]')).toBeInTheDocument();
  });

  it('renders placeholder instead of throwing when value exceeds capacity', () => {
    const { container } = render(<QRCode value={'9'.repeat(5000)} />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toContain('9');
    expect(container.querySelector('[data-part="modules"]')).not.toBeInTheDocument();
  });
});

/* ------------------------------- 编码器测试 ------------------------------- */

describe('qrcode-encoder', () => {
  it('detects numeric / alphanumeric / byte modes', () => {
    expect(detectMode('1234567')).toBe('numeric');
    expect(detectMode('HELLO WORLD')).toBe('alphanumeric');
    expect(detectMode('ZUI-2026')).toBe('alphanumeric'); // '-' 在字母数字字符集内
    expect(detectMode('hello')).toBe('byte');
    expect(detectMode('你好')).toBe('byte');
    expect(detectMode('Zui')).toBe('byte'); // 小写 → byte
  });

  it('picks minimal version and throws beyond v10', () => {
    expect(pickVersion('1234567', 'numeric', 'M')).toBe(1);
    expect(pickVersion('1'.repeat(45), 'numeric', 'L')).toBe(2);
    expect(pickVersion('1'.repeat(45), 'numeric', 'H')).toBe(3);
    expect(() => pickVersion('1'.repeat(5000), 'numeric', 'M')).toThrow();
  });

  it('matches known codeword vectors (thonky HELLO WORLD 1-Q + numeric 1-M)', () => {
    expect(buildDataCodewords('HELLO WORLD', 'alphanumeric', 1, 'Q')).toEqual([
      0x20, 0x5b, 0x0b, 0x78, 0xd1, 0x72, 0xdc, 0x4d, 0x43, 0x40, 0xec, 0x11, 0xec,
    ]);
    expect(buildDataCodewords('1234567', 'numeric', 1, 'M')).toEqual([
      0x10, 0x1c, 0x7b, 0x72, 0x1c, 0x00, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
      0xec, 0x11,
    ]);
  });

  it('computes codeword capacities per spec (v1: 26 total)', () => {
    expect(getNumTotalCodewords(1)).toBe(26);
    expect(getNumDataCodewords(1, 'M')).toBe(16);
    expect(getNumDataCodewords(1, 'Q')).toBe(13);
    expect(getNumTotalCodewords(10)).toBe(346);
    expect(getNumDataCodewords(10, 'L')).toBe(274);
  });

  it('interleaves blocks to exactly total codewords with valid RS syndromes', () => {
    const value = '1234567890'.repeat(12); // 120 位数字 → v5-Q（4 块、长短混合）
    const mode = detectMode(value);
    const version = pickVersion(value, mode, 'Q');
    expect(version).toBe(5);
    const data = buildDataCodewords(value, mode, version, 'Q');
    const codewords = addEccAndInterleave(data, version, 'Q');
    expect(codewords).toHaveLength(getNumTotalCodewords(version));
    const { blocks, dataLens } = deinterleave(codewords, version, 'Q');
    const { ecPerBlock } = getEccBlocks(version, 'Q');
    expect(blocks.every((block) => eccValid(block, ecPerBlock))).toBe(true);
    const flat: number[] = [];
    blocks.forEach((block, j) => flat.push(...block.slice(0, dataLens[j])));
    expect(flat).toEqual(data);
  });

  it('places function patterns per spec (finders / timing / dark / format copies)', () => {
    const result = encodeQR('1234567', 'M');
    const { size, modules, mask } = result;
    expect(size).toBe(21);
    const expectedFinder = [
      [true, true, true, true, true, true, true],
      [true, false, false, false, false, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, true, true, true, false, true],
      [true, false, false, false, false, false, true],
      [true, true, true, true, true, true, true],
    ];
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        expect(modules[y][x]).toBe(expectedFinder[y][x]); // 左上
        expect(modules[y][size - 7 + x]).toBe(expectedFinder[y][x]); // 右上
        expect(modules[size - 7 + y][x]).toBe(expectedFinder[y][x]); // 左下
      }
    }
    // 时序图形：行 6 / 列 6 交替
    for (let i = 8; i < size - 8; i += 1) {
      expect(modules[6][i]).toBe(i % 2 === 0);
      expect(modules[i][6]).toBe(i % 2 === 0);
    }
    // 固定深色模块
    expect(modules[size - 8][8]).toBe(true);
    // 格式信息两份副本一致且与 formatBits 一致
    const expected = formatBits('M', mask);
    const readCopy1 = (): number => {
      let bits = 0;
      const set = (i: number, v: boolean) => {
        if (v) bits |= 1 << i;
      };
      for (let i = 0; i <= 5; i += 1) set(i, modules[i][8]);
      set(6, modules[7][8]);
      set(7, modules[8][8]);
      set(8, modules[8][7]);
      for (let i = 9; i < 15; i += 1) set(i, modules[8][14 - i]);
      return bits;
    };
    const readCopy2 = (): number => {
      let bits = 0;
      const set = (i: number, v: boolean) => {
        if (v) bits |= 1 << i;
      };
      for (let i = 0; i < 8; i += 1) set(i, modules[8][size - 1 - i]);
      for (let i = 8; i < 15; i += 1) set(i, modules[size - 15 + i][8]);
      return bits;
    };
    expect(readCopy1()).toBe(expected);
    expect(readCopy2()).toBe(expected);
    // formatBits 的 M-0 已知向量
    expect(formatBits('M', 0)).toBe(0x5412);
  });

  it('round-trips decode for numeric / alphanumeric / byte(UTF-8) / mixed-block v5-Q / v10', () => {
    const cases: Array<[string, ErrorCorrectionLevel]> = [
      ['1234567', 'M'],
      ['HELLO WORLD', 'Q'],
      ['HELLO WORLD', 'H'],
      ['你好, ZUI! 2026', 'M'],
      ['1234567890'.repeat(12), 'Q'], // v5-Q 长短混合块（交错回归）
      ['0012', 'L'], // 前导零数字
      ['zui-' + 'x'.repeat(200), 'M'], // v10（版本信息 + 校正图形）
    ];
    for (const [value, ecl] of cases) {
      const result = encodeQR(value, ecl);
      const { decoded, eccOk } = decodeResult(result);
      expect(eccOk, `ecc for ${value.slice(0, 12)}…`).toBe(true);
      expect(decoded, `decode for ${value.slice(0, 12)}…`).toBe(value);
    }
  });

  it('qrMatrixToPathData merges runs into rect strokes', () => {
    const result = encodeQR('1234567', 'M');
    const d = qrMatrixToPathData(result.modules, 4);
    expect(d.startsWith('M4,4')).toBe(true);
    expect(d.split('z').length - 1).toBeGreaterThan(10);
  });
});
