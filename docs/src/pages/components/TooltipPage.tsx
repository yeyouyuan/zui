import { Button, Tooltip } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Tooltip content="保存当前更改">
  <Button>悬浮我</Button>
</Tooltip>`;

const PLACEMENT_CODE = `<Tooltip content="上方提示" placement="top"><Button>top</Button></Tooltip>
<Tooltip content="下方提示" placement="bottom"><Button>bottom</Button></Tooltip>
<Tooltip content="左侧提示" placement="left"><Button>left</Button></Tooltip>
<Tooltip content="右侧提示" placement="right"><Button>right</Button></Tooltip>`;

const FOCUS_CODE = `<Tooltip content="聚焦即显示，Esc 可隐藏">
  <Button>聚焦我（Tab 过来）</Button>
</Tooltip>`;

const DELAY_CODE = `<Tooltip content="立即显示" delay={0}>
  <Button>delay=0</Button>
</Tooltip>
<Tooltip content="延迟 600ms" delay={600}>
  <Button>delay=600</Button>
</Tooltip>
<Tooltip content="不会显示" disabled>
  <Button>disabled</Button>
</Tooltip>`;

export default function TooltipPage(): React.ReactNode {
  usePageTitle('Tooltip 悬浮提示');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Tooltip 悬浮提示</h1>
      <p className="doc-lead">
        轻量悬浮提示：hover 延迟显示、focus 立即显示、Esc 隐藏，深底浅字浮层。通过 cloneElement
        给触发器注入 aria-describedby，读屏可将提示内容关联到触发元素。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="children 必须是单个元素（作为触发器）；hover 进入延迟 200ms 显示，离开立即隐藏。"
        code={BASIC_CODE}
      >
        <Tooltip content="保存当前更改">
          <Button>悬浮我</Button>
        </Tooltip>
      </Demo>

      <Demo
        title="四向位置"
        description="placement 提供 top / bottom / left / right，默认 top。"
        code={PLACEMENT_CODE}
      >
        <Tooltip content="上方提示" placement="top">
          <Button variant="secondary">top</Button>
        </Tooltip>
        <Tooltip content="下方提示" placement="bottom">
          <Button variant="secondary">bottom</Button>
        </Tooltip>
        <Tooltip content="左侧提示" placement="left">
          <Button variant="secondary">left</Button>
        </Tooltip>
        <Tooltip content="右侧提示" placement="right">
          <Button variant="secondary">right</Button>
        </Tooltip>
      </Demo>

      <Demo
        title="键盘可达"
        description="focus 立即显示（不受 delay 影响）、blur 隐藏；文档级 Esc 也可隐藏。提示内容通过 aria-describedby 关联到触发器。"
        code={FOCUS_CODE}
      >
        <Tooltip content="聚焦即显示，Esc 可隐藏">
          <Button variant="outline">聚焦我（Tab 过来）</Button>
        </Tooltip>
      </Demo>

      <Demo
        title="延迟与禁用"
        description="delay 控制 hover 显示延迟（毫秒）；disabled 时任何触发方式都不显示。"
        code={DELAY_CODE}
      >
        <Tooltip content="立即显示" delay={0}>
          <Button variant="outline">delay=0</Button>
        </Tooltip>
        <Tooltip content="延迟 600ms" delay={600}>
          <Button variant="outline">delay=600</Button>
        </Tooltip>
        <Tooltip content="不会显示" disabled>
          <Button variant="outline">disabled</Button>
        </Tooltip>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Tooltip</h3>
      <ApiTable
        rows={[
          {
            name: 'content',
            type: 'React.ReactNode',
            description: '提示内容。',
          },
          {
            name: 'children',
            type: 'React.ReactElement',
            description: '单个子元素（作为触发器），通过 cloneElement 注入打开态控制与 aria-describedby。',
          },
          {
            name: 'placement',
            type: "'top' | 'bottom' | 'left' | 'right'",
            defaultValue: "'top'",
            description: '浮层相对触发器的位置。',
          },
          {
            name: 'delay',
            type: 'number',
            defaultValue: '200',
            description: 'hover 显示延迟（ms）；focus 显示不受影响。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用后任何触发方式都不显示浮层。',
          },
          {
            name: 'className',
            type: 'string',
            description: '追加到根元素 z-tooltip-root。',
          },
          {
            name: 'classNames',
            type: '{ root?; content? }',
            description: 'slot 级类名追加（root / content）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Tooltip"
        parts={['root', 'content']}
        vars={[
          '--z-tooltip-max-width',
          '--z-tooltip-bg',
          '--z-tooltip-fg',
          '--z-tooltip-radius',
          '--z-tooltip-font-size',
          '--z-tooltip-line-height',
          '--z-tooltip-padding-x',
          '--z-tooltip-padding-y',
          '--z-tooltip-shadow',
          '--z-tooltip-offset',
          '--z-tooltip-z',
          '--z-tooltip-animation',
        ]}
      />
    </div>
  );
}
