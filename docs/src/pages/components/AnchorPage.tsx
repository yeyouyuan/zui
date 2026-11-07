import { useState } from 'react';
import { Anchor } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Anchor>
  <Anchor.Link href="#anchor-intro" title="组件介绍" />
  <Anchor.Link href="#anchor-usage" title="使用方式" />
  <Anchor.Link href="#anchor-a11y" title="无障碍" />
</Anchor>

<section id="anchor-intro">…</section>
<section id="anchor-usage">…</section>
<section id="anchor-a11y">…</section>`;

const NESTED_CODE = `<Anchor>
  <Anchor.Link href="#anchor-part-1" title="第一部分">
    <Anchor.Link href="#anchor-part-1-1" title="1.1 小节" />
    <Anchor.Link href="#anchor-part-1-2" title="1.2 小节" />
  </Anchor.Link>
  <Anchor.Link href="#anchor-part-2" title="第二部分" />
</Anchor>`;

const CONTAINER_CODE = `const [box, setBox] = useState<HTMLDivElement | null>(null);

<Anchor offsetTop={8} target={() => box ?? window}>
  <Anchor.Link href="#anchor-ch1" title="第一章" />
  <Anchor.Link href="#anchor-ch2" title="第二章" />
  <Anchor.Link href="#anchor-ch3" title="第三章" />
</Anchor>
<div ref={setBox} style={{ height: 240, overflowY: 'auto' }}>
  <section id="anchor-ch1">…</section>
  <section id="anchor-ch2">…</section>
  <section id="anchor-ch3">…</section>
</div>`;

const ON_CLICK_CODE = `const [clicked, setClicked] = useState('');

<Anchor onClick={(event, link) => setClicked(link.href)}>
  <Anchor.Link href="#anchor-cb-a" title="章节甲" />
  <Anchor.Link href="#anchor-cb-b" title="章节乙" />
</Anchor>`;

function DemoSection(props: { id: string; title: string; text: string }): React.ReactNode {
  return (
    <section id={props.id} style={{ minHeight: 140, padding: 'var(--z-space-2) 0' }}>
      <p style={{ fontWeight: 'var(--z-weight-semibold)' }}>{props.title}</p>
      <p style={{ color: 'var(--z-color-fg-muted)' }}>{props.text}</p>
    </section>
  );
}

export default function AnchorPage(): React.ReactNode {
  usePageTitle('Anchor 锚点');
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [clicked, setClicked] = useState('');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Anchor 锚点</h1>
      <p className="doc-lead">
        页内章节导航：滚动侦测高亮当前章节（rAF 节流），点击平滑滚动到目标位置且不改写
        location.hash，支持嵌套缩进目录与自定义滚动容器。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="滚动页面时自动高亮当前章节（top ≤ offsetTop + 8 的最后一节，全部高于阈值取第一个）；点击链接平滑滚动，激活态带 aria-current 与左侧 2px 指示条。"
        code={BASIC_CODE}
      >
        <Anchor>
          <Anchor.Link href="#anchor-intro" title="组件介绍" />
          <Anchor.Link href="#anchor-usage" title="使用方式" />
          <Anchor.Link href="#anchor-a11y" title="无障碍" />
        </Anchor>
        <div style={{ flex: 1, minWidth: 280 }}>
          <DemoSection
            id="anchor-intro"
            title="组件介绍"
            text="Anchor 用于长文档的页内目录，监听滚动容器位置自动切换激活章节。"
          />
          <DemoSection
            id="anchor-usage"
            title="使用方式"
            text="Anchor.Link 声明目录项，href 指向 #section-id；点击即置 active 并平滑滚动。"
          />
          <DemoSection
            id="anchor-a11y"
            title="无障碍"
            text="nav + ul + 原生锚点语义，激活链接带 aria-current，键盘焦点样式可见。"
          />
        </div>
      </Demo>

      <Demo
        title="嵌套结构"
        description="Anchor.Link 的 children 放嵌套 Anchor.Link，渲染为 ul 内嵌 ul 缩进层级。"
        code={NESTED_CODE}
      >
        <Anchor>
          <Anchor.Link href="#anchor-part-1" title="第一部分">
            <Anchor.Link href="#anchor-part-1-1" title="1.1 小节" />
            <Anchor.Link href="#anchor-part-1-2" title="1.2 小节" />
          </Anchor.Link>
          <Anchor.Link href="#anchor-part-2" title="第二部分" />
        </Anchor>
        <div style={{ flex: 1, minWidth: 280 }}>
          <DemoSection
            id="anchor-part-1"
            title="第一部分"
            text="父级章节，包含两个嵌套小节。"
          />
          <DemoSection id="anchor-part-1-1" title="1.1 小节" text="嵌套链接按层级缩进展示。" />
          <DemoSection id="anchor-part-1-2" title="1.2 小节" text="激活态会沿目录结构高亮对应链接。" />
          <DemoSection id="anchor-part-2" title="第二部分" text="第二个顶级章节。" />
        </div>
      </Demo>

      <Demo
        title="指定滚动容器与 offsetTop"
        description="target 指向内部滚动容器；offsetTop 用于存在固定头部时抵消高度——点击滚动通过 scroll-margin-top 实现，判定阈值相应上移。"
        code={CONTAINER_CODE}
      >
        <Anchor offsetTop={8} target={() => box ?? window}>
          <Anchor.Link href="#anchor-ch1" title="第一章" />
          <Anchor.Link href="#anchor-ch2" title="第二章" />
          <Anchor.Link href="#anchor-ch3" title="第三章" />
        </Anchor>
        <div ref={setBox} style={{ flex: 1, minWidth: 280, height: 240, overflowY: 'auto' }}>
          <DemoSection id="anchor-ch1" title="第一章" text="在容器内滚动侦测激活状态。" />
          <DemoSection id="anchor-ch2" title="第二章" text="点击链接在容器内平滑滚动。" />
          <DemoSection id="anchor-ch3" title="第三章" text="resize 时也会重新测量位置。" />
        </div>
      </Demo>

      <Demo
        title="点击回调"
        description="onClick 在默认滚动前触发，参数为事件与 { href, title }；默认行为已 preventDefault，location.hash 保持不变。"
        code={ON_CLICK_CODE}
        stack
      >
        <Anchor onClick={(_event, link) => setClicked(link.href)}>
          <Anchor.Link href="#anchor-cb-a" title="章节甲" />
          <Anchor.Link href="#anchor-cb-b" title="章节乙" />
        </Anchor>
        <div style={{ flex: 1, minWidth: 280 }}>
          {clicked ? (
            <p className="doc-p">
              已拦截点击：<code className="doc-code-inline">{clicked}</code>（location.hash 未变化）
            </p>
          ) : null}
          <DemoSection id="anchor-cb-a" title="章节甲" text="点击回调演示章节一。" />
          <DemoSection id="anchor-cb-b" title="章节乙" text="点击回调演示章节二。" />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'offsetTop',
            type: 'number',
            defaultValue: '0',
            description: '激活判定阈值（px），判定 top ≤ offsetTop + 8；点击滚动用 scroll-margin-top 抵消。',
          },
          {
            name: 'target',
            type: '() => HTMLElement | Window',
            defaultValue: 'window',
            description: '滚动容器。',
          },
          {
            name: 'onClick',
            type: '(event, link: { href; title }) => void',
            description: '链接点击回调；默认行为已 preventDefault，不改写 location.hash。',
          },
          {
            name: 'classNames',
            type: '{ root?; link? }',
            description: 'slot 级类名追加（root / link）。',
          },
          {
            name: 'Anchor.Link href',
            type: 'string',
            description: "目标锚点，'#section-id'（必须 # 开头）。",
          },
          {
            name: 'Anchor.Link title',
            type: 'React.ReactNode',
            description: '链接文本。',
          },
          {
            name: 'Anchor.Link children',
            type: 'React.ReactNode',
            description: '嵌套 Anchor.Link（ul 内嵌 ul 缩进）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'nav'>",
            description: "原生 nav 属性透传到根元素（className、style、aria-*、事件等）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素与每个结构元素带 <code className="doc-code-inline">data-part</code>（root / list /
        item / link / sublist）；滚动与 resize 监听均经 rAF 节流，组件卸载时清理；激活链接的{' '}
        <code className="doc-code-inline">aria-current</code> 取值为字符串 true，点击不改写
        location.hash。
      </p>

      <CustomizeOutlet
        name="Anchor"
        parts={['root', 'list', 'item', 'link', 'sublist']}
        vars={[
          '--z-anchor-font-size',
          '--z-anchor-link-color',
          '--z-anchor-link-hover-color',
          '--z-anchor-link-active-color',
          '--z-anchor-link-bg',
          '--z-anchor-link-active-bg',
          '--z-anchor-link-padding-x',
          '--z-anchor-link-padding-y',
          '--z-anchor-indicator-width',
          '--z-anchor-indicator-color',
          '--z-anchor-sublist-indent',
          '--z-anchor-transition',
        ]}
      />
    </div>
  );
}
