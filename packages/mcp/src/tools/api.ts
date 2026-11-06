/**
 * zui_get_component_api —— 组件名 → props 签名 + 用法示例。
 * 读 meta.json（CONTRACTS-V3 §2 结构）+ CONTRACTS-V3 §1 精确契约。
 */

import type { Catalog, CatalogEntry, PropMeta } from './search.js';
import { resolveEntry, suggestComponents } from './search.js';
import { buildExampleCode } from './generate.js';

/* --------------------------------- 类型 --------------------------------- */

export interface ComponentApi {
  ok: true;
  name: string;
  description: string;
  category: string;
  useCase: string[];
  dontUse: string[];
  /** prop → { type, default, desc }（meta.json 的 props 段）。 */
  props: Record<string, PropMeta>;
  a11yNotes: string[];
  related: string[];
  /** props 签名：CONTRACTS-V3 §1 的 ts 片段，其次 llms.txt 小节。 */
  signature?: string;
  /** 用法示例（由 meta 默认值推导的 JSX）。 */
  example: string;
  sources: CatalogEntry['sources'];
}

export interface ApiError {
  ok: false;
  error: string;
  suggestions: string[];
}

/* --------------------------------- 实现 --------------------------------- */

/** 组件名 → 完整 API 视图；未知名组件返回建议。 */
export function getComponentApi(catalog: Catalog, name: string): ComponentApi | ApiError {
  const entry = resolveEntry(catalog, name);
  if (!entry) {
    return {
      ok: false,
      error: `未找到组件 "${name}"。可用组件见 zui_search_components。`,
      suggestions: suggestComponents(catalog, name),
    };
  }
  return toApi(entry);
}

function toApi(entry: CatalogEntry): ComponentApi {
  return {
    ok: true,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    useCase: entry.useCase,
    dontUse: entry.dontUse,
    props: entry.props,
    a11yNotes: entry.a11yNotes,
    related: entry.related,
    signature: entry.contractsSignature ?? entry.llmsSignature,
    example: buildExampleCode(entry),
    sources: entry.sources,
  };
}

/** 渲染为 LLM 友好的 Markdown 文本（MCP content 用）。 */
export function renderApiMarkdown(api: ComponentApi): string {
  const lines: string[] = [`# ${api.name}`, ''];
  if (api.description) lines.push(api.description, '');
  lines.push(`- 分类：${api.category}`);
  if (api.useCase.length > 0) lines.push(`- 适用：${api.useCase.join('、')}`);
  if (api.dontUse.length > 0) lines.push(`- 避免：${api.dontUse.join('；')}`);

  const propNames = Object.keys(api.props);
  if (propNames.length > 0) {
    lines.push('', '## Props', '', '| Prop | Type | Default | 说明 |', '|---|---|---|---|');
    for (const key of propNames) {
      const prop = api.props[key];
      lines.push(
        `| ${key} | ${escapeCell(prop.type)} | ${escapeCell(prop.default ?? '')} | ${escapeCell(prop.desc ?? '')} |`,
      );
    }
  }

  if (api.signature) {
    lines.push('', '## Props 签名', '', '```ts', api.signature, '```');
  }

  lines.push('', '## 用法示例', '', '```tsx', api.example, '```');

  if (api.a11yNotes.length > 0) {
    lines.push('', '## 无障碍');
    for (const note of api.a11yNotes) lines.push(`- ${note}`);
  }
  if (api.related.length > 0) lines.push('', `## 相关组件\n\n${api.related.join('、')}`);

  const sources = [
    api.sources.meta ? 'meta.json' : '',
    api.sources.contracts ? 'CONTRACTS-V3.md' : '',
    api.sources.llms ? 'llms.txt' : '',
  ].filter(Boolean);
  if (sources.length > 0) lines.push('', `> 来源：${sources.join(' + ')}`);

  return lines.join('\n');
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
