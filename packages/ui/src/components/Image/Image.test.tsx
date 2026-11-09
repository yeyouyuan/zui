import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Image } from './index';
import { Modal } from '../Modal';

afterEach(cleanup);

/** 等焦点陷阱的 rAF 就绪（焦点移入预览容器） */
async function flushRaf() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

function getImg() {
  return document.querySelector('[data-part="image"]') as HTMLImageElement;
}

describe('Image 渲染', () => {
  it('渲染 img 与 root，data-part 齐全', () => {
    render(<Image src="/a.png" alt="A" />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-image');
    expect(root).toHaveAttribute('data-preview', 'true');
    const img = getImg();
    expect(img).toHaveAttribute('src', '/a.png');
    expect(img).toHaveAttribute('alt', 'A');
  });

  it('width/height 同步到 root 尺寸与 img 属性', () => {
    render(<Image src="/a.png" alt="A" width={120} height={80} />);
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root.style.width).toBe('120px');
    expect(root.style.height).toBe('80px');
    expect(getImg()).toHaveAttribute('width', '120');
    expect(getImg()).toHaveAttribute('height', '80');
  });

  it('加载失败时切换 fallback', () => {
    render(<Image src="/broken.png" alt="A" fallback="/fb.png" />);
    const img = getImg();
    expect(img).toHaveAttribute('src', '/broken.png');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', '/fb.png');
  });

  it('提交前已失败的图片即使错过 error 事件也会回退', () => {
    render(
      <Image
        src="/cached-broken.png"
        fallback="/fb.png"
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'complete', { configurable: true, value: true });
            Object.defineProperty(node, 'naturalWidth', { configurable: true, value: 0 });
          }
        }}
      />
    );
    expect(getImg()).toHaveAttribute('src', '/fb.png');
  });

  it('回退后切换 src 立即尝试新图片，重复 error 不会循环切换', () => {
    const { rerender } = render(<Image src="/broken.png" fallback="/fb.png" />);
    fireEvent.error(getImg());
    fireEvent.error(getImg());
    expect(getImg()).toHaveAttribute('src', '/fb.png');
    rerender(<Image src="/next.png" fallback="/fb.png" />);
    expect(getImg()).toHaveAttribute('src', '/next.png');
    rerender(<Image src="/broken.png" fallback="/fb.png" />);
    expect(getImg()).toHaveAttribute('src', '/broken.png');
  });

  it('合并内部 ref 时保留 React 19 callback ref 的清理函数', () => {
    const cleanupRef = vi.fn();
    const callbackRef = vi.fn(() => cleanupRef);
    const { unmount } = render(<Image src="/a.png" ref={callbackRef} />);
    expect(callbackRef).toHaveBeenCalledWith(getImg());
    unmount();
    expect(cleanupRef).toHaveBeenCalledOnce();
  });

  it('无 fallback 时 error 保留原 src', () => {
    render(<Image src="/broken.png" alt="A" />);
    fireEvent.error(getImg());
    expect(getImg()).toHaveAttribute('src', '/broken.png');
  });
});

describe('Image 预览', () => {
  it('Modal 内预览优先显示并逐层响应 Esc', async () => {
    const user = userEvent.setup();
    render(
      <Modal defaultOpen>
        <Modal.Content>
          <Modal.Title>图库</Modal.Title>
          <Image src="/a.png" alt="A" />
        </Modal.Content>
      </Modal>
    );
    await user.click(getImg());
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await flushRaf();
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(getImg()).toHaveFocus();
  });
  it.each(['{Enter}', ' '])('键盘 %s 打开预览并在关闭后恢复焦点', async (key) => {
    const user = userEvent.setup();
    render(<Image src="/a.png" alt="A" />);
    const image = getImg();
    await user.tab();
    expect(image).toHaveFocus();
    await user.keyboard(key);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await flushRaf();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(image).toHaveFocus();
  });

  it('preview=false 不添加键盘停靠点，并允许阻止默认打开行为', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Image src="/a.png" alt="A" preview={false} />);
    expect(getImg()).not.toHaveAttribute('tabindex');
    rerender(
      <Image
        src="/a.png"
        alt="A"
        onKeyDown={(event) => event.preventDefault()}
        onClick={(event) => event.preventDefault()}
      />
    );
    getImg().focus();
    await user.keyboard('{Enter}');
    await user.click(getImg());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击打开全屏预览（role=dialog + aria-modal）', async () => {
    const user = userEvent.setup();
    render(<Image src="/a.png" alt="A" />);
    await user.click(getImg());
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'A');
    expect(dialog.querySelector('img')).toHaveAttribute('src', '/a.png');
  });

  it('Esc 关闭预览', async () => {
    const user = userEvent.setup();
    render(<Image src="/a.png" alt="A" />);
    await user.click(getImg());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await flushRaf();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击遮罩关闭；关闭按钮不冒泡到遮罩也会关闭', async () => {
    const user = userEvent.setup();
    render(<Image src="/a.png" alt="A" />);
    await user.click(getImg());
    await user.click(screen.getByRole('button', { name: '关闭预览' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(getImg());
    await user.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preview=false 时点击不打开', async () => {
    const user = userEvent.setup();
    render(<Image src="/a.png" alt="A" preview={false} />);
    await user.click(getImg());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('onClick 回调仍触发', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Image src="/a.png" alt="A" onClick={onClick} />);
    await user.click(getImg());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Image 定制', () => {
  it('classNames / className 透传', () => {
    render(
      <Image
        src="/a.png"
        alt="A"
        className="page-img"
        classNames={{ root: 'my-root', image: 'my-image', preview: 'my-preview' }}
      />
    );
    const root = document.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-image', 'my-root', 'page-img');
    expect(getImg()).toHaveClass('z-image-img', 'my-image');
  });
});
