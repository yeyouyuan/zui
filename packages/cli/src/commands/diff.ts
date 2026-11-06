/**
 * zui diff —— 本地副本 vs registry 的 unified diff（上游更新通道）
 *
 * 对比 registry 源文件与本地已复制文件：
 * - 一致：state = 'same'
 * - 有差异：state = 'changed'，输出 unified diff
 * - 本地缺失：state = 'missing'，输出全部内容为新增的 diff
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Ctx } from '../index.js';
import { itemFiles, readSource } from '../source.js';
import { resolveItems } from './add.js';

export interface DiffOptions {
  ctx: Ctx;
  names: string[];
}

export interface DiffFileResult {
  /** 组件名 */
  item: string;
  /** registry 内相对路径 */
  source: string;
  /** 本地文件绝对路径 */
  localPath: string;
  label: string;
  state: 'same' | 'changed' | 'missing';
  /** unified diff（same 时为空串） */
  patch: string;
}

export interface DiffResult {
  files: DiffFileResult[];
}

/* --------------------------- unified diff 实现 --------------------------- */

interface DiffOp {
  type: ' ' | '-' | '+';
  line: string;
}

/** 基于 LCS 的行级 diff（文件规模下 O(n·m) 足够） */
function lineDiff(oldLines: string[], newLines: string[]): DiffOp[] {
  const n = oldLines.length;
  const m = newLines.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: ' ', line: oldLines[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: '-', line: oldLines[i] });
      i++;
    } else {
      ops.push({ type: '+', line: newLines[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: '-', line: oldLines[i++] });
  while (j < m) ops.push({ type: '+', line: newLines[j++] });
  return ops;
}

/** 生成 unified diff 文本（context 行数 3） */
export function unifiedDiff(
  oldText: string,
  newText: string,
  oldLabel: string,
  newLabel: string,
  context = 3
): string {
  const split = (s: string) => (s === '' ? [] : s.split('\n'));
  const oldLines = split(oldText);
  const newLines = split(newText);
  const ops = lineDiff(oldLines, newLines);

  // 每个 op 对应的旧/新文件行号（1 起始）
  const oldNos: number[] = [];
  const newNos: number[] = [];
  let o = 1;
  let n = 1;
  for (const op of ops) {
    oldNos.push(op.type === '+' ? 0 : o);
    newNos.push(op.type === '-' ? 0 : n);
    if (op.type !== '+') o++;
    if (op.type !== '-') n++;
  }

  // 变更点分簇：相邻变更间隔 <= 2*context 合并为一个 hunk
  const changed: number[] = [];
  ops.forEach((op, idx) => {
    if (op.type !== ' ') changed.push(idx);
  });
  const clusters: Array<[number, number]> = [];
  for (const idx of changed) {
    const last = clusters[clusters.length - 1];
    if (last && idx - last[1] <= context * 2) last[1] = idx;
    else clusters.push([idx, idx]);
  }

  const out: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  for (const [first, last] of clusters) {
    const from = Math.max(0, first - context);
    const to = Math.min(ops.length, last + 1 + context);
    const lines: string[] = [];
    let oldCount = 0;
    let newCount = 0;
    let startOld = 0;
    let startNew = 0;
    for (let i = from; i < to; i++) {
      lines.push(`${ops[i].type}${ops[i].line}`);
      if (ops[i].type !== '+') {
        oldCount++;
        if (startOld === 0) startOld = oldNos[i];
      }
      if (ops[i].type !== '-') {
        newCount++;
        if (startNew === 0) startNew = newNos[i];
      }
    }
    out.push(`@@ -${startOld},${oldCount} +${startNew},${newCount} @@`);
    out.push(...lines);
  }

  return out.length > 2 ? out.join('\n') : '';
}

/* -------------------------------- 主流程 -------------------------------- */

/** diff 主流程：对比本地副本与 registry */
export async function diff(options: DiffOptions): Promise<DiffResult> {
  const { ctx, names } = options;
  const files: DiffFileResult[] = [];

  const seen = new Set<string>();
  for (const item of resolveItems(ctx, names, false)) {
    for (const file of itemFiles(ctx, item)) {
      if (seen.has(file)) continue;
      seen.add(file);
      const src = path.join(ctx.registryRoot, file);
      const localPath = ctx.localPathFor(item, file);
      const registryText = fs.existsSync(src) ? readSource(ctx, item, file) : '';
      const label = path.relative(ctx.cwd, localPath).split(path.sep).join('/');

      if (!fs.existsSync(localPath)) {
        files.push({
          item: item.name,
          source: file,
          localPath,
          label,
          state: 'missing',
          patch: unifiedDiff('', registryText, '/dev/null', `b/${label}`),
        });
        continue;
      }

      const localText = fs.readFileSync(localPath, 'utf8');
      if (localText === registryText) {
        files.push({ item: item.name, source: file, localPath, label, state: 'same', patch: '' });
      } else {
        files.push({
          item: item.name,
          source: file,
          localPath,
          label,
          state: 'changed',
          patch: unifiedDiff(localText, registryText, `a/${label}`, `b/${label}`),
        });
      }
    }
  }

  return { files };
}
