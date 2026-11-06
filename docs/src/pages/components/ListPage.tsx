import { List } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const ITEMS = [
  { key: '1', title: '设计令牌发布', description: 'v0.3 语义令牌全量上线，覆盖色板 / 间距 / 字阶。' },
  { key: '2', title: '无障碍走查', description: '键盘导航与 ARIA 属性矩阵扩展至 51+ 组件。' },
  { key: '3', title: '虚拟滚动优化', description: '万行级表格仅渲染可视区窗口行。' },
];

const BASIC_CODE = `<List
  items={[
    { key: '1', title: '标题一', description: '描述一' },
    { key: '2', title: '标题二', description: '描述二', extra: <Button size="sm">查看</Button> },
    { key: '3', title: '标题三', avatar: <Avatar>头</Avatar> },
  ]}
  header="最近动态"
  footer="共 3 条"
/>`;

const VARIANT_CODE = `<List items={items} bordered={false} />
<List items={items} size="sm" />`;

const LOADING_CODE = `<List items={items} loading />`;

export default function ListPage(): React.ReactNode {
  usePageTitle('List 列表');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">List 列表</h1>
      <p className="doc-lead">
        通用列表：ul/li 语义结构，支持头像 / 标题 / 描述 / 右侧 extra，以及边框、尺寸与加载态。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="items 驱动；header / footer 放置列表头尾，extra 放置右侧操作。"
        code={BASIC_CODE}
        stack
      >
        <List
          items={[
            { key: '1', title: '设计令牌发布', description: 'v0.3 语义令牌全量上线，覆盖色板 / 间距 / 字阶。' },
            {
              key: '2',
              title: '无障碍走查',
              description: '键盘导航与 ARIA 属性矩阵扩展至 51+ 组件。',
              extra: <button type="button">查看</button>,
            },
            {
              key: '3',
              title: '虚拟滚动优化',
              description: '万行级表格仅渲染可视区窗口行。',
              avatar: <span aria-hidden="true">头</span>,
            },
          ]}
          header="最近动态"
          footer="共 3 条"
        />
      </Demo>

      <Demo
        title="边框与尺寸"
        description="bordered 默认 true（外框 + 头尾分隔）；size 提供 sm / md 两档，影响行距、字号与头像尺寸。"
        code={VARIANT_CODE}
        stack
      >
        <List items={ITEMS} bordered={false} />
        <List items={ITEMS} size="sm" />
      </Demo>

      <Demo
        title="加载态"
        description="loading 以 spinner 块替代列表体，根元素带 aria-busy 与 role=status 提示。"
        code={LOADING_CODE}
        stack
      >
        <List items={ITEMS} loading />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          { name: 'items', type: 'Array<{ key; title; description?; extra?; avatar? }>', description: '列表项数据。' },
          { name: 'header', type: 'React.ReactNode', description: '列表头。' },
          { name: 'footer', type: 'React.ReactNode', description: '列表尾。' },
          { name: 'bordered', type: 'boolean', defaultValue: 'true', description: '外框 + 头尾分隔。' },
          { name: 'size', type: "'sm' | 'md'", defaultValue: "'md'", description: '尺寸（行距/字号/头像）。' },
          { name: 'loading', type: 'boolean', defaultValue: 'false', description: '加载态：spinner 块替代列表体，根 aria-busy。' },
          { name: 'classNames', type: '{ root?; item?; meta?; extra? }', description: 'slot 级类名追加。' },
        ]}
      />

      <CustomizeOutlet
        name="List"
        parts={['root', 'header', 'body', 'item', 'avatar', 'meta', 'title', 'description', 'extra', 'footer', 'loading']}
        vars={[
          '--z-list-font-size',
          '--z-list-fg',
          '--z-list-bg',
          '--z-list-border',
          '--z-list-radius',
          '--z-list-item-padding-x',
          '--z-list-item-padding-y',
          '--z-list-item-gap',
          '--z-list-item-hover-bg',
          '--z-list-item-border',
          '--z-list-title-font-weight',
          '--z-list-title-fg',
          '--z-list-description-fg',
          '--z-list-avatar-size',
          '--z-list-header-bg',
          '--z-list-header-fg',
          '--z-list-loading-padding',
          '--z-list-spinner-size',
          '--z-list-spinner-color',
        ]}
      />
    </div>
  );
}
