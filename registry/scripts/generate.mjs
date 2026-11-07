#!/usr/bin/env node
/**
 * ZUI registry 生成脚本（registry 组）
 *
 * 遍历 packages/ui/src/components/ 下的每个组件目录，读取 meta.json（若存在）与源文件清单
 * （.tsx / .ts / .css，排除 *.test.*，保留 index.ts 出口文件），自动生成 registry/registry.json。
 *
 * 新组件只需在 packages/ui/src/components/<Name>/ 下放好源码（可选 meta.json），
 * 重新运行本脚本即自动进入 registry —— 无需手工登记。
 *
 * 用法：
 *   node registry/scripts/generate.mjs          # 生成 registry/registry.json
 *   node registry/scripts/generate.mjs --check  # 只校验是否与现有文件一致（CI 用）
 *
 * 说明：
 * - meta.json 缺失时从 docs 文档站标题/描述兜底，再缺失用组件名占位，
 *   AI 翻译组补写 meta.json 后重跑本脚本即可覆盖。
 * - cssVars 解析组件 CSS 中根选择器（如 .z-button）上定义的组件级变量的默认值。
 * - dependencies / registryDependencies 取自 meta.json；无 meta 时 npm 依赖扫 import，
 *   registry 依赖留给人工（meta.json 的 related / registryDependencies）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(REPO_ROOT, 'packages', 'ui', 'src', 'components');
const DOCS_PAGES_DIR = path.join(REPO_ROOT, 'docs', 'src', 'pages', 'components');
const UI_SRC = path.join(REPO_ROOT, 'packages', 'ui', 'src');
const BLOCKS_DIR = path.join(REPO_ROOT, 'packages', 'blocks', 'src');
const OUTPUT = path.join(REPO_ROOT, 'registry', 'registry.json');

/** 组件目录名 -> registry name（kebab-case，如 DropdownMenu -> dropdown-menu） */
export function toKebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/** 读取 docs 文档页标题（如 "Button 按钮"）与首段描述，作为 meta.json 缺失时的兜底 */
function docsFallback(componentDirName) {
  const pageFile = path.join(DOCS_PAGES_DIR, `${componentDirName}Page.tsx`);
  if (!fs.existsSync(pageFile)) return {};
  const src = fs.readFileSync(pageFile, 'utf8');
  const titleMatch = src.match(/usePageTitle\('([^']+)'\)/);
  const leadMatch = src.match(/doc-lead">\s*([\s\S]*?)<\/p>/);
  let description;
  if (leadMatch) {
    description = leadMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return { title: titleMatch ? titleMatch[1] : undefined, description };
}

/** 解析组件 CSS：收集根选择器上定义的组件级 CSS 变量（默认值） */
export function extractCssVars(cssText) {
  const vars = {};
  // 只取类选择器块（.z-xxx { ... }）里的定义，跳过嵌套的尺寸/变体覆盖块
  const rootBlockRe = /\.(z-[a-z0-9-]+)\s*\{([^{}]*)\}/g;
  let m;
  while ((m = rootBlockRe.exec(cssText)) !== null) {
    const body = m[2];
    const defRe = /(--z-[a-z0-9-]+)\s*:\s*([^;]+);/g;
    let d;
    while ((d = defRe.exec(body)) !== null) {
      const key = d[1];
      const value = d[2].replace(/\/\*.*?\*\//g, '').trim();
      if (!(key in vars)) vars[key] = value;
    }
  }
  return vars;
}

/** 组件目录里的源文件清单（相对仓库根，正斜杠），排除测试文件 */
export function listSourceFiles(dirAbs) {
  const rel = (f) => path.relative(REPO_ROOT, f).split(path.sep).join('/');
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter(
      (name) =>
        (/\.(tsx?|css)$/.test(name) &&
          !/\.test\./.test(name) &&
          !/\.stories\./.test(name)) ||
        name === 'index.ts'
    )
    .sort()
    .map((name) => rel(path.join(dirAbs, name)));
}

/** 扫描组件源码里的 import 说明符，推断 npm dependencies（无 meta.json 时的兜底） */
export function inferNpmDeps(fileAbsPaths) {
  const deps = new Set();
  for (const f of fileAbsPaths) {
    if (!/\.(tsx?|css)$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const re = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const spec = m[1] || m[2];
      if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue;
      // 取包名（scoped 包保留两段）
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (pkg === 'react' || pkg === 'react-dom') continue; // peerDeps，不进 dependencies
      deps.add(pkg);
    }
  }
  return [...deps].sort();
}

/**
 * 扫描组件源码里对兄弟组件的 import（../<Other>/...），推断 registryDependencies。
 * 组件目录名 -> kebab 名（如 ../TreeSelect/ -> tree-select）。
 */
export function inferRegistryDeps(fileAbsPaths, allComponentNames) {
  const deps = new Set();
  const nameSet = new Set(allComponentNames);
  for (const f of fileAbsPaths) {
    if (!/\.tsx?$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const re = /from\s+['"]\.\.\/([A-Za-z0-9_-]+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const target = m[1];
      if (nameSet.has(target)) deps.add(toKebab(target));
    }
  }
  return [...deps].sort();
}

/** 生成单个组件的 registry item */
function buildItem(dirAbs, dirName, allComponentNames) {
  const metaPath = path.join(dirAbs, 'meta.json');
  let meta = null;
  if (fs.existsSync(metaPath)) {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }

  const files = listSourceFiles(dirAbs);
  const absFiles = files.map((f) => path.join(REPO_ROOT, f));

  // cssVars：所有组件 CSS 的根变量合并（通常只有一份 <Name>.css）
  const cssVars = {};
  for (const f of absFiles) {
    if (!f.endsWith('.css')) continue;
    Object.assign(cssVars, extractCssVars(fs.readFileSync(f, 'utf8')));
  }

  const fallback = docsFallback(dirName);
  const componentName = meta?.name ?? dirName;
  const title = meta?.title ?? fallback.title ?? `${componentName}`;
  const description = meta?.description ?? fallback.description ?? `${componentName} 组件`;

  const dependencies = [...new Set([...(meta?.dependencies ?? []), ...inferNpmDeps(absFiles)])].sort();

  // registryDependencies：meta.json 显式声明优先；否则按组件间 import 推断
  const registryDependencies = [...new Set([...(meta?.registryDependencies ?? []).map(toKebab),
    ...inferRegistryDeps(absFiles, allComponentNames)])].sort();

  return {
    name: toKebab(dirName),
    type: 'registry:component',
    title,
    description,
    dependencies,
    registryDependencies,
    files,
    cssVars,
    meta: path
      .relative(REPO_ROOT, metaPath)
      .split(path.sep)
      .join('/'),
  };
}

/** 主流程：扫描组件目录 -> 生成 registry.json */
export function generate() {
  if (!fs.existsSync(COMPONENTS_DIR)) {
    throw new Error(`组件目录不存在：${COMPONENTS_DIR}`);
  }
  const dirs = fs
    .readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const items = dirs.map((dirName) =>
    buildItem(path.join(COMPONENTS_DIR, dirName), dirName, dirs)
  );

  const exports = {};
  for (const name of dirs) {
    const barrel = path.join(COMPONENTS_DIR, name, 'index.ts');
    const text = fs.readFileSync(barrel, 'utf8');
    for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
      for (const specifier of match[1].split(',')) {
        const exported = specifier.trim().split(/\s+as\s+/).pop();
        if (exported) exports[exported] = path.relative(REPO_ROOT, barrel).split(path.sep).join('/');
      }
    }
  }
  // utils / config 的桶导出（cx / useControllableState / locale 包等）也进入映射，
  // 否则业务区块从 '@zui/react' 具名导入这些符号时复制模式无法解析本地源文件。
  for (const extra of ['utils/index.ts', 'config/index.ts']) {
    const barrel = path.join(UI_SRC, extra);
    if (!fs.existsSync(barrel)) continue;
    const text = fs.readFileSync(barrel, 'utf8');
    for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const targetBase = path.join(path.dirname(barrel), match[2]);
      const target = ['ts', 'tsx'].map((ext) => `${targetBase}.${ext}`).find((p) => fs.existsSync(p));
      if (!target) continue;
      for (const specifier of match[1].split(',')) {
        const exported = specifier.trim().split(/\s+as\s+/).pop();
        if (exported && !exports[exported]) {
          exports[exported] = path.relative(REPO_ROOT, target).split(path.sep).join('/');
        }
      }
    }
  }
  for (const name of fs.readdirSync(BLOCKS_DIR).sort()) {
    const dir = path.join(BLOCKS_DIR, name);
    const metaPath = path.join(dir, 'block.json');
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const files = listSourceFiles(dir);
    const source = files.map((file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')).join('\n');
    const imported = [...source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@zui\/react['"]/g)]
      .flatMap((match) => match[1].split(',').map((specifier) => specifier.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]));
    const inferred = imported
      .map((symbol) => exports[symbol])
      .filter(Boolean)
      .filter((file) => file.includes('/components/')) // utils/config 符号由 sharedFiles 覆盖，不进 registryDependencies
      .map((file) => toKebab(file.split('/')[4]));
    items.push({ name, type: 'registry:block', title: name, description: meta.description,
      dependencies: inferNpmDeps(files.map((file) => path.join(REPO_ROOT, file))).filter((dep) => dep !== '@zui/react'),
      registryDependencies: [...new Set([...(meta.dependencies ?? []).map(toKebab), ...inferred])].sort(),
      files, cssVars: {}, meta: path.relative(REPO_ROOT, metaPath).split(path.sep).join('/') });
  }
  const sharedFiles = ['utils', 'config', 'styles'].flatMap((dir) => listSourceFiles(path.join(UI_SRC, dir)));
  const dependencies = inferNpmDeps(sharedFiles.map((file) => path.join(REPO_ROOT, file)));
  const registry = { name: 'zui', homepage: 'https://zui.dev', sharedFiles, dependencies, exports, items };
  return registry;
}

function main() {
  const check = process.argv.includes('--check');
  const registry = generate();
  const json = `${JSON.stringify(registry, null, 2)}\n`;

  if (check) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
    if (current !== json) {
      console.error('registry.json 与组件目录不一致，请运行 node registry/scripts/generate.mjs');
      process.exit(1);
    }
    console.log(`registry.json 已是最新（${registry.items.length} 个组件）`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, json, 'utf8');
  console.log(`已生成 ${path.relative(REPO_ROOT, OUTPUT)}（${registry.items.length} 个组件）`);
}

// 作为脚本运行时执行 main；被 import 时只导出函数（供测试）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
