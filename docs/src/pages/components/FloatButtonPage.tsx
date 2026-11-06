import { useState } from 'react';
import { FloatButton } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<FloatButton
  icon={<span aria-hidden="true">↑</span>}
  onClick={() => alert('点击了悬浮按钮')}
  aria-label="回到顶部"
/>`;

const MENU_CODE = `const [log, setLog] = useState('');

<FloatButton
  trigger="click"
  menu={[
    { icon: <span aria-hidden="true">✎</span>, description: '编辑', onClick: () => setLog('编辑') },
    { icon: <span aria-hidden="true">↗</span>, description: '分享', onClick: () => setLog('分享') },
    { icon: <span aria-hidden="true">✕</span>, description: '删除', onClick: () => setLog('删除') },
  ]}
/>
<span>{log ? '最后操作：' + log : '展开菜单试试'}</span>`;

const STYLE_CODE = `<FloatButton type="primary" shape="square" description="新建" onClick={() => {}} />
<FloatButton type="primary" shape="circle" icon={<span aria-hidden="true">+</span>} onClick={() => {}} />`;

export default function FloatButtonPage(): React.ReactNode {
  usePageTitle('FloatButton 悬浮按钮');
  const [log, setLog] = useState('');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">FloatButton 悬浮按钮</h1>
      <p className="doc-lead">悬浮按钮，固定在角落的快捷操作入口，可展开菜单。</p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="固定在右下角的圆形按钮，点击触发 onClick；提供 icon 与 aria-label 保持可访问性。"
        code={BASIC_CODE}
        stack
      >
        <div style={{ position: 'relative', height: 160, border: '1px dashed var(--z-color-border)', borderRadius: 8 }}>
          <FloatButton
            icon={<span aria-hidden="true">↑</span>}
            onClick={() => setLog('基础按钮')}
            aria-label="回到顶部"
          />
        </div>
        <p className="doc-p">{log ? `最后操作：${log}` : '点击悬浮按钮试试'}</p>
      </Demo>

      <Demo
        title="展开菜单"
        description="传入 menu 数组后按钮变为菜单入口，trigger 支持 click（默认）或 hover 展开；Esc 关闭并归还焦点。"
        code={MENU_CODE}
        stack
      >
        <div style={{ position: 'relative', height: 220, border: '1px dashed var(--z-color-border)', borderRadius: 8 }}>
          <FloatButton
            trigger="click"
            menu={[
              { icon: <span aria-hidden="true">✎</span>, description: '编辑', onClick: () => setLog('编辑') },
              { icon: <span aria-hidden="true">↗</span>, description: '分享', onClick: () => setLog('分享') },
              { icon: <span aria-hidden="true">✕</span>, description: '删除', onClick: () => setLog('删除') },
            ]}
          />
        </div>
        <p className="doc-p">{log ? `最后操作：${log}` : '展开菜单试试'}</p>
      </Demo>

      <Demo title="形状与类型" description="shape 支持 circle / square，type 支持 default / primary；description 显示按钮内文字说明。" code={STYLE_CODE} stack>
        <div style={{ position: 'relative', height: 160, border: '1px dashed var(--z-color-border)', borderRadius: 8 }}>
          <FloatButton type="primary" shape="square" description="新建" onClick={() => setLog('新建')} />
          <FloatButton type="primary" shape="circle" icon={<span aria-hidden="true">+</span>} onClick={() => setLog('添加')} />
        </div>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'icon',
            type: 'React.ReactNode',
            description: '按钮图标。',
          },
          {
            name: 'description',
            type: 'React.ReactNode',
            description: '按钮内文字说明。',
          },
          {
            name: 'shape',
            type: "'circle' | 'square'",
            defaultValue: "'circle'",
            description: '形状。',
          },
          {
            name: 'type',
            type: "'default' | 'primary'",
            defaultValue: "'default'",
            description: '类型。',
          },
          {
            name: 'trigger',
            type: "'click' | 'hover'",
            defaultValue: "'click'",
            description: '菜单展开方式。',
          },
          {
            name: 'onClick',
            type: '() => void',
            description: '点击触发器时触发。',
          },
          {
            name: 'menu',
            type: 'Array<{ icon?; description?; onClick? }>',
            description: '展开菜单项。',
          },
          {
            name: 'classNames',
            type: '{ root?; menu?; item? }',
            description: 'slot 级类名追加（root / menu / item）。',
          },
        ]}
      />

      <CustomizeOutlet
        name="FloatButton"
        parts={['root', 'trigger', 'menu', 'item']}
        vars={[
          '--z-float-button-size',
          '--z-float-button-bg',
          '--z-float-button-fg',
          '--z-float-button-hover-bg',
          '--z-float-button-border',
          '--z-float-button-radius',
          '--z-float-button-shadow',
          '--z-float-button-font-size',
          '--z-float-button-icon-size',
          '--z-float-button-gap',
          '--z-float-button-primary-bg',
          '--z-float-button-primary-fg',
          '--z-float-button-primary-hover-bg',
          '--z-float-button-menu-gap',
          '--z-float-button-menu-item-bg',
          '--z-float-button-right',
          '--z-float-button-bottom',
          '--z-float-button-transition',
        ]}
      />
    </div>
  );
}
