/** Registry 源路径到本地路径的唯一映射；add 与 diff 共用同一转换。 */
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx, RegistryItem } from './index.js';

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

export function localSourcePath(cwd: string, directory: string, item: RegistryItem, file: string): string {
  const component = /^packages\/ui\/src\/components\/([^/]+)\/(.+)$/.exec(file);
  const shared = /^packages\/ui\/src\/(utils|config|styles)\/(.+)$/.exec(file);
  const block = /^packages\/blocks\/src\/([^/]+)\/(.+)$/.exec(file);
  const relative = component ? path.join(kebab(component[1]), component[2])
    : shared ? path.join('_zui', shared[1], shared[2])
    : block ? path.join('blocks', block[1], block[2])
    : path.join(item.name, path.basename(file));
  return path.resolve(cwd, directory, relative);
}

export function itemFiles(ctx: Ctx, item: RegistryItem): string[] {
  return [...new Set([...item.files, ...(ctx.registry.sharedFiles ?? [])])];
}

export function readSource(ctx: Ctx, item: RegistryItem, file: string): string {
  const src = path.resolve(ctx.registryRoot, file);
  if (!src.startsWith(`${path.resolve(ctx.registryRoot)}${path.sep}`)) {
    throw new Error(`registry 文件超出根目录：${file}`);
  }
  let text = fs.readFileSync(src, 'utf8');
  const dest = ctx.localPathFor(item, file);
  const relativeImport = (target: string) => {
    let result = path.relative(path.dirname(dest), ctx.localPathFor(item, target)).split(path.sep).join('/');
    result = result.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');
    return result.startsWith('.') ? result : `./${result}`;
  };
  const sources = new Set([...(ctx.registry.sharedFiles ?? []), ...ctx.allItems().flatMap((entry) => entry.files)]);
  const resolveRelative = (specifier: string) => {
    if (!specifier.startsWith('.')) return specifier;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
      .find((candidate) => sources.has(candidate));
    return target ? relativeImport(target) : specifier;
  };

  // 业务块使用本地安装的组件（包含 TableBody / FormInstance 等子导出）。
  text = text.replace(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+(['"])@zui\/react\3\s*;?/g,
    (_match, typeOnly: string | undefined, symbols: string) => symbols.split(',').map((symbol) => {
      const specifier = symbol.trim();
      if (!specifier) return '';
      const name = specifier.replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      const target = ctx.registry.exports?.[name];
      if (!target) throw new Error(`registry 没有 ${name} 的本地导出映射`);
      return `import ${typeOnly ?? ''}{ ${specifier} } from '${relativeImport(target)}';`;
    }).filter(Boolean).join('\n'));
  text = text.replace(/((?:from\s+|import\s*)['"])([^'"]+)(['"])/g,
    (_match, prefix: string, specifier: string, suffix: string) => `${prefix}${resolveRelative(specifier)}${suffix}`);
  text = text.replace(/(import\(\s*['"])([^'"]+)(['"]\s*\))/g,
    (_match, prefix: string, specifier: string, suffix: string) => `${prefix}${resolveRelative(specifier)}${suffix}`);

  if (file.endsWith('.css') && file.includes('/components/') && ctx.registry.sharedFiles?.length) {
    const styles = ['tokens', 'reset'].map((name) => `packages/ui/src/styles/${name}.css`)
      .filter((target) => sources.has(target));
    text = styles.map((target) => `@import '${relativeImport(target)}';\n`).join('') + text;
  }
  return text;
}
