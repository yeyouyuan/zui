import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NotificationProvider } from './NotificationProvider';
import { useNotification, type NotificationApi } from './useNotification';

afterEach(cleanup);

let api: NotificationApi;

function Harness() {
  api = useNotification();
  return null;
}

function renderWithProvider(
  props: Omit<React.ComponentProps<typeof NotificationProvider>, 'children'> = {}
) {
  return render(
    <NotificationProvider {...props}>
      <Harness />
    </NotificationProvider>
  );
}

describe('Notification hooks 契约', () => {
  it('useNotification 在 Provider 外抛明确错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(
      /useNotification must be used within NotificationProvider/
    );
    spy.mockRestore();
  });

  it('success() 渲染卡片：role=status + data-variant + 标题/描述', () => {
    renderWithProvider();
    act(() => {
      api.success({ title: '保存成功', description: '已同步到云端' });
    });
    const item = screen.getByText('保存成功').closest('[data-part="item"]') as HTMLElement;
    expect(item).toHaveClass('z-notification');
    expect(item).toHaveAttribute('role', 'status');
    expect(item).toHaveAttribute('aria-live', 'polite');
    expect(item).toHaveAttribute('data-variant', 'success');
    expect(item).toHaveAttribute('data-state', 'open');
    expect(screen.getByText('已同步到云端')).toBeInTheDocument();
  });

  it('error() 用 role=alert + assertive；open() 为默认变体无图标', () => {
    renderWithProvider();
    act(() => {
      api.error({ title: '网络错误' });
    });
    const alertItem = screen.getByText('网络错误').closest('[data-part="item"]') as HTMLElement;
    expect(alertItem).toHaveAttribute('role', 'alert');
    expect(alertItem).toHaveAttribute('aria-live', 'assertive');

    act(() => {
      api.open({ title: '一般通知' });
    });
    const plain = screen.getByText('一般通知').closest('[data-part="item"]') as HTMLElement;
    expect(plain).toHaveAttribute('data-variant', 'default');
    expect(plain.querySelector('[data-part="icon"]')).toBeNull();
  });

  it('warning / info 变体与默认图标', () => {
    renderWithProvider();
    act(() => {
      api.warning({ title: 'w' });
      api.info({ title: 'i' });
    });
    expect(screen.getByText('w').closest('[data-part="item"]')).toHaveAttribute(
      'data-variant',
      'warning'
    );
    expect(screen.getByText('i').closest('[data-part="item"]')).toHaveAttribute(
      'data-variant',
      'info'
    );
  });
});

describe('Notification 关闭与生命周期', () => {
  it('closable 默认 true，点击关闭按钮移除（先 closing 再移除）', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.info({ title: '可关闭' });
      });
      fireEvent.click(screen.getByRole('button', { name: '关闭' }));
      const item = screen.getByText('可关闭').closest('[data-part="item"]') as HTMLElement;
      expect(item).toHaveAttribute('data-state', 'closing');
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText('可关闭')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('duration 默认 4500 自动关闭；duration=0 不自动关', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.info({ title: '自动关' });
        api.info({ title: '常驻', duration: 0 });
      });
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      // 自动关闭进入 closing（200ms 退场）后移除
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText('自动关')).not.toBeInTheDocument();
      expect(screen.getByText('常驻')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('close(id) 指定关闭；destroy() 关闭全部', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      let id1 = '';
      act(() => {
        id1 = api.info({ title: 'T1', duration: 0 });
        api.info({ title: 'T2', duration: 0 });
      });
      act(() => {
        api.close(id1);
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText('T1')).not.toBeInTheDocument();
      expect(screen.getByText('T2')).toBeInTheDocument();
      act(() => {
        api.destroy();
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText('T2')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('max 挤掉最旧通知', () => {
    renderWithProvider({ max: 2 });
    act(() => {
      api.info({ title: 'N1', duration: 0 });
      api.info({ title: 'N2', duration: 0 });
      api.info({ title: 'N3', duration: 0 });
    });
    expect(screen.queryByText('N1')).not.toBeInTheDocument();
    expect(screen.getByText('N2')).toBeInTheDocument();
    expect(screen.getByText('N3')).toBeInTheDocument();
  });

  it('onClick 点击卡片触发；关闭按钮不冒泡触发卡片点击', () => {
    vi.useFakeTimers();
    try {
      const onClick = vi.fn();
      renderWithProvider();
      act(() => {
        api.info({ title: 'clickable', duration: 0, onClick });
      });
      const item = screen.getByText('clickable').closest('[data-part="item"]') as HTMLElement;
      fireEvent.click(item);
      expect(onClick).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: '关闭' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText('clickable')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Notification 定制', () => {
  it('placement 逐条覆盖，容器 data-placement 正确', () => {
    renderWithProvider({ placement: 'topLeft' });
    act(() => {
      api.info({ title: 'TL', duration: 0 });
      api.info({ title: 'BR', duration: 0, placement: 'bottomRight' });
    });
    const tl = screen.getByText('TL').closest('[data-part="root"]') as HTMLElement;
    const br = screen.getByText('BR').closest('[data-part="root"]') as HTMLElement;
    expect(tl).toHaveAttribute('data-placement', 'topLeft');
    expect(br).toHaveAttribute('data-placement', 'bottomRight');
    expect(tl).toHaveClass('z-notification-list');
  });

  it('classNames 追加到 list 与 item', () => {
    renderWithProvider({ classNames: { root: 'my-list', item: 'my-item' } });
    act(() => {
      api.info({ title: 'X', duration: 0 });
    });
    const item = screen.getByText('X').closest('[data-part="item"]') as HTMLElement;
    expect(item).toHaveClass('z-notification', 'my-item');
    expect(item.closest('[data-part="root"]')).toHaveClass('my-list');
    expect(document.querySelector('[data-part="title"]')).toHaveTextContent('X');
    expect(document.querySelector('[data-part="body"]')).toBeInTheDocument();
    expect(document.querySelector('[data-part="close"]')).toBeInTheDocument();
  });

  it('自定义 icon 替换默认图标', () => {
    renderWithProvider();
    act(() => {
      api.success({ title: 'custom', duration: 0, icon: <svg data-testid="my-icon" /> });
    });
    expect(screen.getByTestId('my-icon')).toBeInTheDocument();
    expect(screen.getByText('custom').closest('[data-part="item"]')?.querySelector('[data-part="icon"]')).toBeNull();
  });
});
