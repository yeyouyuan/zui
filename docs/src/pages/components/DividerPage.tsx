import { Divider } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<p>上方内容</p>
<Divider />
<p>下方内容</p>
<Divider dashed />`;

const TEXT_CODE = `<Divider>分割文字</Divider>
<Divider dashed>虚线带文字</Divider>`;

const VERTICAL_CODE = `<span>登录</span>
<Divider orientation="vertical" />
<span>注册</span>
<Divider orientation="vertical" dashed />
<span>找回密码</span>`;

export default function DividerPage(): React.ReactNode {
  usePageTitle('Divider 分割线');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Divider 分割线</h1>
      <p className="doc-lead">
        区分内容的 1px 分割线：水平 / 垂直两种朝向，支持虚线与中间文字（文字两侧自动留白 12px）。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="水平分割线"
        description="默认水平 1px border-subtle 线；dashed 切换虚线。"
        code={BASIC_CODE}
        stack
      >
        <p>上方内容</p>
        <Divider />
        <p>下方内容</p>
        <Divider dashed />
      </Demo>

      <Demo
        title="带文字"
        description="children 为中间文字（仅水平方向生效）：12px fg-muted，两侧留白 12px。"
        code={TEXT_CODE}
        stack
      >
        <Divider>分割文字</Divider>
        <Divider dashed>虚线带文字</Divider>
      </Demo>

      <Demo
        title="垂直分割线"
        description="vertical 为 1px 竖线，inline 布局下高 1em，常用于行内分组。"
        code={VERTICAL_CODE}
      >
        <span>登录</span>
        <Divider orientation="vertical" />
        <span>注册</span>
        <Divider orientation="vertical" dashed />
        <span>找回密码</span>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'orientation',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'horizontal'",
            description: '分割线朝向。',
          },
          {
            name: 'dashed',
            type: 'boolean',
            defaultValue: 'false',
            description: '虚线样式。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '中间文字（仅 horizontal 生效），12px fg-muted。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-orientation</code>、
        <code className="doc-code-inline">data-dashed</code>、
        <code className="doc-code-inline">data-has-text</code>。
      </p>

      <CustomizeOutlet
        name="Divider"
        parts={['root', 'line', 'text']}
        vars={[
          '--z-divider-line-color',
          '--z-divider-thickness',
          '--z-divider-margin-y',
          '--z-divider-margin-x',
          '--z-divider-text-gap',
          '--z-divider-text-color',
          '--z-divider-text-font-size',
          '--z-divider-text-font-weight',
          '--z-divider-vertical-height',
        ]}
      />
    </div>
  );
}
