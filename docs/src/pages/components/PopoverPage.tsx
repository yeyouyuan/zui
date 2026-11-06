import { Button, Popover } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Popover>
  <Popover.Trigger>打开浮层</Popover.Trigger>
  <Popover.Content>
    <p>这里是弹出层内容，点击外部或按 Esc 关闭。</p>
  </Popover.Content>
</Popover>`;

const ALIGN_CODE = `<Popover>
  <Popover.Trigger>start 对齐</Popover.Trigger>
  <Popover.Content align="start">左侧对齐触发器</Popover.Content>
</Popover>
<Popover>
  <Popover.Trigger>center 对齐</Popover.Trigger>
  <Popover.Content align="center">居中对齐触发器</Popover.Content>
</Popover>
<Popover>
  <Popover.Trigger>end 对齐</Popover.Trigger>
  <Popover.Content align="end">右侧对齐触发器</Popover.Content>
</Popover>`;

const SIDE_CODE = `<Popover>
  <Popover.Trigger>下方弹出</Popover.Trigger>
  <Popover.Content side="bottom">默认向下弹出</Popover.Content>
</Popover>
<Popover>
  <Popover.Trigger>上方弹出</Popover.Trigger>
  <Popover.Content side="top">向上弹出</Popover.Content>
</Popover>`;

const FOCUS_CODE = `<Popover>
  <Popover.Trigger>焦点演示</Popover.Trigger>
  <Popover.Content>
    <input placeholder="打开时自动聚焦到这里" data-autofocus />
    <Button variant="primary">确定</Button>
  </Popover.Content>
</Popover>`;

const AS_CHILD_CODE = `<Popover>
  <Popover.Trigger asChild>
    <Button variant="outline">asChild 触发器</Button>
  </Popover.Trigger>
  <Popover.Content>
    asChild 模式：toggle 与 aria 状态透传到子元素。
  </Popover.Content>
</Popover>`;

export default function PopoverPage(): React.ReactNode {
  usePageTitle('Popover 弹出层');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Popover 弹出层</h1>
      <p className="doc-lead">
        点击触发的组合式弹出层：Portal 渲染到 body，白底圆角 8px + shadow-lg。点击触发器
        toggle、点击外部与 Esc 关闭；打开焦点进入 content 首个可聚焦元素，关闭归还触发器。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Popover.Trigger 点击开合；Popover.Content 用 Portal 渲染到 body 并跟随触发器定位。"
        code={BASIC_CODE}
      >
        <Popover>
          <Popover.Trigger>打开浮层</Popover.Trigger>
          <Popover.Content>
            <p className="doc-p">这里是弹出层内容，点击外部或按 Esc 关闭。</p>
          </Popover.Content>
        </Popover>
      </Demo>

      <Demo
        title="对齐方式"
        description="align 提供 start / center / end 三档，相对触发器对齐，默认 start。"
        code={ALIGN_CODE}
      >
        <Popover>
          <Popover.Trigger>start 对齐</Popover.Trigger>
          <Popover.Content align="start">左侧对齐触发器</Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger>center 对齐</Popover.Trigger>
          <Popover.Content align="center">居中对齐触发器</Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger>end 对齐</Popover.Trigger>
          <Popover.Content align="end">右侧对齐触发器</Popover.Content>
        </Popover>
      </Demo>

      <Demo
        title="弹出方向"
        description="side 提供 bottom / top，默认 bottom。"
        code={SIDE_CODE}
      >
        <Popover>
          <Popover.Trigger>下方弹出</Popover.Trigger>
          <Popover.Content side="bottom">默认向下弹出</Popover.Content>
        </Popover>
        <Popover>
          <Popover.Trigger>上方弹出</Popover.Trigger>
          <Popover.Content side="top">向上弹出</Popover.Content>
        </Popover>
      </Demo>

      <Demo
        title="焦点管理"
        description="打开时焦点优先移入 [data-autofocus] 元素，否则首个可聚焦元素，最后兜底 content 本体；Tab 在浮层内循环，关闭后焦点归还触发按钮。"
        code={FOCUS_CODE}
      >
        <Popover>
          <Popover.Trigger>焦点演示</Popover.Trigger>
          <Popover.Content>
            <div className="doc-pg-preview-row">
              <input data-autofocus placeholder="打开时自动聚焦到这里" />
              <Button variant="primary">确定</Button>
            </div>
          </Popover.Content>
        </Popover>
      </Demo>

      <Demo
        title="asChild 触发器"
        description="Popover.Trigger 支持 asChild 语义：克隆子元素（如 Button）并透传 toggle onClick 与 aria 状态。"
        code={AS_CHILD_CODE}
      >
        <Popover>
          <Popover.Trigger asChild>
            <Button variant="outline">asChild 触发器</Button>
          </Popover.Trigger>
          <Popover.Content>asChild 模式：toggle 与 aria 状态透传到子元素。</Popover.Content>
        </Popover>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Popover</h3>
      <ApiTable
        rows={[
          {
            name: 'open',
            type: 'boolean',
            description: '受控展开。',
          },
          {
            name: 'defaultOpen',
            type: 'boolean',
            defaultValue: 'false',
            description: '非受控初始展开。',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            description: '展开状态变更回调。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '组合 Popover.Trigger 与 Popover.Content。',
          },
        ]}
      />
      <h3 className="doc-h3">Popover.Trigger</h3>
      <ApiTable
        rows={[
          {
            name: 'asChild',
            type: 'boolean',
            defaultValue: 'false',
            description: '克隆子元素并透传 toggle onClick 与 aria 状态（asChild 语义）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'button'>",
            description: '原生 button 属性透传（含 onClick，可 e.preventDefault() 接管开合）。',
          },
        ]}
      />
      <h3 className="doc-h3">Popover.Content</h3>
      <ApiTable
        rows={[
          {
            name: 'align',
            type: "'start' | 'center' | 'end'",
            defaultValue: "'start'",
            description: '相对触发器的对齐方式。',
          },
          {
            name: 'side',
            type: "'bottom' | 'top'",
            defaultValue: "'bottom'",
            description: '弹出方向。',
          },
          {
            name: 'classNames',
            type: '{ content? }',
            description: 'slot 级类名追加（content）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到浮层（className、style、aria-* 等）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Popover"
        parts={['root', 'trigger', 'content']}
        vars={[
          '--z-popover-bg',
          '--z-popover-fg',
          '--z-popover-radius',
          '--z-popover-padding',
          '--z-popover-shadow',
          '--z-popover-offset',
          '--z-popover-max-width',
          '--z-popover-z',
          '--z-popover-animation-duration',
          '--z-popover-transition',
        ]}
      />
    </div>
  );
}
