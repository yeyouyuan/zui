import { useState } from 'react';
import { Switch } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Switch label="接收通知" defaultChecked />
<Switch />`;

const SIZE_CODE = `<Switch size="sm" label="小尺寸" />
<Switch size="md" label="中尺寸（默认）" />`;

const CONTROLLED_CODE = `const [on, setOn] = useState(false);

<Switch checked={on} onChange={setOn} label={on ? '已开启' : '已关闭'} />`;

const DISABLED_CODE = `<Switch label="禁用（关）" disabled />
<Switch label="禁用（开）" disabled defaultChecked />`;

export default function SwitchPage(): React.ReactNode {
  usePageTitle('Switch 开关');
  const [on, setOn] = useState(false);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Switch 开关</h1>
      <p className="doc-lead">
        原生 button 承载的开关：role=&quot;switch&quot; + aria-checked，Space / Enter 原生触发切换，
        track / thumb 两个视觉件由令牌驱动。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="label 可选；点击或按 Space / Enter 切换。" code={BASIC_CODE}>
        <Switch label="接收通知" defaultChecked />
        <Switch />
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md 两档（无 lg），默认 md。" code={SIZE_CODE}>
        <Switch size="sm" label="小尺寸" />
        <Switch size="md" label="中尺寸（默认）" />
      </Demo>

      <Demo
        title="受控模式"
        description="checked + onChange(checked: boolean) 组成受控契约。"
        code={CONTROLLED_CODE}
      >
        <Switch checked={on} onChange={setOn} label={on ? '已开启' : '已关闭'} />
      </Demo>

      <Demo title="禁用" description="禁用时轨道与滑块降级为 disabled 令牌色。" code={DISABLED_CODE}>
        <Switch label="禁用（关）" disabled />
        <Switch label="禁用（开）" disabled defaultChecked />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'checked',
            type: 'boolean',
            description: '受控开关态。',
          },
          {
            name: 'defaultChecked',
            type: 'boolean',
            description: '非受控初始态。',
          },
          {
            name: 'onChange',
            type: '(checked: boolean) => void',
            description: '开关变化回调（参数为布尔值）。',
          },
          {
            name: 'size',
            type: "'sm' | 'md'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'label',
            type: 'React.ReactNode',
            description: '标签内容。',
          },
          {
            name: 'classNames',
            type: '{ root?; track?; thumb?; label? }',
            description: 'slot 级类名追加（root / track / thumb / label）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'button'>",
            description: "原生 button 属性透传（'onChange'、'value'、'type' 除外）。",
          },
        ]}
      />

      <CustomizeOutlet
        name="Switch"
        parts={['root', 'track', 'label']}
        vars={[
          '--z-switch-track-width',
          '--z-switch-track-height',
          '--z-switch-track-bg',
          '--z-switch-track-checked-bg',
          '--z-switch-track-disabled-bg',
          '--z-switch-thumb-size',
          '--z-switch-thumb-offset',
          '--z-switch-thumb-travel',
          '--z-switch-thumb-bg',
          '--z-switch-thumb-disabled-bg',
          '--z-switch-gap',
          '--z-switch-label-color',
          '--z-switch-label-font-size',
          '--z-switch-transition',
        ]}
        note="thumb 槽位当前带类名 z-switch-thumb（classNames.thumb 可追加），未标注 data-part。"
      />
    </div>
  );
}
