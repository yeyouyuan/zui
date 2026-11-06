import { useState } from 'react';
import { Collapse } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const ITEMS = [
  { key: 'a', label: 'ZUI 是什么？', children: <p>ZUI 是令牌驱动、无障碍优先的现代 React 组件库。</p> },
  { key: 'b', label: '支持受控/非受控吗？', children: <p>全部状态型组件遵循 value / defaultValue / onChange 受控范式。</p> },
  { key: 'c', label: '如何定制样式？', children: <p>data-part + classNames + 组件级 CSS 变量三件套，不依赖内部类名。</p> },
  { key: 'd', label: '禁用项（不可展开）', children: <p>不会被渲染到。</p>, disabled: true },
];

const BASIC_CODE = `<Collapse
  items={[
    { key: 'a', label: '标题一', children: <p>内容一</p> },
    { key: 'b', label: '标题二', children: <p>内容二</p> },
    { key: 'c', label: '标题三', children: <p>内容三</p>, disabled: true },
  ]}
  defaultValue={['a']}
  onChange={(keys) => console.log(keys)}
/>`;

const ACCORDION_CODE = `<Collapse items={items} accordion defaultValue={['a']} />`;

const CONTROL_CODE = `const [value, setValue] = useState(['b']);

<Collapse items={items} value={value} onChange={setValue} />`;

export default function CollapsePage(): React.ReactNode {
  usePageTitle('Collapse 折叠面板');
  const [value, setValue] = useState<string[]>(['b']);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Collapse 折叠面板</h1>
      <p className="doc-lead">
        分组内容的收纳展示：items 驱动、手风琴单开模式、展开高度动画（CSS grid-template-rows 过渡）。
        header 聚焦后原生 Enter / Space 激活。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="默认可同时展开多个面板；disabled 项不可展开（aria-disabled）。展开收起带高度过渡动画。"
        code={BASIC_CODE}
        stack
      >
        <Collapse items={ITEMS} defaultValue={['a']} onChange={() => undefined} />
      </Demo>

      <Demo
        title="手风琴"
        description="accordion 开启单开模式：展开新面板自动收起当前面板；点开合面板则全部收起。"
        code={ACCORDION_CODE}
        stack
      >
        <Collapse items={ITEMS} accordion defaultValue={['a']} />
      </Demo>

      <Demo title="受控" description="value / onChange 受控用法。" code={CONTROL_CODE} stack>
        <Collapse items={ITEMS} value={value} onChange={setValue} />
        <p className="doc-p">
          当前展开：<code className="doc-code-inline">{JSON.stringify(value)}</code>
        </p>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          { name: 'items', type: 'Array<{ key; label; children; disabled? }>', description: '面板项数据。' },
          { name: 'value / defaultValue', type: 'string[]', defaultValue: '[]', description: '展开 key（受控/非受控）。' },
          { name: 'onChange', type: '(keys: string[]) => void', description: '展开变更回调（手风琴模式最多 1 个 key）。' },
          { name: 'accordion', type: 'boolean', defaultValue: 'false', description: '手风琴单开模式。' },
          { name: 'classNames', type: '{ root?; item?; header?; content? }', description: 'slot 级类名追加。' },
        ]}
      />
      <p className="doc-p">
        无障碍：header 为原生 button（role=button）+ <code className="doc-code-inline">aria-expanded</code> +{' '}
        <code className="doc-code-inline">aria-controls</code> 关联面板；面板 <code className="doc-code-inline">role="region"</code>{' '}
        + <code className="doc-code-inline">aria-labelledby</code> 回指 header。
      </p>

      <CustomizeOutlet
        name="Collapse"
        parts={['root', 'item', 'header', 'content', 'content-inner']}
        vars={[
          '--z-collapse-font-size',
          '--z-collapse-fg',
          '--z-collapse-border',
          '--z-collapse-radius',
          '--z-collapse-header-bg',
          '--z-collapse-header-hover-bg',
          '--z-collapse-header-padding-x',
          '--z-collapse-header-padding-y',
          '--z-collapse-header-font-weight',
          '--z-collapse-header-disabled-fg',
          '--z-collapse-content-bg',
          '--z-collapse-content-padding-x',
          '--z-collapse-content-padding-y',
          '--z-collapse-arrow-color',
          '--z-collapse-focus-ring',
          '--z-collapse-animation-duration',
        ]}
      />
    </div>
  );
}
