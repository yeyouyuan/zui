import { Timeline } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_ITEMS = [
  { label: '2026-11-01', children: '项目立项，需求评审通过。' },
  { label: '2026-11-03', children: '设计稿定稿，进入开发。', color: 'primary' as const },
  { label: '2026-11-05', children: '提测并完成一轮回归。', color: 'success' as const },
];

const BASIC_CODE = `<Timeline
  items={[
    { label: '2026-11-01', children: '项目立项，需求评审通过。' },
    { label: '2026-11-03', children: '设计稿定稿，进入开发。', color: 'primary' },
    { label: '2026-11-05', children: '提测并完成一轮回归。', color: 'success' },
  ]}
/>`;

const MODE_CODE = `<Timeline mode="right" items={[…]} />
<Timeline mode="alternate" items={[…]} />`;

const PENDING_CODE = `<Timeline
  items={[…]}
  pending={<span>发布中…</span>}
/>`;

const DOT_CODE = `<Timeline
  items={[
    { children: '自定义节点图标', dot: <span>★</span>, color: 'warning' },
    { children: '默认空心节点', color: 'error' },
  ]}
/>`;

export default function TimelinePage(): React.ReactNode {
  usePageTitle('Timeline 时间轴');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Timeline 时间轴</h1>
      <p className="doc-lead">
        竖线 + 节点圆点 + 内容的时间轴：支持左/右/交替布局、语义状态色节点、自定义圆点与 pending 进行中节点。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="items 提供 label 与 children，节点色用 color 映射语义状态。"
        code={BASIC_CODE}
      >
        <Timeline items={BASIC_ITEMS} />
      </Demo>

      <Demo
        title="布局模式"
        description="mode 支持 left（默认）/ right / alternate（奇偶交替左右）。"
        code={MODE_CODE}
        stack
      >
        <Timeline mode="right" items={BASIC_ITEMS} />
        <Timeline mode="alternate" items={BASIC_ITEMS} />
      </Demo>

      <Demo
        title="pending 尾节点"
        description="pending 渲染虚点的进行中节点，常用于流程尚未结束的场景。"
        code={PENDING_CODE}
      >
        <Timeline items={BASIC_ITEMS} pending={<span>发布中…</span>} />
      </Demo>

      <Demo
        title="自定义圆点"
        description="dot 可传任意 ReactNode 替换默认空心节点。"
        code={DOT_CODE}
      >
        <Timeline
          items={[
            { children: '自定义节点图标', dot: <span aria-hidden="true">★</span>, color: 'warning' },
            { children: '默认空心节点', color: 'error' },
          ]}
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'items',
            type: 'Array<{ key?; label?; children; color?; dot? }>',
            description: '时间轴项（children 为内容；key 可选，默认按索引）。',
          },
          {
            name: 'mode',
            type: "'left' | 'right' | 'alternate'",
            defaultValue: "'left'",
            description: '布局：内容靠左 / 靠右 / 奇偶交替。',
          },
          {
            name: 'pending',
            type: 'React.ReactNode',
            description: '尾部进行中节点（虚点）。',
          },
          {
            name: 'items[].color',
            type: "'primary' | 'success' | 'warning' | 'error' | 'neutral'",
            defaultValue: "'neutral'",
            description: '节点语义颜色。',
          },
          {
            name: 'items[].dot',
            type: 'React.ReactNode',
            description: '自定义节点圆点内容。',
          },
          {
            name: 'classNames',
            type: '{ root?; item?; dot?; label?; content? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: "原生 div 属性透传到根元素（className、style、aria-*、事件等）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-mode</code>；节点项带{' '}
        <code className="doc-code-inline">data-color</code>、
        <code className="doc-code-inline">data-side</code>（alternate 模式左右标记）、
        <code className="doc-code-inline">data-pending</code>（仅 pending 节点）。
      </p>

      <CustomizeOutlet
        name="Timeline"
        parts={['root', 'item', 'dot', 'label', 'content']}
        vars={[
          '--z-timeline-font-family',
          '--z-timeline-font-size',
          '--z-timeline-fg',
          '--z-timeline-line-color',
          '--z-timeline-line-width',
          '--z-timeline-dot-size',
          '--z-timeline-dot-border-width',
          '--z-timeline-dot-bg',
          '--z-timeline-item-gap',
          '--z-timeline-content-gap',
          '--z-timeline-label-color',
          '--z-timeline-label-width',
          '--z-timeline-label-margin',
          '--z-timeline-dot-color',
          '--z-timeline-dot-pending-color',
        ]}
      />
    </div>
  );
}
