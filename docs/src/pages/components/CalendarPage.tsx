import { useState } from 'react';
import { Calendar } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [value, setValue] = useState('2026-11-04');

<Calendar value={value} onChange={setValue} />
<span>选中：{value}</span>`;

const UNCONTROLLED_CODE = `<Calendar defaultValue="2026-11-04" onChange={(iso) => console.log(iso)} />`;

const LAYOUT_CODE = `<Calendar defaultValue="2026-11-04" fullscreen />
<Calendar defaultValue="2026-11-04" fullscreen={false} />`;

export default function CalendarPage(): React.ReactNode {
  usePageTitle('Calendar 日历');
  const [value, setValue] = useState('2026-11-04');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Calendar 日历</h1>
      <p className="doc-lead">
        静态日历展示组件：月份导航、选中日与今天高亮，完整的 grid 语义与键盘导航。 与 DatePicker
        独立实现，适合内嵌在日程、活动等面板中。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="受控模式下 value 驱动选中日，onChange 回调 ISO 'YYYY-MM-DD'；今天高亮、选中日实底主色。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <Calendar value={value} onChange={setValue} />
          <p className="doc-p">
            选中：<code className="doc-code-inline">{value}</code>
          </p>
        </div>
      </Demo>

      <Demo
        title="非受控"
        description="只给 defaultValue，组件内部管理选中状态，onChange 仅作通知。"
        code={UNCONTROLLED_CODE}
      >
        <Calendar defaultValue="2026-11-04" onChange={() => undefined} />
      </Demo>

      <Demo
        title="布局"
        description="fullscreen 默认 true 撑满容器；false 时收缩为内容宽度，适合侧栏。"
        code={LAYOUT_CODE}
      >
        <div className="doc-pg-preview-row">
          <Calendar defaultValue="2026-11-04" fullscreen={false} />
          <div style={{ width: 320, maxWidth: 'min(320px, calc(100vw - 60px))' }}>
            <Calendar defaultValue="2026-11-04" />
          </div>
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
            description: '选中日期后回调（ISO）。',
          },
          {
            name: 'fullscreen',
            type: 'boolean',
            defaultValue: 'true',
            description: 'true 全幅撑满容器；false 收缩为内容宽度。',
          },
          {
            name: 'classNames',
            type: '{ root?; header?; label?; nav?; grid?; week?; weekday?; day? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到根元素（className、style、aria-*、事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        键盘：<code className="doc-code-inline">←→/↑↓</code> 移动（周循环）、
        <code className="doc-code-inline">Home/End</code> 月首尾、
        <code className="doc-code-inline">PageUp/PageDown</code> 上/下月、
        <code className="doc-code-inline">Enter/Space</code> 选中；网格 role=grid / gridcell，
        aria-selected 标记选中日，aria-current=date 标记今天。
      </p>

      <CustomizeOutlet
        name="Calendar"
        parts={['root', 'header', 'label', 'nav', 'grid', 'week', 'weekday', 'day']}
        vars={[
          '--z-calendar-bg',
          '--z-calendar-fg',
          '--z-calendar-border',
          '--z-calendar-radius',
          '--z-calendar-padding',
          '--z-calendar-label-font-size',
          '--z-calendar-label-font-weight',
          '--z-calendar-label-fg',
          '--z-calendar-nav-size',
          '--z-calendar-nav-radius',
          '--z-calendar-nav-fg',
          '--z-calendar-nav-hover-bg',
          '--z-calendar-grid-gap',
          '--z-calendar-weekday-font-size',
          '--z-calendar-weekday-fg',
          '--z-calendar-day-size',
          '--z-calendar-day-font-size',
          '--z-calendar-day-fg',
          '--z-calendar-day-radius',
          '--z-calendar-day-hover-bg',
          '--z-calendar-day-selected-bg',
          '--z-calendar-day-selected-fg',
          '--z-calendar-day-today-border',
          '--z-calendar-day-today-fg',
          '--z-calendar-day-out-fg',
          '--z-calendar-focus-ring',
          '--z-calendar-transition',
        ]}
      />
    </div>
  );
}
