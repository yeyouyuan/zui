import { useState } from 'react';
import { Steps } from '@zui/react';
import type { StepsItem } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_ITEMS = [
  { title: '填写信息', description: '账号与联系方式' },
  { title: '确认订单', description: '核对商品与地址' },
  { title: '在线支付', description: '支持多种支付方式' },
  { title: '等待发货', description: '预计 48 小时内' },
];

const BASIC_CODE = `<Steps
  current={1}
  items={[
    { title: '填写信息', description: '账号与联系方式' },
    { title: '确认订单', description: '核对商品与地址' },
    { title: '在线支付', description: '支持多种支付方式' },
    { title: '等待发货', description: '预计 48 小时内' },
  ]}
/>`;

const CONTROLLED_CODE = `const [current, setCurrent] = useState(0);

<Steps current={current} onChange={setCurrent} items={items} />`;

const STATUS_CODE = `<Steps
  current={2}
  items={[
    { title: '填写信息' },
    { title: '确认订单' },
    { title: '在线支付', status: 'error' },
    { title: '等待发货' },
  ]}
/>`;

const ICON_CODE = `<Steps
  current={2}
  items={[
    { title: '激活账户', icon: <span>◎</span> },
    { title: '完善资料', icon: <span>✎</span> },
    { title: '开始使用' },
  ]}
/>`;

const DIRECTION_CODE = `<Steps direction="vertical" current={1} items={items} />`;

const SIZE_CODE = `<Steps size="sm" current={1} items={items} />`;

const ERROR_ITEMS: StepsItem[] = [
  { title: '填写信息' },
  { title: '确认订单' },
  { title: '在线支付', status: 'error', description: '支付超时，请重试' },
  { title: '等待发货' },
];

const ICON_ITEMS: StepsItem[] = [
  { title: '激活账户', icon: <span aria-hidden="true">◎</span> },
  { title: '完善资料', icon: <span aria-hidden="true">✎</span> },
  { title: '开始使用', description: '完成全部流程' },
];

export default function StepsPage(): React.ReactNode {
  usePageTitle('Steps 步骤条');
  const [current, setCurrent] = useState(0);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Steps 步骤条</h1>
      <p className="doc-lead">
        引导用户按顺序完成多步流程：根据 current 派生 finish / process / wait 状态，
        支持 error 显式覆盖、自定义图标、垂直布局与可点击键盘导航。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="current 之前的步骤为 finish（主色对勾），当前为 process（主色数字），之后为 wait。"
        code={BASIC_CODE}
      >
        <Steps current={1} items={BASIC_ITEMS} />
      </Demo>

      <Demo
        title="可点击步骤"
        description="提供 onChange 后每一步可点击（disabled 除外）；键盘 ↑←/↓→ 移动焦点、Home/End 首尾、Enter 确认。"
        code={CONTROLLED_CODE}
      >
        <Steps current={current} onChange={setCurrent} items={BASIC_ITEMS} />
      </Demo>

      <Demo
        title="显式状态覆盖"
        description="item.status 覆盖派生状态，error 可出现在任意位置并显示危险色 XCircle 图标。"
        code={STATUS_CODE}
        stack
      >
        <Steps current={2} items={ERROR_ITEMS} />
      </Demo>

      <Demo
        title="自定义图标"
        description="item.icon 替换默认的数字 / 对勾图标。"
        code={ICON_CODE}
        stack
      >
        <Steps current={2} items={ICON_ITEMS} />
      </Demo>

      <Demo title="垂直方向" description="direction=vertical 时改为列布局，连接线在左侧图标下方。" code={DIRECTION_CODE}>
        <Steps direction="vertical" current={1} items={BASIC_ITEMS} />
      </Demo>

      <Demo title="尺寸" description="size 支持 md（默认）与 sm，提供紧凑形态。" code={SIZE_CODE}>
        <Steps size="sm" current={1} items={BASIC_ITEMS} />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'items',
            type: 'StepsItem[]',
            defaultValue: '—',
            description: '步骤配置：title 必填，description / icon / status / disabled 可选。',
          },
          {
            name: 'current',
            type: 'number',
            defaultValue: '0',
            description: '当前步骤下标：< 为 finish，== 为 process，> 为 wait。',
          },
          {
            name: 'direction',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'horizontal'",
            description: '排列方向。',
          },
          {
            name: 'size',
            type: "'md' | 'sm'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'onChange',
            type: '(index: number) => void',
            description: '提供后步骤可点击；键盘 roving tabindex + ↑←/↓→/Home/End + Enter 确认。',
          },
          {
            name: 'classNames',
            type: '{ root?; item?; icon?; content?; connector? }',
            description: 'slot 级类名追加（root / item / icon / content / connector）。',
          },
          {
            name: 'item.status',
            type: "'wait' | 'process' | 'finish' | 'error'",
            description: '显式覆盖派生状态（error 可出现在任意位置）。',
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-direction</code>、
        <code className="doc-code-inline">data-size</code>；每项带
        <code className="doc-code-inline">data-status</code>（含显式覆盖后的最终状态），
        结构元素带 <code className="doc-code-inline">data-part</code>（nav / root / item / trigger /
        icon / content / title / description / connector）。无障碍：nav
        标签文案取自 <code className="doc-code-inline">locale.steps.label</code>，当前项
        <code className="doc-code-inline">aria-current=step</code>。
      </p>

      <CustomizeOutlet
        name="Steps"
        parts={['root', 'item', 'icon', 'content', 'connector']}
        vars={[
          '--z-steps-icon-size',
          '--z-steps-icon-font-size',
          '--z-steps-line-width',
          '--z-steps-line-color',
          '--z-steps-line-finish-color',
          '--z-steps-item-gap',
          '--z-steps-gap',
          '--z-steps-title-font-size',
          '--z-steps-description-font-size',
          '--z-steps-title-fg',
          '--z-steps-description-fg',
          '--z-steps-icon-bg',
          '--z-steps-icon-fg',
          '--z-steps-icon-border',
          '--z-steps-transition',
        ]}
      />
    </div>
  );
}
