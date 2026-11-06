import { useState } from 'react';
import { Slider } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [value, setValue] = useState(30);

<Slider value={value} onChange={setValue} />
<span>{value}</span>`;

const RANGE_CODE = `<Slider min={0} max={1000} step={100} defaultValue={500} />
<Slider min={-50} max={50} step={5} defaultValue={0} />`;

const MARKS_CODE = `<Slider
  marks={{ 0: '冷', 50: '温', 100: '热' }}
  defaultValue={50}
/>
<Slider defaultValue={70} tooltip={false} />
<Slider defaultValue={20} disabled />`;

export default function SliderPage(): React.ReactNode {
  usePageTitle('Slider 滑块');
  const [value, setValue] = useState(30);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Slider 滑块</h1>
      <p className="doc-lead">滑块：连续取值输入，支持刻度、数值气泡与 APG 键盘步进。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="拖动 thumb 调整数值；role=slider + aria-valuenow/min/max/valuetext，←→/↑↓/Home/End/PageUp/PageDown 键盘步进。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <div style={{ flex: 1 }}>
            <Slider value={value} onChange={setValue} />
          </div>
          <span>{value}</span>
        </div>
      </Demo>

      <Demo title="范围与步进" description="min / max / step 控制取值范围与步长（默认 0 / 100 / 1）。" code={RANGE_CODE} stack>
        <Slider min={0} max={1000} step={100} defaultValue={500} />
        <Slider min={-50} max={50} step={5} defaultValue={0} />
      </Demo>

      <Demo title="刻度、气泡与禁用" description="marks 添加刻度标注；tooltip=false 隐藏拖动数值气泡；disabled 禁用。" code={MARKS_CODE} stack>
        <Slider marks={{ 0: '冷', 50: '温', 100: '热' }} defaultValue={50} />
        <Slider defaultValue={70} tooltip={false} />
        <Slider defaultValue={20} disabled />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'number',
            description: '受控值。',
          },
          {
            name: 'defaultValue',
            type: 'number',
            description: '非受控初始值。',
          },
          {
            name: 'onChange',
            type: '(v: number) => void',
            description: '值变化回调。',
          },
          {
            name: 'min',
            type: 'number',
            defaultValue: '0',
            description: '最小值。',
          },
          {
            name: 'max',
            type: 'number',
            defaultValue: '100',
            description: '最大值。',
          },
          {
            name: 'step',
            type: 'number',
            defaultValue: '1',
            description: '步长。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用。',
          },
          {
            name: 'marks',
            type: 'Record<number, React.ReactNode>',
            description: '刻度标注。',
          },
          {
            name: 'tooltip',
            type: 'boolean',
            defaultValue: 'true',
            description: '拖动时显示数值气泡。',
          },
          {
            name: 'classNames',
            type: '{ root?; track?; fill?; thumb?; mark? }',
            description: 'slot 级类名追加（root / track / fill / thumb / mark）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Slider"
        parts={['root', 'track', 'fill', 'thumb', 'mark', 'tooltip']}
        vars={[
          '--z-slider-track-height',
          '--z-slider-track-bg',
          '--z-slider-track-radius',
          '--z-slider-fill-bg',
          '--z-slider-thumb-size',
          '--z-slider-thumb-bg',
          '--z-slider-thumb-border',
          '--z-slider-thumb-shadow',
          '--z-slider-thumb-focus-ring',
          '--z-slider-mark-color',
          '--z-slider-mark-active-color',
          '--z-slider-mark-font-size',
          '--z-slider-tooltip-bg',
          '--z-slider-tooltip-fg',
          '--z-slider-tooltip-font-size',
          '--z-slider-tooltip-padding-x',
          '--z-slider-tooltip-padding-y',
          '--z-slider-tooltip-radius',
          '--z-slider-disabled-opacity',
          '--z-slider-transition',
        ]}
      />
    </div>
  );
}
