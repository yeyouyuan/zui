import { useState } from 'react';
import { Alert, Button } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const TYPES_CODE = `<Alert type="info" title="这是一条信息">默认信息提示。</Alert>
<Alert type="success" title="操作成功">资源已创建完成。</Alert>
<Alert type="warning" title="请注意">磁盘空间即将不足。</Alert>
<Alert type="error" title="出错了">请求超时，请稍后重试。</Alert>`;

const CLOSE_CODE = `const [visible, setVisible] = useState(true);

{visible ? (
  <Alert closable onClose={() => setVisible(false)} title="可关闭提示">
    点击右侧 × 关闭此提示条。
  </Alert>
) : null}`;

const CONTENT_CODE = `<Alert title="只有标题" />
<Alert>只有辅助描述，无标题。</Alert>
<Alert showIcon={false} title="无图标">
  showIcon=false 隐藏左侧图标。
</Alert>`;

export default function AlertPage(): React.ReactNode {
  usePageTitle('Alert 警告提示');
  const [visible, setVisible] = useState(true);

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Alert 警告提示</h1>
      <p className="doc-lead">
        页面内的静态提示横幅：4 种语义类型、浅色状态底 + 状态色边/图标，可关闭；error / warning
        自动获得 role=&quot;alert&quot;，info / success 为 role=&quot;status&quot;。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="类型"
        description="type 提供 info / success / warning / error 四种语义类型，默认 info。error 与 warning 使用 role=alert（中断读屏），其余使用 role=status。"
        code={TYPES_CODE}
        stack
      >
        <Alert type="info" title="这是一条信息">
          默认信息提示。
        </Alert>
        <Alert type="success" title="操作成功">
          资源已创建完成。
        </Alert>
        <Alert type="warning" title="请注意">
          磁盘空间即将不足。
        </Alert>
        <Alert type="error" title="出错了">
          请求超时，请稍后重试。
        </Alert>
      </Demo>

      <Demo
        title="可关闭"
        description="closable 渲染关闭按钮（aria-label=关闭），点击后提示条移除并触发 onClose。"
        code={CLOSE_CODE}
      >
        {visible ? (
          <Alert closable onClose={() => setVisible(false)} title="可关闭提示">
            点击右侧 × 关闭此提示条。
          </Alert>
        ) : (
          <Button variant="secondary" onClick={() => setVisible(true)}>
            重新显示
          </Button>
        )}
      </Demo>

      <Demo
        title="标题、描述与图标"
        description="title 与 children（辅助描述）可单独使用；showIcon=false 隐藏左侧图标。"
        code={CONTENT_CODE}
        stack
      >
        <Alert title="只有标题" />
        <Alert>只有辅助描述，无标题。</Alert>
        <Alert showIcon={false} title="无图标">
          showIcon=false 隐藏左侧图标。
        </Alert>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'type',
            type: "'info' | 'success' | 'warning' | 'error'",
            defaultValue: "'info'",
            description: '语义类型。error/warning 为 role=alert，info/success 为 role=status。',
          },
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '标题。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: '辅助描述。',
          },
          {
            name: 'closable',
            type: 'boolean',
            defaultValue: 'false',
            description: '显示关闭按钮（aria-label=关闭），点击后提示条移除。',
          },
          {
            name: 'onClose',
            type: '() => void',
            description: '关闭回调。',
          },
          {
            name: 'showIcon',
            type: 'boolean',
            defaultValue: 'true',
            description: '是否显示左侧状态图标。',
          },
          {
            name: 'classNames',
            type: '{ root?; icon?; title?; description?; close? }',
            description: 'slot 级类名追加。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: "原生 div 属性透传到根元素（className、style、aria-*、事件等；'title' 除外）。",
          },
        ]}
      />
      <p className="doc-p">
        根元素 data 属性：<code className="doc-code-inline">data-type</code>；关闭后组件自行移除（非受控）。
      </p>

      <CustomizeOutlet
        name="Alert"
        parts={['root', 'icon', 'title', 'description', 'close']}
        vars={[
          '--z-alert-padding-x',
          '--z-alert-padding-y',
          '--z-alert-gap',
          '--z-alert-radius',
          '--z-alert-border-width',
          '--z-alert-font-size',
          '--z-alert-line-height',
          '--z-alert-title-font-size',
          '--z-alert-title-font-weight',
          '--z-alert-icon-size',
          '--z-alert-close-size',
          '--z-alert-close-icon-size',
          '--z-alert-close-radius',
          '--z-alert-bg',
          '--z-alert-fg',
          '--z-alert-border',
          '--z-alert-icon-color',
          '--z-alert-close-hover-bg',
          '--z-alert-focus-ring',
          '--z-alert-transition',
        ]}
      />
    </div>
  );
}
