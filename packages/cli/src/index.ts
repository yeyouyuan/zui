#!/usr/bin/env node
/**
 * @zui/cli —— ZUI registry 命令行入口（registry 组）
 *
 * 命令（契约 §3）：
 *   zui init                交互式初始化：检测框架、配置组件目标目录、写 .zurc.json
 *   zui add <组件...>        从 registry 复制组件源码到目标目录（支持多组件 / --all）
 *   zui diff <组件...>       本地副本 vs registry 的 unified diff
 *   zui list                列出 registry 所有组件
 *
 * 零运行时依赖：纯 process.argv 解析。
 * registry 定位顺序：--registry 参数 > ZUI_REGISTRY 环境变量 > .zurc.json 的 registry
 *   > 自 cwd 向上找 registry/registry.json > 自 CLI 包位置向上找（monorepo 开发态）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { localSourcePath } from './source.js';

import { add as addCommand } from './commands/add.js';
import { diff as diffCommand } from './commands/diff.js';
import { init as initCommand } from './commands/init.js';
import { list as listCommand } from './commands/list.js';

/* ---------------------------------- 类型 ---------------------------------- */

/** registry.json 单个条目（契约 §3 schema） */
export interface RegistryItem {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies: string[];
  registryDependencies: string[];
  files: string[];
  cssVars: Record<string, string>;
  meta: string;
}

/** registry.json 根结构 */
export interface Registry {
  name: string;
  homepage?: string;
  items: RegistryItem[];
  sharedFiles?: string[];
  dependencies?: string[];
  exports?: Record<string, string>;
}

/** .zurc.json 项目配置 */
export interface ZuiConfig {
  /** 组件复制目标目录（相对 cwd 或绝对路径） */
  components: string;
  /** 检测到的框架：next / vite / react-scripts / remix / react */
  framework?: string;
  /** ts / js */
  language?: string;
  /** 自定义 registry.json 路径（相对 cwd 或绝对路径） */
  registry?: string;
}

/** 命令执行上下文：配置 + registry + 定位工具 */
export interface Ctx {
  cwd: string;
  config: ZuiConfig;
  registry: Registry;
  /** registry.json 绝对路径 */
  registryPath: string;
  /** registry files[] 的相对根目录 */
  registryRoot: string;
  log: (msg: string) => void;
  /** 按名称找组件（接受 Button / button / dropdown-menu 等写法） */
  findItem: (name: string) => RegistryItem | undefined;
  allItems: () => RegistryItem[];
  /** 组件文件复制到本地的目标绝对路径 */
  localPathFor: (item: RegistryItem, file: string) => string;
}

export const CONFIG_FILE = '.zurc.json';
export const DEFAULT_COMPONENTS_DIR = 'src/components/ui';

/* -------------------------------- 基础工具 -------------------------------- */

/** Button / dropdown-menu / DropdownMenu -> dropdown-menu */
export function toKebab(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/* ------------------------------ registry 定位 ------------------------------ */

function resolveRegistryFile(cwd: string, explicit?: string): string {
  const candidates: Array<string | undefined> = [];
  if (explicit) candidates.push(path.resolve(cwd, explicit));
  if (process.env['ZUI_REGISTRY']) candidates.push(path.resolve(cwd, process.env['ZUI_REGISTRY']));

  // .zurc.json 的 registry 字段
  const configFile = path.join(cwd, CONFIG_FILE);
  if (fs.existsSync(configFile)) {
    const cfg = readJson<Partial<ZuiConfig>>(configFile);
    if (cfg.registry) candidates.push(path.resolve(cwd, cfg.registry));
  }

  for (const c of candidates) {
    if (!c) continue;
    const file = fs.existsSync(c) && fs.statSync(c).isDirectory() ? path.join(c, 'registry.json') : c;
    if (fs.existsSync(file)) return file;
  }

  // 自 cwd 向上找 registry/registry.json
  let dir = path.resolve(cwd);
  for (;;) {
    const file = path.join(dir, 'registry', 'registry.json');
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const bundled = fileURLToPath(new URL('../data/registry/registry.json', import.meta.url));
  if (fs.existsSync(bundled)) return bundled;

  // 自 CLI 包位置向上找（monorepo 开发态：node packages/cli/dist/index.js 直接运行）
  dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const file = path.join(dir, 'registry', 'registry.json');
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `找不到 registry.json（依次尝试 --registry / $ZUI_REGISTRY / ${CONFIG_FILE} / 向上查找）。` +
      `用 --registry <path> 指定，或在仓库根目录运行。`
  );
}

/** registry.json 里 files[] 的相对根：<root>/registry/registry.json -> <root> */
export function registryRootOf(registryPath: string): string {
  const dir = path.dirname(registryPath);
  return path.basename(dir) === 'registry' ? path.dirname(dir) : dir;
}

/* -------------------------------- 配置读写 -------------------------------- */

/** 读取 .zurc.json（缺失返回默认值） */
export function readConfig(cwd: string): ZuiConfig {
  const file = path.join(cwd, CONFIG_FILE);
  const defaults: ZuiConfig = { components: DEFAULT_COMPONENTS_DIR };
  if (!fs.existsSync(file)) return defaults;
  const cfg = readJson<Partial<ZuiConfig>>(file);
  return { ...defaults, ...cfg, components: cfg.components ?? DEFAULT_COMPONENTS_DIR };
}

/** 写 .zurc.json */
export function writeConfig(cwd: string, config: ZuiConfig): string {
  const file = path.join(cwd, CONFIG_FILE);
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return file;
}

/* ------------------------------- Context 构建 ------------------------------- */

export function createContext(options: {
  cwd?: string;
  registryPath?: string;
  log?: (msg: string) => void;
}): Ctx {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const config = readConfig(cwd);
  const registryPath = resolveRegistryFile(cwd, options.registryPath ?? config.registry);
  const registry = readJson<Registry>(registryPath);
  const registryRoot = registryRootOf(registryPath);
  const log = options.log ?? ((msg: string) => console.log(msg));

  return {
    cwd,
    config,
    registry,
    registryPath,
    registryRoot,
    log,
    findItem: (name: string) => {
      const key = toKebab(name);
      return registry.items.find((i) => i.name === key);
    },
    allItems: () => registry.items,
    localPathFor: (item: RegistryItem, file: string) =>
      localSourcePath(cwd, config.components, item, file),
  };
}

/* --------------------------------- 参数解析 -------------------------------- */

export interface CliOptions {
  command: string;
  names: string[];
  all: boolean;
  yes: boolean;
  force: boolean;
  json: boolean;
  components?: string;
  framework?: string;
  registry?: string;
  cwd?: string;
}

const VALUE_FLAGS = new Set(['--components', '-c', '--framework', '--registry', '--cwd']);

/** 纯 process.argv 解析（不引第三方依赖） */
export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    command: '',
    names: [],
    all: false,
    yes: false,
    force: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[++i];
      if (value === undefined) throw new Error(`参数 ${arg} 缺少取值`);
      if (arg === '--components' || arg === '-c') opts.components = value;
      else if (arg === '--framework') opts.framework = value;
      else if (arg === '--registry') opts.registry = value;
      else opts.cwd = value;
      continue;
    }
    switch (arg) {
      case '--all':
        opts.all = true;
        break;
      case '--yes':
      case '-y':
        opts.yes = true;
        break;
      case '--force':
      case '-f':
        opts.force = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--help':
      case '-h':
        opts.command = 'help';
        break;
      case '--version':
      case '-v':
        opts.command = 'version';
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`未知参数：${arg}（--help 查看用法）`);
        if (!opts.command) opts.command = arg;
        else opts.names.push(arg);
    }
  }

  if (!opts.command) opts.command = 'help';
  return opts;
}

/* ---------------------------------- 用法 ---------------------------------- */

export const USAGE = `zui —— ZUI registry CLI

用法：
  zui init [选项]             初始化：检测框架、配置目标目录、写 ${CONFIG_FILE}
  zui add <组件...>           复制组件源码到目标目录（如 zui add button modal）
  zui add --all               复制 registry 全部组件
  zui diff <组件...>          显示本地副本 vs registry 的 unified diff
  zui list                    列出 registry 所有组件

选项：
  -c, --components <dir>      组件目标目录（默认 ${DEFAULT_COMPONENTS_DIR}）
      --framework <name>      指定框架（init 跳过检测：next/vite/react-scripts/remix/react）
      --registry <path>       指定 registry.json 路径（默认自动定位）
      --cwd <dir>             指定项目目录（默认当前目录）
      --json                  list 以 JSON 输出
  -y, --yes                   非交互，全部默认
  -f, --force                 init 覆盖已有 ${CONFIG_FILE}
  -h, --help                  显示帮助
  -v, --version               显示版本
`;

function packageVersion(): string {
  try {
    const pkg = readJson<{ version?: string }>(
      fileURLToPath(new URL('../package.json', import.meta.url))
    );
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/* ---------------------------------- 入口 ---------------------------------- */

/** CLI 主流程：解析参数并分发到各命令（出错打印信息并置 exitCode） */
export async function run(argv: string[]): Promise<void> {
  try {
    const opts = parseArgs(argv);
    const log = (msg: string) => console.log(msg);

    switch (opts.command) {
      case 'init': {
        const result = await initCommand({
          cwd: path.resolve(opts.cwd ?? process.cwd()),
          components: opts.components,
          framework: opts.framework,
          yes: opts.yes,
          force: opts.force,
          log,
        });
        log(`已写入 ${result.configFile}`);
        log(`  框架：${result.config.framework ?? 'unknown'}   组件目录：${result.config.components}`);
        break;
      }
      case 'add': {
        if (!opts.all && opts.names.length === 0) {
          throw new Error('add 需要组件名（zui add button modal）或 --all');
        }
        const ctx = createContext({ cwd: opts.cwd, registryPath: opts.registry, log });
        const result = await addCommand({ ctx, names: opts.names, all: opts.all });
        if (result.written.length === 0) log('没有需要复制的文件');
        for (const w of result.written) {
          const rel = path.relative(ctx.cwd, w.dest).split(path.sep).join('/');
          log(`  ${w.status.padEnd(7)} ${rel}`);
        }
        if (result.importHint) log(`import 提示：${result.importHint}`);
        if (result.dependencies.length > 0) {
          log(`需要安装依赖：pnpm add ${result.dependencies.join(' ')}`);
        } else {
          log('无需额外 npm 依赖（仅 react / react-dom peer 依赖）');
        }
        for (const w of result.warnings) log(`  提醒：${w}`);
        break;
      }
      case 'diff': {
        if (opts.names.length === 0) throw new Error('diff 需要组件名（zui diff button）');
        const ctx = createContext({ cwd: opts.cwd, registryPath: opts.registry, log });
        const result = await diffCommand({ ctx, names: opts.names });
        for (const file of result.files) {
          log(file.patch === '' ? `${file.label}：无差异` : file.patch);
        }
        const changed = result.files.filter((f) => f.state === 'changed').length;
        log(`diff 完成：${result.files.length} 个文件，${changed} 个有差异`);
        break;
      }
      case 'list': {
        const ctx = createContext({ cwd: opts.cwd, registryPath: opts.registry, log });
        const result = await listCommand({ ctx });
        if (opts.json) {
          log(JSON.stringify(ctx.registry, null, 2));
        } else {
          log(`registry：${ctx.registry.name}（${result.items.length} 个组件）`);
          for (const it of result.items) {
            log(`  ${it.name.padEnd(16)} ${it.title.padEnd(24)} ${it.description}`);
          }
        }
        break;
      }
      case 'version':
        log(packageVersion());
        break;
      case 'help':
      default:
        log(USAGE);
    }
  } catch (e) {
    console.error(`zui: ${(e instanceof Error ? e.message : String(e))}`);
    process.exitCode = 1;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void run(process.argv.slice(2));
}
