import { useState } from 'react';
import { ColorPicker } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<ColorPicker defaultValue="#1677ff" onChange={(hex) => console.log(hex)} />

// 触发器显示色块 + hex 文本，点击弹出取色面板`;

const SIZES_CODE = `<ColorPicker size="sm" defaultValue="#f5222d" />
<ColorPicker size="md" defaultValue="#52c41a" />
<ColorPicker size="lg" defaultValue="#722ed1" />`;

const CONTROLLED_CODE = `const [color, setColor] = useState('#fa8c16');

<ColorPicker value={color} onChange={setColor} />
<span>当前颜色：{color}</span>`;

const DISABLED_CODE = `<ColorPicker disabled defaultValue="#1677ff" />
<ColorPicker disabled />`;

export default function ColorPickerPage(): React.ReactNode {
  usePageTitle('ColorPicker 取色器');
  const [color, setColor] = useState('#fa8c16');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">ColorPicker 取色器</h1>
      <p className="doc-lead">
        swatch 触发器（色块 + hex 文本）点击弹出取色面板：饱和度/亮度方块 + 色相条 + hex 输入，
        内部 HSV ↔ hex 转换，外部点击 / Esc 关闭，本版不做 alpha。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="非受控默认 '#1677ff'；hex 支持 '#rgb' / '#rrggbb'（省略 '#' 亦可），onChange 统一回调归一化 '#rrggbb' 小写。"
        code={BASIC_CODE}
      >
        <ColorPicker defaultValue="#1677ff" />
      </Demo>

      <Demo title="尺寸" description="size 提供 sm / md / lg 三档，控制触发器高度。" code={SIZES_CODE}>
        <ColorPicker size="sm" defaultValue="#f5222d" />
        <ColorPicker size="md" defaultValue="#52c41a" />
        <ColorPicker size="lg" defaultValue="#722ed1" />
      </Demo>

      <Demo
        title="受控"
        description="value / onChange 受控范式：外部不更新 value 时选色只回调、显示不漂移。"
        code={CONTROLLED_CODE}
      >
        <ColorPicker value={color} onChange={setColor} />
        <span className="doc-p">当前颜色：{color}</span>
      </Demo>

      <Demo
        title="禁用"
        description="disabled 置灰触发器（原生 disabled），面板不可打开。"
        code={DISABLED_CODE}
      >
        <ColorPicker disabled defaultValue="#1677ff" />
        <ColorPicker disabled />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'value',
            type: 'string',
            description: "受控值（hex，归一化 '#rrggbb' 小写）。",
          },
          {
            name: 'defaultValue',
            type: 'string',
            defaultValue: "'#ff0000'",
            description: "非受控初始值（'#rgb' / '#rrggbb' / 省略 '#' 均可）。",
          },
          {
            name: 'onChange',
            type: '(hex: string) => void',
            description: '值变更回调（归一化 hex）。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '禁用（触发器原生 disabled，面板不可开）。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '触发器尺寸。',
          },
          {
            name: 'classNames',
            type: '{ root?; swatch?; panel?; hue? }',
            description: 'slot 级类名追加（root / swatch / panel / hue）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: "原生 div 属性透传到根元素（className、style、aria-*、事件等；'value'/'defaultValue'/'onChange' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        面板键盘：<code className="doc-code-inline">←→/↑↓</code> 调饱和度/亮度、
        <code className="doc-code-inline">Home/End</code> 调色相；色相条聚焦时
        <code className="doc-code-inline">←→/↑↓</code> 按 slider 语义调色相；SV 方块与色相条支持点击与拖拽取色。
        根元素 data 属性：<code className="doc-code-inline">data-size</code>、
        <code className="doc-code-inline">data-open</code>、
        <code className="doc-code-inline">data-disabled</code>。
      </p>

      <CustomizeOutlet
        name="ColorPicker"
        parts={[
          'root',
          'swatch',
          'swatch-color',
          'swatch-hex',
          'panel',
          'sv',
          'sv-white',
          'sv-black',
          'sv-pointer',
          'hue',
          'hue-pointer',
          'hex',
        ]}
        vars={[
          '--z-color-picker-height',
          '--z-color-picker-font-size',
          '--z-color-picker-radius',
          '--z-color-picker-gap',
          '--z-color-picker-trigger-bg',
          '--z-color-picker-trigger-fg',
          '--z-color-picker-trigger-border',
          '--z-color-picker-trigger-hover-border',
          '--z-color-picker-trigger-focus-ring',
          '--z-color-picker-swatch-size',
          '--z-color-picker-swatch-radius',
          '--z-color-picker-swatch-border',
          '--z-color-picker-panel-width',
          '--z-color-picker-panel-bg',
          '--z-color-picker-panel-border',
          '--z-color-picker-panel-padding',
          '--z-color-picker-panel-gap',
          '--z-color-picker-panel-radius',
          '--z-color-picker-panel-shadow',
          '--z-color-picker-sv-height',
          '--z-color-picker-sv-radius',
          '--z-color-picker-hue-height',
          '--z-color-picker-hue-radius',
          '--z-color-picker-pointer-size',
          '--z-color-picker-pointer-border',
          '--z-color-picker-hex-input-bg',
          '--z-color-picker-hex-input-fg',
          '--z-color-picker-hex-input-border',
          '--z-color-picker-hex-input-radius',
          '--z-color-picker-disabled-bg',
          '--z-color-picker-disabled-fg',
          '--z-color-picker-disabled-border',
          '--z-color-picker-transition',
        ]}
        note="饱和度/亮度方块与色相条的纯色相谱、白/黑基色是取色器数学模型的一部分，由组件行内样式注入（与主题无关）；面板 UI 颜色全部走语义令牌。"
      />
    </div>
  );
}
