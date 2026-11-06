import {
  ConfigProvider,
  Input,
  MessageProvider,
  Modal,
  Select,
  useMessage,
  useZuiConfig,
  Button,
} from '@zui/react';

import ApiTable from '../../components/ApiTable';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const FRUIT_OPTIONS = [
  { value: 'apple', label: '苹果' },
  { value: 'banana', label: '香蕉' },
  { value: 'orange', label: '橘子' },
];

const EN_LOCALE = {
  select: { placeholder: 'Please select' },
  input: { clear: 'Clear' },
  modal: { close: 'Close' },
  message: { close: 'Dismiss' },
};

const DEFAULT_CODE = `// 无 ConfigProvider：useZuiConfig 返回默认 zh-CN 文案，不 throw
<Input clearable defaultValue="有值时显示清除按钮" />
<Select options={FRUIT_OPTIONS} />`;

const OVERRIDE_CODE = `<ConfigProvider
  locale={{
    select: { placeholder: 'Please select' },
    input: { clear: 'Clear' },
    modal: { close: 'Close' },
    message: { close: 'Dismiss' },
  }}
>
  {/* 只覆盖部分键：其余键（如 pagination/empty）深合并保留 zh-CN 默认 */}
  <Input clearable defaultValue="clear me" />
  <Select options={FRUIT_OPTIONS} />
  <Modal>
    <Modal.Trigger>打开弹窗</Modal.Trigger>
    <Modal.Content>
      <Modal.Header>
        <Modal.Title>标题</Modal.Title>
      </Modal.Header>
      <Modal.Body>关闭按钮的 aria-label 来自 locale.modal.close。</Modal.Body>
      <Modal.Close />
    </Modal.Content>
  </Modal>
</ConfigProvider>`;

const READ_CODE = `function LocaleReadout() {
  const { locale } = useZuiConfig(); // 无 Provider 时返回默认，不 throw
  return <span>{locale.select.placeholder}</span>;
}

// 嵌套 ConfigProvider 逐层深合并：内层覆盖外层，缺省键继续回退
<ConfigProvider locale={{ select: { placeholder: '外层' } }}>
  <ConfigProvider locale={{ input: { clear: '内层' } }}>
    <LocaleReadout />
  </ConfigProvider>
</ConfigProvider>`;

/** 当前生效文案读取器：演示 useZuiConfig */
function LocaleReadout({ label }: { label?: string }): React.ReactNode {
  const { locale } = useZuiConfig();
  return (
    <div>
      {label ? <p className="doc-p">{label}</p> : null}
      <ul className="doc-chip-list">
        <li className="doc-chip">select.placeholder = &quot;{locale.select.placeholder}&quot;</li>
        <li className="doc-chip">input.clear = &quot;{locale.input.clear}&quot;</li>
        <li className="doc-chip">modal.close = &quot;{locale.modal.close}&quot;</li>
        <li className="doc-chip">message.close = &quot;{locale.message.close}&quot;</li>
      </ul>
    </div>
  );
}

/** 可关闭消息触发按钮（需在 MessageProvider 内） */
function MessageDemo(): React.ReactNode {
  const message = useMessage();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        message.show({
          content: '这是一条可关闭的消息（右上角按钮文案走 locale）',
          closable: true,
          duration: 0,
        })
      }
    >
      弹出消息
    </Button>
  );
}

export default function ConfigPage(): React.ReactNode {
  usePageTitle('ConfigProvider 全局配置');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">ConfigProvider 全局配置</h1>
      <p className="doc-lead">
        文案收口入口：通过 locale 深合并覆盖组件默认文案（placeholder、aria-label 等）， 子组件用
        useZuiConfig 读取；无 Provider 时返回默认 zh-CN，不抛错。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="默认文案（无 Provider）"
        description="不包 ConfigProvider 时一切照旧：Select 显示「请选择」、Input 清除按钮 aria-label 为「清除」，useZuiConfig 返回默认 zh-CN。"
        code={DEFAULT_CODE}
      >
        <Input aria-label="搜索" clearable defaultValue="有值时显示清除按钮" />
        <Select options={FRUIT_OPTIONS} aria-label="水果" />
        <LocaleReadout label="useZuiConfig() 读取到的当前文案：" />
      </Demo>

      <Demo
        title="locale 覆盖（深合并）"
        description="locale 只写需要覆盖的键，其余键深合并保留 zh-CN 默认；Select placeholder、Input 清除按钮、Modal/Message 关闭按钮均跟随 locale。"
        code={OVERRIDE_CODE}
        stack
      >
        <ConfigProvider locale={EN_LOCALE}>
          <Input aria-label="search" clearable defaultValue="clear me" />
          <Select options={FRUIT_OPTIONS} aria-label="fruit" />
          <Modal>
            <Modal.Trigger>打开弹窗</Modal.Trigger>
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Modal</Modal.Title>
              </Modal.Header>
              <Modal.Body>关闭按钮（×）的 aria-label 来自 locale.modal.close。</Modal.Body>
              <Modal.Close />
            </Modal.Content>
          </Modal>
          <MessageProvider>
            <MessageDemo />
          </MessageProvider>
          <LocaleReadout label="Provider 内读取到的覆盖文案（未覆盖的键保持默认）：" />
        </ConfigProvider>
      </Demo>

      <Demo
        title="useZuiConfig 与嵌套"
        description="useZuiConfig 无 Provider 时返回默认不 throw；嵌套 ConfigProvider 逐层深合并，内层覆盖外层。"
        code={READ_CODE}
        stack
      >
        <LocaleReadout label="Provider 外（默认 zh-CN，不 throw）：" />
        <ConfigProvider locale={{ select: { placeholder: '外层 placeholder' } }}>
          <LocaleReadout label="第一层（覆盖 select.placeholder）：" />
          <ConfigProvider locale={{ input: { clear: '内层清除' } }}>
            <LocaleReadout label="第二层（再覆盖 input.clear，select 沿用外层）：" />
          </ConfigProvider>
        </ConfigProvider>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'locale',
            type: 'DeepPartial<ZuiLocale>',
            defaultValue: '—',
            description:
              '与默认 zh-CN 深合并的文案覆盖；未提供的段/键保持默认。嵌套 Provider 逐层合并。',
          },
          {
            name: 'translate',
            type: 'TranslateConfig',
            description: '配置翻译服务与目标语言，自动翻译组件内置文案；未提供有效凭据时保留原文。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '受配置的子树。',
          },
        ]}
      />
      <p className="doc-p">
        <code className="doc-code-inline">useZuiConfig(): {'{ locale: ZuiLocale }'}</code>
        ：读取当前生效配置。无 ConfigProvider 时返回默认 zh-CN（不 throw，配置必须可缺省）。
      </p>

      <h3 className="doc-h3">ZuiLocale 文案键</h3>
      <ApiTable
        rows={[
          {
            name: 'select.placeholder',
            type: 'string',
            defaultValue: "'请选择'",
            description: 'Select 未选中时的占位文案。',
          },
          {
            name: 'input.clear',
            type: 'string',
            defaultValue: "'清除'",
            description: 'Input 清除按钮 aria-label。',
          },
          {
            name: 'modal.close',
            type: 'string',
            defaultValue: "'关闭'",
            description: 'Modal.Close 图标按钮的默认 aria-label；有文字时以文字作为名称。',
          },
          {
            name: 'drawer.close',
            type: 'string',
            defaultValue: "'关闭'",
            description: 'Drawer.Close 图标按钮的默认 aria-label；有文字时以文字作为名称。',
          },
          {
            name: 'message.close',
            type: 'string',
            defaultValue: "'关闭'",
            description: 'Message 可关闭条目的关闭按钮 aria-label。',
          },
          {
            name: 'pagination.prev / next / jumper',
            type: 'string',
            defaultValue: "'上一页' / '下一页' / '跳至'",
            description: 'Pagination 翻页按钮与跳页文案。',
          },
          {
            name: 'empty.description',
            type: 'string',
            defaultValue: "'暂无数据'",
            description: 'Empty 默认描述。',
          },
        ]}
      />
      <p className="doc-p">
        以上文案均由对应组件读取；通过 ConfigProvider 覆盖后，相关组件会同步更新。
      </p>
    </div>
  );
}
