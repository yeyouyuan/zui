/**
 * zui init —— 交互式初始化：检测框架、配置组件目标目录、写 .zurc.json
 */

import fs from 'node:fs';
import path from 'node:path';

import type { ZuiConfig } from '../index.js';
import { CONFIG_FILE, DEFAULT_COMPONENTS_DIR, writeConfig } from '../index.js';

export interface InitOptions {
  /** 项目目录（默认 process.cwd()） */
  cwd?: string;
  /** 组件目标目录（提供则跳过该项交互） */
  components?: string;
  /** 框架（提供则跳过检测） */
  framework?: string;
  /** 非交互模式：全部取默认/传入值 */
  yes?: boolean;
  /** 覆盖已有 .zurc.json */
  force?: boolean;
  /** 自定义交互问询（测试可注入；默认 readline/TTY） */
  prompt?: (question: string, defaultValue: string) => Promise<string>;
  log?: (msg: string) => void;
}

export interface InitResult {
  configFile: string;
  config: ZuiConfig;
  detected: { framework: string; language: string };
}

/** 从 package.json 依赖推断框架 */
export function detectFramework(deps: Record<string, string> | undefined): string {
  if (!deps) return 'react';
  if (deps['next']) return 'next';
  if (deps['vite']) return 'vite';
  if (deps['react-scripts']) return 'react-scripts';
  if (deps['@remix-run/react'] || deps['@remix-run/dev']) return 'remix';
  return 'react';
}

function readPackageDeps(cwd: string): Record<string, string> {
  const file = path.join(cwd, 'package.json');
  if (!fs.existsSync(file)) return {};
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...pkg.devDependencies, ...pkg.dependencies };
}

/** 默认问询：TTY 用 readline 交互，否则直接取默认值 */
async function defaultPrompt(
  question: string,
  defaultValue: string,
  yes: boolean
): Promise<string> {
  if (yes || !process.stdin.isTTY) return defaultValue;
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question}（默认 ${defaultValue}）：`);
    return answer.trim() || defaultValue;
  } finally {
    rl.close();
  }
}

/** init 主流程 */
export async function init(options: InitOptions = {}): Promise<InitResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const log = options.log ?? ((msg: string) => console.log(msg));
  const yes = options.yes ?? false;

  // 检测框架与语言
  const detectedFramework = options.framework ?? detectFramework(readPackageDeps(cwd));
  const detectedLanguage = fs.existsSync(path.join(cwd, 'tsconfig.json')) ? 'ts' : 'js';
  log(`检测到框架：${detectedFramework}，语言：${detectedLanguage}`);

  // 交互确认组件目标目录
  const prompt = options.prompt ?? ((q: string, d: string) => defaultPrompt(q, d, yes));
  const components =
    options.components ??
    ((await prompt('组件安装到哪个目录', DEFAULT_COMPONENTS_DIR)) || DEFAULT_COMPONENTS_DIR);

  const config: ZuiConfig = {
    components,
    framework: detectedFramework,
    language: detectedLanguage,
  };

  // 已存在且未 --force：交互确认或跳过
  const configFile = path.join(cwd, CONFIG_FILE);
  if (fs.existsSync(configFile) && !options.force) {
    if (!yes && process.stdin.isTTY) {
      const answer = await prompt(`${CONFIG_FILE} 已存在，覆盖？(yes/no)`, 'no');
      if (answer.trim().toLowerCase() !== 'yes') {
        throw new Error(`${CONFIG_FILE} 已存在（--force 覆盖）`);
      }
    } else {
      throw new Error(`${CONFIG_FILE} 已存在（--force 覆盖）`);
    }
  }

  writeConfig(cwd, config);
  return { configFile, config, detected: { framework: detectedFramework, language: detectedLanguage } };
}
