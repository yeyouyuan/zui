import { useState } from 'react';
import { Splitter } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Splitter
  aria-label="工作台"
  defaultSizes={[36, 64]}
  handleProps={({ beforePanelLabel, afterPanelLabel }) => ({
    'aria-label': \`调整\${beforePanelLabel}与\${afterPanelLabel}\`,
  })}
  style={{ height: 240 }}
>
  <Splitter.Panel key="main" label="主区" minSize={20}>主区</Splitter.Panel>
  <Splitter.Panel key="details" label="详情" minSize={20}>详情</Splitter.Panel>
</Splitter>`;

const VERTICAL_CODE = `<Splitter
  orientation="vertical"
  defaultSizes={[60, 40]}
  handleProps={() => ({ collapseTarget: 'after' })}
  style={{ height: 240 }}
>
  <Splitter.Panel key="canvas" label="画布">画布</Splitter.Panel>
  <Splitter.Panel key="console" label="控制台" collapsible collapsedSize={8}>
    控制台
  </Splitter.Panel>
</Splitter>`;

const CONTROLLED_CODE = `const [sizes, setSizes] = useState([30, 70]);

<Splitter
  aria-label="工作台"
  sizes={sizes}
  onSizesChange={(next, details) => {
    setSizes(next);
    reportContinuousChange(details.reason);
  }}
  onResizeEnd={(actual, details) => {
    persist({ actual, requested: details.requestedSizes, cancelled: details.cancelled });
  }}
  style={{ height: 240 }}
>
  <Splitter.Panel key="left" label="左侧">左</Splitter.Panel>
  <Splitter.Panel key="right" label="右侧">右</Splitter.Panel>
</Splitter>`;

export default function SplitterPage(): React.ReactNode {
  usePageTitle('Splitter 可调分栏');
  const [sizes, setSizes] = useState([30, 70]);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Splitter 可调分栏</h1>
      <p className="doc-lead">
        自动生成的具名分隔条支持 Pointer Capture 与完整键盘调整；Panel 百分比只分配扣除固定 Handle
        轨道后的空间，并提供受控尺寸、明确目标折叠、取消恢复和焦点安全回退。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="水平分栏"
        description="拖动分隔条，或聚焦后用方向键（1%）、PageUp/PageDown（10%）、Home/End（成对有效边界）调整。"
        code={BASIC_CODE}
        stack
      >
        <Splitter
          aria-label="水平分栏演示"
          defaultSizes={[36, 64]}
          handleProps={({ beforePanelLabel, afterPanelLabel }) => ({
            'aria-label': `调整${beforePanelLabel}与${afterPanelLabel}`,
          })}
          style={{ height: 200, width: '100%' }}
        >
          <Splitter.Panel key="main" label="主区" minSize={20}>
            <div style={{ padding: 12 }}>主区</div>
          </Splitter.Panel>
          <Splitter.Panel key="details" label="详情" minSize={20}>
            <div style={{ padding: 12 }}>详情</div>
          </Splitter.Panel>
        </Splitter>
      </Demo>

      <Demo
        title="垂直分栏与明确目标折叠"
        description="orientation=vertical 为上下分栏；只有 handleProps.collapseTarget 指向可折叠 Panel 时，Enter 才切换折叠。"
        code={VERTICAL_CODE}
        stack
      >
        <Splitter
          orientation="vertical"
          defaultSizes={[60, 40]}
          handleProps={() => ({ collapseTarget: 'after' })}
          style={{ height: 260, width: '100%' }}
        >
          <Splitter.Panel key="canvas" label="画布">
            <div style={{ padding: 12 }}>画布</div>
          </Splitter.Panel>
          <Splitter.Panel key="console" label="控制台" collapsible collapsedSize={8}>
            <div style={{ padding: 12 }}>控制台</div>
          </Splitter.Panel>
        </Splitter>
      </Demo>

      <Demo
        title="受控尺寸与结束边界"
        description="onSizesChange 持续报告请求；pointerup、键盘 keyup/blur 或取消边界只触发一次 onResizeEnd，并区分 actual 与 requestedSizes。"
        code={CONTROLLED_CODE}
        stack
      >
        <Splitter
          aria-label="受控分栏演示"
          sizes={sizes}
          onSizesChange={setSizes}
          style={{ height: 200, width: '100%' }}
        >
          <Splitter.Panel key="left" label="左侧">
            <div style={{ padding: 12 }}>左 {Math.round(sizes[0])}%</div>
          </Splitter.Panel>
          <Splitter.Panel key="right" label="右侧">
            <div style={{ padding: 12 }}>右 {Math.round(sizes[1])}%</div>
          </Splitter.Panel>
        </Splitter>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'orientation',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'horizontal'",
            description: '分栏方向。水平布局会根据 RTL 翻转指针与左右方向键的视觉增减方向。',
          },
          {
            name: 'sizes / defaultSizes',
            type: 'number[]',
            description:
              '受控 / 非受控 Panel 百分比数组，长度等于 Panel 数量且总和为 100；固定 Handle 轨道不计入这 100%。',
          },
          {
            name: 'onSizesChange',
            type: '(sizes, { reason, handleIndex }) => void',
            description:
              '尺寸请求回调；reason 为 pointer、keyboard、collapse 或 panels-change。受控模式不乐观改写界面。',
          },
          {
            name: 'onResizeEnd',
            type: '(actualSizes, { input, cancelled, requestedSizes, handleIndex }) => void',
            description:
              'Pointer 在 up / cancel 边界、键盘在 keyup / blur 边界各触发一次；取消会恢复起点，并保留最后 requestedSizes。',
          },
          {
            name: 'handleProps',
            type: '(context) => SplitterHandleProps',
            description:
              '定制自动生成的 Handle；context 提供 index、两侧稳定 id 与 label，可设置名称、原生事件、disabled、collapseTarget。',
          },
          {
            name: 'Panel.label / initialSize / minSize / maxSize',
            type: 'string / number',
            description: 'Panel 名称与初始 / 最小 / 最大百分比；label 用于默认 Handle 可访问名称。',
          },
          {
            name: 'Panel.collapsible / collapsedSize',
            type: 'boolean / number',
            description:
              '允许明确目标折叠及折叠后百分比。折叠内容保持 DOM，但会同步 inert、aria-hidden 与 pointer-events:none。',
          },
          {
            name: 'Panel.collapsed / defaultCollapsed / onCollapsedChange',
            type: 'boolean / (collapsed) => void',
            description:
              '折叠状态的受控 / 非受控 API；外部折叠时，内容内焦点安全回退到相关 Handle。',
          },
          {
            name: 'classNames / Panel.classNames',
            type: '{ root?; handle?; handleIndicator? } / { root?; content? }',
            description: '根、Panel、内容、Handle 与视觉指示条的 slot 类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        结构：<code className="doc-code-inline">root &gt; (panel + auto handle)×n</code>
        。Handle 为具名 <code className="doc-code-inline">role=&quot;separator&quot;</code>，
        <code className="doc-code-inline">aria-controls</code> 同时关联两侧稳定 Panel id；
        <code className="doc-code-inline">aria-valuemin/max/now</code> 表达相邻两块的成对有效范围。
        拖动期间文档根写入 <code className="doc-code-inline">data-z-splitter-dragging</code>
        ，结束后立即清理。
      </p>

      <CustomizeOutlet
        name="Splitter"
        parts={['root', 'panel', 'content', 'handle', 'handle-indicator']}
        vars={[
          '--z-splitter-handle-size',
          '--z-splitter-handle-hit-size',
          '--z-splitter-handle-bg',
          '--z-splitter-handle-hover-bg',
          '--z-splitter-handle-active-bg',
          '--z-splitter-handle-radius',
          '--z-splitter-handle-fg',
          '--z-splitter-animation-duration',
        ]}
      />
    </div>
  );
}
