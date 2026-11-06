import { useState } from 'react';
import { TreeSelect } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const DATA = [
  {
    key: 'rd',
    title: '研发部',
    children: [
      { key: 'fe', title: '前端组' },
      { key: 'be', title: '后端组' },
      { key: 'qa', title: '测试组' },
    ],
  },
  {
    key: 'ops',
    title: '运营部',
    children: [
      { key: 'content', title: '内容组' },
      { key: 'growth', title: '增长组' },
    ],
  },
  { key: 'hr', title: '人力资源部' },
];

const BASIC_CODE = `<TreeSelect
  data={data}
  ariaLabel="选择部门"
  defaultValue={['fe', 'be']}
  onChange={(keys) => console.log(keys)}
/>

// 多选（默认）：勾选框 + Tag 显示，勾选带父子联动
// 点击 Tag × 移除（连带取消祖先收拢）`;

const SINGLE_CODE = `<TreeSelect data={data} multiple={false} placeholder="选择一个部门" />`;

const SIZE_CODE = `<TreeSelect data={data} size="sm" />
<TreeSelect data={data} size="md" />
<TreeSelect data={data} size="lg" />`;

const CONTROL_CODE = `const [value, setValue] = useState(['rd']);

<TreeSelect data={data} value={value} onChange={setValue} />`;

export default function TreeSelectPage(): React.ReactNode {
  usePageTitle('TreeSelect 树选择');
  const [value, setValue] = useState<string[]>(['rd']);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">TreeSelect 树选择</h1>
      <p className="doc-lead">
        触发器多值 Tag 显示 + 弹出 Tree 面板（Popover 模式，外部点击 / Esc
        关闭）。多选模式下勾选带父子联动， 单选模式点击即选中并收起。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="多选（默认）"
        description="勾选框选择多个节点，Tag 展示已选值；点击 Tag 的 × 移除（取消时同步取消祖先勾选收拢）。"
        code={BASIC_CODE}
      >
        <TreeSelect
          data={DATA}
          ariaLabel="选择部门"
          defaultValue={['fe', 'be']}
          onChange={() => undefined}
        />
      </Demo>

      <Demo
        title="单选"
        description="multiple={false} 时面板变为点选模式，选中后自动收起面板并显示纯文本值。"
        code={SINGLE_CODE}
      >
        <TreeSelect data={DATA} multiple={false} placeholder="选择一个部门" />
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档，默认 md。" code={SIZE_CODE}>
        <div className="doc-pg-preview-row">
          <TreeSelect data={DATA} size="sm" />
          <TreeSelect data={DATA} size="md" />
          <TreeSelect data={DATA} size="lg" />
        </div>
      </Demo>

      <Demo title="受控" description="value / onChange 受控用法。" code={CONTROL_CODE}>
        <TreeSelect data={DATA} value={value} onChange={setValue} />
        <p className="doc-p">
          当前值：<code className="doc-code-inline">{JSON.stringify(value)}</code>
        </p>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          { name: 'data', type: 'TreeNode[]', description: '树数据（与 Tree 的 TreeNode 同构）。' },
          {
            name: 'value / defaultValue',
            type: 'string[]',
            defaultValue: '[]',
            description: '选中 key（受控/非受控）。',
          },
          {
            name: 'onChange',
            type: '(keys: string[]) => void',
            description: '选中变更回调（多选输出勾选闭包，树序）。',
          },
          {
            name: 'multiple',
            type: 'boolean',
            defaultValue: 'true',
            description: '多选（勾选框 + Tag）；false 为单选。',
          },
          {
            name: 'placeholder',
            type: 'string',
            defaultValue: "'请选择'",
            description: '占位文案。',
          },
          {
            name: 'ariaLabel',
            type: 'string',
            defaultValue: 'placeholder',
            description: '触发器的稳定无障碍名称，建议按字段用途填写。',
          },
          { name: 'disabled', type: 'boolean', defaultValue: 'false', description: '禁用。' },
          { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: '尺寸。' },
          {
            name: 'classNames',
            type: '{ root?; trigger?; panel?; tags? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        键盘：触发器聚焦后 Enter / Space / ↓ 打开并聚焦首项；↑↓、Home / End 浏览节点，←→
        收起或展开分支，Space / Enter 选择，Esc 关闭并归还焦点。
      </p>

      <CustomizeOutlet
        name="TreeSelect"
        parts={[
          'root',
          'trigger',
          'tags',
          'tag',
          'remove',
          'value',
          'placeholder',
          'panel',
          'node',
          'icon',
          'checkbox',
          'label',
          'empty',
        ]}
        vars={[
          '--z-tree-select-font-size',
          '--z-tree-select-trigger-min-height',
          '--z-tree-select-trigger-padding-x',
          '--z-tree-select-trigger-radius',
          '--z-tree-select-trigger-bg',
          '--z-tree-select-trigger-fg',
          '--z-tree-select-trigger-border',
          '--z-tree-select-placeholder-fg',
          '--z-tree-select-tag-height',
          '--z-tree-select-tag-bg',
          '--z-tree-select-tag-fg',
          '--z-tree-select-tag-radius',
          '--z-tree-select-panel-bg',
          '--z-tree-select-panel-border',
          '--z-tree-select-panel-radius',
          '--z-tree-select-panel-shadow',
          '--z-tree-select-panel-max-height',
          '--z-tree-select-node-hover-bg',
          '--z-tree-select-node-selected-bg',
          '--z-tree-select-checkbox-size',
          '--z-tree-select-checkbox-checked-bg',
          '--z-tree-select-focus-ring',
        ]}
      />
    </div>
  );
}
