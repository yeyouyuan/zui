import type { Config, Fields } from '@puckeditor/core';
import type { ComponentProps } from 'react';
import type { BuilderDataSource } from './builder-data-sources';
import {
  SceneAppShell,
  SceneAppView,
  SceneChart,
  SceneDataTable,
  SceneMetric,
  SceneRecordForm,
  SceneRecordList,
} from './builder-scene-runtime';

const sourceField = {
  type: 'select' as const,
  label: '绑定数据源',
  options: [{ label: '请先在数据面板创建', value: '' }],
};
const flag = (label: string) => ({
  type: 'radio' as const,
  label,
  options: [
    { label: '开启', value: true },
    { label: '关闭', value: false },
  ],
});
export const sceneComponents: Config['components'] = {
  AppShell: {
    label: '应用框架',
    fields: {
      brand: { type: 'text', label: '应用名称' },
      subtitle: { type: 'text', label: '空间说明' },
      layout: {
        type: 'select',
        label: '导航布局',
        options: [
          { label: '侧边导航', value: 'sidebar' },
          { label: '顶部导航', value: 'topbar' },
        ],
      },
      navigation: { type: 'textarea', label: '导航（每行：视图标识 | 显示文字）' },
      initialView: { type: 'text', label: '默认视图标识' },
      sidebarWidth: { type: 'number', label: '侧栏宽度', min: 160, max: 320 },
      content: { type: 'slot' },
    },
    defaultProps: {
      brand: 'Forma',
      subtitle: '团队工作空间',
      navigation: 'overview|工作概览\nprojects|项目管理\ncontent|内容中心',
      initialView: 'overview',
      layout: 'sidebar',
      sidebarWidth: 218,
      content: [],
    },
    render: ({ puck, ...props }) => (
      <SceneAppShell
        {...(props as unknown as ComponentProps<typeof SceneAppShell>)}
        editing={puck.isEditing}
      />
    ),
  },
  AppView: {
    label: '应用内容视图',
    fields: {
      value: { type: 'text', label: '对应导航视图标识' },
      title: { type: 'text', label: '视图名称' },
      content: { type: 'slot' },
    },
    defaultProps: { value: 'overview', title: '工作概览', content: [] },
    render: ({ puck, ...props }) => (
      <SceneAppView {...(props as ComponentProps<typeof SceneAppView>)} editing={puck.isEditing} />
    ),
  },
  DataTable: {
    label: '数据管理表格',
    fields: {
      title: { type: 'text', label: '列表标题' },
      source: sourceField,
      columns: { type: 'text', label: '显示字段（用逗号分隔，留空全部）' },
      filterField: { type: 'text', label: '快捷筛选字段' },
      pageSize: { type: 'number', label: '每页记录数', min: 5, max: 100 },
      searchable: flag('搜索'),
      editable: flag('新增、编辑与删除'),
      downloadable: flag('导出筛选结果'),
      density: {
        type: 'select',
        label: '行密度',
        options: [
          { label: '舒适', value: 'comfortable' },
          { label: '紧凑', value: 'compact' },
        ],
      },
    },
    defaultProps: {
      title: '项目列表',
      source: '',
      columns: '',
      filterField: '',
      pageSize: 5,
      searchable: true,
      editable: true,
      downloadable: true,
      density: 'comfortable',
    },
    render: ({ puck, ...props }) => <SceneDataTable {...props} editing={puck.isEditing} />,
  },
  DataMetric: {
    label: '数据统计卡',
    fields: {
      title: { type: 'text', label: '统计名称' },
      source: sourceField,
      operation: {
        type: 'select',
        label: '计算方式',
        options: [
          { label: '记录数量', value: 'count' },
          { label: '字段求和', value: 'sum' },
          { label: '字段平均', value: 'average' },
        ],
      },
      field: { type: 'text', label: '数值字段' },
      filterField: { type: 'text', label: '仅统计此字段等于下方值的记录（可选）' },
      filterValue: { type: 'text', label: '筛选值' },
      prefix: { type: 'text', label: '前缀' },
      suffix: { type: 'text', label: '后缀' },
      caption: { type: 'text', label: '底部说明' },
    },
    defaultProps: {
      title: '总项目数',
      source: '',
      operation: 'count',
      field: '',
      filterField: '',
      filterValue: '',
      prefix: '',
      suffix: '',
      caption: '所有项目的实时汇总',
    },
    render: (props) => <SceneMetric {...(props as ComponentProps<typeof SceneMetric>)} />,
  },
  DataChart: {
    label: '数据图表',
    fields: {
      title: { type: 'text', label: '图表标题' },
      source: sourceField,
      chart: {
        type: 'select',
        label: '图表类型',
        options: [
          { label: '柱状图', value: 'bar' },
          { label: '折线图', value: 'line' },
          { label: '环形图（非负数据）', value: 'donut' },
        ],
      },
      groupField: { type: 'text', label: '按字段分组' },
      operation: {
        type: 'select',
        label: '聚合方式',
        options: [
          { label: '记录计数', value: 'count' },
          { label: '数值求和', value: 'sum' },
        ],
      },
      valueField: { type: 'text', label: '数值字段（求和时使用）' },
      height: { type: 'number', label: '图表高度', min: 180, max: 600 },
    },
    defaultProps: {
      title: '项目状态分布',
      source: '',
      chart: 'bar',
      groupField: '',
      operation: 'count',
      valueField: '',
      height: 240,
    },
    render: (props) => <SceneChart {...(props as ComponentProps<typeof SceneChart>)} />,
  },
  RecordList: {
    label: '数据内容集合',
    fields: {
      title: { type: 'text', label: '集合标题' },
      source: sourceField,
      titleField: { type: 'text', label: '标题字段' },
      descriptionField: { type: 'text', label: '描述字段' },
      badgeField: { type: 'text', label: '状态标签字段' },
      columns: { type: 'number', label: '卡片最大列数', min: 1, max: 6 },
      layout: {
        type: 'select',
        label: '展示方式',
        options: [
          { label: '响应式卡片', value: 'cards' },
          { label: '纵向列表', value: 'list' },
        ],
      },
      searchable: flag('搜索'),
    },
    defaultProps: {
      title: '项目档案',
      source: '',
      titleField: 'name',
      descriptionField: 'description',
      badgeField: 'status',
      columns: 3,
      layout: 'cards',
      searchable: true,
    },
    render: (props) => <SceneRecordList {...(props as ComponentProps<typeof SceneRecordList>)} />,
  },
  RecordForm: {
    label: '数据录入表单',
    fields: {
      title: { type: 'text', label: '表单标题' },
      source: sourceField,
      submitLabel: { type: 'text', label: '提交按钮' },
      successMessage: { type: 'text', label: '保存成功反馈' },
      columns: {
        type: 'select',
        label: '表单布局',
        options: [
          { label: '单列', value: 1 },
          { label: '双列 · 手机自动单列', value: 2 },
        ],
      },
    },
    defaultProps: {
      title: '创建新项目',
      source: '',
      submitLabel: '创建项目',
      successMessage: '项目已创建，可在列表查看。',
      columns: 2,
    },
    render: ({ puck, ...props }) => <SceneRecordForm {...props} editing={puck.isEditing} />,
  },
};
for (const component of Object.values(sceneComponents)) {
  if (!component.fields?.source) continue;
  component.resolveFields = (data, { fields, appState }) => {
    const sources = ((appState.data.root.props as Record<string, unknown>)?.datasets ||
      []) as BuilderDataSource[];
    const source = sources.find((item) => item.id === data.props.source);
    const next: Fields = {
      ...fields,
      source: {
        ...sourceField,
        options: [
          { label: '选择数据源…', value: '' },
          ...sources.map((item) => ({ label: `${item.name} (${item.id})`, value: item.id })),
        ],
      },
    };
    for (const key of [
      'field',
      'filterField',
      'groupField',
      'valueField',
      'titleField',
      'descriptionField',
      'badgeField',
    ]) {
      if (!fields[key]) continue;
      next[key] = {
        type: 'select',
        label: fields[key].label,
        options: [
          { label: '不设置', value: '' },
          ...(source?.fields || [])
            .filter((field) => !['field', 'valueField'].includes(key) || field.type === 'number')
            .map((field) => ({ label: field.label, value: field.key })),
        ],
      };
    }
    return next;
  };
}

// Consumers decorate copies so repeated imports cannot stack design wrappers.
for (const component of Object.values(sceneComponents)) Object.freeze(component);
