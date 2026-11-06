import { useState } from 'react';
import { Spin } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Spin />
<Spin tip="加载中…" />`;

const SIZE_CODE = `<Spin size="sm" />
<Spin size="md" />
<Spin size="lg" />`;

const WRAP_CODE = `const [spinning, setSpinning] = useState(true);

<Spin spinning={spinning} tip="加载中">
  <div>被包裹的内容区</div>
</Spin>
<Button onClick={() => setSpinning(!spinning)}>切换加载态</Button>`;

export default function SpinPage(): React.ReactNode {
  usePageTitle('Spin 加载中');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Spin 加载中</h1>
      <p className="doc-lead">
        旋转环加载指示器：独立模式直接渲染；包裹模式覆盖在内容区之上（半透明遮罩 + aria-busy），
        指示器用纯 SVG 环形动画。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="独立模式默认 spinning 渲染旋转环；tip 可附底部文案。"
        code={BASIC_CODE}
      >
        <Spin />
        <Spin tip="加载中…" />
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档，默认 md。" code={SIZE_CODE}>
        <Spin size="sm" />
        <Spin size="md" />
        <Spin size="lg" />
      </Demo>

      <Demo
        title="包裹模式"
        description="传入 children 后内容被半透明遮罩覆盖，内容区带 aria-busy 与 inert；spinning=false 时内容恢复可交互。"
        code={WRAP_CODE}
        stack
      >
        <WrapDemo />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'spinning',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否处于加载中；独立模式下 false 不渲染任何内容。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '旋转环尺寸。',
          },
          {
            name: 'tip',
            type: 'React.ReactNode',
            description: '加载指示器下方文案。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '包裹模式：有 children 时半透明遮罩覆盖内容并标记 aria-busy。',
          },
          {
            name: 'classNames',
            type: '{ root?; spinner?; tip? }',
            description: 'slot 级类名追加（root / spinner / tip）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Spin"
        parts={['root', 'spinner', 'tip']}
        vars={[
          '--z-spin-size',
          '--z-spin-ring-width',
          '--z-spin-color',
          '--z-spin-track-color',
          '--z-spin-tip-color',
          '--z-spin-tip-font-size',
          '--z-spin-gap',
          '--z-spin-mask-bg',
        ]}
      />
    </div>
  );
}

function WrapDemo(): React.ReactNode {
  const [spinning, setSpinning] = useState(true);
  return (
    <div className="doc-pg-preview-row">
      <Spin spinning={spinning} tip="加载中">
        <div className="doc-p" style={{ padding: 16, minWidth: 240 }}>
          被包裹的内容区
        </div>
      </Spin>
      <button className="doc-code-inline" onClick={() => setSpinning(!spinning)}>
        切换加载态
      </button>
    </div>
  );
}
