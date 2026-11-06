/**
 * zui add —— 从 registry 复制组件源码到目标目录
 *
 * - 支持多组件（zui add button modal）与 --all
 * - 自动补齐 registryDependencies（组件间依赖，递归去重）
 * - 文件复制到 <components>/<组件名>/<原文件名>，输出 import 提示与依赖安装提示
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Ctx, RegistryItem } from '../index.js';
import { itemFiles, readSource } from '../source.js';

export interface AddOptions {
  ctx: Ctx;
  /** 组件名列表（Button / button / dropdown-menu 均可） */
  names: string[];
  /** 全部组件 */
  all?: boolean;
}

export interface AddFileResult {
  /** registry 内相对路径 */
  source: string;
  /** 本地绝对路径 */
  dest: string;
  /** created 新建 / updated 覆盖 / skipped 未变化 */
  status: 'created' | 'updated' | 'skipped';
}

export interface AddResult {
  items: RegistryItem[];
  written: AddFileResult[];
  /** 合并后的 npm dependencies */
  dependencies: string[];
  /** import 路径提示 */
  importHint?: string;
  warnings: string[];
}

/** 解析目标组件：补全 registryDependencies（BFS 递归去重） */
export function resolveItems(ctx: Ctx, names: string[], all: boolean): RegistryItem[] {
  const roots: RegistryItem[] = [];
  if (all) {
    roots.push(...ctx.allItems());
  } else {
    for (const name of names) {
      const item = ctx.findItem(name);
      if (!item) {
        const known = ctx.allItems().map((i) => i.name).join(', ');
        throw new Error(`registry 中没有组件「${name}」。可用：${known}`);
      }
      roots.push(item);
    }
  }

  const byName = new Map<string, RegistryItem>();
  const queue = [...roots];
  while (queue.length > 0) {
    const item = queue.shift() as RegistryItem;
    if (byName.has(item.name)) continue;
    byName.set(item.name, item);
    for (const dep of item.registryDependencies) {
      const depItem = ctx.findItem(dep);
      if (!depItem) throw new Error(`registry 缺少依赖组件：${dep}`);
      if (!byName.has(depItem.name)) queue.push(depItem);
    }
  }

  // 按 registry 原始顺序输出（保证 --all / 多组件确定性）
  return ctx.allItems().filter((i) => byName.has(i.name));
}

/** add 主流程：复制组件文件到目标目录 */
export async function add(options: AddOptions): Promise<AddResult> {
  const { ctx, names, all = false } = options;
  const items = resolveItems(ctx, names, all);
  const written: AddFileResult[] = [];
  const warnings: string[] = [];
  const npmDeps = new Set<string>(ctx.registry.dependencies ?? []);
  const copied = new Set<string>();

  for (const item of items) {
    for (const dep of item.dependencies) npmDeps.add(dep);

    for (const file of itemFiles(ctx, item)) {
      if (copied.has(file)) continue;
      copied.add(file);
      const src = path.join(ctx.registryRoot, file);
      const dest = ctx.localPathFor(item, file);
      if (!fs.existsSync(src)) {
        warnings.push(`registry 缺少源文件：${file}`);
        continue;
      }
      const next = Buffer.from(readSource(ctx, item, file), 'utf8');
      let status: AddFileResult['status'] = 'created';
      if (fs.existsSync(dest)) {
        status = Buffer.compare(fs.readFileSync(dest), next) === 0 ? 'skipped' : 'updated';
      }
      if (status !== 'skipped') {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, next);
      }
      written.push({ source: file, dest, status });
    }
  }

  // import 提示：主组件文件（<Name>.tsx 或同名主文件）
  let importHint: string | undefined;
  const first = ctx.findItem(names[0] ?? '') ?? items[0];
  if (first) {
    const mainBase = `${first.name.replace(/-/g, '')}.tsx`.toLowerCase();
    const mainFile = first.files.find((file) => file.endsWith('/index.ts')) ??
      first.files.find((f) => f.toLowerCase().endsWith(`/${mainBase}`)) ??
      first.files.find((f) => f.endsWith('.tsx')) ??
      first.files[0];
    if (mainFile) {
      const rel = path.relative(
        ctx.cwd,
        ctx.localPathFor(first, mainFile)
      ).split(path.sep).join('/');
      const relNoExt = rel.replace(/\.tsx?$/, '').replace(/\/index$/, '').replace(/^\.\//, '');
      const source = readSource(ctx, first, mainFile);
      const exportName = source.match(/export\s+\{\s*([A-Za-z_$][\w$]*)/)?.[1]
        ?? source.match(/export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/)?.[1]
        ?? path.basename(mainFile).replace(/\.tsx?$/, '');
      importHint = `import { ${exportName} } from './${relNoExt}'; // ${first.title}`;
    }
  }

  return {
    items,
    written,
    dependencies: [...npmDeps].sort(),
    importHint,
    warnings,
  };
}
