import { Cascader } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const OPTIONS = [
  {
    value: 'zhejiang',
    label: '浙江',
    children: [
      {
        value: 'hangzhou',
        label: '杭州',
        children: [
          { value: 'xihu', label: '西湖' },
          { value: 'binjiang', label: '滨江' },
        ],
      },
      { value: 'ningbo', label: '宁波' },
    ],
  },
  {
    value: 'jiangsu',
    label: '江苏',
    children: [{ value: 'nanjing', label: '南京' }],
  },
  { value: 'beijing', label: '北京' },
];

const BASIC_CODE = `const options = [
  {
    value: 'zhejiang',
    label: '浙江',
    children: [
      {
        value: 'hangzhou',
        label: '杭州',
        children: [
          { value: 'xihu', label: '西湖' },
          { value: 'binjiang', label: '滨江' },
        ],
      },
      { value: 'ningbo', label: '宁波' },
    ],
  },
  { value: 'jiangsu', label: '江苏', children: [{ value: 'nanjing', label: '南京' }] },
  { value: 'beijing', label: '北京' },
];

<Cascader options={options} placeholder="请选择地区" />`;

const VALUE_CODE = `<Cascader options={options} defaultValue={['zhejiang', 'hangzhou', 'xihu']} />
<Cascader options={options} defaultValue={['beijing']} size="lg" />`;

const SEARCH_CODE = `<Cascader options={options} showSearch placeholder="搜索：试试「西湖」" />`;

export default function CascaderPage(): React.ReactNode {
  usePageTitle('Cascader 级联选择');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Cascader 级联选择</h1>
      <p className="doc-lead">
        多列菜单逐级展开：hover 或选中当前项展开下一列，最终值为从根到叶的路径
        （string[]）。支持 ←→ 切列、↑↓ 列内移动、Enter 选中，以及全路径搜索。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="点击触发器打开菜单；点击有子级的项展开下一列，点击叶子项选中完整路径并关闭。"
        code={BASIC_CODE}
        stack
      >
        <Cascader options={OPTIONS} placeholder="请选择地区" />
      </Demo>

      <Demo
        title="默认值与尺寸"
        description="value / defaultValue 是从根到叶的路径数组，触发器以「/」连接各段标签。"
        code={VALUE_CODE}
        stack
      >
        <Cascader options={OPTIONS} defaultValue={['zhejiang', 'hangzhou', 'xihu']} />
        <Cascader options={OPTIONS} defaultValue={['beijing']} size="lg" />
      </Demo>

      <Demo
        title="搜索"
        description="showSearch 在面板顶部提供搜索框，扁平化匹配全路径（label 与 value 均可命中），Enter 直接选中。"
        code={SEARCH_CODE}
        stack
      >
        <Cascader options={OPTIONS} showSearch placeholder="搜索：试试「西湖」" />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'options',
            type: 'CascaderOption[]',
            description: '选项树：{ value; label; children?; disabled? }。',
          },
          {
            name: 'value',
            type: 'string[]',
            description: '选中路径（受控）。',
          },
          {
            name: 'defaultValue',
            type: 'string[]',
            description: '非受控初始路径。',
          },
          {
            name: 'onChange',
            type: '(path: string[]) => void',
            description: '选中路径变化回调。',
          },
          {
            name: 'placeholder',
            type: 'string',
            defaultValue: "'请选择'",
            description: '占位文案。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'showSearch',
            type: 'boolean',
            defaultValue: 'false',
            description: '搜索模式：扁平化匹配全路径。',
          },
          {
            name: 'classNames',
            type: '{ root?; trigger?; panel?; menu?; item? }',
            description: 'slot 级类名追加（root / trigger / panel / menu / item）。',
          },
        ]}
      />
      <p className="doc-p">
        键盘（打开后焦点在面板）：<code className="doc-code-inline">←→</code> 切换列、
        <code className="doc-code-inline">↑↓</code> 列内移动、<code className="doc-code-inline">Enter</code>{' '}
        展开或选中、<code className="doc-code-inline">Esc</code> 关闭并归还焦点到触发器。
      </p>

      <CustomizeOutlet
        name="Cascader"
        parts={['root', 'trigger', 'panel', 'menu', 'item']}
        vars={[
          '--z-cascader-trigger-height',
          '--z-cascader-trigger-padding-x',
          '--z-cascader-trigger-font-size',
          '--z-cascader-trigger-bg',
          '--z-cascader-trigger-fg',
          '--z-cascader-trigger-border',
          '--z-cascader-placeholder-fg',
          '--z-cascader-panel-bg',
          '--z-cascader-panel-border',
          '--z-cascader-panel-radius',
          '--z-cascader-panel-shadow',
          '--z-cascader-menu-width',
          '--z-cascader-item-height',
          '--z-cascader-item-padding-x',
          '--z-cascader-item-fg',
          '--z-cascader-item-hover-bg',
          '--z-cascader-item-active-bg',
          '--z-cascader-item-active-fg',
          '--z-cascader-item-disabled-fg',
        ]}
      />
    </div>
  );
}
