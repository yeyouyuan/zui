import { useState } from 'react';
import { InputNumber } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [quantity, setQuantity] = useState<number | null>(1);

<InputNumber value={quantity} onChange={setQuantity} aria-label="数量" />
<span>当前值：{quantity === null ? '（空）' : quantity}</span>`;

const SIZES_CODE = `<InputNumber size="sm" defaultValue={1} aria-label="小尺寸" />
<InputNumber size="md" defaultValue={1} aria-label="中尺寸" />
<InputNumber size="lg" defaultValue={1} aria-label="大尺寸" />`;

const STEP_CODE = `<InputNumber step={5} min={0} max={50} defaultValue={10} aria-label="步进 5" />
<InputNumber step={0.25} precision={2} defaultValue={1.5} aria-label="精度 2 位" />`;

const LAYOUT_CODE = `<InputNumber min={0} max={10} defaultValue={99} aria-label="边界 clamp" />
<InputNumber controls={false} defaultValue={3} aria-label="无步进按钮" />
<InputNumber disabled defaultValue={3} aria-label="禁用" />`;

export default function InputNumberPage(): React.ReactNode {
  usePageTitle('InputNumber 数字输入');
  const [quantity, setQuantity] = useState<number | null>(1);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">InputNumber 数字输入</h1>
      <p className="doc-lead">
        带 +/- 步进按钮的数值输入框：↑↓ 键盘步进、min/max 边界 clamp、precision 小数位控制，
        input type=number 的 spinbutton 语义原生保留。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="value / onChange 受控范式；清空时 onChange 收到 null，失焦时自动做边界与精度归一。"
        code={BASIC_CODE}
      >
        <InputNumber value={quantity} onChange={setQuantity} aria-label="数量" />
        <span className="doc-p">当前值：{quantity === null ? '（空）' : quantity}</span>
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档，默认 md。" code={SIZES_CODE}>
        <InputNumber size="sm" defaultValue={1} aria-label="小尺寸" />
        <InputNumber size="md" defaultValue={1} aria-label="中尺寸" />
        <InputNumber size="lg" defaultValue={1} aria-label="大尺寸" />
      </Demo>

      <Demo
        title="步进与精度"
        description="step 同时作用于 +/- 按钮与 ↑↓ 键盘；precision 控制小数位（显示与提交均按此舍入）。"
        code={STEP_CODE}
      >
        <InputNumber step={5} min={0} max={50} defaultValue={10} aria-label="步进 5" />
        <InputNumber step={0.25} precision={2} defaultValue={1.5} aria-label="精度 2 位" />
      </Demo>

      <Demo
        title="边界、无按钮与禁用"
        description="min / max 边界 clamp（到边界时对应步进按钮禁用）；controls={false} 隐藏 +/- 按钮；disabled 禁用全部交互。"
        code={LAYOUT_CODE}
        stack
      >
        <InputNumber min={0} max={10} defaultValue={99} aria-label="边界 clamp" />
        <InputNumber controls={false} defaultValue={3} aria-label="无步进按钮" />
        <InputNumber disabled defaultValue={3} aria-label="禁用" />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'number | null',
            description: '受控值（null 表示空）。',
          },
          {
            name: 'defaultValue',
            type: 'number | null',
            defaultValue: 'null',
            description: '非受控初始值。',
          },
          {
            name: 'onChange',
            type: '(v: number | null) => void',
            description: '值变更回调（清空时为 null）。',
          },
          {
            name: 'min / max',
            type: 'number',
            defaultValue: '-Infinity / Infinity',
            description: '边界：步进与失焦提交时 clamp 到 [min, max]。',
          },
          {
            name: 'step',
            type: 'number',
            defaultValue: '1',
            description: '步进，+/- 按钮与 ↑↓ 键盘共用。',
          },
          {
            name: 'precision',
            type: 'number',
            description: '小数位数，提交与显示均按此舍入（未设时按 step 的小数位消除浮点误差）。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'controls',
            type: 'boolean',
            defaultValue: 'true',
            description: '显示 +/- 步进按钮（aria-label="增加" / "减少"）。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用（原生 disabled）。',
          },
          {
            name: 'classNames',
            type: '{ root?; input?; increase?; decrease? }',
            description: 'slot 级类名追加（root / input / increase / decrease）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'input'>",
            description: "原生 input 属性透传到数字输入本体（placeholder、name、aria-* 等；'value'/'defaultValue'/'onChange'/'size' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-size</code>、
        <code className="doc-code-inline">data-disabled</code>；原生 spinner 已隐藏，步进入口只有键盘与按钮。
      </p>

      <CustomizeOutlet
        name="InputNumber"
        parts={['root', 'input', 'controls', 'increase', 'decrease']}
        vars={[
          '--z-input-number-height',
          '--z-input-number-padding-x',
          '--z-input-number-gap',
          '--z-input-number-font-size',
          '--z-input-number-radius',
          '--z-input-number-bg',
          '--z-input-number-fg',
          '--z-input-number-border',
          '--z-input-number-hover-border',
          '--z-input-number-focus-border',
          '--z-input-number-focus-ring',
          '--z-input-number-control-width',
          '--z-input-number-control-color',
          '--z-input-number-control-hover-bg',
          '--z-input-number-control-hover-color',
          '--z-input-number-control-active-bg',
          '--z-input-number-disabled-bg',
          '--z-input-number-disabled-fg',
          '--z-input-number-disabled-border',
          '--z-input-number-transition',
        ]}
      />
    </div>
  );
}
