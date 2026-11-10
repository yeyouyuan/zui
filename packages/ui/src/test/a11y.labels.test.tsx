/**
 * a11y.labels.test.tsx —— 可访问名覆盖（a11y 组）
 *
 * 所有可交互元素必须有非空可访问名，统一用 getByRole(..., { name }) 从
 * 「读屏用户视角」断言（而非查 DOM 文本/属性）：
 * Button 文本 / iconStart+文本、Modal.Close 图标 "关闭"、Input 清除 "清除"、
 * Message closable "关闭"，并抽样 Tabs/Switch/Select/Modal.Trigger。
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Input } from '../components/Input';
import { Statistic } from '../components/Statistic';
import { MessageProvider, useMessage, type MessageApi } from '../components/Message';
import { Modal } from '../components/Modal';
import { Select, type SelectOption } from '../components/Select';
import { Switch } from '../components/Switch';
import { Tabs } from '../components/Tabs';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const fruitOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
];

describe('Combobox 可访问名', () => {
  it('原生 label 命名输入，clear/toggle 暴露本地化名称', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="fruit-combobox">水果</label>
        <Combobox id="fruit-combobox" options={fruitOptions} defaultValue="apple" clearable />
      </>
    );

    expect(screen.getByRole('combobox', { name: '水果' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除选择' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '展开选项' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: '收起选项' })).toBeInTheDocument();
  });

  it('复杂 option label 使用 textValue 作为可访问名', () => {
    render(
      <Combobox
        aria-label="复杂选项"
        defaultOpen
        options={[
          {
            value: 'shanghai',
            label: (
              <span>
                上海 <small>SHA</small>
              </span>
            ),
            textValue: '上海市',
          },
        ]}
      />
    );
    expect(screen.getByRole('option', { name: '上海市' })).toBeInTheDocument();
  });
});

describe('Button 可访问名', () => {
  it('纯文本按钮：可访问名 = 文本', () => {
    render(<Button>提交</Button>);
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
  });

  it('iconStart + 文本：图标 aria-hidden，可访问名 = 文本', () => {
    render(<Button iconStart={<svg data-testid="icon" />}>保存</Button>);
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    // 装饰性图标不污染可访问名
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('iconEnd + loading：spinner/icon 均 aria-hidden，可访问名 = 文本', () => {
    render(
      <Button iconEnd={<svg data-testid="end-icon" />} loading>
        加载中
      </Button>
    );
    expect(screen.getByRole('button', { name: '加载中' })).toBeInTheDocument();
    expect(screen.getByTestId('end-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('纯图标按钮：aria-label 透传作为可访问名', () => {
    render(<Button aria-label="设置" iconStart={<svg />} />);
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });
});

describe('Modal.Close 可访问名', () => {
  it('Modal.Close 的 × 图标默认可访问名为 "关闭"', () => {
    render(
      <Modal defaultOpen>
        <Modal.Trigger>打开</Modal.Trigger>
        <Modal.Content>
          <Modal.Title>标题</Modal.Title>
          <Modal.Body>内容</Modal.Body>
          <Modal.Footer>
            <Modal.Close>×</Modal.Close>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('Modal.Trigger 文本即为可访问名', () => {
    render(
      <Modal>
        <Modal.Trigger>打开弹窗</Modal.Trigger>
        <Modal.Content>
          <Modal.Body>内容</Modal.Body>
        </Modal.Content>
      </Modal>
    );
    expect(screen.getByRole('button', { name: '打开弹窗' })).toBeInTheDocument();
  });
});

describe('Input 清除按钮可访问名', () => {
  it('clearable 有值时：清除按钮可访问名 "清除"', () => {
    render(<Input clearable defaultValue="关键词" />);
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
  });

  it('无值时不渲染清除按钮，不产生无名按钮', () => {
    render(<Input clearable />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Statistic.CountDown 可访问名', () => {
  it('role=timer 默认可访问名取 locale.statistic.countdown，可被 aria-label 覆盖', () => {
    const { unmount } = render(<Statistic.CountDown value={Date.now() + 60_000} />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '倒计时');
    unmount();
    render(<Statistic.CountDown value={Date.now() + 60_000} aria-label="活动结束" />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '活动结束');
  });
});

describe('Input 子组件按钮可访问名', () => {
  it('Password 切换按钮可访问名随状态切换', async () => {
    const user = userEvent.setup();
    render(<Input.Password aria-label="密码" />);
    expect(screen.getByRole('button', { name: '显示密码' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '显示密码' }));
    expect(screen.getByRole('button', { name: '隐藏密码' })).toBeInTheDocument();
  });

  it('Search 按钮可访问名 "搜索"', () => {
    render(<Input.Search aria-label="搜索" />);
    expect(screen.getByRole('button', { name: '搜索' })).toBeInTheDocument();
  });

  it('Textarea 清除按钮复用 "清除" 可访问名', () => {
    render(<Input.Textarea clearable defaultValue="内容" />);
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
  });
});

describe('Message closable 可访问名', () => {
  let api: MessageApi;

  function Harness() {
    api = useMessage();
    return null;
  }

  it('closable 消息：关闭按钮可访问名 "关闭"', () => {
    render(
      <MessageProvider>
        <Harness />
      </MessageProvider>
    );
    act(() => {
      api.show({ content: '可关闭提示', closable: true, duration: 0 });
    });
    const item = screen.getByText('可关闭提示').closest('[data-part="item"]') as HTMLElement;
    expect(within(item).getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });
});

describe('其余可交互元素可访问名抽样', () => {
  it('Tabs.Trigger：图标 aria-hidden，可访问名 = 文本', () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one" icon={<svg data-testid="tab-icon" />}>
            概览
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">内容</Tabs.Panel>
      </Tabs>
    );
    expect(screen.getByRole('tab', { name: '概览' })).toBeInTheDocument();
    expect(screen.getByTestId('tab-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('Switch：label 文本即可访问名', () => {
    render(<Switch label="自动保存" />);
    expect(screen.getByRole('switch', { name: '自动保存' })).toBeInTheDocument();
  });

  it('Select 触发器：可访问名包含字段标签和当前可见值', () => {
    const { rerender } = render(<Select options={fruitOptions} aria-label="水果" />);
    expect(screen.getByRole('button', { name: '水果 请选择' })).toBeInTheDocument();

    rerender(<Select options={fruitOptions} aria-label="水果" value="apple" />);
    expect(screen.getByRole('button', { name: '水果 Apple' })).toBeInTheDocument();

    rerender(<Select options={fruitOptions} />);
    expect(screen.getByRole('button', { name: '请选择' })).toBeInTheDocument();
  });
});
