import { useState } from 'react';
import { Button } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const VARIANTS_CODE = `<Button variant="primary">主要按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button variant="outline">描边按钮</Button>
<Button variant="ghost">幽灵按钮</Button>
<Button variant="danger">危险按钮</Button>`;

const SIZES_CODE = `<Button size="sm">小按钮</Button>
<Button size="md">中按钮</Button>
<Button size="lg">大按钮</Button>`;

const LOADING_CODE = `const [loading, setLoading] = useState(false);

<Button loading={loading} onClick={() => setLoading(true)}>
  提交中…
</Button>
<Button loading iconStart={<span>↑</span>}>上传中</Button>`;

const LAYOUT_CODE = `<Button fullWidth>全宽按钮</Button>
<Button disabled>禁用按钮</Button>
<Button variant="outline" iconStart={<span>+</span>} iconEnd={<span>→</span>}>
  带图标
</Button>`;

export default function ButtonPage(): React.ReactNode {
  usePageTitle('Button 按钮');
  const [loading, setLoading] = useState(false);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Button 按钮</h1>
      <p className="doc-lead">
        最基础的操作触发器：5 种语义变体、3 种尺寸，支持图标、加载态与全宽布局，加载态下保留可聚焦性。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="变体" description="5 种语义变体覆盖绝大多数操作场景：主要 / 次要 / 描边 / 幽灵 / 危险。" code={VARIANTS_CODE}>
        <Button variant="primary">主要按钮</Button>
        <Button variant="secondary">次要按钮</Button>
        <Button variant="outline">描边按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
        <Button variant="danger">危险按钮</Button>
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档，默认 md。" code={SIZES_CODE}>
        <Button size="sm">小按钮</Button>
        <Button size="md">中按钮</Button>
        <Button size="lg">大按钮</Button>
      </Demo>

      <Demo
        title="加载态"
        description="loading 置灰并显示 spinner，带 aria-busy，点击被拦截；注意 loading 时按钮仍可聚焦（不用原生 disabled）。"
        code={LOADING_CODE}
      >
        <Button loading={loading} onClick={() => setLoading(true)}>
          点我进入加载
        </Button>
        <Button loading iconStart={<span aria-hidden="true">↑</span>}>
          上传中
        </Button>
        <Button variant="secondary" onClick={() => setLoading(false)}>
          复位
        </Button>
      </Demo>

      <Demo
        title="图标、全宽与禁用"
        description="iconStart / iconEnd 放置前后图标；fullWidth 撑满容器；disabled 使用原生 disabled。"
        code={LAYOUT_CODE}
        stack
      >
        <Button fullWidth>全宽按钮</Button>
        <div className="doc-pg-preview-row">
          <Button disabled>禁用按钮</Button>
          <Button variant="outline" iconStart={<span aria-hidden="true">+</span>} iconEnd={<span aria-hidden="true">→</span>}>
            带图标
          </Button>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'variant',
            type: "'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'",
            defaultValue: "'primary'",
            description: '语义变体。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'loading',
            type: 'boolean',
            defaultValue: 'false',
            description: '加载态：置灰 + spinner + aria-busy，拦截点击（保留可聚焦，不用原生 disabled）。',
          },
          {
            name: 'iconStart',
            type: 'React.ReactNode',
            description: '前置图标。',
          },
          {
            name: 'iconEnd',
            type: 'React.ReactNode',
            description: '后置图标。',
          },
          {
            name: 'fullWidth',
            type: 'boolean',
            defaultValue: 'false',
            description: '宽度撑满容器。',
          },
          {
            name: 'classNames',
            type: '{ root?; icon?; label?; spinner? }',
            description: 'slot 级类名追加（root / icon / label / spinner）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'button'>",
            description: "原生 button 属性透传到根元素（className、style、aria-*、事件等；'prefix' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-variant</code>、
        <code className="doc-code-inline">data-size</code>、
        <code className="doc-code-inline">data-loading</code>、
        <code className="doc-code-inline">data-full-width</code>；禁用用原生{' '}
        <code className="doc-code-inline">disabled</code>。
      </p>

      <CustomizeOutlet
        name="Button"
        parts={['root', 'icon', 'label', 'spinner']}
        vars={[
          '--z-button-height',
          '--z-button-padding-x',
          '--z-button-font-size',
          '--z-button-font-weight',
          '--z-button-radius',
          '--z-button-gap',
          '--z-button-bg',
          '--z-button-fg',
          '--z-button-border',
          '--z-button-border-width',
          '--z-button-hover-bg',
          '--z-button-hover-fg',
          '--z-button-active-bg',
          '--z-button-disabled-bg',
          '--z-button-disabled-fg',
          '--z-button-disabled-border',
          '--z-button-focus-ring',
          '--z-button-spinner-size',
          '--z-button-spinner-width',
          '--z-button-transition',
        ]}
      />
    </div>
  );
}
