import { useState } from 'react';
import { Radio, RadioGroup } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<RadioGroup name="plan" defaultValue="free">
  <Radio value="free" label="免费版" />
  <Radio value="pro" label="专业版" />
  <Radio value="team" label="团队版" />
</RadioGroup>`;

const ORIENTATION_CODE = `<RadioGroup name="size" orientation="horizontal" defaultValue="md">
  <Radio value="sm" label="小" />
  <Radio value="md" label="中" />
  <Radio value="lg" label="大" />
</RadioGroup>`;

const CONTROLLED_CODE = `const [value, setValue] = useState('pro');

<RadioGroup name="plan2" value={value} onChange={setValue}>
  <Radio value="free" label="免费版" />
  <Radio value="pro" label="专业版" />
</RadioGroup>
<span>当前：{value}</span>`;

const DISABLED_CODE = `<RadioGroup name="d1" defaultValue="a" disabled>
  <Radio value="a" label="组级禁用 A" />
  <Radio value="b" label="组级禁用 B" />
</RadioGroup>

<RadioGroup name="d2" defaultValue="x">
  <Radio value="x" label="正常" />
  <Radio value="y" label="项级禁用" disabled />
</RadioGroup>`;

export default function RadioPage(): React.ReactNode {
  usePageTitle('Radio 单选框');
  const [value, setValue] = useState('pro');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Radio 单选框</h1>
      <p className="doc-lead">
        单选框与单选组：RadioGroup 通过 Context 注入 name / value / onChange / disabled，
        组根为 role=&quot;radiogroup&quot;；不使用 Group 时回退原生 name 分组。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo title="基础用法" description="RadioGroup 包裹 Radio，默认纵向排列。" code={BASIC_CODE}>
        <RadioGroup name="plan" defaultValue="free">
          <Radio value="free" label="免费版" />
          <Radio value="pro" label="专业版" />
          <Radio value="team" label="团队版" />
        </RadioGroup>
      </Demo>

      <Demo
        title="横向排列"
        description='orientation="horizontal" 时组根带 aria-orientation="horizontal"，选项并排。'
        code={ORIENTATION_CODE}
      >
        <RadioGroup name="size" orientation="horizontal" defaultValue="md">
          <Radio value="sm" label="小" />
          <Radio value="md" label="中" />
          <Radio value="lg" label="大" />
        </RadioGroup>
      </Demo>

      <Demo
        title="受控模式"
        description="RadioGroup 的 value / onChange 组成受控契约，onChange 参数是选项的 value 字符串。"
        code={CONTROLLED_CODE}
      >
        <RadioGroup name="plan2" value={value} onChange={setValue}>
          <Radio value="free" label="免费版" />
          <Radio value="pro" label="专业版" />
        </RadioGroup>
        <span className="doc-pg-value">当前：{value}</span>
      </Demo>

      <Demo title="禁用" description="支持组级禁用（RadioGroup disabled）与项级禁用（Radio disabled）。" code={DISABLED_CODE} stack>
        <RadioGroup name="d1" defaultValue="a" disabled>
          <Radio value="a" label="组级禁用 A" />
          <Radio value="b" label="组级禁用 B" />
        </RadioGroup>
        <RadioGroup name="d2" defaultValue="x">
          <Radio value="x" label="正常" />
          <Radio value="y" label="项级禁用" disabled />
        </RadioGroup>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">RadioGroup</h3>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: '受控选中值。',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: '非受控初始值。',
          },
          {
            name: 'onChange',
            type: '(value: string) => void',
            description: '选中值变化回调。',
          },
          {
            name: 'name',
            type: 'string',
            description: '注入给组内 Radio 的表单 name。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '组级禁用，注入给所有 Radio。',
          },
          {
            name: 'orientation',
            type: "'horizontal' | 'vertical'",
            defaultValue: "'vertical'",
            description: '排列方向，写入 aria-orientation。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '组内 Radio 节点。',
          },
          {
            name: 'className',
            type: 'string',
            description: '追加到组根元素。',
          },
          {
            name: 'classNames',
            type: '{ root? }',
            description: 'slot 级类名追加（root）。',
          },
        ]}
      />
      <h3 className="doc-h3">Radio</h3>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: '选项值（必填）。',
          },
          {
            name: 'label',
            type: 'React.ReactNode',
            description: '标签内容。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用该选项。',
          },
          {
            name: 'classNames',
            type: '{ root?; control?; label? }',
            description: 'slot 级类名追加（root / control / label）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'input'>",
            description:
              "原生 input 属性透传（'type'、'onChange'、'checked'、'defaultChecked'、'size' 除外）。",
          },
        ]}
      />

      <CustomizeOutlet
        name="Radio"
        parts={['root', 'control', 'label']}
        vars={[
          '--z-radio-size',
          '--z-radio-gap',
          '--z-radio-group-gap',
          '--z-radio-bg',
          '--z-radio-border',
          '--z-radio-border-width',
          '--z-radio-checked-border',
          '--z-radio-dot-size',
          '--z-radio-dot-color',
          '--z-radio-label-color',
          '--z-radio-label-font-size',
          '--z-radio-disabled-bg',
          '--z-radio-disabled-fg',
          '--z-radio-disabled-border',
          '--z-radio-transition',
        ]}
      />
    </div>
  );
}
