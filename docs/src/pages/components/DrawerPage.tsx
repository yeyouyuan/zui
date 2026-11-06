import { Button, Drawer } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Drawer>
  <Drawer.Trigger>打开抽屉</Drawer.Trigger>
  <Drawer.Content>
    <Drawer.Header>
      <Drawer.Title>编辑资料</Drawer.Title>
    </Drawer.Header>
    <Drawer.Body>抽屉正文内容……</Drawer.Body>
    <Drawer.Footer>
      <Drawer.Close>取消</Drawer.Close>
      <Button variant="primary">保存</Button>
    </Drawer.Footer>
  </Drawer.Content>
</Drawer>`;

const PLACEMENT_CODE = `<Drawer>
  <Drawer.Trigger>从右侧滑入</Drawer.Trigger>
  <Drawer.Content placement="right">…</Drawer.Content>
</Drawer>
<Drawer>
  <Drawer.Trigger>从左侧滑入</Drawer.Trigger>
  <Drawer.Content placement="left">…</Drawer.Content>
</Drawer>
<Drawer>
  <Drawer.Trigger>从顶部滑入</Drawer.Trigger>
  <Drawer.Content placement="top">…</Drawer.Content>
</Drawer>
<Drawer>
  <Drawer.Trigger>从底部滑入</Drawer.Trigger>
  <Drawer.Content placement="bottom">…</Drawer.Content>
</Drawer>`;

const SIZE_CODE = `<Drawer>
  <Drawer.Trigger>窄抽屉</Drawer.Trigger>
  <Drawer.Content size={240}>…</Drawer.Content>
</Drawer>
<Drawer>
  <Drawer.Trigger>百分比抽屉</Drawer.Trigger>
  <Drawer.Content size="50%">…</Drawer.Content>
</Drawer>`;

const CLOSE_CODE = `<Drawer>
  <Drawer.Trigger>不可点遮罩关闭</Drawer.Trigger>
  <Drawer.Content closeOnOverlay={false} closeOnEsc={false}>
    {/* 只能通过 Drawer.Close 或按钮关闭 */}
  </Drawer.Content>
</Drawer>`;

export default function DrawerPage(): React.ReactNode {
  usePageTitle('Drawer 抽屉');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Drawer 抽屉</h1>
      <p className="doc-lead">
        Modal 的姊妹件：四方向滑入的组合式面板，与 Modal 共享同一套焦点陷阱 / 滚动锁 / Portal 规范，
        支持遮罩与 Esc 关闭、关闭后焦点归还触发器。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Drawer.Trigger 自动开合；Content 内用 Header / Title / Body / Footer / Close 组合结构。"
        code={BASIC_CODE}
      >
        <Drawer>
          <Drawer.Trigger>打开抽屉</Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>编辑资料</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <p className="doc-p">抽屉正文内容，可放置表单与说明。</p>
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close>取消</Drawer.Close>
              <Button variant="primary">保存</Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </Demo>

      <Demo
        title="滑入方向"
        description="placement 提供 left / right / top / bottom 四个方向，默认 right；面板从对应边缘滑入。"
        code={PLACEMENT_CODE}
      >
        <Drawer>
          <Drawer.Trigger>右侧（默认）</Drawer.Trigger>
          <Drawer.Content placement="right">
            <Drawer.Header>
              <Drawer.Title>右侧抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>从右向左滑入。</Drawer.Body>
          </Drawer.Content>
        </Drawer>
        <Drawer>
          <Drawer.Trigger>左侧</Drawer.Trigger>
          <Drawer.Content placement="left">
            <Drawer.Header>
              <Drawer.Title>左侧抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>从左向右滑入。</Drawer.Body>
          </Drawer.Content>
        </Drawer>
        <Drawer>
          <Drawer.Trigger>顶部</Drawer.Trigger>
          <Drawer.Content placement="top" size={240}>
            <Drawer.Header>
              <Drawer.Title>顶部抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>从上向下滑入，size 为高度。</Drawer.Body>
          </Drawer.Content>
        </Drawer>
        <Drawer>
          <Drawer.Trigger>底部</Drawer.Trigger>
          <Drawer.Content placement="bottom" size={240}>
            <Drawer.Header>
              <Drawer.Title>底部抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>从下向上滑入，size 为高度。</Drawer.Body>
          </Drawer.Content>
        </Drawer>
      </Demo>

      <Demo
        title="尺寸"
        description="size 控制面板宽 / 高（数字按 px，字符串原样），默认 378；left / right 为宽，top / bottom 为高。"
        code={SIZE_CODE}
      >
        <Drawer>
          <Drawer.Trigger>窄抽屉 240px</Drawer.Trigger>
          <Drawer.Content size={240}>
            <Drawer.Header>
              <Drawer.Title>窄抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>size 数字 240（px）。</Drawer.Body>
          </Drawer.Content>
        </Drawer>
        <Drawer>
          <Drawer.Trigger>百分比抽屉 50%</Drawer.Trigger>
          <Drawer.Content size="50%">
            <Drawer.Header>
              <Drawer.Title>百分比抽屉</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>size="50%"</Drawer.Body>
          </Drawer.Content>
        </Drawer>
      </Demo>

      <Demo
        title="关闭行为"
        description="closeOnOverlay / closeOnEsc 默认 true；置 false 后只能通过 Drawer.Close 或业务按钮关闭。"
        code={CLOSE_CODE}
      >
        <Drawer>
          <Drawer.Trigger>不可点遮罩关闭</Drawer.Trigger>
          <Drawer.Content closeOnOverlay={false} closeOnEsc={false}>
            <Drawer.Header>
              <Drawer.Title>受控关闭</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <p className="doc-p">遮罩点击与 Esc 均已禁用，只能点击「取消」关闭。</p>
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close>取消</Drawer.Close>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <ApiTable
        rows={[
          {
            name: 'open / defaultOpen / onOpenChange',
            type: 'boolean / (open: boolean) => void',
            description: '受控 / 非受控开关与变更回调。',
          },
          {
            name: 'placement',
            type: "'left' | 'right' | 'top' | 'bottom'",
            defaultValue: "'right'",
            description: '抽屉滑入方向（Drawer.Content）。',
          },
          {
            name: 'size',
            type: 'number | string',
            defaultValue: '378',
            description: '面板宽 / 高（left/right 为宽，top/bottom 为高）；数字按 px，字符串原样。',
          },
          {
            name: 'closeOnOverlay',
            type: 'boolean',
            defaultValue: 'true',
            description: '点击遮罩关闭。',
          },
          {
            name: 'closeOnEsc',
            type: 'boolean',
            defaultValue: 'true',
            description: 'Esc 关闭。',
          },
          {
            name: 'classNames',
            type: '{ overlay?; content? }',
            description: 'slot 级类名追加（overlay / content）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description:
              'Content 上的原生 div 属性透传到 dialog 元素（className、style、aria-*、事件等）。',
          },
        ]}
      />
      <p className="doc-p">
        子部件：<code className="doc-code-inline">Drawer.Trigger</code>
        （button，aria-haspopup="dialog"）、
        <code className="doc-code-inline">Drawer.Content</code>（Portal + role="dialog"
        aria-modal）、
        <code className="doc-code-inline">Drawer.Header / Title / Body / Footer / Close</code>
        （Close 仅在图标用法下默认 aria-label="关闭"，有文字时以文字作为名称）。Title 自动关联
        dialog 的 aria-labelledby。
      </p>

      <CustomizeOutlet
        name="Drawer"
        parts={['overlay', 'content', 'header', 'title', 'body', 'footer', 'close']}
        vars={[
          '--z-drawer-overlay-bg',
          '--z-drawer-size',
          '--z-drawer-content-bg',
          '--z-drawer-content-fg',
          '--z-drawer-content-shadow',
          '--z-drawer-content-padding',
          '--z-drawer-header-gap',
          '--z-drawer-title-font-size',
          '--z-drawer-body-padding',
          '--z-drawer-footer-gap',
          '--z-drawer-footer-padding-top',
          '--z-drawer-close-size',
          '--z-drawer-close-fg',
          '--z-drawer-close-hover-bg',
          '--z-drawer-animation-duration',
        ]}
      />
    </div>
  );
}
