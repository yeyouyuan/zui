/**
 * zui_generate_code —— 组件名 + props → 可用 JSX 代码片段。
 */

import type { Catalog, CatalogEntry } from './search.js';
import { resolveEntry, suggestComponents } from './search.js';

/* --------------------------------- 类型 --------------------------------- */

export interface GenerateResult {
  ok: true;
  /** 解析后的规范组件名。 */
  name: string;
  /** 完整可用片段：import + Example 组件。 */
  code: string;
  /** 未在 meta.json 中登记的 props 提示（仅当 meta 存在时给出）。 */
  warnings: string[];
}

export interface GenerateError {
  ok: false;
  error: string;
  suggestions: string[];
}

/* ------------------------------ JSX 值格式化 ------------------------------ */

const SIMPLE_STRING = /^[^"'<>&{}\n]*$/;

/** 常见透传 props：meta 未登记也不告警。 */
const PASSTHROUGH_PROPS = /^(className|style|id|title|ref|key|children|dangerouslySetInnerHTML)$|^(aria|data)-/;

/** 把单个 prop 值格式化为 JSX 属性片段（含前导空格）；null/undefined 省略，false 保留。 */
export function formatAttribute(name: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (value === false) return ` ${name}={false}`;
  if (value === true) return ` ${name}`;
  if (typeof value === 'number') return ` ${name}={${value}}`;
  if (typeof value === 'string') {
    // "{表达式}" 形式 → 原样输出为 JSX 表达式（如 "{() => alert('hi')}"）。
    if (value.length >= 2 && value.startsWith('{') && value.endsWith('}')) {
      return ` ${name}=${value}`;
    }
    if (SIMPLE_STRING.test(value)) return ` ${name}="${value}"`;
    return ` ${name}={${JSON.stringify(value)}}`;
  }
  // 对象/数组 → JSON 作为对象/数组字面量，如 style={{"color":"red"}}。
  return ` ${name}={${JSON.stringify(value)}}`;
}

function formatOpenTag(name: string, props: Record<string, unknown>): string {
  let tag = `<${name}`;
  for (const [key, value] of Object.entries(props)) {
    tag += formatAttribute(key, value);
  }
  return `${tag}`;
}

/* -------------------------------- 生成 -------------------------------- */

/**
 * 生成可用 JSX 代码片段（import + 带示例的组件函数）。
 * 未知名组件返回 GenerateError（含相近建议）。
 */
export function generateCode(
  catalog: Catalog,
  component: string,
  props: Record<string, unknown> = {},
  children?: string,
): GenerateResult | GenerateError {
  const entry = resolveEntry(catalog, component);
  if (!entry) {
    return {
      ok: false,
      error: `未找到组件 "${component}"。可用组件见 zui_search_components。`,
      suggestions: suggestComponents(catalog, component),
    };
  }

  const warnings: string[] = [];
  if (entry.sources.meta && entry.props) {
    for (const key of Object.keys(props)) {
      if (PASSTHROUGH_PROPS.test(key)) continue;
      if (!(key in entry.props)) {
        warnings.push(`props.${key} 不在 ${entry.name} 的 meta.json props 中，请确认拼写`);
      }
    }
  }

  const example = exampleFor(entry.name);
  const jsx = renderJsx(example.tag ?? entry.name, { ...example.props, ...props }, children ?? example.children);
  const imports = example.imports ?? entry.name;
  const helper = example.helper ?? '';
  const code = `import { ${imports} } from '@zui/react';\nimport '@zui/react/styles.css';\n\n${helper}export function ${entry.name}Example() {\n  return (\n    ${indent(jsx, 4)}\n  );\n}\n`;

  return { ok: true, name: entry.name, code, warnings };
}

/** 渲染 `<Name ...>children</Name>` 或 `<Name ... />`。 */
function renderJsx(name: string, props: Record<string, unknown>, children?: string): string {
  const open = formatOpenTag(name, props);
  if (children === undefined || children === '') return `${open} />`;
  if (children.includes('\n')) {
    const body = children
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `${open}>\n${body}\n</${name}>`;
  }
  return `${open}>${children}</${name}>`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line === '' ? line : pad + line))
    .join('\n')
    .trimStart();
}

/* --------------------------- 用法示例（供 api 用） --------------------------- */

/** 解析 meta.json 中的默认值字面量：`'primary'` / `true` / `42`。 */
export function parseDefaultLiteral(raw: string): string | number | boolean | undefined {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const quoted = /^'([^']*)'$/.exec(s) ?? /^"([^"]*)"$/.exec(s);
  if (quoted) return quoted[1];
  return undefined;
}

/** 由 meta.json 的 props 默认值构造一段可运行的用法示例。 */
export function buildExampleCode(entry: CatalogEntry): string {
  const example = exampleFor(entry.name);
  return renderJsx(example.tag ?? entry.name, example.props ?? {}, example.children);
}

interface Example {
  tag?: string;
  props?: Record<string, unknown>;
  children?: string;
  imports?: string;
  helper?: string;
}

/** Required props and compound children come from the public component API. */
function exampleFor(name: string): Example {
  const examples: Record<string, Example> = {
    Button: { children: 'Submit' },
    Input: { props: { placeholder: 'Enter text', 'aria-label': 'Name' } },
    Checkbox: { props: { label: 'Remember me' } },
    Radio: { props: { value: 'a', label: 'Option A' } },
    Switch: { props: { label: 'Enable notifications' } },
    Select: { props: { options: [{ value: 'a', label: 'Option A' }], 'aria-label': 'Choose option' } },
    Modal: { children: '<Modal.Trigger>Open</Modal.Trigger>\n<Modal.Content><Modal.Title>Title</Modal.Title><Modal.Body>Content</Modal.Body><Modal.Close /></Modal.Content>' },
    Drawer: { children: '<Drawer.Trigger>Open</Drawer.Trigger>\n<Drawer.Content><Drawer.Title>Title</Drawer.Title><Drawer.Body>Content</Drawer.Body><Drawer.Close /></Drawer.Content>' },
    Tabs: { props: { defaultValue: 'a' }, children: '<Tabs.List aria-label="Sections"><Tabs.Trigger value="a">Overview</Tabs.Trigger></Tabs.List>\n<Tabs.Panel value="a">Content</Tabs.Panel>' },
    Table: { children: '<Table.Head><Table.Row><Table.HeaderCell>Name</Table.HeaderCell></Table.Row></Table.Head>\n<Table.Body><Table.Row><Table.Cell>Alice</Table.Cell></Table.Row></Table.Body>' },
    Tooltip: { props: { content: 'Help' }, children: '<button type="button">Help</button>' },
    Popover: { children: '<Popover.Trigger>Open</Popover.Trigger>\n<Popover.Content aria-label="Details">Content</Popover.Content>' },
    DropdownMenu: { children: '<DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>\n<DropdownMenu.Content><DropdownMenu.Item onSelect={() => {}}>Edit</DropdownMenu.Item></DropdownMenu.Content>' },
    Alert: { props: { title: 'Information' }, children: 'Details' },
    Badge: { props: { count: 3 }, children: '<span>Messages</span>' },
    Tag: { children: 'Active' },
    Pagination: { props: { total: 100 } },
    Breadcrumb: { children: '<Breadcrumb.Item href="/">Home</Breadcrumb.Item><Breadcrumb.Item>Current</Breadcrumb.Item>' },
    Avatar: { props: { alt: 'Alice' }, children: 'A' },
    Card: { props: { title: 'Title' }, children: 'Content' },
    Divider: {}, Empty: {}, Skeleton: {}, Spin: {}, Progress: { props: { percent: 60 } },
    Form: { imports: 'Form, Input, Button', children: '<Form.Item name="name" label="Name" required><Input /></Form.Item>\n<Button type="submit">Submit</Button>' },
    Slider: { props: { defaultValue: 30, 'aria-label': 'Volume' } },
    Rate: { props: { defaultValue: 3, 'aria-label': 'Rating' } },
    InputNumber: { props: { defaultValue: 1, 'aria-label': 'Quantity' } },
    ColorPicker: { props: { defaultValue: '#6366f1' } }, DatePicker: {}, Calendar: {},
    Descriptions: { children: '<Descriptions.Item label="Name">Alice</Descriptions.Item>' },
    Statistic: { props: { title: 'Visitors', value: 12345 } },
    Timeline: { props: { items: [{ key: 'a', children: 'Created' }] } },
    VirtualTable: { props: { height: 320, columns: [{ key: 'name', title: 'Name' }], data: [{ name: 'Alice' }] } },
    Tree: { props: { data: [{ key: 'a', title: 'Root' }] } },
    TreeSelect: { props: { data: [{ key: 'a', title: 'Option A' }] } },
    Collapse: { props: { items: [{ key: 'a', label: 'Title', children: 'Content' }] } },
    List: { props: { items: [{ key: 'a', title: 'Alice', description: 'Designer' }] } },
    Transfer: { props: { dataSource: [{ key: 'a', title: 'Option A' }] } },
    Cascader: { props: { options: [{ value: 'a', label: 'Option A' }] } }, TimePicker: {},
    Mentions: { props: { options: [{ value: 'alice', label: 'Alice' }], 'aria-label': 'Message' } },
    Popconfirm: { props: { title: 'Continue?' }, children: '<button type="button">Continue</button>' },
    Image: { props: { src: '/image.png', alt: 'Landscape' } },
    Tour: { props: { steps: [{ title: 'Welcome', target: '#tour-target' }] } },
    Segmented: { props: { options: [{ value: 'a', label: 'Overview' }] } },
    QRCode: { props: { value: 'https://example.com' } },
    Watermark: { props: { content: 'Confidential' }, children: '<div style={{ height: 240 }}>Content</div>' },
    Affix: { children: '<button type="button">Pinned action</button>' }, BackTop: {},
    FloatButton: { props: { 'aria-label': 'Help' } }, Result: { props: { status: 'success' } },
    App: { children: '<div>Application content</div>' },
    Upload: { props: { customRequest: '{({ file, onSuccess }) => { setTimeout(() => onSuccess(), 600); }}' } },
    Steps: { props: { items: [{ title: 'Fill in information' }, { title: 'Confirm order' }, { title: 'Payment' }] } },
    DateRangePicker: {},
    Anchor: { children: '<Anchor.Link href="#intro" title="Introduction" />' },
    // Typography 根是纯命名空间（Title/Paragraph/Text），不能直接作 JSX 标签
    Typography: { tag: 'Typography.Text', props: { strong: true }, children: 'Content' },
  };
  if (name === 'Message' || name === 'Notification') {
    const hook = `use${name}`;
    const message = name === 'Message' ? "'Saved'" : "{ title: 'Saved' }";
    return { tag: `${name}Provider`, imports: `${name}Provider, ${hook}`,
      children: '<FeedbackAction />', helper: `function FeedbackAction() {\n  const api = ${hook}();\n  return <button type="button" onClick={() => api.success(${message})}>Show feedback</button>;\n}\n\n` };
  }
  return examples[name] ?? {};
}
