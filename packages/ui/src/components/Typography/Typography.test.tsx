import { act, cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Typography } from './index';
import { TypographyText } from './Typography';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup），并清掉注入的 clipboard mock
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
});

/** 注入 navigator.clipboard mock（jsdom 默认无 clipboard） */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('Typography.Title', () => {
  it('level 1-5 分别渲染 h1-h5，根类 z-typography + z-typography-h1..h5', () => {
    const texts = ['一', '二', '三', '四', '五'];
    const { container } = render(
      <>
        <Typography.Title level={1}>一</Typography.Title>
        <Typography.Title level={2}>二</Typography.Title>
        <Typography.Title level={3}>三</Typography.Title>
        <Typography.Title level={4}>四</Typography.Title>
        <Typography.Title level={5}>五</Typography.Title>
      </>,
    );
    for (let level = 1; level <= 5; level++) {
      const heading = container.querySelector(`h${level}`);
      expect(heading).not.toBeNull();
      expect(heading).toHaveClass('z-typography');
      expect(heading).toHaveClass(`z-typography-h${level}`);
      expect(heading).toHaveTextContent(texts[level - 1]);
      expect(heading).toHaveAttribute('data-part', 'root');
    }
  });

  it('默认 level=1 → 渲染 h1', () => {
    const { container } = render(<Typography.Title>默认标题</Typography.Title>);
    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.querySelector('h1')).toHaveTextContent('默认标题');
    expect(container.querySelector('h2')).toBeNull();
  });

  it('Title delete → 标签仍为标题层级，data-delete 交给 CSS 叠加删除线', () => {
    const { container } = render(<Typography.Title delete>过时标题</Typography.Title>);
    expect(container.querySelector('h1')).toHaveAttribute('data-delete', 'true');
  });
});

describe('Typography.Paragraph', () => {
  it('渲染 <p>，带 z-typography-paragraph 类', () => {
    const { container } = render(<Typography.Paragraph>段落内容</Typography.Paragraph>);
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p).toHaveClass('z-typography');
    expect(p).toHaveClass('z-typography-paragraph');
    expect(p).toHaveTextContent('段落内容');
  });

  it('ellipsis=true → data-ellipsis 且默认 1 行（--z-typography-ellipsis-rows=1）', () => {
    const { container } = render(<Typography.Paragraph ellipsis>长文本</Typography.Paragraph>);
    const p = container.querySelector('p')!;
    expect(p).toHaveAttribute('data-ellipsis', 'true');
    expect(p.style.getPropertyValue('--z-typography-ellipsis-rows')).toBe('1');
  });

  it('ellipsis={{ rows: 3 }} → 内联行数变量供 -webkit-line-clamp 消费', () => {
    const { container } = render(
      <Typography.Paragraph ellipsis={{ rows: 3 }}>长文本</Typography.Paragraph>,
    );
    const p = container.querySelector('p')!;
    expect(p.style.getPropertyValue('--z-typography-ellipsis-rows')).toBe('3');
  });

  it('未开 ellipsis → 无 data-ellipsis、无行数变量', () => {
    const { container } = render(<Typography.Paragraph>普通段落</Typography.Paragraph>);
    const p = container.querySelector('p')!;
    expect(p).not.toHaveAttribute('data-ellipsis');
    expect(p.style.getPropertyValue('--z-typography-ellipsis-rows')).toBe('');
  });
});

describe('Typography.Text', () => {
  it('默认渲染 <span>，带 z-typography-text 类', () => {
    const { container } = render(<Typography.Text>普通文本</Typography.Text>);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span).toHaveClass('z-typography');
    expect(span).toHaveClass('z-typography-text');
    expect(span).toHaveTextContent('普通文本');
  });

  it('语义标签切换：code → <code>', () => {
    const { container } = render(<Typography.Text code>const x = 1</Typography.Text>);
    expect(container.querySelector('code')).not.toBeNull();
    expect(container.querySelector('code')).toHaveTextContent('const x = 1');
  });

  it('语义标签切换：keyboard → <kbd>', () => {
    const { container } = render(<Typography.Text keyboard>Ctrl</Typography.Text>);
    expect(container.querySelector('kbd')).not.toBeNull();
    expect(container.querySelector('kbd')).toHaveTextContent('Ctrl');
  });

  it('语义标签切换：mark → <mark>', () => {
    const { container } = render(<Typography.Text mark>高亮</Typography.Text>);
    expect(container.querySelector('mark')).not.toBeNull();
    expect(container.querySelector('mark')).toHaveTextContent('高亮');
  });

  it('语义标签切换：delete → <del>', () => {
    const { container } = render(<Typography.Text delete>已废弃</Typography.Text>);
    expect(container.querySelector('del')).not.toBeNull();
    expect(container.querySelector('del')).toHaveTextContent('已废弃');
  });

  it('strong / underline → data-strong / data-underline（标签保持 span）', () => {
    const { container } = render(
      <Typography.Text strong underline>强调</Typography.Text>,
    );
    const span = container.querySelector('span')!;
    expect(span).toHaveAttribute('data-strong', 'true');
    expect(span).toHaveAttribute('data-underline', 'true');
  });

  it('组合态：code + delete → 标签为 <code>，data-delete 保留（CSS 叠加删除线）', () => {
    const { container } = render(<Typography.Text code delete>旧 API</Typography.Text>);
    const code = container.querySelector('code')!;
    expect(code).not.toBeNull();
    expect(code).toHaveAttribute('data-code', 'true');
    expect(code).toHaveAttribute('data-delete', 'true');
  });
});

describe('type 配色', () => {
  it('四色 → data-type 透传（CSS 侧映射 --z-color-* 令牌）', () => {
    for (const type of ['secondary', 'success', 'warning', 'danger'] as const) {
      const { container, unmount } = render(<TypographyText type={type}>颜色</TypographyText>);
      expect(container.firstChild).toHaveAttribute('data-type', type);
      unmount();
    }
  });
});

describe('copyable', () => {
  it('点击复制按钮 → navigator.clipboard.writeText 收到 children 文本，onCopy 回调触发', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const onCopy = vi.fn();
    const { container } = render(
      <Typography.Text copyable={{ onCopy }}>ZUI 文本</Typography.Text>,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    await user.click(button!);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('ZUI 文本');
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('复制成功态：aria-label=复制 → title=已复制 + aria-live=polite 反馈节点，1.5s 后还原', async () => {
    vi.useFakeTimers();
    try {
      const writeText = vi.fn().mockResolvedValue(undefined);
      stubClipboard(writeText);
      const { container } = render(<Typography.Text copyable>ZUI</Typography.Text>);
      const button = container.querySelector('button')!;
      expect(button).toHaveAttribute('aria-label', '复制');
      expect(button).not.toHaveAttribute('title');

      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute('data-copied', 'true');
      expect(button).toHaveAttribute('title', '已复制');
      const feedback = container.querySelector('[data-part="copy-feedback"]');
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveAttribute('aria-live', 'polite');
      expect(feedback).toHaveTextContent('已复制');

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(button).not.toHaveAttribute('data-copied');
      expect(button).not.toHaveAttribute('title');
      expect(container.querySelector('[data-part="copy-feedback"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('CopyConfig.text 覆盖被复制内容（默认取 children 文本）', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { container } = render(
      <Typography.Text copyable={{ text: '自定义内容' }}>
        <b>富文本</b>
      </Typography.Text>,
    );
    await user.click(container.querySelector('button')!);
    expect(writeText).toHaveBeenCalledWith('自定义内容');
  });

  it('默认复制内容递归提取 children 文本（嵌套元素拼接）', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { container } = render(
      <Typography.Paragraph copyable>
        版本 <strong>v2</strong>
      </Typography.Paragraph>,
    );
    await user.click(container.querySelector('button')!);
    expect(writeText).toHaveBeenCalledWith('版本 v2');
  });

  it('navigator.clipboard 失败 → 回退 textarea + execCommand("copy")，仍进入成功态', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard(writeText);
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    try {
      const { container } = render(<Typography.Text copyable>回退复制</Typography.Text>);
      await user.click(container.querySelector('button')!);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(execCommand).toHaveBeenCalledWith('copy');
      // 隐藏 textarea 用后即删
      expect(container.querySelector('textarea')).toBeNull();
      expect(container.querySelector('button')).toHaveAttribute('data-copied', 'true');
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });
});

describe('定制出口', () => {
  it('classNames.root/copy 追加、data-part=root/copy、className 透传根元素', () => {
    const { container } = render(
      <Typography.Text
        copyable
        className="my-text"
        classNames={{ root: 'my-root', copy: 'my-copy' }}
      >
        定制
      </Typography.Text>,
    );
    const root = container.querySelector('span.z-typography')!;
    expect(root).toHaveClass('my-text');
    expect(root).toHaveClass('my-root');
    expect(root).toHaveAttribute('data-part', 'root');
    const button = container.querySelector('button')!;
    expect(button).toHaveClass('my-copy');
    expect(button).toHaveAttribute('data-part', 'copy');
  });
});
