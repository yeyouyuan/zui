import { useState } from 'react';
import { DateRangePicker } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<DateRangePicker
  defaultValue={['2024-06-01', '2024-06-07']}
  onChange={(range) => console.log(range)}
/>`;

const CONTROLLED_CODE = `const [range, setRange] = useState<[string, string] | null>(null);

<DateRangePicker
  value={range}
  onChange={(next) => setRange(next)}
/>
<DateRangePicker
  value={range}
  onChange={(next) => setRange(next)}
  status={range ? 'default' : 'error'}
/>`;

const MINMAX_CODE = `<DateRangePicker
  min="2024-06-01"
  max="2024-06-30"
  defaultValue={['2024-06-05', '2024-06-15']}
/>`;

const SIZE_STATUS_CODE = `<DateRangePicker size="sm" />
<DateRangePicker size="md" />
<DateRangePicker size="lg" status="success" />
<DateRangePicker status="error" />`;

const DISABLED_CLEAR_CODE = `<DateRangePicker disabled defaultValue={['2024-06-01', '2024-06-07']} />
<DateRangePicker allowClear={false} />
<DateRangePicker defaultValue={['2024-06-01', '2024-06-07']} />`;

const PAGE_CODE = `export default function DemoPage() {
  const [range, setRange] = useState<[string, string] | null>(null);

  return (
    <DateRangePicker
      value={range}
      onChange={(next) => setRange(next)}
    />
  );
}`;

export default function DateRangePickerPage(): React.ReactNode {
  usePageTitle('DateRangePicker 日期范围选择器');
  const [range, setRange] = useState<[string, string] | null>(['2024-06-10', '2024-06-20']);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">DateRangePicker 日期范围选择器</h1>
      <p className="doc-lead">
        桌面双月并排、窄屏单月日历面板选择日期区间：点选起点后点选终点完成选择，逆序点击自动重开；
        完整键盘导航（a11y S 级），浮层基于共享 FloatingPanel 引擎自动翻转定位。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="双输入位触发器显示 ISO 起止日期，中间为 locale 分隔符；完成选择后面板自动关闭并归还焦点。"
        code={BASIC_CODE}
      >
        <DateRangePicker defaultValue={['2024-06-01', '2024-06-07']} />
      </Demo>

      <Demo
        title="受控"
        description="value / onChange 完全受控；onChange(null) 表示已清空。"
        code={CONTROLLED_CODE}
      >
        <DateRangePicker value={range} onChange={setRange} />
        <p className="doc-p">
          当前选择：
          <code className="doc-code-inline">{range ? `${range[0]} ~ ${range[1]}` : '未选择'}</code>
        </p>
      </Demo>

      <Demo
        title="限制可选范围"
        description="min / max 之外的日期置灰禁选（aria-disabled），边界日期可选。"
        code={MINMAX_CODE}
      >
        <DateRangePicker
          min="2024-06-01"
          max="2024-06-30"
          defaultValue={['2024-06-05', '2024-06-15']}
        />
      </Demo>

      <Demo
        title="尺寸与状态"
        description="size 提供 sm / md / lg；status 给触发器边框着色（error / success）。"
        code={SIZE_STATUS_CODE}
        stack
      >
        <DateRangePicker size="sm" />
        <DateRangePicker size="md" />
        <DateRangePicker size="lg" status="success" />
        <DateRangePicker status="error" />
      </Demo>

      <Demo
        title="禁用与清除"
        description="disabled 禁用触发器；allowClear 默认开启，已选时显示清除钮，点击回调 onChange(null)。"
        code={DISABLED_CLEAR_CODE}
        stack
      >
        <DateRangePicker disabled defaultValue={['2024-06-01', '2024-06-07']} />
        <DateRangePicker allowClear={false} />
        <DateRangePicker defaultValue={['2024-06-01', '2024-06-07']} />
      </Demo>

      <h2 className="doc-h2">键盘操作</h2>
      <p className="doc-p">
        触发器：<code className="doc-code-inline">Enter / Space / ↓ / ↑</code> 开关面板； 面板内：
        <code className="doc-code-inline">← →</code> ±1 天（周内循环）、
        <code className="doc-code-inline">↑ ↓</code> ±7 天、
        <code className="doc-code-inline">Home / End</code> 月首尾、
        <code className="doc-code-inline">PageUp / PageDown</code> 上/下月、
        <code className="doc-code-inline">Enter</code> 选定、
        <code className="doc-code-inline">Esc</code> 关闭并归还焦点。焦点跟随日期格（roving
        tabindex）， 移出当前可见月份时视图自动跟随。
      </p>

      <Demo title="组合表单" description="受控值与清除状态配合表单展示。" code={PAGE_CODE}>
        <DateRangePicker value={range} onChange={setRange} />
        <DateRangePicker
          value={range}
          onChange={(next) => setRange(next)}
          status={range ? 'success' : 'error'}
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: '[string, string]',
            description: "受控范围，ISO 'YYYY-MM-DD' 二元组 [start, end]。",
          },
          {
            name: 'defaultValue',
            type: '[string, string]',
            description: '非受控初始范围。',
          },
          {
            name: 'onChange',
            type: '(range: [string, string] | null) => void',
            description: '完成选择回调；null = 已清空。',
          },
          {
            name: 'min / max',
            type: 'string',
            description: '最小 / 最大可选日期（ISO，含），之外禁选（aria-disabled）。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用触发器。',
          },
          {
            name: 'status',
            type: "'default' | 'error' | 'success'",
            defaultValue: "'default'",
            description: '校验状态，触发器边框着色。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'allowClear',
            type: 'boolean',
            defaultValue: 'true',
            description: '已选时显示清除按钮，点击回调 onChange(null)。',
          },
          {
            name: 'id',
            type: 'string',
            description: '开始输入位 id（供 label 关联）。',
          },
          {
            name: 'classNames',
            type: '{ root?; trigger?; panel?; day?; header? }',
            description: 'slot 级类名追加（root / trigger / panel / day / header）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '其余属性透传到根元素（className、style、aria-*、data-* 等）。',
          },
        ]}
      />
      <p className="doc-p">
        选择状态机：无选择 → 点 A 记起点（<code className="doc-code-inline">aria-selected</code>）→
        点 B ≥ A 完成 [A, B] 并关闭面板；B &lt; A 则 B 成为新起点（逆序重开）。 start / end 格{' '}
        <code className="doc-code-inline">aria-selected</code>， 范围中间格{' '}
        <code className="doc-code-inline">data-in-range</code>。
      </p>

      <CustomizeOutlet
        name="DateRangePicker"
        parts={[
          'root',
          'trigger',
          'input-start',
          'input-end',
          'separator',
          'icon',
          'clear',
          'panel',
          'header',
          'nav',
          'label',
          'months',
          'grid',
          'week',
          'weekday',
          'day',
        ]}
        vars={[
          '--z-date-range-trigger-height',
          '--z-date-range-trigger-padding-x',
          '--z-date-range-trigger-font-size',
          '--z-date-range-trigger-radius',
          '--z-date-range-trigger-bg',
          '--z-date-range-trigger-fg',
          '--z-date-range-trigger-border',
          '--z-date-range-trigger-hover-border',
          '--z-date-range-trigger-focus-border',
          '--z-date-range-trigger-focus-ring',
          '--z-date-range-error-border',
          '--z-date-range-success-border',
          '--z-date-range-placeholder-fg',
          '--z-date-range-separator-fg',
          '--z-date-range-icon-color',
          '--z-date-range-clear-fg',
          '--z-date-range-clear-hover-fg',
          '--z-date-range-clear-hover-bg',
          '--z-date-range-disabled-bg',
          '--z-date-range-disabled-fg',
          '--z-date-range-disabled-border',
          '--z-date-range-panel-width',
          '--z-date-range-panel-bg',
          '--z-date-range-panel-border',
          '--z-date-range-panel-radius',
          '--z-date-range-panel-shadow',
          '--z-date-range-panel-padding',
          '--z-date-range-panel-gap',
          '--z-date-range-header-gap',
          '--z-date-range-label-font-size',
          '--z-date-range-label-font-weight',
          '--z-date-range-label-fg',
          '--z-date-range-nav-size',
          '--z-date-range-nav-color',
          '--z-date-range-nav-hover-bg',
          '--z-date-range-months-gap',
          '--z-date-range-grid-gap',
          '--z-date-range-day-size',
          '--z-date-range-day-font-size',
          '--z-date-range-day-fg',
          '--z-date-range-day-radius',
          '--z-date-range-day-hover-bg',
          '--z-date-range-day-selected-bg',
          '--z-date-range-day-selected-fg',
          '--z-date-range-day-in-range-bg',
          '--z-date-range-day-in-range-fg',
          '--z-date-range-day-today-border',
          '--z-date-range-day-out-fg',
          '--z-date-range-day-disabled-fg',
          '--z-date-range-weekday-fg',
          '--z-date-range-weekday-font-size',
          '--z-date-range-transition',
        ]}
      />
    </div>
  );
}
