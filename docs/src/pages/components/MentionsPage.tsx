import { Mentions } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const OPTIONS = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

const BASIC_CODE = `const options = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

<Mentions
  options={options}
  rows={4}
  placeholder="说点什么，输入 @ 提及成员…"
/>`;

const PREFIX_CODE = `<Mentions
  options={[
    { value: 'urgent', label: '加急' },
    { value: 'bug', label: '缺陷' },
    { value: 'design', label: '设计' },
  ]}
  prefix="#"
  placeholder="输入 # 打标签…"
/>`;

export default function MentionsPage(): React.ReactNode {
  usePageTitle('Mentions 提及');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Mentions 提及</h1>
      <p className="doc-lead">
        在文本域中输入触发前缀（默认 @）唤起建议下拉，选项随查询词过滤；
        ↑↓ 移动、Enter/Tab 插入、Esc 关闭。适合评论区 @ 成员、# 打标签等场景。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="在空白或行首输入 @ 触发建议；查询词实时过滤（label 与 value 均可命中），插入后自动补一个空格。"
        code={BASIC_CODE}
        stack
      >
        <Mentions options={OPTIONS} rows={4} placeholder="说点什么，输入 @ 提及成员…" />
      </Demo>

      <Demo
        title="自定义前缀"
        description="prefix 改变触发字符，例如用 # 引用标签；触发要求前缀位于行首或空白之后。"
        code={PREFIX_CODE}
        stack
      >
        <Mentions
          options={[
            { value: 'urgent', label: '加急' },
            { value: 'bug', label: '缺陷' },
            { value: 'design', label: '设计' },
          ]}
          prefix="#"
          placeholder="输入 # 打标签…"
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'options',
            type: 'Array<{ value: string; label?: React.ReactNode }>',
            description: '可提及的选项。',
          },
          {
            name: 'value',
            type: 'string',
            description: '受控文本。',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: '非受控初始文本。',
          },
          {
            name: 'onChange',
            type: '(v: string) => void',
            description: '文本变化回调。',
          },
          {
            name: 'prefix',
            type: 'string',
            defaultValue: "'@'",
            description: '触发前缀（前需空白或行首）。',
          },
          {
            name: 'rows',
            type: 'number',
            defaultValue: '3',
            description: 'textarea 行数。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用。',
          },
          {
            name: 'placeholder',
            type: 'string',
            description: '占位文案。',
          },
          {
            name: 'classNames',
            type: '{ root?; textarea?; panel?; item? }',
            description: 'slot 级类名追加（root / textarea / panel / item）。',
          },
        ]}
      />
      <p className="doc-p">
        无障碍：textarea 携带 <code className="doc-code-inline">aria-expanded</code> /{' '}
        <code className="doc-code-inline">aria-controls</code> /{' '}
        <code className="doc-code-inline">aria-activedescendant</code> 联动建议面板；面板{' '}
        <code className="doc-code-inline">role=&quot;listbox&quot;</code>，项{' '}
        <code className="doc-code-inline">role=&quot;option&quot;</code>。
      </p>

      <CustomizeOutlet
        name="Mentions"
        parts={['root', 'textarea', 'panel', 'item']}
        vars={[
          '--z-mentions-font-size',
          '--z-mentions-textarea-padding-x',
          '--z-mentions-textarea-padding-y',
          '--z-mentions-textarea-radius',
          '--z-mentions-textarea-bg',
          '--z-mentions-textarea-fg',
          '--z-mentions-textarea-border',
          '--z-mentions-panel-bg',
          '--z-mentions-panel-border',
          '--z-mentions-panel-radius',
          '--z-mentions-panel-shadow',
          '--z-mentions-panel-max-height',
          '--z-mentions-item-height',
          '--z-mentions-item-padding-x',
          '--z-mentions-item-fg',
          '--z-mentions-item-hover-bg',
          '--z-mentions-item-active-bg',
          '--z-mentions-item-active-fg',
        ]}
      />
    </div>
  );
}
