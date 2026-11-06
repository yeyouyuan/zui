import { Breadcrumb } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Breadcrumb>
  <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
  <Breadcrumb.Item href="/components">组件</Breadcrumb.Item>
  <Breadcrumb.Item>分页</Breadcrumb.Item>
</Breadcrumb>`;

const SEPARATOR_CODE = `<Breadcrumb separator="›">
  <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
  <Breadcrumb.Item href="/design">设计</Breadcrumb.Item>
  <Breadcrumb.Item>令牌</Breadcrumb.Item>
</Breadcrumb>`;

const CURRENT_CODE = `<Breadcrumb>
  <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
  <Breadcrumb.Item>当前页（无 href 渲染 span）</Breadcrumb.Item>
</Breadcrumb>`;

export default function BreadcrumbPage(): React.ReactNode {
  usePageTitle('Breadcrumb 面包屑');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Breadcrumb 面包屑</h1>
      <p className="doc-lead">
        页面层级导航：ol/li 语义列表，分隔符默认「/」，href 渲染 a 否则 span，最后一项自动标记
        aria-current=&quot;page&quot;。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Breadcrumb.Item 有 href 渲染可点击的 a，末项无 href 渲染 span 并标记为当前页。"
        code={BASIC_CODE}
      >
        <Breadcrumb>
          <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
          <Breadcrumb.Item href="/components">组件</Breadcrumb.Item>
          <Breadcrumb.Item>分页</Breadcrumb.Item>
        </Breadcrumb>
      </Demo>

      <Demo
        title="自定义分隔符"
        description="separator 可传任意节点覆盖默认「/」，渲染在 z-breadcrumb-separator 插槽（aria-hidden）。"
        code={SEPARATOR_CODE}
      >
        <Breadcrumb separator="›">
          <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
          <Breadcrumb.Item href="/design">设计</Breadcrumb.Item>
          <Breadcrumb.Item>令牌</Breadcrumb.Item>
        </Breadcrumb>
      </Demo>

      <Demo
        title="当前页"
        description="最后一项自动附加 aria-current=&quot;page&quot;，hover 字色变 primary，当前页保持主字色。"
        code={CURRENT_CODE}
      >
        <Breadcrumb>
          <Breadcrumb.Item href="/">首页</Breadcrumb.Item>
          <Breadcrumb.Item>当前页（无 href 渲染 span）</Breadcrumb.Item>
        </Breadcrumb>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Breadcrumb</h3>
      <ApiTable
        rows={[
          {
            name: 'separator',
            type: 'React.ReactNode',
            defaultValue: "'/'",
            description: '分隔符内容（aria-hidden）。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: 'Breadcrumb.Item 列表。',
          },
          {
            name: 'classNames',
            type: '{ root?; item?; separator? }',
            description: 'slot 级类名追加（root / item / separator）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'nav'>",
            description: '原生 nav 属性透传到根元素。',
          },
        ]}
      />
      <h3 className="doc-h3">Breadcrumb.Item</h3>
      <ApiTable
        rows={[
          {
            name: 'href',
            type: 'string',
            description: '有 href 渲染 <a>，否则渲染 <span>。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '项内容。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'a'>",
            description: '原生 a 属性透传（ref 支持 a / span 两种形态）。',
          },
        ]}
      />
      <p className="doc-p">
        语义：容器 <code className="doc-code-inline">nav[role=&quot;navigation&quot;]</code>，aria-label
        「面包屑」，内部 <code className="doc-code-inline">ol/li</code>；最后一项自动
        <code className="doc-code-inline">aria-current=&quot;page&quot;</code>。
      </p>

      <CustomizeOutlet
        name="Breadcrumb"
        parts={['root', 'item', 'separator']}
        vars={[
          '--z-breadcrumb-font-size',
          '--z-breadcrumb-fg',
          '--z-breadcrumb-hover-fg',
          '--z-breadcrumb-current-fg',
          '--z-breadcrumb-current-font-weight',
          '--z-breadcrumb-separator-fg',
          '--z-breadcrumb-separator-margin-x',
          '--z-breadcrumb-focus-ring',
          '--z-breadcrumb-transition',
        ]}
      />
    </div>
  );
}
