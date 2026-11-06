import { useState } from 'react';
import { Rate } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [value, setValue] = useState(3);

<Rate value={value} onChange={setValue} />
<span>{value} 星</span>`;

const HALF_CODE = `<Rate allowHalf defaultValue={2.5} />
<Rate count={10} defaultValue={7} />`;

const STATE_CODE = `<Rate defaultValue={4} disabled />
<Rate defaultValue={4} readonly />`;

export default function RatePage(): React.ReactNode {
  usePageTitle('Rate 评分');
  const [value, setValue] = useState(3);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Rate 评分</h1>
      <p className="doc-lead">评分：星级打分，radiogroup 语义，支持半星与键盘调整。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="点击星形按钮选择分值；role=radiogroup + 每星 role=radio + aria-checked，←→ 键盘调整。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <Rate value={value} onChange={setValue} />
          <span>{value} 星</span>
        </div>
      </Demo>

      <Demo title="半星与自定义数量" description="allowHalf 开启 0.5 步进；count 控制星形数量（默认 5）。" code={HALF_CODE}>
        <div className="doc-pg-preview-row">
          <Rate allowHalf defaultValue={2.5} />
          <Rate count={10} defaultValue={7} />
        </div>
      </Demo>

      <Demo title="禁用与只读" description="disabled 禁用交互（原生 disabled 星按钮）；readonly 仅展示。" code={STATE_CODE}>
        <div className="doc-pg-preview-row">
          <Rate defaultValue={4} disabled />
          <Rate defaultValue={4} readonly />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'number',
            description: '受控值（0..count，allowHalf 时步进 0.5）。',
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
            name: 'count',
            type: 'number',
            defaultValue: '5',
            description: '星形数量。',
          },
          {
            name: 'allowHalf',
            type: 'boolean',
            defaultValue: 'false',
            description: '是否允许半星。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用（原生 disabled 星按钮）。',
          },
          {
            name: 'readonly',
            type: 'boolean',
            defaultValue: 'false',
            description: '只读展示。',
          },
          {
            name: 'classNames',
            type: '{ root?; star?; half? }',
            description: 'slot 级类名追加（root / star / half）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Rate"
        parts={['root', 'star', 'half']}
        vars={[
          '--z-rate-star-size',
          '--z-rate-star-empty-color',
          '--z-rate-star-filled-color',
          '--z-rate-star-hover-color',
          '--z-rate-gap',
          '--z-rate-disabled-opacity',
          '--z-rate-focus-ring',
          '--z-rate-transition',
        ]}
      />
    </div>
  );
}
