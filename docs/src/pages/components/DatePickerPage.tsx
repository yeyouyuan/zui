import { useState } from 'react';
import { DatePicker } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [value, setValue] = useState('');

<DatePicker value={value} onChange={setValue} placeholder="请选择日期" />
<span>选中：{value || '未选择'}</span>`;

const RANGE_CODE = `<DatePicker
  min="2024-01-01"
  max="2024-12-31"
  defaultValue="2024-06-15"
  onChange={(iso) => console.log(iso)}
/>`;

const SIZE_CODE = `<DatePicker size="sm" placeholder="小尺寸" />
<DatePicker size="md" placeholder="中尺寸" />
<DatePicker size="lg" placeholder="大尺寸" />`;

export default function DatePickerPage(): React.ReactNode {
  usePageTitle('DatePicker 日期选择器');
  const [value, setValue] = useState('');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">DatePicker 日期选择器</h1>
      <p className="doc-lead">日期选择器，弹出日历面板选择单个日期（ISO YYYY-MM-DD）。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="选择日期"
        description="点击触发器打开日历面板，选择日期后面板关闭并回调 ISO 字符串；触发器支持直接输入 YYYY-MM-DD。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <DatePicker value={value} onChange={setValue} placeholder="请选择日期" />
          <span>选中：{value || '未选择'}</span>
        </div>
      </Demo>

      <Demo title="可选范围" description="min / max 限定可选日期（ISO 字符串，含边界），范围外日期禁用。" code={RANGE_CODE}>
        <DatePicker
          min="2024-01-01"
          max="2024-12-31"
          defaultValue="2024-06-15"
          onChange={(iso: string) => setValue(iso)}
        />
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档。" code={SIZE_CODE}>
        <div className="doc-pg-preview-row">
          <DatePicker size="sm" placeholder="小尺寸" />
          <DatePicker size="md" placeholder="中尺寸" />
          <DatePicker size="lg" placeholder="大尺寸" />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: "受控值，ISO 'YYYY-MM-DD'。",
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: '非受控初始值。',
          },
          {
            name: 'onChange',
            type: '(iso: string) => void',
            description: '选中日期回调，携带 ISO 字符串。',
          },
          {
            name: 'min',
            type: 'string',
            description: '可选最小日期（ISO，含）。',
          },
          {
            name: 'max',
            type: 'string',
            description: '可选最大日期（ISO，含）。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用。',
          },
          {
            name: 'placeholder',
            type: 'string',
            description: '占位文案。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'classNames',
            type: '{ root?; trigger?; panel?; day?; header?; input?; icon?; label?; nav?; grid?; week?; weekday? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        键盘支持：←→/↑↓ 移动日期（周循环）、Home/End 月首尾、PageUp/PageDown 上/下月、Enter 选中关闭、Esc
        关闭归还焦点。日历网格使用 <code className="doc-code-inline">role=&quot;grid&quot;</code> +
        <code className="doc-code-inline">role=&quot;gridcell&quot;</code> +{' '}
        <code className="doc-code-inline">aria-selected</code>。
      </p>

      <CustomizeOutlet
        name="DatePicker"
        parts={['root', 'trigger', 'input', 'icon', 'panel', 'header', 'nav', 'label', 'grid', 'week', 'weekday', 'day']}
        vars={[
          '--z-datepicker-trigger-height',
          '--z-datepicker-trigger-bg',
          '--z-datepicker-trigger-fg',
          '--z-datepicker-trigger-border',
          '--z-datepicker-trigger-radius',
          '--z-datepicker-trigger-padding-x',
          '--z-datepicker-trigger-font-size',
          '--z-datepicker-trigger-hover-border',
          '--z-datepicker-trigger-focus-border',
          '--z-datepicker-trigger-focus-ring',
          '--z-datepicker-placeholder-fg',
          '--z-datepicker-icon-color',
          '--z-datepicker-panel-width',
          '--z-datepicker-panel-bg',
          '--z-datepicker-panel-border',
          '--z-datepicker-panel-radius',
          '--z-datepicker-panel-shadow',
          '--z-datepicker-panel-padding',
          '--z-datepicker-panel-gap',
          '--z-datepicker-header-gap',
          '--z-datepicker-nav-size',
          '--z-datepicker-nav-color',
          '--z-datepicker-nav-hover-bg',
          '--z-datepicker-label-fg',
          '--z-datepicker-label-font-size',
          '--z-datepicker-label-font-weight',
          '--z-datepicker-weekday-fg',
          '--z-datepicker-weekday-font-size',
          '--z-datepicker-grid-gap',
          '--z-datepicker-day-size',
          '--z-datepicker-day-fg',
          '--z-datepicker-day-font-size',
          '--z-datepicker-day-radius',
          '--z-datepicker-day-hover-bg',
          '--z-datepicker-day-out-fg',
          '--z-datepicker-day-disabled-fg',
          '--z-datepicker-day-selected-bg',
          '--z-datepicker-day-selected-fg',
          '--z-datepicker-day-today-border',
          '--z-datepicker-disabled-bg',
          '--z-datepicker-disabled-border',
          '--z-datepicker-disabled-fg',
          '--z-datepicker-transition',
        ]}
      />
    </div>
  );
}
