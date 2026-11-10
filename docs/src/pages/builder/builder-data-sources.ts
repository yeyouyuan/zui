export type DataValue = string | number | boolean | null;
export type DataRow = Record<string, DataValue>;
export interface DataColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'date' | 'select';
  required?: boolean;
  options?: string[];
}
export interface BuilderDataSource {
  id: string;
  name: string;
  mode: 'local' | 'rest';
  endpoint: string;
  path: string;
  fields: DataColumn[];
  rows: DataRow[];
}
const keyPattern = /^[a-zA-Z][\w-]{0,59}$/;
const forbidden = new Set(['__proto__', 'constructor', 'prototype', '_id']);
export const isDataKey = (key: string) => keyPattern.test(key) && !forbidden.has(key);
export function validateSources(value: unknown): BuilderDataSource[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('每页最多支持 12 个数据源。');
  const ids = new Set<string>();
  return value.map((input) => {
    const source = input as BuilderDataSource;
    if (!source || !isDataKey(source.id) || ids.has(source.id))
      throw new Error('数据源 ID 必须唯一，以英文字母开头，只含字母、数字、横线与下划线。');
    ids.add(source.id);
    if (typeof source.name !== 'string' || source.name.length > 80)
      throw new Error('数据源名称最多 80 字。');
    if (!['local', 'rest'].includes(source.mode)) throw new Error('数据源类型不正确。');
    if (typeof source.endpoint !== 'string' || source.endpoint.length > 2000)
      throw new Error('API 地址过长。');
    if (source.endpoint && !/^https?:\/\/[^<>\s"\\]+$/.test(source.endpoint))
      throw new Error('API 仅支持 HTTP / HTTPS 地址。');
    if (typeof source.path !== 'string' || !/^(?:[\w-]+(?:\.[\w-]+)*)?$/.test(source.path))
      throw new Error('结果路径请用 data.items 这样的点分隔字段。');
    if (!Array.isArray(source.fields) || !source.fields.length || source.fields.length > 20)
      throw new Error('数据源需有 1–20 个字段。');
    const keys = new Set<string>();
    const fields = source.fields.map((field) => {
      if (!field || !isDataKey(field.key) || keys.has(field.key))
        throw new Error('字段名必须唯一，且以英文字母开头。');
      keys.add(field.key);
      if (typeof field.label !== 'string' || field.label.length > 100)
        throw new Error('字段显示名称过长。');
      if (!['text', 'number', 'email', 'date', 'select'].includes(field.type))
        throw new Error('字段类型不支持。');
      if (field.required !== undefined && typeof field.required !== 'boolean')
        throw new Error('字段必填设置不正确。');
      if (
        field.options !== undefined &&
        (!Array.isArray(field.options) ||
          field.options.length > 50 ||
          field.options.some((s) => typeof s !== 'string' || s.length > 100))
      )
        throw new Error('每个选项字段最多 50 个文本选项。');
      return {
        key: field.key,
        label: field.label,
        type: field.type,
        required: !!field.required,
        ...(field.options ? { options: field.options } : {}),
      };
    });
    return {
      id: source.id,
      name: source.name,
      mode: source.mode,
      endpoint: source.endpoint,
      path: source.path,
      fields,
      rows: normalizeRows(source.rows, fields),
    };
  });
}
export function normalizeRows(value: unknown, fields: DataColumn[]): DataRow[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new Error('数据需为数组，最多 1000 条记录。');
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error('每条记录需为对象。');
    const input = item as Record<string, unknown>;
    const id =
      typeof input._id === 'string' && input._id.length <= 100 ? input._id : `row-${index + 1}`;
    if (ids.has(id)) throw new Error('记录 _id 不能重复。');
    ids.add(id);
    const row: DataRow = { _id: id };
    for (const field of fields) {
      const entry = input[field.key] ?? null;
      if (!['string', 'number', 'boolean'].includes(typeof entry) && entry !== null)
        throw new Error(`字段 ${field.key} 需要文本、数字或布尔值。`);
      if (
        (typeof entry === 'string' && entry.length > 10000) ||
        (typeof entry === 'number' && !Number.isFinite(entry))
      )
        throw new Error(`字段 ${field.key} 的值无效。`);
      if (field.type === 'number' && entry !== null && entry !== '') {
        if (
          (typeof entry !== 'number' && typeof entry !== 'string') ||
          !Number.isFinite(Number(entry))
        )
          throw new Error(`数值字段 ${field.label} 含有非数字。`);
        row[field.key] = Number(entry);
      } else row[field.key] = entry as DataValue;
    }
    return row;
  });
}
export function parseApiRows(value: unknown, source: BuilderDataSource): DataRow[] {
  let result = value;
  for (const key of source.path.split('.').filter(Boolean)) {
    if (forbidden.has(key) || !result || typeof result !== 'object' || !Object.hasOwn(result, key))
      throw new Error(`找不到结果路径 ${source.path}。`);
    result = (result as Record<string, unknown>)[key];
  }
  return normalizeRows(result, source.fields);
}

export const demoProjectSource: BuilderDataSource = {
  id: 'projects',
  name: '项目台账 · 示例数据',
  mode: 'local',
  endpoint: '',
  path: '',
  fields: [
    { key: 'name', label: '项目名称', type: 'text', required: true },
    { key: 'owner', label: '负责人', type: 'text', required: true },
    {
      key: 'status',
      label: '项目状态',
      type: 'select',
      options: ['进行中', '待启动', '已完成'],
      required: true,
    },
    { key: 'budget', label: '预算', type: 'number', required: true },
    { key: 'due', label: '交付日期', type: 'date', required: true },
    { key: 'description', label: '项目说明', type: 'text' },
  ],
  rows: [
    ['品牌体验升级', '林知夏', '进行中', 68000, '2026-12-12', '统一品牌网站与核心产品的视觉体验。'],
    [
      '客户服务门户',
      '周予安',
      '进行中',
      92000,
      '2026-12-20',
      '让客户可以自助查询进度与提交服务需求。',
    ],
    [
      '移动端数据看板',
      '陈一诺',
      '待启动',
      42000,
      '2027-01-08',
      '为外勤团队提供随时可访问的数据概览。',
    ],
    ['协作文档中心', '沈亦舟', '已完成', 56000, '2026-11-02', '将项目文档和交付记录集中管理。'],
    ['会员运营平台', '林知夏', '进行中', 78000, '2026-12-28', '优化会员触达、活动与客户关系管理。'],
    ['年度设计系统', '陈一诺', '已完成', 36000, '2026-10-22', '沉淀可复用的组件与品牌规范。'],
    ['销售流程改造', '周予安', '待启动', 64000, '2027-01-16', '打通线索到合同的工作流。'],
    ['知识库迁移', '沈亦舟', '进行中', 28000, '2026-12-06', '整理知识条目并升级检索体验。'],
  ].map(
    ([name, owner, status, budget, due, description], index) =>
      ({ _id: `project-${index + 1}`, name, owner, status, budget, due, description }) as DataRow
  ),
};

export const scenePropSchemas: Record<string, Record<string, string>> = {
  AppShell: {
    brand: 'text',
    subtitle: 'text',
    navigation: 'text',
    initialView: 'text',
    layout: 'sidebar|topbar',
    sidebarWidth: 'range:160:320',
    content: 'slot',
  },
  AppView: { value: 'text', title: 'text', content: 'slot' },
  DataTable: {
    title: 'text',
    source: 'text',
    columns: 'text',
    filterField: 'text',
    pageSize: 'range:5:100',
    editable: 'boolean',
    searchable: 'boolean',
    downloadable: 'boolean',
    density: 'comfortable|compact',
  },
  DataMetric: {
    title: 'text',
    source: 'text',
    operation: 'count|sum|average',
    field: 'text',
    filterField: 'text',
    filterValue: 'text',
    prefix: 'text',
    suffix: 'text',
    caption: 'text',
  },
  DataChart: {
    title: 'text',
    source: 'text',
    chart: 'bar|line|donut',
    groupField: 'text',
    valueField: 'text',
    operation: 'count|sum',
    height: 'range:180:600',
  },
  RecordList: {
    title: 'text',
    source: 'text',
    titleField: 'text',
    descriptionField: 'text',
    badgeField: 'text',
    columns: 'range:1:6',
    layout: 'cards|list',
    searchable: 'boolean',
  },
  RecordForm: {
    title: 'text',
    source: 'text',
    submitLabel: 'text',
    successMessage: 'text',
    columns: 'range:1:2',
  },
};
