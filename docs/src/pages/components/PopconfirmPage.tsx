import { useState } from 'react';
import { Button, Popconfirm } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `const [log, setLog] = useState('');

<Popconfirm
  title="确认删除这条记录？"
  onConfirm={() => setLog('已删除')}
  onCancel={() => setLog('已取消')}
>
  <Button variant="danger">删除</Button>
</Popconfirm>
<span>{log}</span>`;

const DESCRIPTION_CODE = `<Popconfirm
  title="覆盖发布？"
  description="当前版本 1.2.0 将被 1.3.0 覆盖。"
  okText="覆盖"
  cancelText="再想想"
  onConfirm={() => {}}
>
  <Button variant="primary">发布</Button>
</Popconfirm>`;

const CUSTOM_CODE = `<Popconfirm
  title="放弃编辑？"
  description="未保存的更改将丢失。"
  okText="放弃"
  cancelText="继续编辑"
  onConfirm={() => {}}
  onCancel={() => {}}
>
  <Button variant="ghost">关闭</Button>
</Popconfirm>`;

export default function PopconfirmPage(): React.ReactNode {
  usePageTitle('Popconfirm 气泡确认');
  const [log, setLog] = useState('');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Popconfirm 气泡确认</h1>
      <p className="doc-lead">气泡确认框，点击触发器弹出确认气泡后才执行操作。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="点击触发器弹出气泡，确定触发 onConfirm 并关闭，取消触发 onCancel。"
        code={BASIC_CODE}
      >
        <div className="doc-pg-preview-row">
          <Popconfirm
            title="确认删除这条记录？"
            onConfirm={() => setLog('已删除')}
            onCancel={() => setLog('已取消')}
          >
            <Button variant="danger">删除</Button>
          </Popconfirm>
          <span>{log}</span>
        </div>
      </Demo>

      <Demo title="描述与自定义文案" description="description 补充说明；okText / cancelText 自定义按钮文案（默认 确定 / 取消）。" code={DESCRIPTION_CODE}>
        <Popconfirm
          title="覆盖发布？"
          description="当前版本 1.2.0 将被 1.3.0 覆盖。"
          okText="覆盖"
          cancelText="再想想"
          onConfirm={() => setLog('已覆盖')}
        >
          <Button variant="primary">发布</Button>
        </Popconfirm>
      </Demo>

      <Demo title="危险操作确认" description="配合 Button 变体传达危险语义，onCancel 兜底误触。" code={CUSTOM_CODE}>
        <Popconfirm
          title="放弃编辑？"
          description="未保存的更改将丢失。"
          okText="放弃"
          cancelText="继续编辑"
          onConfirm={() => setLog('已放弃')}
          onCancel={() => setLog('继续编辑')}
        >
          <Button variant="ghost">关闭</Button>
        </Popconfirm>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'title',
            type: 'React.ReactNode',
            description: '确认标题。',
          },
          {
            name: 'description',
            type: 'React.ReactNode',
            description: '补充描述。',
          },
          {
            name: 'onConfirm',
            type: '() => void',
            description: '点击确定时触发并关闭。',
          },
          {
            name: 'onCancel',
            type: '() => void',
            description: '点击取消时触发并关闭。',
          },
          {
            name: 'okText',
            type: 'string',
            defaultValue: "'确定'",
            description: '确定按钮文案。',
          },
          {
            name: 'cancelText',
            type: 'string',
            defaultValue: "'取消'",
            description: '取消按钮文案。',
          },
          {
            name: 'children',
            type: 'React.ReactElement',
            description: '触发元素（被 cloneElement 注入 onClick/ref）。',
          },
          {
            name: 'classNames',
            type: '{ root?; content?; actions? }',
            description: 'slot 级类名追加（root / content / actions）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Popconfirm"
        parts={['root', 'content', 'title', 'description', 'actions', 'ok', 'cancel']}
        vars={[
          '--z-popconfirm-width',
          '--z-popconfirm-bg',
          '--z-popconfirm-fg',
          '--z-popconfirm-border',
          '--z-popconfirm-radius',
          '--z-popconfirm-shadow',
          '--z-popconfirm-padding',
          '--z-popconfirm-gap',
          '--z-popconfirm-title-size',
          '--z-popconfirm-title-weight',
          '--z-popconfirm-desc-size',
          '--z-popconfirm-desc-fg',
          '--z-popconfirm-btn-height',
          '--z-popconfirm-btn-radius',
          '--z-popconfirm-ok-bg',
          '--z-popconfirm-ok-fg',
          '--z-popconfirm-ok-hover-bg',
          '--z-popconfirm-cancel-bg',
          '--z-popconfirm-cancel-fg',
          '--z-popconfirm-cancel-border',
          '--z-popconfirm-z',
        ]}
      />
    </div>
  );
}
