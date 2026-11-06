import { Descriptions } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Descriptions title="用户信息">
  <Descriptions.Item label="姓名">张三</Descriptions.Item>
  <Descriptions.Item label="年龄">28</Descriptions.Item>
  <Descriptions.Item label="城市">上海</Descriptions.Item>
</Descriptions>`;

const COLUMN_CODE = `<Descriptions title="订单信息" column={2}>
  <Descriptions.Item label="订单号">NO.20261105-001</Descriptions.Item>
  <Descriptions.Item label="状态">已发货</Descriptions.Item>
  <Descriptions.Item label="备注" span={2}>节假日配送请提前联系收件人。</Descriptions.Item>
</Descriptions>`;

const BORDERED_CODE = `<Descriptions title="服务器配置" bordered size="sm">
  <Descriptions.Item label="CPU">8 核</Descriptions.Item>
  <Descriptions.Item label="内存">32 GB</Descriptions.Item>
  <Descriptions.Item label="磁盘">1 TB SSD</Descriptions.Item>
  <Descriptions.Item label="带宽">100 Mbps</Descriptions.Item>
</Descriptions>`;

export default function DescriptionsPage(): React.ReactNode {
  usePageTitle('Descriptions 描述列表');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Descriptions 描述列表</h1>
      <p className="doc-lead">
        dl/dt/dd
        语义的键值对展示组件：每行列数、跨列、尺寸与表格边框，适合详情页字段、只读态与属性面板。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Descriptions.Item 提供 label 与 children，自动渲染为 dt/dd 语义结构。"
        code={BASIC_CODE}
      >
        <Descriptions title="用户信息">
          <Descriptions.Item label="姓名">张三</Descriptions.Item>
          <Descriptions.Item label="年龄">28</Descriptions.Item>
          <Descriptions.Item label="城市">上海</Descriptions.Item>
        </Descriptions>
      </Demo>

      <Demo
        title="列数与跨列"
        description="column 控制宽屏每行列数（默认 3）；480px 以下自动单列。Item 的 span 控制宽屏跨列数，超出 column 时自动收敛。"
        code={COLUMN_CODE}
        stack
      >
        <Descriptions title="订单信息" column={2}>
          <Descriptions.Item label="订单号">NO.20261105-001</Descriptions.Item>
          <Descriptions.Item label="状态">已发货</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            节假日配送请提前联系收件人。
          </Descriptions.Item>
        </Descriptions>
      </Demo>

      <Demo
        title="边框与尺寸"
        description="bordered 开启表格风格单元格边框（label 浅底）；size 支持 sm / md。"
        code={BORDERED_CODE}
        stack
      >
        <Descriptions title="服务器配置" bordered size="sm">
          <Descriptions.Item label="CPU">8 核</Descriptions.Item>
          <Descriptions.Item label="内存">32 GB</Descriptions.Item>
          <Descriptions.Item label="磁盘">1 TB SSD</Descriptions.Item>
          <Descriptions.Item label="带宽">100 Mbps</Descriptions.Item>
        </Descriptions>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '列表标题。',
          },
          {
            name: 'column',
            type: 'number',
            defaultValue: '3',
            description: '宽屏每行列数；480px 以下自动单列。',
          },
          {
            name: 'size',
            type: "'sm' | 'md'",
            defaultValue: "'md'",
            description: '尺寸（字号/内边距）。',
          },
          {
            name: 'bordered',
            type: 'boolean',
            defaultValue: 'false',
            description: '表格风格单元格边框。',
          },
          {
            name: 'Descriptions.Item.label',
            type: 'React.ReactNode',
            description: '字段标签（dt）。',
          },
          {
            name: 'Descriptions.Item.span',
            type: 'number',
            defaultValue: '1',
            description: '占据列数（自动收敛到 column）。',
          },
          {
            name: 'classNames',
            type: '{ root?; title?; body?; item?; label?; content? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-size</code>、
        <code className="doc-code-inline">data-bordered</code>；Item 带{' '}
        <code className="doc-code-inline">data-span</code>。
      </p>

      <CustomizeOutlet
        name="Descriptions"
        parts={['root', 'title', 'body', 'item', 'label', 'content']}
        vars={[
          '--z-descriptions-font-size',
          '--z-descriptions-fg',
          '--z-descriptions-font-family',
          '--z-descriptions-title-font-size',
          '--z-descriptions-title-font-weight',
          '--z-descriptions-title-fg',
          '--z-descriptions-title-margin-bottom',
          '--z-descriptions-row-gap',
          '--z-descriptions-column-gap',
          '--z-descriptions-item-padding-x',
          '--z-descriptions-item-padding-y',
          '--z-descriptions-item-gap',
          '--z-descriptions-label-fg',
          '--z-descriptions-label-min-width',
          '--z-descriptions-label-bg',
          '--z-descriptions-content-fg',
          '--z-descriptions-border',
          '--z-descriptions-border-width',
        ]}
      />
    </div>
  );
}
