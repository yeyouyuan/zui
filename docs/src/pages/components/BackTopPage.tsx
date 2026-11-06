import { useState } from 'react';
import { BackTop } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [count, setCount] = useState(0);

<div style={{ height: 300, overflow: 'auto', border: '1px solid var(--z-color-border)', position: 'relative' }}>
  <div style={{ height: 1000, padding: 16 }}>
    {Array.from({ length: 40 }).map((_, i) => (
      <p key={i}>滚动内容 {i + 1}</p>
    ))}
    <BackTop target={() => scrollerRef.current!} onClick={() => setCount((c) => c + 1)} />
  </div>
</div>
<span>点击返回顶部次数：{count}</span>`;

const THRESHOLD_CODE = `<BackTop visibilityHeight={200} target={() => scrollerRef.current!} />`;

const CUSTOM_CODE = `<BackTop target={() => scrollerRef.current!}>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span aria-hidden="true">↑</span> 回顶部
  </span>
</BackTop>`;

export default function BackTopPage(): React.ReactNode {
  usePageTitle('BackTop 返回顶部');
  const [count, setCount] = useState(0);
  const [scrollerRef, setScrollerRef] = useState<HTMLDivElement | null>(null);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">BackTop 返回顶部</h1>
      <p className="doc-lead">返回顶部按钮，滚动超过阈值后淡入显示，点击平滑回到顶部。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="在滚动容器内滚动超过 visibilityHeight（默认 400）后按钮淡入，点击平滑滚回顶部并触发 onClick。"
        code={BASIC_CODE}
        stack
      >
        <div
          ref={setScrollerRef}
          style={{
            height: 300,
            overflow: 'auto',
            border: '1px solid var(--z-color-border)',
            position: 'relative',
          }}
        >
          <div style={{ height: 1000, padding: 16, position: 'relative' }}>
            {Array.from({ length: 40 }).map((_, i) => (
              <p key={i}>滚动内容 {i + 1}</p>
            ))}
            {scrollerRef ? (
              <BackTop target={() => scrollerRef} onClick={() => setCount((c) => c + 1)} />
            ) : null}
          </div>
        </div>
        <p className="doc-p">点击返回顶部次数：{count}</p>
      </Demo>

      <Demo title="自定义阈值" description="visibilityHeight 控制显示阈值（滚动距离）。" code={THRESHOLD_CODE}>
        <div
          style={{
            height: 200,
            overflow: 'auto',
            border: '1px solid var(--z-color-border)',
            position: 'relative',
          }}
        >
          <div style={{ height: 800, padding: 16, position: 'relative' }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <p key={i}>滚动内容 {i + 1}</p>
            ))}
            {scrollerRef ? <BackTop visibilityHeight={200} target={() => scrollerRef} /> : null}
          </div>
        </div>
      </Demo>

      <Demo title="自定义按钮内容" description="通过 children 定制按钮外观。" code={CUSTOM_CODE}>
        <div
          style={{
            height: 200,
            overflow: 'auto',
            border: '1px solid var(--z-color-border)',
            position: 'relative',
          }}
        >
          <div style={{ height: 800, padding: 16, position: 'relative' }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <p key={i}>滚动内容 {i + 1}</p>
            ))}
            {scrollerRef ? (
              <BackTop target={() => scrollerRef}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span aria-hidden="true">↑</span> 回顶部
                </span>
              </BackTop>
            ) : null}
          </div>
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'target',
            type: '() => HTMLElement | Window',
            defaultValue: 'window',
            description: '滚动容器，默认 window。',
          },
          {
            name: 'visibilityHeight',
            type: 'number',
            defaultValue: '400',
            description: '超过该滚动距离才显示。',
          },
          {
            name: 'onClick',
            type: '() => void',
            description: '点击按钮时触发（先触发 onClick，再平滑滚回顶部）。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '自定义按钮内容。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加（root）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="BackTop"
        parts={['root']}
        vars={[
          '--z-back-top-size',
          '--z-back-top-bg',
          '--z-back-top-fg',
          '--z-back-top-hover-bg',
          '--z-back-top-border',
          '--z-back-top-radius',
          '--z-back-top-shadow',
          '--z-back-top-icon-size',
          '--z-back-top-right',
          '--z-back-top-bottom',
          '--z-back-top-transition',
        ]}
      />
    </div>
  );
}
