import { useState } from 'react';
import { Select } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const LANG_OPTIONS = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어', disabled: true },
  { value: 'fr', label: 'Français' },
];

const BASIC_CODE = `const [value, setValue] = useState('zh');

<Select
  options={[
    { value: 'zh', label: '简体中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어', disabled: true },
    { value: 'fr', label: 'Français' },
  ]}
  value={value}
  onChange={setValue}
  placeholder="请选择语言"
/>
<span>当前值：{value}</span>`;

const KEYBOARD_CODE = `// 焦点保持在触发器上，用 aria-activedescendant 虚拟移动高亮项
<Select options={options} aria-label="语言" />
// 关闭时：Enter / Space / ↓ / ↑ 打开
// 打开时：↑ ↓ 移动、Home / End 首尾、Enter / Space 选中
// Esc 关闭并把焦点还给触发器、Tab 关闭、首字母 typeahead 快速定位`;

const STATUS_CODE = `<Select options={options} status="error" defaultValue="" aria-label="错误态" />
<Select options={options} status="success" defaultValue="zh" aria-label="成功态" />`;

const MISC_CODE = `<Select options={options} size="sm" aria-label="小尺寸" />
<Select options={options} size="lg" aria-label="大尺寸" />
<Select options={options} disabled defaultValue="zh" aria-label="禁用" />
<Select options={options} name="lang" defaultValue="zh" aria-label="表单提交" />`;

export default function SelectPage(): React.ReactNode {
  usePageTitle('Select 选择器');
  const [value, setValue] = useState('zh');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Select 选择器</h1>
      <p className="doc-lead">
        select-only combobox（WAI-ARIA APG 模式）：焦点始终留在触发器上，弹层用
        aria-activedescendant 虚拟移动，完整支持键盘导航与 typeahead。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="options 描述选项列表，value / onChange 组成受控契约；disabled 选项可导航但不可选。"
        code={BASIC_CODE}
      >
        <div style={{ width: 220 }}>
          <Select options={LANG_OPTIONS} value={value} onChange={setValue} placeholder="请选择语言" />
        </div>
        <span className="doc-pg-value">当前值：{value}</span>
      </Demo>

      <Demo
        title="键盘操作"
        description="点击下方选择器后直接用键盘试试（演示完按 Esc 关闭）："
        code={KEYBOARD_CODE}
      >
        <div style={{ width: 220 }}>
          <Select options={LANG_OPTIONS} aria-label="语言" />
        </div>
        <ul className="doc-kbd-row">
          <li>
            <span className="doc-kbd">Enter</span> / <span className="doc-kbd">Space</span> /{' '}
            <span className="doc-kbd">↓</span> 打开
          </li>
          <li>
            <span className="doc-kbd">↑</span> <span className="doc-kbd">↓</span> 移动高亮
          </li>
          <li>
            <span className="doc-kbd">Home</span> / <span className="doc-kbd">End</span> 首尾项
          </li>
          <li>
            <span className="doc-kbd">Enter</span> 选中 · <span className="doc-kbd">Esc</span> 关闭
          </li>
          <li>输入首字母 typeahead 快速定位</li>
        </ul>
      </Demo>

      <Demo title="校验状态" description="status 暴露为 data-status，配合错误/成功语义色。" code={STATUS_CODE}>
        <div style={{ width: 220 }}>
          <Select options={LANG_OPTIONS} status="error" defaultValue="" aria-label="错误态" />
        </div>
        <div style={{ width: 220 }}>
          <Select options={LANG_OPTIONS} status="success" defaultValue="zh" aria-label="成功态" />
        </div>
      </Demo>

      <Demo
        title="尺寸、禁用与表单提交"
        description="size 三档；disabled 整体禁用；传 name 时渲染隐藏 input 供表单提交。"
        code={MISC_CODE}
      >
        <div style={{ width: 180 }}>
          <Select options={LANG_OPTIONS} size="sm" aria-label="小尺寸" />
        </div>
        <div style={{ width: 180 }}>
          <Select options={LANG_OPTIONS} size="lg" aria-label="大尺寸" />
        </div>
        <div style={{ width: 180 }}>
          <Select options={LANG_OPTIONS} disabled defaultValue="zh" aria-label="禁用" />
        </div>
        <div style={{ width: 180 }}>
          <Select options={LANG_OPTIONS} name="lang" defaultValue="zh" aria-label="表单提交" />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'options',
            type: 'SelectOption[]',
            description: '选项列表。SelectOption = { value: string; label: React.ReactNode; disabled?: boolean }。',
          },
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
            name: 'placeholder',
            type: 'string',
            defaultValue: "'请选择'",
            description: '未选中时的占位文本。',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: '整体禁用。',
          },
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '尺寸。',
          },
          {
            name: 'status',
            type: "'default' | 'error' | 'success'",
            defaultValue: "'default'",
            description: '校验状态。',
          },
          {
            name: 'id',
            type: 'string',
            description: '触发器元素 id（缺省自动生成）。',
          },
          {
            name: 'name',
            type: 'string',
            description: '渲染隐藏 input 供表单提交。',
          },
          {
            name: 'className',
            type: 'string',
            description: '追加到根元素。',
          },
          {
            name: 'classNames',
            type: '{ root?; trigger?; value?; listbox?; option?; empty? }',
            description: 'slot 级类名追加。',
          },
          {
            name: "'aria-label' / 'aria-labelledby' / 'aria-describedby'",
            type: 'string',
            description: '无障碍标注，透传给触发器。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Select"
        parts={['root', 'trigger', 'value', 'listbox', 'option', 'empty']}
        vars={[
          '--z-select-trigger-height',
          '--z-select-trigger-padding-x',
          '--z-select-trigger-font-size',
          '--z-select-trigger-radius',
          '--z-select-trigger-bg',
          '--z-select-trigger-fg',
          '--z-select-trigger-border',
          '--z-select-trigger-hover-border',
          '--z-select-placeholder-fg',
          '--z-select-listbox-bg',
          '--z-select-listbox-border',
          '--z-select-listbox-radius',
          '--z-select-listbox-shadow',
          '--z-select-listbox-padding',
          '--z-select-listbox-margin-top',
          '--z-select-listbox-max-height',
          '--z-select-option-padding-x',
          '--z-select-option-padding-y',
          '--z-select-option-radius',
          '--z-select-option-fg',
          '--z-select-option-hover-bg',
          '--z-select-option-active-bg',
          '--z-select-option-active-fg',
          '--z-select-option-disabled-fg',
          '--z-select-empty-fg',
          '--z-select-empty-padding',
          '--z-select-animation-duration',
        ]}
      />
    </div>
  );
}
