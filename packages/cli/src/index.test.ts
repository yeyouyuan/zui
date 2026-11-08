/**
 * @zui/cli 测试：init / add 的文件复制逻辑（mock 目标目录与 registry）+ diff / list + argv 解析。
 * 环境：node（无 DOM）；临时目录自清理。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { createContext, parseArgs, readConfig, toKebab } from './index.js';
import { add, resolveItems } from './commands/add.js';
import { diff, unifiedDiff } from './commands/diff.js';
import { detectFramework, init } from './commands/init.js';
import { list } from './commands/list.js';

/* --------------------------------- 工具 ---------------------------------- */

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zui-cli-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop() as string;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const silent = () => {};

/** 构造 mock registry：<root>/registry/registry.json + 组件源文件 */
function buildMockRegistry(root: string): string {
  const components = path.join(root, 'packages', 'ui', 'src', 'components');
  fs.mkdirSync(path.join(components, 'Foo'), { recursive: true });
  fs.mkdirSync(path.join(components, 'Bar'), { recursive: true });
  fs.writeFileSync(path.join(components, 'Foo', 'Foo.tsx'), 'export const Foo = 1;\n');
  fs.writeFileSync(path.join(components, 'Foo', 'Foo.css'), '.z-foo { --z-foo-gap: 4px; }\n');
  fs.writeFileSync(path.join(components, 'Bar', 'Bar.tsx'), 'export const Bar = 2;\n');

  const registry = {
    name: 'zui-mock',
    homepage: 'https://zui.dev',
    items: [
      {
        name: 'foo',
        type: 'registry:component',
        title: 'Foo 测试件',
        description: 'mock 组件 foo',
        dependencies: ['lodash'],
        registryDependencies: ['bar'],
        files: ['packages/ui/src/components/Foo/Foo.tsx', 'packages/ui/src/components/Foo/Foo.css'],
        cssVars: { '--z-foo-gap': '4px' },
        meta: 'packages/ui/src/components/Foo/meta.json',
      },
      {
        name: 'bar',
        type: 'registry:component',
        title: 'Bar 测试件',
        description: 'mock 组件 bar',
        dependencies: [],
        registryDependencies: [],
        files: ['packages/ui/src/components/Bar/Bar.tsx'],
        cssVars: {},
        meta: 'packages/ui/src/components/Bar/meta.json',
      },
    ],
  };
  fs.mkdirSync(path.join(root, 'registry'), { recursive: true });
  const registryPath = path.join(root, 'registry', 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  return registryPath;
}

/* -------------------------------- toKebab -------------------------------- */

describe('toKebab', () => {
  it('转换 PascalCase / 空格 / 下划线', () => {
    expect(toKebab('Button')).toBe('button');
    expect(toKebab('DropdownMenu')).toBe('dropdown-menu');
    expect(toKebab('dropdown-menu')).toBe('dropdown-menu');
    expect(toKebab('VirtualTable')).toBe('virtual-table');
  });
});

/* -------------------------------- parseArgs ------------------------------- */

describe('parseArgs', () => {
  it('add 多组件', () => {
    const opts = parseArgs(['add', 'button', 'modal']);
    expect(opts.command).toBe('add');
    expect(opts.names).toEqual(['button', 'modal']);
  });

  it('add --all', () => {
    const opts = parseArgs(['add', '--all']);
    expect(opts.all).toBe(true);
  });

  it('init 选项', () => {
    const opts = parseArgs(['init', '-y', '--force', '-c', 'lib/ui', '--framework', 'next']);
    expect(opts.yes).toBe(true);
    expect(opts.force).toBe(true);
    expect(opts.components).toBe('lib/ui');
    expect(opts.framework).toBe('next');
  });

  it('未知参数抛错', () => {
    expect(() => parseArgs(['add', '--wat'])).toThrow(/未知参数/);
    expect(() => parseArgs(['add', '--components'])).toThrow(/缺少取值/);
  });
});

/* --------------------------------- init ---------------------------------- */

describe('init', () => {
  it('检测框架并写 .zurc.json', async () => {
    const cwd = tmpDir();
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ dependencies: { next: '15.0.0' } })
    );
    fs.writeFileSync(path.join(cwd, 'tsconfig.json'), '{}');

    const result = await init({ cwd, yes: true, log: silent });
    expect(result.detected.framework).toBe('next');
    expect(result.detected.language).toBe('ts');

    const cfg = readConfig(cwd);
    expect(cfg.framework).toBe('next');
    expect(cfg.components).toBe('src/components/ui');
  });

  it('交互 prompt 决定目标目录', async () => {
    const cwd = tmpDir();
    const result = await init({
      cwd,
      log: silent,
      prompt: async () => 'lib/ui',
    });
    expect(result.config.components).toBe('lib/ui');
    expect(readConfig(cwd).components).toBe('lib/ui');
  });

  it('已存在时拒绝覆盖，--force 允许', async () => {
    const cwd = tmpDir();
    await init({ cwd, components: 'a', yes: true, log: silent });
    await expect(init({ cwd, components: 'b', yes: true, log: silent })).rejects.toThrow(/已存在/);
    await init({ cwd, components: 'b', yes: true, force: true, log: silent });
    expect(readConfig(cwd).components).toBe('b');
  });

  it('detectFramework 优先级', () => {
    expect(detectFramework({ next: '1' })).toBe('next');
    expect(detectFramework({ vite: '1' })).toBe('vite');
    expect(detectFramework({ 'react-scripts': '1' })).toBe('react-scripts');
    expect(detectFramework({})).toBe('react');
    expect(detectFramework(undefined)).toBe('react');
  });
});

/* ---------------------------------- add ---------------------------------- */

describe('add', () => {
  it('复制组件文件到目标目录（含 registryDependencies 传递）', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });

    const result = await add({ ctx, names: ['foo'] });
    // foo + 依赖 bar
    expect(result.items.map((i) => i.name)).toEqual(['foo', 'bar']);

    const fooDir = path.join(project, 'src', 'components', 'ui', 'foo');
    const barDir = path.join(project, 'src', 'components', 'ui', 'bar');
    expect(fs.readFileSync(path.join(fooDir, 'Foo.tsx'), 'utf8')).toContain('Foo = 1');
    expect(fs.readFileSync(path.join(fooDir, 'Foo.css'), 'utf8')).toContain('--z-foo-gap');
    expect(fs.existsSync(path.join(barDir, 'Bar.tsx'))).toBe(true);

    expect(result.dependencies).toEqual(['lodash']);
    expect(result.importHint).toContain('Foo');
  });

  it('重复执行：未变化 skipped / 本地改动 updated', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });

    await add({ ctx, names: ['bar'] });
    const again = await add({ ctx, names: ['bar'] });
    expect(again.written[0].status).toBe('skipped');

    const local = path.join(project, 'src', 'components', 'ui', 'bar', 'Bar.tsx');
    fs.writeFileSync(local, '// 本地改动\n');
    const third = await add({ ctx, names: ['bar'] });
    expect(third.written[0].status).toBe('updated');
    // add 覆盖式同步：registry 内容写回本地（diff 命令才是查看本地改动的通道）
    expect(fs.readFileSync(local, 'utf8')).toContain('Bar = 2');
  });

  it('--all 复制全部组件', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });

    const result = await add({ ctx, names: [], all: true });
    expect(result.items.map((i) => i.name)).toEqual(['foo', 'bar']);
    expect(fs.existsSync(path.join(project, 'src', 'components', 'ui', 'foo', 'Foo.tsx'))).toBe(
      true
    );
  });

  it('自定义目标目录（.zurc.json）', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    fs.writeFileSync(path.join(project, '.zurc.json'), JSON.stringify({ components: 'app/ui' }));
    const ctx = createContext({ cwd: project, registryPath, log: silent });
    await add({ ctx, names: ['bar'] });
    expect(fs.existsSync(path.join(project, 'app', 'ui', 'bar', 'Bar.tsx'))).toBe(true);
  });

  it('未知组件抛错并列出可用组件', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });
    await expect(add({ ctx, names: ['nope'] })).rejects.toThrow(/没有组件/);
  });

  it('resolveItems 去重依赖环', () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });
    const items = resolveItems(ctx, ['foo', 'bar', 'foo'], false);
    expect(items.map((i) => i.name)).toEqual(['foo', 'bar']);
  });
});

/* --------------------------------- diff ---------------------------------- */

describe('unifiedDiff', () => {
  it('生成 hunk 与行数', () => {
    const patch = unifiedDiff('a\nb\nc\nd\ne', 'a\nb\nX\nd\ne', 'a/t', 'b/t');
    expect(patch).toContain('--- a/t');
    expect(patch).toContain('+++ b/t');
    expect(patch).toContain('@@ -1,5 +1,5 @@');
    expect(patch).toContain('-c');
    expect(patch).toContain('+X');
    expect(patch).toContain(' d');
  });

  it('新增文件：全部为 + 行', () => {
    const patch = unifiedDiff('', 'x\ny', '/dev/null', 'b/t');
    expect(patch).toContain('@@ -0,0 +1,2 @@');
    expect(patch).toContain('+x');
  });

  it('相同内容为空', () => {
    expect(unifiedDiff('a\nb', 'a\nb', 'a', 'b')).toBe('');
  });
});

describe('diff', () => {
  it('same / changed / missing 三态', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });

    await add({ ctx, names: ['bar'] });
    // 本地改成不同内容
    const local = path.join(project, 'src', 'components', 'ui', 'bar', 'Bar.tsx');
    fs.writeFileSync(local, 'export const Bar = 999;\n');

    const result = await diff({ ctx, names: ['foo', 'bar'] });
    const foo = result.files.find((f) => f.item === 'foo');
    const bar = result.files.find((f) => f.item === 'bar');

    // foo 未 add -> missing
    expect(foo?.state).toBe('missing');
    expect(foo?.patch).toContain('+');
    // bar 改过 -> changed
    expect(bar?.state).toBe('changed');
    expect(bar?.patch).toContain('-export const Bar = 999;');

    // add 后再 diff -> same
    await add({ ctx, names: ['foo', 'bar'] });
    const clean = await diff({ ctx, names: ['foo', 'bar'] });
    expect(clean.files.every((f) => f.state === 'same')).toBe(true);
    expect(clean.files.every((f) => f.patch === '')).toBe(true);
  });
});

/* --------------------------------- list ---------------------------------- */

describe('list', () => {
  it('返回全部组件', async () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath, log: silent });
    const result = await list({ ctx });
    expect(result.items.map((i) => i.name)).toEqual(['foo', 'bar']);
    expect(ctx.findItem('Foo')?.title).toBe('Foo 测试件');
    expect(ctx.findItem('BAR')?.name).toBe('bar');
    expect(ctx.findItem('baz')).toBeUndefined();
  });
});

/* --------------------------- registry 定位与契约 --------------------------- */

describe('registry 定位', () => {
  it('自 cwd 向上发现 registry/registry.json', () => {
    const root = tmpDir();
    const registryPath = buildMockRegistry(root);
    const nested = path.join(root, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    const ctx = createContext({ cwd: nested, log: silent });
    expect(ctx.registryPath).toBe(registryPath);
    expect(ctx.registryRoot).toBe(root);
  });
});

describe('真实 registry 契约校验（71 组件 + 16 业务块）', () => {
  const realRegistry = path.resolve(
    fileURLToPath(new URL('../../../registry/registry.json', import.meta.url))
  );

  it('schema 与字段齐全', () => {
    if (!fs.existsSync(realRegistry)) return; // 生成前跳过
    const registry = JSON.parse(fs.readFileSync(realRegistry, 'utf8')) as {
      name: string;
      homepage: string;
      items: Array<Record<string, unknown>>;
    };
    expect(registry.name).toBe('zui');
    expect(registry.homepage).toBe('https://zui.dev');
    expect(registry.items.filter((item) => item.type === 'registry:component')).toHaveLength(71);
    expect(registry.items.filter((item) => item.type === 'registry:block')).toHaveLength(16);
    for (const item of registry.items) {
      expect(item.name).toMatch(/^[a-z0-9-]+$/);
      expect(['registry:component', 'registry:block']).toContain(item.type);
      expect(typeof item.title).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(Array.isArray(item.dependencies)).toBe(true);
      expect(Array.isArray(item.registryDependencies)).toBe(true);
      expect(Array.isArray(item.files)).toBe(true);
      expect(typeof item.cssVars).toBe('object');
      expect(typeof item.meta).toBe('string');
    }
    const button = registry.items.find((i) => i.name === 'button');
    expect(button).toBeTruthy();
    expect((button as { files: string[] }).files.length).toBeGreaterThanOrEqual(2);
    expect(
      (button as { cssVars: Record<string, string> })['cssVars']['--z-button-height']
    ).toBeTruthy();
  });

  it('add button 端到端（真实 registry）', async () => {
    if (!fs.existsSync(realRegistry)) return;
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath: realRegistry, log: silent });
    const result = await add({ ctx, names: ['Button'] });
    const destDir = path.join(project, 'src', 'components', 'ui', 'button');
    expect(fs.existsSync(path.join(destDir, 'Button.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'Button.css'))).toBe(true);
    expect(result.written.every((w) => w.status === 'created')).toBe(true);

    const d = await diff({ ctx, names: ['button'] });
    expect(d.files.every((f) => f.state === 'same')).toBe(true);
  });

  it('安装业务块时补齐组件、公共源码并转换内联类型及 CSS 路径', async () => {
    const project = tmpDir();
    const ctx = createContext({ cwd: project, registryPath: realRegistry, log: silent });
    const result = await add({ ctx, names: ['form-page'] });
    const local = (file: string) =>
      fs.readFileSync(path.join(project, 'src/components/ui', file), 'utf8');
    expect(local('blocks/form-page/index.tsx')).not.toMatch(/from ['"]@zui\/react['"]/);
    expect(local('blocks/form-page/index.tsx')).toContain("from '../../form'");
    expect(local('form/Form.tsx')).toContain("import('../_zui/config')");
    expect(local('input/Input.css')).toContain("@import '../_zui/styles/tokens.css'");
    expect(local('_zui/utils/floatingPosition.ts')).toContain('floatingPosition');
    expect(result.dependencies).toEqual(
      expect.arrayContaining(['@zui/icons', '@zui/tokens', '@zui/i18n'])
    );
    const d = await diff({ ctx, names: ['form-page'] });
    expect(d.files.every((file) => file.state === 'same')).toBe(true);
  });
});
