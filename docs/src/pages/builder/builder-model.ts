import type { Data as PuckData } from '@puckeditor/core';
import {
  validateCssDeclarations,
  validateDesign,
  validateNodeMeta,
  validateStateDesign,
} from './builder-design';
import {
  bindableProperties,
  validateNodeLogic,
  validateVariables,
  type BuilderVariable,
} from './builder-logic';
import { validateTokens, type BuilderToken } from './builder-tokens';
import { validateInstance, validateSymbols, type BuilderSymbol } from './builder-symbols';
import { catalogDefinitions, validateCatalogJson } from './builder-catalog-data';
import { scenePropSchemas, validateSources, type BuilderDataSource } from './builder-data-sources';

export type BuilderData = PuckData<
  Record<string, Record<string, unknown>>,
  {
    title?: string;
    description?: string;
    theme?: string;
    maxWidth?: number;
    padding?: number;
    contentGap?: number;
    primaryColor?: string;
    background?: string;
    fontFamily?: string;
    customCss?: string;
    visualPreset?: string;
    radius?: number;
    datasets?: BuilderDataSource[];
    dataKey?: string;
    variables?: BuilderVariable[];
    tokens?: BuilderToken[];
  }
>;
type Data = BuilderData;

export const BUILDER_STORAGE_KEY = 'zui-page-builder-v1';
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

export interface BuilderSnapshot {
  id: string;
  savedAt: string;
  data: Data;
}
export interface BuilderPageRecord {
  id: string;
  name: string;
  updatedAt: string;
  data: Data;
  snapshots: BuilderSnapshot[];
}
export interface BuilderWorkspace {
  version: 1;
  revision: string;
  activeId: string;
  pages: BuilderPageRecord[];
  symbols?: BuilderSymbol[];
}

export const componentProps: Record<string, Record<string, string>> = {
  Button: {
    children: 'text',
    variant: 'primary|secondary|outline|ghost|danger',
    size: 'sm|md|lg',
    disabled: 'boolean',
    href: 'link',
    action: 'button|submit|copy|download|message|toggle',
    payload: 'text',
    targetId: 'anchor',
    fileName: 'text',
    newTab: 'boolean',
  },
  Input: {
    label: 'text',
    name: 'text',
    placeholder: 'text',
    size: 'sm|md|lg',
    status: 'default|error|success',
    clearable: 'boolean',
    required: 'boolean',
    type: 'text|email|tel|number|url',
  },
  Card: { title: 'text', children: 'text', hoverable: 'boolean', content: 'slot' },
  Alert: {
    type: 'info|success|warning|error',
    title: 'text',
    children: 'text',
    closable: 'boolean',
  },
  Switch: { label: 'text', name: 'text', size: 'sm|md', defaultChecked: 'boolean' },
  Badge: { count: 'number', dot: 'boolean', children: 'text' },
  Tag: { children: 'text', color: 'primary|success|warning|error|neutral', closable: 'boolean' },
  Divider: { children: 'text', dashed: 'boolean' },
  Progress: { percent: 'percent', status: 'normal|active|success|error' },
  Typography_Text: { children: 'text', strong: 'boolean' },
  Heading: { text: 'text', level: 'h1|h2|h3', align: 'left|center|right' },
  Section: {
    anchor: 'anchor',
    title: 'text',
    tone: 'plain|muted|brand',
    padding: 'spacing',
    content: 'slot',
  },
  Columns: { columns: 'columns', gap: 'spacing', content: 'slot' },
  Image: {
    src: 'image',
    alt: 'text',
    caption: 'text',
    fit: 'cover|contain',
    height: 'imageHeight',
  },
  Form: { title: 'text', successMessage: 'text', content: 'slot' },
  Container: { content: 'slot' },
  Spacer: { height: 'spacing' },
  TextArea: { label: 'text', name: 'text', placeholder: 'text', required: 'boolean', rows: 'rows' },
  Checkbox: { label: 'text', name: 'text', required: 'boolean', defaultChecked: 'boolean' },
  FormSelect: {
    label: 'text',
    name: 'text',
    placeholder: 'text',
    required: 'boolean',
    options: 'text',
  },
};
for (const [type, definition] of Object.entries(catalogDefinitions)) {
  componentProps[type] = Object.fromEntries(
    Object.entries(definition.fields).map(([key, field]) => [
      key,
      field.kind === 'select'
        ? field.options!.join('|')
        : field.kind === 'items' || field.kind === 'rows'
          ? `json:${field.kind}`
          : field.kind === 'number'
            ? `range:${field.min}:${field.max}`
            : field.kind === 'textarea'
              ? 'text'
              : field.kind,
    ])
  );
}
Object.assign(componentProps, scenePropSchemas);
for (const schema of Object.values(componentProps))
  Object.assign(schema, {
    _design: 'design',
    _editor: 'meta',
    _states: 'states',
    _logic: 'logic',
    _instance: 'instance',
  });
const rootProps = {
  title: 'text',
  description: 'text',
  theme: 'light|dark',
  maxWidth: 'width',
  padding: 'spacing',
  contentGap: 'range:0:160',
  primaryColor: 'color',
  background: 'color',
  fontFamily: 'font',
  customCss: 'css',
  visualPreset: 'indigo|ocean|forest|amber|rose|graphite',
  radius: 'range:0:32',
  datasets: 'sources',
  dataKey: 'text',
  variables: 'variables',
  tokens: 'tokens',
};

export function builderId(prefix = 'page'): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

export function safeLink(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = value.trim();
  if (/^#[\w\u4e00-\u9fa5-]*$/.test(text)) return text;
  try {
    const url = new URL(text);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? text : undefined;
  } catch {
    return undefined;
  }
}
export function safeImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}格式不正确。`);
  return value as Record<string, unknown>;
}
function shortText(value: unknown, label: string, max = 10000): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`${label}必须是 ${max} 字以内的文本。`);
  return value;
}

/** 只接收已注册组件与字段；导入失败时原草稿保持完整。 */
export function validateBuilderData(value: unknown, allowIncomplete = false): Data {
  const source = record(value, '页面数据');
  const ids = new Set<string>();
  let total = 0;
  const validateProps = (
    value: unknown,
    schema: Record<string, string>,
    depth: number,
    component?: string
  ): Record<string, unknown> => {
    const props = record(value, '组件属性');
    const clean: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(props)) {
      if (key === 'id' && component) {
        const id = shortText(item, '组件 ID', 150);
        if (!id || ids.has(id)) throw new Error('组件 ID 为空或重复。');
        ids.add(id);
        clean.id = id;
        continue;
      }
      const kind = schema[key];
      if (!Object.hasOwn(schema, key))
        throw new Error(`不支持的${component ?? '页面'}属性：${key}。`);
      if (kind === 'sources') {
        clean[key] = validateSources(item);
      } else if (kind === 'variables') {
        clean[key] = validateVariables(item);
      } else if (kind === 'tokens') {
        clean[key] = validateTokens(item);
      } else if (kind === 'states') {
        clean[key] = validateStateDesign(item);
      } else if (kind === 'logic') {
        clean[key] = validateNodeLogic(item, bindableProperties(schema));
      } else if (kind === 'instance') {
        clean[key] = validateInstance(item);
      } else if (kind === 'css') {
        clean[key] = validateCssDeclarations(item);
      } else if (kind === 'color' || kind === 'font') {
        const text = shortText(item, key, 240);
        if (text && !allowIncomplete)
          validateDesign({ desktop: { [kind === 'color' ? 'color' : 'fontFamily']: text } });
        clean[key] = text;
      } else if (kind === 'json:items' || kind === 'json:rows') {
        clean[key] = validateCatalogJson(item, kind === 'json:items' ? 'items' : 'rows');
      } else if (kind.startsWith('range:')) {
        const [, min, max] = kind.split(':').map(Number);
        if (allowIncomplete && item === null) clean[key] = null;
        else if (
          typeof item !== 'number' ||
          !Number.isFinite(item) ||
          (!allowIncomplete && (item < min || item > max))
        )
          throw new Error(`${key}应在 ${min} 到 ${max} 之间。`);
        else clean[key] = item;
      } else if (kind === 'design') {
        clean[key] = validateDesign(item);
      } else if (kind === 'meta') {
        clean[key] = validateNodeMeta(item);
      } else if (kind === 'slot') {
        clean[key] = validateContent(item, depth + 1, component === 'Form');
      } else if (kind === 'boolean') {
        if (typeof item !== 'boolean') throw new Error(`${key}必须是开关值。`);
        clean[key] = item;
      } else if (
        ['number', 'percent', 'spacing', 'columns', 'width', 'imageHeight', 'rows'].includes(kind)
      ) {
        if (allowIncomplete && item === null) {
          clean[key] = null;
          continue;
        }
        const ranges: Record<string, [number, number]> = {
          number: [0, 1000000],
          percent: [0, 100],
          spacing: [0, 96],
          columns: [1, 4],
          width: [320, 1920],
          imageHeight: [80, 1000],
          rows: [2, 20],
        };
        const [min, max] = ranges[kind];
        if (
          typeof item !== 'number' ||
          !Number.isFinite(item) ||
          (!allowIncomplete &&
            (item < min || item > max || (kind === 'columns' && !Number.isInteger(item))))
        )
          throw new Error(`${key}应在 ${min} 到 ${max} 之间。`);
        clean[key] = item;
      } else {
        const text = shortText(item, key, kind === 'image' ? 2000000 : 10000);
        if (!allowIncomplete && kind === 'link' && text && !safeLink(text))
          throw new Error('链接仅支持 http、https、mailto、tel 或页内锚点。');
        if (!allowIncomplete && kind === 'image' && text && !safeImage(text))
          throw new Error('图片需使用 http/https 地址或 PNG、JPEG、WebP、GIF 数据。');
        if (!allowIncomplete && kind === 'anchor' && text && !/^[\w\u4e00-\u9fa5-]+$/.test(text))
          throw new Error('锚点只允许文字、数字、下划线和短横线。');
        if (kind.includes('|') && !kind.split('|').includes(text))
          throw new Error(`${key}含有不支持的选项。`);
        clean[key] = text;
      }
    }
    if (component && !clean.id) throw new Error('组件缺少 ID。');
    return clean;
  };
  const validateContent = (value: unknown, depth: number, insideForm = false): Data['content'] => {
    if (!Array.isArray(value) || depth > 8)
      throw new Error('页面结构不是组件列表，或嵌套超过 8 层。');
    return value.map((item) => {
      if (++total > 500) throw new Error('单页最多支持 500 个组件。');
      const node = record(item, '组件');
      const type = shortText(node.type, '组件类型', 80);
      if (!Object.hasOwn(componentProps, type)) throw new Error(`未注册的组件：${type}。`);
      if (!allowIncomplete && insideForm && type === 'Form') throw new Error('表单不能嵌套表单。');
      const props = validateProps(node.props, componentProps[type], depth, type);
      // Track a form through intervening layout slots as well.
      if (insideForm && Array.isArray(props.content)) {
        const hasForm = (nodes: Data['content']): boolean =>
          nodes.some(
            (n) => n.type === 'Form' || (Array.isArray(n.props.content) && hasForm(n.props.content))
          );
        if (!allowIncomplete && hasForm(props.content as Data['content']))
          throw new Error('表单不能嵌套表单。');
      }
      return { type, props } as Data['content'][number];
    });
  };
  const root = source.root ? record(source.root, '页面设置') : {};
  const rootValues = root.props ?? root;
  const content = validateContent(source.content, 0);
  // Legacy Puck dropzones are intentionally rejected instead of silently dropping content.
  if (source.zones && Object.keys(record(source.zones, '旧版分区')).length)
    throw new Error('请先将旧版 zones 分区转换为 slot 容器再导入。');
  return { root: { props: validateProps(rootValues, rootProps, 0) }, content };
}

export function createBuilderPage(
  name: string,
  data: Data,
  preserveDataKey = false
): BuilderPageRecord {
  const copy = structuredClone(data);
  if (!preserveDataKey || !copy.root.props?.dataKey)
    copy.root.props = { ...copy.root.props, dataKey: builderId('data') };
  return {
    id: builderId(),
    name: name.trim().slice(0, 80) || '未命名页面',
    updatedAt: new Date().toISOString(),
    data: copy,
    snapshots: [],
  };
}
export function createBuilderWorkspace(data: Data): BuilderWorkspace {
  const page = createBuilderPage('我的第一个页面', data);
  return { version: 1, revision: builderId('revision'), activeId: page.id, pages: [page] };
}

function parsePage(value: unknown): BuilderPageRecord {
  const source = record(value, '页面记录');
  const id = shortText(source.id, '页面 ID', 150);
  if (!id) throw new Error('页面 ID 不能为空。');
  const name = shortText(source.name, '页面名称', 80);
  const updatedAt = shortText(source.updatedAt, '更新时间', 80);
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('更新时间不正确。');
  const snapshots = source.snapshots ?? [];
  if (!Array.isArray(snapshots) || snapshots.length > 5) throw new Error('保存版本格式不正确。');
  return {
    id,
    name,
    updatedAt,
    data: validateBuilderData(source.data, true),
    snapshots: snapshots.map((entry) => {
      const snapshot = record(entry, '保存版本');
      return {
        id: shortText(snapshot.id, '版本 ID', 150),
        savedAt: shortText(snapshot.savedAt, '保存时间', 80),
        data: validateBuilderData(snapshot.data, true),
      };
    }),
  };
}
export function parseBuilderWorkspace(raw: string): BuilderWorkspace {
  const source = record(JSON.parse(raw), '工作区');
  if (
    source.version !== 1 ||
    !Array.isArray(source.pages) ||
    !source.pages.length ||
    source.pages.length > 20
  )
    throw new Error('工作区版本不支持，或页面数量超出 1–20 页。');
  const pages = source.pages.map(parsePage);
  if (new Set(pages.map((page) => page.id)).size !== pages.length)
    throw new Error('工作区包含重复页面。');
  const activeId = shortText(source.activeId, '当前页面', 150);
  if (!pages.some((page) => page.id === activeId)) throw new Error('工作区未找到当前页面。');
  return {
    version: 1,
    revision: shortText(source.revision, '修订号', 150),
    activeId,
    pages,
    ...(source.symbols ? { symbols: validateSymbols(source.symbols) } : {}),
  };
}

export function parseBuilderImport(raw: string): {
  pages: BuilderPageRecord[];
  workspace: boolean;
  symbols?: BuilderSymbol[];
} {
  if (new Blob([raw]).size > MAX_IMPORT_BYTES) throw new Error('导入文件不能超过 32 MB。');
  const value = record(JSON.parse(raw), '导入文件');
  if (value.pages) {
    const workspace = parseBuilderWorkspace(raw);
    return { pages: workspace.pages, symbols: workspace.symbols, workspace: true };
  }
  if (value.format === 'zui-page' && value.version !== 1) throw new Error('不支持此页面文件版本。');
  const data = validateBuilderData(value.format === 'zui-page' ? value.data : value);
  const name =
    value.format === 'zui-page'
      ? shortText(value.name, '页面名称', 80)
      : String(data.root.props?.title || '导入的页面');
  const page = createBuilderPage(name, data, true);
  if (value.format === 'zui-page' && value.pageId !== undefined)
    page.id = shortText(value.pageId, '页面 ID', 150);
  return {
    pages: [page],
    symbols: value.symbols ? validateSymbols(value.symbols) : undefined,
    workspace: false,
  };
}

export function countBuilderComponents(data: Data): number {
  const count = (nodes: Data['content']): number =>
    nodes.reduce(
      (sum, node) => sum + 1 + (Array.isArray(node.props.content) ? count(node.props.content) : 0),
      0
    );
  return count(data.content);
}

export function saveDownload(
  content: string | Blob,
  fileName: string,
  type = 'application/json'
): void {
  const url = URL.createObjectURL(
    typeof content === 'string' ? new Blob([content], { type }) : content
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = Array.from(fileName)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .slice(0, 100);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
