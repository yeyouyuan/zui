/**
 * zui_search_components —— 组件目录数据层 + 名称/描述检索。
 *
 * 数据源（运行时用 fs 读取）：
 *   1. packages/ui/src/components/<Name>/meta.json   （CONTRACTS-V3 §2 结构，AI 翻译组产出）
 *   2. CONTRACTS-V3.md §1                            （新组件精确契约，缺 meta 时兜底）
 *   3. docs/public/llms.txt                          （26 个基础组件签名，补充兜底）
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

/* ---------------------------------- 类型 ---------------------------------- */

/** meta.json 中单个 prop 的结构（CONTRACTS-V3 §2）。 */
export interface PropMeta {
  type: string;
  default?: string;
  desc?: string;
}

/** packages/ui/src/components/<Name>/meta.json 的结构（CONTRACTS-V3 §2）。 */
export interface ComponentMeta {
  name: string;
  description: string;
  category?: string;
  useCase?: string[];
  dontUse?: string[];
  props?: Record<string, PropMeta>;
  a11yNotes?: string[];
  related?: string[];
}

/** 单个组件的合并视图（meta.json + CONTRACTS-V3 + llms.txt）。 */
export interface CatalogEntry {
  /** 规范组件名 = 目录名（如 Button / DropdownMenu）。 */
  name: string;
  description: string;
  category: string;
  useCase: string[];
  dontUse: string[];
  props: Record<string, PropMeta>;
  a11yNotes: string[];
  related: string[];
  /** CONTRACTS-V3 §1 的 ```ts props 签名（如有）。 */
  contractsSignature?: string;
  /** docs/public/llms.txt 的组件签名段（如有）。 */
  llmsSignature?: string;
  sources: { meta: boolean; contracts: boolean; llms: boolean };
}

/** 组件目录，key 为小写组件名。 */
export type Catalog = Map<string, CatalogEntry>;

/** zui_search_components 的返回条目。 */
export interface SearchHit {
  name: string;
  description: string;
  category: string;
}

/* ------------------------------- 目录定位 ------------------------------- */

/**
 * 解析仓库根目录。
 * 优先级：ZUI_COMPONENTS_DIR/ZUI_ROOT 环境变量 → 从本文件位置向上找
 * CONTRACTS-V3.md 或 pnpm-workspace.yaml → process.cwd()。
 */
export function resolveRepoRoot(): string {
  if (process.env.ZUI_ROOT) return resolve(process.env.ZUI_ROOT);
  const bundled = resolve(dirname(fileURLToPath(import.meta.url)), '../../data');
  if (existsSync(join(bundled, 'CONTRACTS-V3.md'))) return bundled;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'CONTRACTS-V3.md')) || existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function componentsDir(root: string): string {
  return process.env.ZUI_COMPONENTS_DIR
    ? resolve(process.env.ZUI_COMPONENTS_DIR)
    : join(root, 'packages', 'ui', 'src', 'components');
}

/* --------------------------- 外部文档解析 --------------------------- */

interface ContractSection {
  description: string;
  signature: string;
}

/** 解析 CONTRACTS-V3.md §1：`### Name（描述）` + ```ts 代码块。 */
function parseContractSections(root: string): Map<string, ContractSection> {
  const out = new Map<string, ContractSection>();
  const file = join(root, 'CONTRACTS-V3.md');
  if (!existsSync(file)) return out;
  const text = readFileSync(file, 'utf8');
  const heading = /^###\s+([^\s（(]+)(?:（|\()(.*)$/mu;
  const blocks = text.split(/^###\s+/mu).slice(1);
  for (const block of blocks) {
    const firstLine = block.split('\n', 1)[0] ?? '';
    const m = heading.exec(`### ${firstLine}`);
    if (!m) continue;
    const name = m[1];
    const description = (m[2] ?? '').replace(/[）)]\s*$/, '').trim();
    const fence = /```(?:ts|tsx)?\n([\s\S]*?)```/.exec(block);
    out.set(name.toLowerCase(), {
      description,
      signature: fence ? fence[1].trim() : '',
    });
  }
  return out;
}

/** 解析 docs/public/llms.txt：`### Name` 小节（签名 + 用法）。 */
function parseLlmsSections(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const file = join(root, 'docs', 'public', 'llms.txt');
  if (!existsSync(file)) return out;
  const text = readFileSync(file, 'utf8');
  const blocks = text.split(/^###\s+/mu).slice(1);
  for (const block of blocks) {
    const firstLine = block.split('\n', 1)[0] ?? '';
    const body = block.slice(firstLine.length).trim();
    // 支持 `### Radio / RadioGroup` 之类多名字小节。
    for (const rawName of firstLine.split('/')) {
      const name = rawName.trim().split(/\s+/)[0];
      if (/^[A-Za-z][A-Za-z0-9]*$/.test(name)) out.set(name.toLowerCase(), body);
    }
  }
  return out;
}

/* ------------------------------- 目录加载 ------------------------------- */

/** 读取 meta.json；不存在或损坏时返回 null（不抛错）。 */
export function readComponentMeta(componentDir: string): ComponentMeta | null {
  const file = join(componentDir, 'meta.json');
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ComponentMeta>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      useCase: Array.isArray(parsed.useCase) ? parsed.useCase.map(String) : undefined,
      dontUse: Array.isArray(parsed.dontUse) ? parsed.dontUse.map(String) : undefined,
      props:
        parsed.props && typeof parsed.props === 'object'
          ? (parsed.props as Record<string, PropMeta>)
          : undefined,
      a11yNotes: Array.isArray(parsed.a11yNotes) ? parsed.a11yNotes.map(String) : undefined,
      related: Array.isArray(parsed.related) ? parsed.related.map(String) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 加载组件目录：遍历 packages/ui/src/components 的各子目录，合并
 * meta.json + CONTRACTS-V3.md + docs/public/llms.txt。
 */
export function loadCatalog(root: string = resolveRepoRoot()): Catalog {
  const catalog: Catalog = new Map();
  const dir = componentsDir(root);
  const contracts = parseContractSections(root);
  const llms = parseLlmsSections(root);
  if (!existsSync(dir)) return catalog;

  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const name = dirent.name;
    const meta = readComponentMeta(join(dir, name));
    const contract = contracts.get(name.toLowerCase());
    const llmsSection = llms.get(name.toLowerCase());
    const entry: CatalogEntry = {
      name,
      description: meta?.description || contract?.description || '',
      category: meta?.category || '未分类',
      useCase: meta?.useCase ?? [],
      dontUse: meta?.dontUse ?? [],
      props: meta?.props ?? {},
      a11yNotes: meta?.a11yNotes ?? [],
      related: meta?.related ?? [],
      contractsSignature: contract?.signature || undefined,
      llmsSignature: llmsSection || undefined,
      sources: {
        meta: Boolean(meta),
        contracts: Boolean(contract),
        llms: Boolean(llmsSection),
      },
    };
    catalog.set(name.toLowerCase(), entry);
  }
  return catalog;
}

/* -------------------------------- 检索 -------------------------------- */

/** 词形归一：DropdownMenu → "dropdownmenu dropdown menu"。 */
function nameVariants(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return `${name.toLowerCase()} ${spaced} ${spaced.replace(/\s+/g, '')}`;
}

function scoreEntry(entry: CatalogEntry, query: string): number {
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const hay = nameVariants(entry.name);
  let score = 0;
  if (name === q) score = Math.max(score, 100);
  else if (name.startsWith(q)) score = Math.max(score, 90);
  else if (hay.includes(q)) score = Math.max(score, 75);
  if (entry.description.toLowerCase().includes(q)) score = Math.max(score, 50);
  if (entry.category.toLowerCase().includes(q)) score = Math.max(score, 40);
  if (entry.useCase.some((u) => u.toLowerCase().includes(q))) score = Math.max(score, 30);
  if (entry.related.some((r) => r.toLowerCase().includes(q))) score = Math.max(score, 25);
  if (Object.keys(entry.props).some((p) => p.toLowerCase().includes(q))) score = Math.max(score, 20);
  return score;
}

/**
 * zui_search_components：query 匹配组件名/描述（含分类、适用场景）。
 * 空 query 返回全部组件；多词 query 要求每个词都命中。
 */
export function searchComponents(
  catalog: Catalog,
  query: string,
  limit = 10,
): SearchHit[] {
  const q = query.trim();
  const entries = [...catalog.values()];
  if (q === '') {
    return entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(toHit);
  }

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of entries) {
    let score = scoreEntry(entry, q);
    if (score === 0 && tokens.length > 1) {
      const text = `${nameVariants(entry.name)} ${entry.description} ${entry.category}`.toLowerCase();
      score = tokens.every((t) => text.includes(t)) ? 35 : 0;
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((s) => toHit(s.entry));
}

function toHit(entry: CatalogEntry): SearchHit {
  return { name: entry.name, description: entry.description, category: entry.category };
}

/* ------------------------------ 名称解析 ------------------------------ */

/** 大小写不敏感地解析组件名。 */
export function resolveEntry(catalog: Catalog, name: string): CatalogEntry | undefined {
  return catalog.get(name.trim().toLowerCase());
}

function editDistance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 未知组件时的相近名称建议。 */
export function suggestComponents(catalog: Catalog, name: string, limit = 5): string[] {
  const target = name.trim().toLowerCase();
  return [...catalog.values()]
    .map((entry) => ({
      name: entry.name,
      score: Math.min(editDistance(entry.name.toLowerCase(), target), nameVariants(entry.name).includes(target) ? 1 : 99),
    }))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((s) => s.name);
}
