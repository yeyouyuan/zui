import { Skeleton } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const LINES_CODE = `<Skeleton />
<Skeleton lines={5} />
<Skeleton lines={1} />`;

const SHAPE_CODE = `<Skeleton circle />
<Skeleton circle width={48} />
<Skeleton width={240} height={120} />`;

const ACTIVE_CODE = `<Skeleton active={false} lines={2} />
<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
  <Skeleton circle width={40} />
  <div style={{ flex: 1 }}>
    <Skeleton lines={2} />
  </div>
</div>`;

export default function SkeletonPage(): React.ReactNode {
  usePageTitle('Skeleton 骨架屏');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Skeleton 骨架屏</h1>
      <p className="doc-lead">
        内容加载中的占位骨架：bg-muted 底 + 渐变扫光动画（1.5s 循环），多行文本末行 60% 宽，
        支持圆形头像位与任意宽高。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="多行文本"
        description="lines 控制行数（默认 3），行间距 8px，末行 60% 宽模拟真实文本收尾。"
        code={LINES_CODE}
        stack
      >
        <Skeleton />
        <Skeleton lines={5} />
        <Skeleton lines={1} />
      </Demo>

      <Demo
        title="圆形与自定义尺寸"
        description="circle 渲染圆形（头像位）；width / height 支持 number（px）或任意 CSS 长度字符串。"
        code={SHAPE_CODE}
      >
        <Skeleton circle />
        <Skeleton circle width={48} />
        <Skeleton width={240} height={120} />
      </Demo>

      <Demo
        title="动画与组合"
        description="active={false} 关闭扫光动画；prefers-reduced-motion 下动画自动降级为静态底。"
        code={ACTIVE_CODE}
        stack
      >
        <Skeleton active={false} lines={2} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton circle width={40} />
          <div style={{ flex: 1 }}>
            <Skeleton lines={2} />
          </div>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'lines',
            type: 'number',
            defaultValue: '3',
            description: '文本行数；末行 60% 宽。',
          },
          {
            name: 'width',
            type: 'number | string',
            description: '宽度（number 为 px）；circle 时为直径。',
          },
          {
            name: 'height',
            type: 'number | string',
            description: '高度（number 为 px）；circle 时为直径。',
          },
          {
            name: 'circle',
            type: 'boolean',
            defaultValue: 'false',
            description: '圆形（头像位），忽略 lines。',
          },
          {
            name: 'active',
            type: 'boolean',
            defaultValue: 'true',
            description: '渐变扫光动画（1.5s 循环）；reduced-motion 自动降级。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等；width / height 除外）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-lines</code>、
        <code className="doc-code-inline">data-circle</code>、
        <code className="doc-code-inline">data-active</code>；行元素{' '}
        <code className="doc-code-inline">data-part="line"</code>，末行{' '}
        <code className="doc-code-inline">data-last="true"</code>。组件默认{' '}
        <code className="doc-code-inline">aria-hidden="true"</code>（装饰性占位）。宽高经内联{' '}
        <code className="doc-code-inline">--z-skeleton-width / --z-skeleton-height</code> 注入。
      </p>

      <CustomizeOutlet
        name="Skeleton"
        parts={['root', 'line']}
        vars={[
          '--z-skeleton-width',
          '--z-skeleton-height',
          '--z-skeleton-line-gap',
          '--z-skeleton-last-line-width',
          '--z-skeleton-radius',
          '--z-skeleton-bg',
          '--z-skeleton-highlight',
          '--z-skeleton-duration',
          '--z-skeleton-easing',
        ]}
      />
    </div>
  );
}
