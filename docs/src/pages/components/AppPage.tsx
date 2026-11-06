import { App, Button, useApp } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

function BasicDemo() {
  const app = useApp();
  return (
    <div className="doc-pg-preview-row">
      <Button
        variant="primary"
        onClick={() => {
          app.message.success('已保存');
        }}
      >
        调用 message
      </Button>
      <Button
        onClick={() => {
          app.notification.open({ title: '通知标题', description: '来自 useApp 的通知' });
        }}
      >
        调用 notification
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          app.modal.confirm({
            title: '确认删除？',
            content: '此操作不可撤销。',
            onConfirm: () => app.message.success('已删除'),
          });
        }}
      >
        调用 modal
      </Button>
    </div>
  );
}

const BASIC_CODE = `function Demo() {
  const app = useApp();
  return (
    <>
      <Button onClick={() => app.message.success('已保存')}>调用 message</Button>
      <Button onClick={() => app.notification.open({ title: '通知' })}>调用 notification</Button>
      <Button onClick={() => app.modal.confirm({ title: '确认删除？' })}>调用 modal</Button>
    </>
  );
}

<App>
  <Demo />
</App>`;

const CONFIG_CODE = `<App
  message={{ max: 5, placement: 'top' }}
  notification={{ max: 3, placement: 'bottomRight' }}
>
  <YourApp />
</App>`;

export default function AppPage(): React.ReactNode {
  usePageTitle('App 应用容器');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">App 应用容器</h1>
      <p className="doc-lead">应用容器，统一 message / notification / modal 上下文，useApp 一处取用。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="useApp 统一出口"
        description="App 内部组合 MessageProvider + NotificationProvider；在任意后代组件调用 useApp() 即可取用 message / notification / modal 三件套，避免多 Provider 嵌套。"
        code={BASIC_CODE}
      >
        <App>
          <BasicDemo />
        </App>
      </Demo>

      <Demo title="配置容量与位置" description="message 与 notification 可分别配置最多显示条数与默认出现位置。" code={CONFIG_CODE}>
        <App
          message={{ max: 5, placement: 'top' }}
          notification={{ max: 3, placement: 'bottomRight' }}
        >
          <BasicDemo />
        </App>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '应用内容。',
          },
          {
            name: 'message',
            type: "{ max?; placement?: 'top' | 'bottom' }",
            description: 'message 容量与位置配置。',
          },
          {
            name: 'notification',
            type: '{ max?; placement?: NotificationPlacement }',
            description: 'notification 容量与位置配置。',
          },
          {
            name: 'classNames',
            type: '{ root?; modal? }',
            description: 'slot 级类名追加（root / modal）。',
          },
        ]}
      />
      <p className="doc-p">
        <code className="doc-code-inline">useApp()</code> 返回{' '}
        <code className="doc-code-inline">{'{ message: MessageApi; notification: NotificationApi; modal: ModalApi }'}</code>
        ；其中 <code className="doc-code-inline">modal.confirm(config)</code> 弹出轻量确认框（title / content /
        okText / cancelText / onConfirm / onCancel），<code className="doc-code-inline">modal.close()</code> 关闭。
      </p>

      <CustomizeOutlet
        name="App"
        parts={['root', 'modal', 'modal-title', 'modal-content', 'modal-actions', 'item']}
        vars={[
          '--z-app-modal-width',
          '--z-app-modal-bg',
          '--z-app-modal-fg',
          '--z-app-modal-padding',
          '--z-app-modal-radius',
          '--z-app-modal-shadow',
          '--z-app-modal-overlay-bg',
          '--z-app-modal-title-size',
          '--z-app-modal-title-weight',
          '--z-app-modal-desc-size',
          '--z-app-modal-desc-fg',
          '--z-app-modal-btn-height',
          '--z-app-modal-btn-radius',
          '--z-app-modal-ok-bg',
          '--z-app-modal-ok-fg',
          '--z-app-modal-ok-hover-bg',
          '--z-app-modal-cancel-border',
          '--z-app-modal-z',
        ]}
      />
    </div>
  );
}
