import {
  Button,
  MessageProvider,
  useMessage,
  type MessageConfig,
} from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

function BasicDemo() {
  const message = useMessage();
  return (
    <>
      <Button variant="secondary" onClick={() => message.success('保存成功')}>
        success
      </Button>
      <Button variant="secondary" onClick={() => message.error('请求失败，请重试')}>
        error
      </Button>
      <Button variant="secondary" onClick={() => message.warning('磁盘空间不足')}>
        warning
      </Button>
      <Button variant="secondary" onClick={() => message.info('有 3 条新通知')}>
        info
      </Button>
    </>
  );
}

function ClosableDemo() {
  const message = useMessage();
  const config: MessageConfig = {
    content: '这是一条可关闭的消息，10 秒后自动消失',
    duration: 10000,
    closable: true,
  };
  return (
    <>
      <Button variant="secondary" onClick={() => message.show(config)}>
        可关闭 + 10s 时长
      </Button>
      <Button variant="secondary" onClick={() => message.info({ content: '不自动关闭', duration: 0 })}>
        duration=0 常驻
      </Button>
    </>
  );
}

function ManageDemo() {
  const message = useMessage();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => message.info({ content: `第 ${Math.floor(Math.random() * 100)} 条消息`, duration: 0 })}
      >
        连续推送
      </Button>
      <Button variant="secondary" onClick={() => message.clear()}>
        clear() 清空
      </Button>
    </>
  );
}

const BASIC_CODE = `function Demo() {
  const message = useMessage();
  return <Button onClick={() => message.success('保存成功')}>成功</Button>;
}

<MessageProvider>
  <Demo />
</MessageProvider>`;

const CONFIG_CODE = `const message = useMessage();

message.show({
  content: '这是一条可关闭的消息，10 秒后自动消失',
  duration: 10000,   // ms，默认 3000；0 = 不自动关闭
  closable: true,    // 默认 false
  onClose: () => console.log('closed'),
});`;

const MANAGE_CODE = `const message = useMessage();

const id = message.warning('磁盘空间不足');  // 返回 id
message.dismiss(id);                       // 按 id 移除
message.clear();                           // 清空全部`;

export default function MessagePage(): React.ReactNode {
  usePageTitle('Message 全局提示');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Message 全局提示</h1>
      <p className="doc-lead">
        hooks 型全局反馈 API——没有 message.success() 静态方法，一切经由 MessageProvider 内的 useMessage() 触发，
        从根上规避上下文丢失之痛。
      </p>
      <div className="doc-note">
        使用前提：组件树中必须包一层 <code className="doc-code-inline">MessageProvider</code>，
        在其内部调用 <code className="doc-code-inline">useMessage()</code>；无 Provider 时会抛出明确错误。
      </div>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="四种类型"
        description="success / error / warning / info 一等方法，参数可为字符串或 MessageConfig；error 使用 aria-live=assertive，其余 polite。"
        code={BASIC_CODE}
      >
        <MessageProvider>
          <BasicDemo />
        </MessageProvider>
      </Demo>

      <Demo
        title="时长与可关闭"
        description="duration 控制自动关闭（0 常驻）；closable 显示手动关闭按钮（aria-label=关闭）。"
        code={CONFIG_CODE}
      >
        <MessageProvider>
          <ClosableDemo />
        </MessageProvider>
      </Demo>

      <Demo
        title="多条管理"
        description="show 等方法返回 id，可 dismiss(id) 移除；clear() 清空；Provider 的 max 控制同屏上限（超出挤掉最旧）。"
        code={MANAGE_CODE}
      >
        <MessageProvider max={3}>
          <ManageDemo />
        </MessageProvider>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">MessageProvider</h3>
      <ApiTable
        rows={[
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '需要使用 useMessage 的子树。',
          },
          {
            name: 'max',
            type: 'number',
            defaultValue: '3',
            description: '同屏最大条数，超出挤掉最旧一条。',
          },
          {
            name: 'placement',
            type: "'top' | 'bottom'",
            defaultValue: "'top'",
            description: '消息列表出现位置，写入 data-placement。',
          },
        ]}
      />
      <h3 className="doc-h3">useMessage() → MessageApi</h3>
      <ApiTable
        rows={[
          {
            name: 'show',
            type: '(config: MessageConfig | string) => string',
            description: '显示默认样式消息，返回 id。',
          },
          {
            name: 'success / error / warning / info',
            type: '(config: MessageConfig | string) => string',
            description: '显示对应语义类型消息，返回 id。',
          },
          {
            name: 'dismiss',
            type: '(id: string) => void',
            description: '按 id 移除一条消息。',
          },
          {
            name: 'clear',
            type: '() => void',
            description: '清空全部消息。',
          },
        ]}
      />
      <h3 className="doc-h3">MessageConfig</h3>
      <ApiTable
        rows={[
          {
            name: 'content',
            type: 'React.ReactNode',
            description: '消息内容（必填）。',
          },
          {
            name: 'duration',
            type: 'number',
            defaultValue: '3000',
            description: '自动关闭时间（ms）；0 表示不自动关闭。',
          },
          {
            name: 'closable',
            type: 'boolean',
            defaultValue: 'false',
            description: '是否显示手动关闭按钮。',
          },
          {
            name: 'onClose',
            type: '() => void',
            description: '关闭回调。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Message"
        parts={['root', 'item', 'icon', 'content', 'close']}
        vars={[
          '--z-message-width',
          '--z-message-max-width',
          '--z-message-padding-x',
          '--z-message-padding-y',
          '--z-message-gap',
          '--z-message-font-size',
          '--z-message-bg',
          '--z-message-fg',
          '--z-message-border',
          '--z-message-radius',
          '--z-message-shadow',
          '--z-message-icon-size',
          '--z-message-close-size',
          '--z-message-transition',
        ]}
        note="容器为 z-message-list（data-placement），条目 z-message（data-variant + data-state=open/closing）。"
      />
    </div>
  );
}
