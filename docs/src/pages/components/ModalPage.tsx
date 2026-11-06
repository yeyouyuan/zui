import { Button, Modal } from '@zui/react';

import ApiTable from '../../components/ApiTable';
import CustomizeOutlet from '../../components/CustomizeOutlet';
import Demo from '../../components/Demo';
import { usePageTitle } from '../../components/usePageTitle';

const BASIC_CODE = `<Modal>
  <Modal.Trigger>打开对话框</Modal.Trigger>
  <Modal.Content>
    <Modal.Header>
      <Modal.Title>标题</Modal.Title>
      <Modal.Description>对话框描述文本</Modal.Description>
    </Modal.Header>
    <Modal.Body>正文内容……</Modal.Body>
    <Modal.Footer>
      <Modal.Close>取消</Modal.Close>
      <Button variant="primary">确定</Button>
    </Modal.Footer>
  </Modal.Content>
</Modal>`;

const SIZE_CODE = `<Modal>
  <Modal.Trigger>小尺寸</Modal.Trigger>
  <Modal.Content size="sm">…</Modal.Content>
</Modal>
<Modal>
  <Modal.Trigger>大尺寸</Modal.Trigger>
  <Modal.Content size="lg">…</Modal.Content>
</Modal>`;

const CLOSE_CODE = `<Modal>
  <Modal.Trigger>不可点遮罩关闭</Modal.Trigger>
  <Modal.Content closeOnOverlay={false} closeOnEsc={false}>
    {/* 只能通过 Modal.Close 或按钮关闭 */}
  </Modal.Content>
</Modal>`;

const FOCUS_CODE = `<Modal.Content>
  <Modal.Body>
    {/* 打开时焦点优先进入带 data-autofocus 的元素 */}
    <Input data-autofocus placeholder="自动聚焦" />
  </Modal.Body>
</Modal.Content>`;

export default function ModalPage(): React.ReactNode {
  usePageTitle('Modal 对话框');

  return (
    <div className="doc-page">
      <h1 className="doc-h1">Modal 对话框</h1>
      <p className="doc-lead">
        组合式 API 的模态对话框：Portal 渲染到 body，APG 焦点管理（打开聚焦、Tab
        循环、关闭归还焦点）， 遮罩 / Esc / 滚动锁全部内建。
      </p>

      <h2 className="doc-h2">示例</h2>

      <Demo
        title="基础用法"
        description="Modal.Trigger 自动开合；Content 内用 Header / Title / Description / Body / Footer / Close 组合结构。"
        code={BASIC_CODE}
      >
        <Modal>
          <Modal.Trigger>打开对话框</Modal.Trigger>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>导出报告</Modal.Title>
              <Modal.Description>将当前筛选条件下的数据导出为 CSV 文件。</Modal.Description>
            </Modal.Header>
            <Modal.Body>
              <p className="doc-p">共 128 条记录，预计耗时约 5 秒。</p>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>取消</Modal.Close>
              <Button variant="primary">开始导出</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </Demo>

      <Demo
        title="尺寸"
        description="Modal.Content 的 size 提供 sm / md / lg 三档，默认 md。"
        code={SIZE_CODE}
      >
        <Modal>
          <Modal.Trigger>小尺寸 sm</Modal.Trigger>
          <Modal.Content size="sm">
            <Modal.Header>
              <Modal.Title>小尺寸</Modal.Title>
            </Modal.Header>
            <Modal.Body>宽度由 --z-modal-content-width-sm 控制。</Modal.Body>
          </Modal.Content>
        </Modal>
        <Modal>
          <Modal.Trigger>中尺寸 md</Modal.Trigger>
          <Modal.Content size="md">
            <Modal.Header>
              <Modal.Title>中尺寸</Modal.Title>
            </Modal.Header>
            <Modal.Body>宽度由 --z-modal-content-width-md 控制。</Modal.Body>
          </Modal.Content>
        </Modal>
        <Modal>
          <Modal.Trigger>大尺寸 lg</Modal.Trigger>
          <Modal.Content size="lg">
            <Modal.Header>
              <Modal.Title>大尺寸</Modal.Title>
            </Modal.Header>
            <Modal.Body>宽度由 --z-modal-content-width-lg 控制。</Modal.Body>
          </Modal.Content>
        </Modal>
      </Demo>

      <Demo
        title="关闭行为"
        description="closeOnOverlay / closeOnEsc 默认 true；置 false 后只能通过 Modal.Close 或业务按钮关闭。"
        code={CLOSE_CODE}
      >
        <Modal>
          <Modal.Trigger>不可点遮罩关闭</Modal.Trigger>
          <Modal.Content closeOnOverlay={false} closeOnEsc={false}>
            <Modal.Header>
              <Modal.Title>受控关闭</Modal.Title>
              <Modal.Description>点击遮罩或按 Esc 都不会关闭。</Modal.Description>
            </Modal.Header>
            <Modal.Footer>
              <Modal.Close>我知道了</Modal.Close>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </Demo>

      <Demo
        title="焦点管理"
        description="打开时焦点优先移入 [data-autofocus] 元素，否则首个可聚焦元素，最后兜底 dialog 本体；Tab 在对话框内循环，关闭后焦点归还触发按钮。"
        code={FOCUS_CODE}
      >
        <Modal>
          <Modal.Trigger>观察焦点</Modal.Trigger>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>自动聚焦</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p className="doc-p">打开后焦点应直接落在下方输入框：</p>
              <input className="doc-chip-btn" data-autofocus placeholder="自动聚焦于此" />
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>关闭</Modal.Close>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </Demo>

      <h2 className="doc-h2">API</h2>
      <h3 className="doc-h3">Modal</h3>
      <ApiTable
        rows={[
          {
            name: 'open',
            type: 'boolean',
            description: '受控打开态。',
          },
          {
            name: 'defaultOpen',
            type: 'boolean',
            description: '非受控初始态。',
          },
          {
            name: 'onOpenChange',
            type: '(open: boolean) => void',
            description: '打开态变化回调。',
          },
          {
            name: 'children',
            type: 'React.ReactNode',
            description: 'Modal.Trigger 与 Modal.Content 等组合节点（必填）。',
          },
        ]}
      />
      <h3 className="doc-h3">Modal.Content</h3>
      <ApiTable
        rows={[
          {
            name: 'size',
            type: "'sm' | 'md' | 'lg'",
            defaultValue: "'md'",
            description: '对话框宽度档位。',
          },
          {
            name: 'closeOnOverlay',
            type: 'boolean',
            defaultValue: 'true',
            description: '点击遮罩是否关闭。',
          },
          {
            name: 'closeOnEsc',
            type: 'boolean',
            defaultValue: 'true',
            description: '按 Esc 是否关闭。',
          },
          {
            name: 'classNames',
            type: '{ overlay?; content? }',
            description: 'slot 级类名追加（overlay / content）。',
          },
          {
            name: '...rest',
            type: "React.ComponentPropsWithRef<'div'>",
            description: '原生 div 属性透传到对话框本体。',
          },
        ]}
      />
      <h3 className="doc-h3">其余组合节点</h3>
      <ApiTable
        rows={[
          {
            name: 'Modal.Trigger',
            type: '原生 button',
            description: '自动 onClick 开关对话框，props 全量透传。',
          },
          {
            name: 'Modal.Header / Modal.Title / Modal.Description',
            type: '结构组件',
            description:
              '标题区；Title / Description 自动关联 aria-labelledby / aria-describedby。',
          },
          {
            name: 'Modal.Body',
            type: '结构组件',
            description: '正文区。',
          },
          {
            name: 'Modal.Footer',
            type: '结构组件',
            description: '操作区。',
          },
          {
            name: 'Modal.Close',
            type: '原生 button',
            description:
              '关闭按钮；仅图标用法默认 aria-label="关闭"，有文字时以文字作为名称，props 透传。',
          },
        ]}
      />

      <CustomizeOutlet
        name="Modal"
        parts={[
          'trigger',
          'overlay',
          'content',
          'header',
          'title',
          'description',
          'body',
          'footer',
          'close',
        ]}
        vars={[
          '--z-modal-content-width-sm',
          '--z-modal-content-width-md',
          '--z-modal-content-width-lg',
          '--z-modal-content-max-height',
          '--z-modal-content-padding',
          '--z-modal-content-radius',
          '--z-modal-content-bg',
          '--z-modal-content-fg',
          '--z-modal-content-shadow',
          '--z-modal-overlay-bg',
          '--z-modal-header-gap',
          '--z-modal-title-font-size',
          '--z-modal-description-font-size',
          '--z-modal-description-fg',
          '--z-modal-body-padding',
          '--z-modal-footer-gap',
          '--z-modal-footer-padding-top',
          '--z-modal-close-size',
          '--z-modal-close-fg',
          '--z-modal-close-hover-bg',
          '--z-modal-animation-duration',
        ]}
      />
    </div>
  );
}
