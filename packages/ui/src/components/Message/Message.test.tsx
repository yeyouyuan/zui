import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MessageProvider } from './MessageProvider';
import { useMessage, type MessageApi } from './useMessage';

afterEach(cleanup);

let api: MessageApi;

function Harness() {
  api = useMessage();
  return null;
}

function renderWithProvider(props: Omit<React.ComponentProps<typeof MessageProvider>, 'children'> = {}) {
  return render(
    <MessageProvider {...props}>
      <Harness />
    </MessageProvider>
  );
}

describe('Message', () => {
  it('useMessage outside provider throws a clear error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useMessage())).toThrow(/useMessage must be used within MessageProvider/);
    spy.mockRestore();
  });

  it('shows a string message via success() with role="status" and polite live region', () => {
    renderWithProvider();
    act(() => {
      api.success('hi');
    });
    const item = screen.getByText('hi').closest('[data-part="item"]') as HTMLElement;
    expect(item).toBeInTheDocument();
    expect(item).toHaveClass('z-message');
    expect(item).toHaveAttribute('role', 'status');
    expect(item).toHaveAttribute('aria-live', 'polite');
    expect(item).toHaveAttribute('data-variant', 'success');
    expect(item).toHaveAttribute('data-state', 'open');
  });

  it('error messages use assertive live region; show() accepts MessageConfig', () => {
    renderWithProvider();
    act(() => {
      api.error({ content: 'boom' });
    });
    const item = screen.getByText('boom').closest('[data-part="item"]') as HTMLElement;
    expect(item).toHaveAttribute('aria-live', 'assertive');
    expect(item).toHaveAttribute('data-variant', 'error');
  });

  it('info() and warning() set their variants', () => {
    renderWithProvider();
    act(() => {
      api.info('note');
      api.warning('careful');
    });
    expect(screen.getByText('note').closest('[data-part="item"]')).toHaveAttribute(
      'data-variant',
      'info'
    );
    expect(screen.getByText('careful').closest('[data-part="item"]')).toHaveAttribute(
      'data-variant',
      'warning'
    );
  });

  it('renders list container with data-placement (default top)', () => {
    const { container } = renderWithProvider();
    const list = document.querySelector('.z-message-list');
    expect(list).toHaveAttribute('data-placement', 'top');
    expect(list).toHaveAttribute('data-part', 'root');
    expect(container).toBeTruthy();
    renderWithProvider({ placement: 'bottom' });
    const lists = document.querySelectorAll('.z-message-list');
    expect(lists[lists.length - 1]).toHaveAttribute('data-placement', 'bottom');
  });

  it('auto-dismisses after duration and removes after exit transition', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.success('auto');
      });
      expect(screen.getByText('auto')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      const item = screen.getByText('auto').closest('[data-part="item"]') as HTMLElement;
      expect(item).toHaveAttribute('data-state', 'closing');
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('auto')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('duration 0 means no auto close', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.show({ content: 'stay', duration: 0 });
      });
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText('stay')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('custom duration is honored and onClose fires', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      const onClose = vi.fn();
      act(() => {
        api.show({ content: 'short', duration: 500, onClose });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('short')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismiss(id) closes the message and removes it after 200ms', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      let id = '';
      act(() => {
        id = api.success('target');
      });
      expect(typeof id).toBe('string');
      act(() => {
        api.dismiss(id);
      });
      const item = screen.getByText('target').closest('[data-part="item"]') as HTMLElement;
      expect(item).toHaveAttribute('data-state', 'closing');
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('target')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clear() closes all messages', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.info('one');
        api.info('two');
      });
      act(() => {
        api.clear();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('one')).not.toBeInTheDocument();
      expect(screen.queryByText('two')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('max (default 3) evicts the oldest message', () => {
    renderWithProvider();
    act(() => {
      api.info('m1');
      api.info('m2');
      api.info('m3');
      api.info('m4');
    });
    expect(screen.queryByText('m1')).not.toBeInTheDocument();
    expect(screen.getByText('m2')).toBeInTheDocument();
    expect(screen.getByText('m3')).toBeInTheDocument();
    expect(screen.getByText('m4')).toBeInTheDocument();
  });

  it('respects custom max prop', () => {
    renderWithProvider({ max: 2 });
    act(() => {
      api.info('a');
      api.info('b');
      api.info('c');
    });
    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('max eviction skips closing entries and never repeats their onClose', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider({ max: 2 });
      const firstClose = vi.fn();
      const secondClose = vi.fn();
      let firstId = '';
      act(() => {
        firstId = api.info({ content: 'first', duration: 0, onClose: firstClose });
        api.info({ content: 'second', duration: 0, onClose: secondClose });
      });
      act(() => {
        api.dismiss(firstId);
        api.info({ content: 'third', duration: 0 });
      });

      expect(screen.getByText('first').closest('[data-part="item"]')).toHaveAttribute(
        'data-state',
        'closing'
      );
      expect(screen.getByText('second')).toBeInTheDocument();
      expect(screen.getByText('third')).toBeInTheDocument();
      expect(firstClose).toHaveBeenCalledTimes(1);

      act(() => {
        api.info({ content: 'fourth', duration: 0 });
      });
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.queryByText('second')).not.toBeInTheDocument();
      expect(secondClose).toHaveBeenCalledTimes(1);
      expect(firstClose).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('first')).not.toBeInTheDocument();
      expect(firstClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('onClose reentrant dismiss is notified only once', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      let id = '';
      const onClose = vi.fn(() => api.dismiss(id));
      act(() => {
        id = api.info({ content: 'reentrant', duration: 0, onClose });
      });
      act(() => {
        api.dismiss(id);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.getByText('reentrant').closest('[data-part="item"]')).toHaveAttribute(
        'data-state',
        'closing'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('closable shows a close button (aria-label="关闭") that dismisses the message', () => {
    vi.useFakeTimers();
    try {
      renderWithProvider();
      act(() => {
        api.show({ content: 'closable', duration: 0, closable: true });
      });
      const closeBtn = screen.getByRole('button', { name: '关闭' });
      fireEvent.click(closeBtn);
      const item = screen.getByText('closable').closest('[data-part="item"]') as HTMLElement;
      expect(item).toHaveAttribute('data-state', 'closing');
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('closable')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('non-closable message has no close button', () => {
    renderWithProvider();
    act(() => {
      api.info({ content: 'plain', duration: 0 });
    });
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
  });

  it('returns distinct ids per call', () => {
    renderWithProvider({ max: 10 });
    let id1 = '';
    let id2 = '';
    act(() => {
      id1 = api.info('first');
      id2 = api.info('second');
    });
    expect(id1).not.toBe(id2);
  });
});
