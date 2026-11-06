import { useState } from 'react';
import { Segmented } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [value, setValue] = useState('list');

<Segmented
  options={[
    { value: 'list', label: '列表' },
    { value: 'board', label: '看板' },
    { value: 'chart', label: '图表' },
  ]}
  value={value}
  onChange={setValue}
/>
<span>当前：{value}</span>`;

const SIZE_CODE = `<Segmented size="sm" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />
<Segmented size="md" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />
<Segmented size="lg" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />`;

const ADVANCED_CODE = `<Segmented
  block
  options={[
    { value: 'all', label: '全部', icon: <span aria-hidden="true">☰</span> },
    { value: 'star', label: '已收藏', icon: <span aria-hidden="true">★</span> },
    { value: 'archived', label: '已归档', disabled: true },
  ]}
  defaultValue="all"
/>`;

export default function SegmentedPage(): React.ReactNode {
  usePageTitle('Segmented 分段控制器');
  const [value, setValue] = useState('list');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Segmented 分段控制器</h1>
      <p className="doc-lead">分段控制器，用于在少量互斥选项间快速切换视图。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="role=radiogroup + role=radio 语义，←→ 键盘切换；选中项滑块（thumb）带过渡动画。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <Segmented
            options={[
              { value: 'list', label: '列表' },
              { value: 'board', label: '看板' },
              { value: 'chart', label: '图表' },
            ]}
            value={value}
            onChange={setValue}
          />
          <span>当前：{value}</span>
        </div>
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档。" code={SIZE_CODE}>
        <div className="doc-pg-preview-row">
          <Segmented size="sm" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />
          <Segmented size="md" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />
          <Segmented size="lg" options={[{ value: 'a', label: '日' }, { value: 'b', label: '周' }]} />
        </div>
      </Demo>

      <Demo title="图标与禁用项" description="option 支持 icon 与 disabled；block 撑满宽度。" code={ADVANCED_CODE} stack>
        <Segmented
          block
          options={[
            { value: 'all', label: '全部', icon: <span aria-hidden="true">☰</span> },
            { value: 'star', label: '已收藏', icon: <span aria-hidden="true">★</span> },
            { value: 'archived', label: '已归档', disabled: true },
          ]}
          defaultValue="all"
        />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'options',
            type: 'Array<{ value: string; label: React.ReactNode; icon?; disabled? }>',
            description: '选项列表。',
          },
          {
            name: 'value',
            type: 'string',
            description: '受控选中值。',
          },
          {
            name: 'defaultValue',
            type: 'string',
            defaultValue: 'options[0].value',
            description: '非受控初始值。',
          },
          {
            name: 'onChange',
            type: '(value: string) => void',
            description: '选中变化回调。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'block',
            type: 'boolean',
            defaultValue: 'false',
            description: '撑满宽度。',
          },
          {
            name: 'classNames',
            type: '{ root?; item?; thumb? }',
            description: 'slot 级类名追加（root / item / thumb）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Segmented"
        parts={['root', 'item', 'thumb']}
        vars={[
          '--z-segmented-bg',
          '--z-segmented-fg',
          '--z-segmented-active-fg',
          '--z-segmented-hover-bg',
          '--z-segmented-padding',
          '--z-segmented-radius',
          '--z-segmented-gap',
          '--z-segmented-font-size',
          '--z-segmented-font-weight',
          '--z-segmented-item-height',
          '--z-segmented-item-padding-x',
          '--z-segmented-icon-size',
          '--z-segmented-thumb-bg',
          '--z-segmented-thumb-radius',
          '--z-segmented-thumb-shadow',
          '--z-segmented-transition',
        ]}
      />
    </div>
  );
}
