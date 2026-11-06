import { useState } from 'react';
import { Input } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Input placeholder="请输入用户名" />
<Input prefix="搜索" placeholder="带前置内容" />
<Input suffix="@zui.dev" placeholder="带后置内容" />`;

const CLEAR_CODE = `const [value, setValue] = useState('');

<Input
  clearable
  value={value}
  onChange={(e) => setValue(e.target.value)}
  onClear={() => setValue('')}
  placeholder="有值时显示清除按钮"
/>`;

const STATUS_CODE = `<Input status="default" placeholder="默认状态" />
<Input status="error" defaultValue="格式不正确" />
<Input status="success" defaultValue="校验通过" />`;

const SIZE_CODE = `<Input size="sm" placeholder="小尺寸" />
<Input size="md" placeholder="中尺寸（默认）" />
<Input size="lg" placeholder="大尺寸" />
<Input disabled placeholder="禁用" />`;

export default function InputPage(): React.ReactNode {
  usePageTitle('Input 输入框');
  const [value, setValue] = useState('');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Input 输入框</h1>
      <p className="doc-lead">
        文本输入基础组件：支持前后缀插槽、可清除按钮、三态校验反馈与三档尺寸，原生 input 属性全量透传。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础与前后缀" description="prefix / suffix 插槽放置图标或单位文本。" code={BASIC_CODE} stack>
        <Input placeholder="请输入用户名" />
        <Input prefix={<span aria-hidden="true">🔍</span>} placeholder="带前置内容" />
        <Input suffix="@zui.dev" placeholder="带后置内容" />
      </Demo>

      <Demo
        title="可清除"
        description="clearable 在有值时显示清除按钮（aria-label=清除），点击后聚焦输入框并触发 onClear。"
        code={CLEAR_CODE}
      >
        <Input
          clearable
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onClear={() => setValue('')}
          placeholder="有值时显示清除按钮"
          style={{ width: 260 }}
        />
      </Demo>

      <Demo title="校验状态" description="status 通过根元素 data-status 暴露，错误态描边与文字颜色由语义令牌驱动。" code={STATUS_CODE} stack>
        <Input status="default" placeholder="默认状态" />
        <Input status="error" defaultValue="格式不正确" />
        <Input status="success" defaultValue="校验通过" />
      </Demo>

      <Demo title="尺寸与禁用" description="size 三档；禁用走原生 disabled。" code={SIZE_CODE} stack>
        <Input size="sm" placeholder="小尺寸" />
        <Input size="md" placeholder="中尺寸（默认）" />
        <Input size="lg" placeholder="大尺寸" />
        <Input disabled placeholder="禁用" />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'status',
            type: "'default' | 'error' | 'success'",
            defaultValue: "'default'",
            description: '校验状态，通过根元素 data-status 暴露。',
          },
          {
            name: 'prefix',
            type: 'React.ReactNode',
            description: '前置内容插槽。',
          },
          {
            name: 'suffix',
            type: 'React.ReactNode',
            description: '后置内容插槽。',
          },
          {
            name: 'clearable',
            type: 'boolean',
            defaultValue: 'false',
            description: '有值时显示清除按钮；只读时隐藏。',
          },
          {
            name: 'onClear',
            type: '() => void',
            description: '点击清除按钮后的回调（按钮会先聚焦输入框）。',
          },
          {
            name: 'classNames',
            type: '{ root?; input?; prefix?; suffix?; clear? }',
            description: 'slot 级类名追加（root / input / prefix / suffix / clear）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'input'>",
            description: "原生 input 属性透传（'prefix' 与 'size' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        结构：<code className="doc-code-inline">root（z-input）&gt; prefix + input（z-input-field）+ clear（z-input-clear）+ suffix</code>；
        清除按钮为 <code className="doc-code-inline">type=&quot;button&quot;</code>、
        <code className="doc-code-inline">aria-label=&quot;清除&quot;</code>。
      </p>

      <CustomizeOutlet
        name="Input"
        parts={['root', 'input', 'prefix', 'suffix', 'clear']}
        vars={[
          '--z-input-height',
          '--z-input-padding-x',
          '--z-input-font-size',
          '--z-input-radius',
          '--z-input-gap',
          '--z-input-bg',
          '--z-input-fg',
          '--z-input-border',
          '--z-input-border-width',
          '--z-input-focus-border',
          '--z-input-focus-ring',
          '--z-input-placeholder-color',
          '--z-input-affix-color',
          '--z-input-affix-font-size',
          '--z-input-clear-color',
          '--z-input-clear-hover-color',
          '--z-input-disabled-bg',
          '--z-input-disabled-fg',
          '--z-input-disabled-border',
          '--z-input-transition',
        ]}
      />
    </div>
  );
}
