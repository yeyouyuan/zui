import { Button, NotificationProvider, useNotification } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

function BasicDemo() {
  const notification = useNotification();
  return (
    <div className="doc-pg-preview-row">
      <Button variant="primary" onClick={() => notification.success({ title: '保存成功', description: '数据已提交。' })}>
        成功通知
      </Button>
      <Button variant="danger" onClick={() => notification.error({ title: '保存失败', description: '请稍后重试。' })}>
        错误通知
      </Button>
      <Button onClick={() => notification.warning({ title: '注意', description: '磁盘空间不足。' })}>警告通知</Button>
    </div>
  );
}

function ConfigDemo() {
  const notification = useNotification();
  return (
    <div className="doc-pg-preview-row">
      <Button
        onClick={() =>
          notification.open({
            title: '可点击通知',
            description: '点击触发 onClick。',
            duration: 0,
            closable: true,
            onClick: () => notification.info({ title: '你点击了通知' }),
          })
        }
      >
        不自动关闭
      </Button>
      <Button
        onClick={() =>
          notification.open({
            title: '左上角通知',
            placement: 'topLeft',
            duration: 3000,
          })
        }
      >
        指定位置
      </Button>
      <Button variant="outline" onClick={() => notification.destroy()}>
        关闭全部
      </Button>
    </div>
  );
}

const BASIC_CODE = `function Demo() {
  const notification = useNotification();
  return (
    <Button onClick={() => notification.success({ title: '保存成功', description: '数据已提交。' })}>
      成功通知
    </Button>
  );
}

<NotificationProvider>
  <Demo />
</NotificationProvider>`;

const CONFIG_CODE = `notification.open({
  title: '可点击通知',
  description: '点击触发 onClick。',
  duration: 0,        // 0 不自动关
  closable: true,
  placement: 'topLeft',
  onClick: () => {},
});`;

const MANAGE_CODE = `const notification = useNotification();
const id = notification.open({ title: '处理中…', duration: 0 });

notification.close(id);   // 关闭指定通知
notification.destroy();   // 关闭全部`;

export default function NotificationPage(): React.ReactNode {
  usePageTitle('Notification 通知卡片');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Notification 通知卡片</h1>
      <p className="doc-lead">通知卡片，全局右上角（四角可配）的可交互消息提醒。</p>
      <p className="doc-p">
        使用前提：组件树中必须包一层 <code className="doc-code-inline">NotificationProvider</code>，
        在其内部调用 <code className="doc-code-inline">useNotification()</code>；无 Provider 时会抛出明确错误。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="四种状态"
        description="open / success / error / warning / info 五种触发方法，对应默认、成功、错误、警告、提示语义色。"
        code={BASIC_CODE}
      >
        <NotificationProvider>
          <BasicDemo />
        </NotificationProvider>
      </Demo>

      <Demo
        title="完整配置"
        description="duration 控制自动关闭（0 不自动关）、closable 显示关闭按钮、placement 单条覆盖 Provider 默认位置、onClick 可点击。"
        code={CONFIG_CODE}
      >
        <NotificationProvider>
          <ConfigDemo />
        </NotificationProvider>
      </Demo>

      <Demo
        title="手动管理"
        description="open 等方法返回通知 id，可配合 close(id) 与 destroy() 精确控制生命周期。"
        code={MANAGE_CODE}
      >
        <NotificationProvider>
          <ConfigDemo />
        </NotificationProvider>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '通知标题。',
          },
          {
            name: 'description',
            type: 'React.ReactNode',
            description: '通知描述。',
          },
          {
            name: 'duration',
            type: 'number',
            defaultValue: '4500',
            description: '自动关闭时间（ms）；0 不自动关。',
          },
          {
            name: 'closable',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否显示关闭按钮。',
          },
          {
            name: 'placement',
            type: "'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'",
            defaultValue: "'topRight'",
            description: '出现位置（单条可覆盖 Provider 默认）。',
          },
          {
            name: 'icon',
            type: 'React.ReactNode',
            description: '自定义图标。',
          },
          {
            name: 'onClick',
            type: '() => void',
            description: '点击通知时触发。',
          },
        ]}
      />
      <p className="doc-p">
        <code className="doc-code-inline">NotificationProvider</code> props：{' '}
        <code className="doc-code-inline">{'{ children?; max?; placement?; classNames?: { root?; item? } }'}</code>
        （max 默认 3，超出挤掉最旧）。
      </p>
      <p className="doc-p">
        <code className="doc-code-inline">useNotification()</code> 返回{' '}
        <code className="doc-code-inline">
          {'{ open, success, error, warning, info, close, destroy }'}
        </code>
        ，各 open 方法均返回通知 id。
      </p>

      <CustomizeOutlet
        name="Notification"
        parts={['root', 'item', 'icon', 'title', 'description', 'body', 'close']}
        vars={[
          '--z-notification-width',
          '--z-notification-bg',
          '--z-notification-fg',
          '--z-notification-border',
          '--z-notification-radius',
          '--z-notification-shadow',
          '--z-notification-padding',
          '--z-notification-gap',
          '--z-notification-inset',
          '--z-notification-title-size',
          '--z-notification-title-weight',
          '--z-notification-desc-size',
          '--z-notification-desc-fg',
          '--z-notification-icon-size',
          '--z-notification-close-size',
          '--z-notification-transition',
        ]}
      />
    </div>
  );
}
