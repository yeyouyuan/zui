import { useState } from 'react';
import { Button, CommandPalette, MessageProvider, useMessage, type CommandPaletteCommand } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const commands: CommandPaletteCommand[] = [
  { key: 'overview', label: '跳转：概览', group: '页面', onSelect: () => navigate('/') },
  { key: 'dark', label: '切换暗色', group: '视图', shortcut: '⌘⇧L', onSelect: toggleDark },
];

<CommandPalette commands={commands} />`;

const CONTROLLED_CODE = `const [open, setOpen] = useState(false);

<>
  <Button onClick={() => setOpen(true)}>打开命令面板</Button>
  <CommandPalette
    commands={commands}
    open={open}
    onOpenChange={setOpen}
    hotkey={false}
  />
</>`;

function PaletteDemo(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const message = useMessage();
  const commands: CommandPaletteCommand[] = [
    { key: 'overview', label: '跳转：概览', group: '页面', onSelect: () => message.info('跳转到概览') },
    { key: 'icons', label: '跳转：图标库', group: '页面', onSelect: () => message.info('跳转到图标库') },
    { key: 'theme', label: '切换明暗主题', group: '视图', shortcut: '⌘⇧L', onSelect: () => message.info('切换主题') },
    { key: 'tokens', label: '查看设计令牌', group: '视图', onSelect: () => message.info('查看令牌') },
    { key: 'export', label: '导出数据', group: '操作', disabled: true, onSelect: () => {} },
  ];
  return <>
    <Button onClick={() => setOpen(true)}>打开基础命令面板</Button>
    <CommandPalette open={open} onOpenChange={setOpen} commands={commands} hotkey={false} aria-label="演示命令面板" />
  </>;
}

export default function CommandPalettePage(): React.ReactNode {
  usePageTitle('CommandPalette 命令面板');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">CommandPalette 命令面板</h1>
      <p className="doc-lead">
        全局热键（默认 ⌘K）唤起的命令搜索：复用 Modal 对话框语义（焦点陷阱、Esc
        关闭、归还焦点），分组 listbox + combobox 输入，键盘完整可达。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="commands 提供 key / label / group / shortcut / onSelect；输入按 label 与 keywords 包含匹配，↑↓ 跨分组移动，Enter 执行并关闭。"
        code={BASIC_CODE}
        stack
      >
        <MessageProvider>
          <PaletteDemo />
        </MessageProvider>
      </Demo>

      <Demo
        title="受控开关"
        description="应用通常用自己的按钮 + onOpenChange 控制 open；hotkey={false} 关闭全局热键避免与页面冲突。"
        code={CONTROLLED_CODE}
        stack
      >
        <ControlledDemo />
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'commands',
            type: 'CommandPaletteCommand[]',
            description:
              '命令列表 { key, label, textValue?, group?, shortcut?, icon?, disabled?, keywords?, onSelect }；未分组命令渲染在分组之前。',
          },
          {
            name: 'open / defaultOpen / onOpenChange',
            type: 'boolean / (open) => void',
            description: '开关状态；热键、选择命令、Esc、遮罩点击都走 onOpenChange。',
          },
          {
            name: 'hotkey',
            type: "string | false",
            defaultValue: "'mod+k'",
            description: "全局触发热键（mod = ⌘ / Ctrl）；false 关闭。",
          },
          {
            name: 'filter',
            type: 'false | (command, query) => boolean',
            description: '自定义过滤；false 关闭本地过滤，由外部按 query 驱动 commands。',
          },
          {
            name: 'placeholder / emptyContent / aria-label',
            type: 'string / ReactNode / string',
            description: '占位文案、空态内容与 dialog 可访问名（缺省取语言包文案）。',
          },
          {
            name: 'classNames',
            type: '{ root?; input?; listbox?; group?; groupLabel?; option?; optionIcon?; optionLabel?; optionShortcut?; empty? }',
            description: 'slot 级类名追加。',
          },
        ]}
      />
      <p className="doc-p">
        结构：复用 <code className="doc-code-inline">Modal</code>（role=dialog + aria-modal +
        焦点陷阱）；内部为 <code className="doc-code-inline">role=combobox</code> 输入 +
        <code className="doc-code-inline">role=listbox</code>，分组用
        <code className="doc-code-inline"> role=group + aria-labelledby</code>，高亮经
        aria-activedescendant 表达。
      </p>
    </div>
  );
}

function ControlledDemo(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const commands: CommandPaletteCommand[] = [
    { key: 'a', label: '动作一', onSelect: () => setOpen(false) },
    { key: 'b', label: '动作二', onSelect: () => setOpen(false) },
  ];
  return (
    <>
      <Button onClick={() => setOpen(true)}>打开命令面板</Button>
      <CommandPalette commands={commands} open={open} onOpenChange={setOpen} hotkey={false} />
    </>
  );
}
