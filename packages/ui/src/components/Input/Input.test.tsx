import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input, InputPassword, InputSearch, InputTextarea } from './Input';
import { Form } from '../Form';

afterEach(cleanup);

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('Input', () => {
  it('renders with default size/status and input part', () => {
    const { container } = render(<Input aria-label="名称" />);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveAttribute('data-status', 'default');
    expect(root).toHaveClass('z-input');
    const input = getInput();
    expect(input).toHaveAttribute('data-part', 'input');
    expect(input).toHaveClass('z-input-field');
    expect(input).toHaveValue('');
  });

  it('exposes size and status via data attributes', () => {
    const { container, unmount } = render(<Input size="lg" status="error" />);
    let root = getRoot(container);
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(root).toHaveAttribute('data-status', 'error');
    unmount();
    const second = render(<Input size="sm" status="success" />);
    root = getRoot(second.container);
    expect(root).toHaveAttribute('data-size', 'sm');
    expect(root).toHaveAttribute('data-status', 'success');
  });

  it('uncontrolled: typing updates value and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input aria-label="名称" onChange={onChange} />);
    const input = getInput();
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('uncontrolled: defaultValue is honored and editable', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="名称" defaultValue="初始" />);
    const input = getInput();
    expect(input).toHaveValue('初始');
    await user.type(input, 'X');
    expect(input).toHaveValue('初始X');
  });

  it('controlled: value prop wins and does not self-update', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Input aria-label="名称" value="固定" onChange={onChange} />);
    const input = getInput();
    expect(input).toHaveValue('固定');
    await user.type(input, 'x');
    expect(input).toHaveValue('固定');
    expect(onChange).toHaveBeenCalled();
    rerender(<Input aria-label="名称" value="新值" onChange={onChange} />);
    expect(input).toHaveValue('新值');
  });

  it('disabled: input is disabled', () => {
    render(<Input aria-label="名称" disabled />);
    expect(getInput()).toBeDisabled();
  });

  it('readOnly: input is read-only and clear button stays hidden', () => {
    render(<Input aria-label="名称" readOnly clearable defaultValue="有值" />);
    const input = getInput();
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
  });

  it('clearable: shows clear button only when there is a value', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="名称" clearable />);
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
    await user.type(getInput(), 'abc');
    const clear = screen.getByRole('button', { name: '清除' });
    expect(clear).toHaveAttribute('type', 'button');
    expect(clear).toHaveAttribute('data-part', 'clear');
    expect(clear).toHaveClass('z-input-clear');
  });

  it('clearable: not rendered without clearable prop even with value', () => {
    render(<Input aria-label="名称" defaultValue="有值" />);
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
  });

  it('clearable: pointerdown 防止输入失焦，点击后清空并触发 onClear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onBlur = vi.fn();
    render(
      <Input
        aria-label="名称"
        clearable
        defaultValue="有值"
        onClear={onClear}
        onBlur={onBlur}
      />
    );
    const input = getInput();
    input.focus();
    const clear = screen.getByRole('button', { name: '清除' });
    expect(fireEvent.pointerDown(clear)).toBe(false);
    expect(input).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
    await user.click(clear);
    expect(input).toHaveValue('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
  });

  it('clearable: controlled input clears when parent updates value via onClear', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = React.useState('受控');
      return (
        <Input
          aria-label="名称"
          clearable
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onClear={() => setValue('')}
        />
      );
    }
    render(<Controlled />);
    const input = getInput();
    expect(input).toHaveValue('受控');
    await user.click(screen.getByRole('button', { name: '清除' }));
    expect(input).toHaveValue('');
  });

  it('clearable: updates a controlled input through onChange alone', async () => {
    function Controlled() {
      const [value, setValue] = React.useState('受控');
      return <Input clearable value={value} onChange={(event) => setValue(event.target.value)} />;
    }
    render(<Controlled />);
    await userEvent.setup().click(screen.getByRole('button', { name: '清除' }));
    expect(getInput()).toHaveValue('');
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
  });

  it('clearable: clears the submitted Form.Item value and validates it', async () => {
    const finish = vi.fn();
    render(
      <Form initialValues={{ name: 'Alice' }} onFinish={finish}>
        <Form.Item name="name" label="名称" required>
          <Input clearable />
        </Form.Item>
        <button type="submit">保存</button>
      </Form>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '清除' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(finish).not.toHaveBeenCalled();
    expect(getInput()).toHaveValue('');
    expect(screen.getByText('该项为必填')).toBeInTheDocument();
  });

  it('renders prefix and suffix with data-part', () => {
    const { container } = render(
      <Input aria-label="搜索" prefix={<span>搜索</span>} suffix="个" />
    );
    const prefix = container.querySelector('[data-part="prefix"]');
    const suffix = container.querySelector('[data-part="suffix"]');
    expect(prefix).toBeInTheDocument();
    expect(prefix).toHaveClass('z-input-prefix');
    expect(prefix).toHaveTextContent('搜索');
    expect(suffix).toBeInTheDocument();
    expect(suffix).toHaveClass('z-input-suffix');
    expect(suffix).toHaveTextContent('个');
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Input
        aria-label="名称"
        clearable
        defaultValue="有值"
        prefix="P"
        suffix="S"
        className="my-root"
        classNames={{
          root: 'cls-root',
          input: 'cls-input',
          prefix: 'cls-prefix',
          suffix: 'cls-suffix',
          clear: 'cls-clear',
        }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-input', 'my-root', 'cls-root');
    expect(getInput()).toHaveClass('z-input-field', 'cls-input');
    expect(root.querySelector('[data-part="prefix"]')).toHaveClass('z-input-prefix', 'cls-prefix');
    expect(root.querySelector('[data-part="suffix"]')).toHaveClass('z-input-suffix', 'cls-suffix');
    expect(root.querySelector('[data-part="clear"]')).toHaveClass('z-input-clear', 'cls-clear');
  });

  it('forwards ref to the native input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input aria-label="名称" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(getInput());
  });

  it('passes native input props through', () => {
    render(<Input aria-label="名称" placeholder="请输入" maxLength={10} name="username" />);
    const input = getInput();
    expect(input).toHaveAttribute('placeholder', '请输入');
    expect(input).toHaveAttribute('maxlength', '10');
    expect(input).toHaveAttribute('name', 'username');
  });
});

describe('Input.Textarea', () => {
  it('renders textarea with parts, data attributes and modifier class', () => {
    const { container } = render(<InputTextarea aria-label="备注" />);
    const root = getRoot(container);
    expect(root).toHaveClass('z-input', 'z-input-textarea');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveAttribute('data-status', 'default');
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(textarea).toHaveAttribute('data-part', 'textarea');
    expect(textarea).toHaveClass('z-input-field');
  });

  it('uncontrolled: typing updates value and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputTextarea aria-label="备注" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, '第一行');
    expect(textarea).toHaveValue('第一行');
    expect(onChange).toHaveBeenCalled();
  });

  it('controlled: value prop wins and does not self-update', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputTextarea aria-label="备注" value="固定" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'x');
    expect(textarea).toHaveValue('固定');
    expect(onChange).toHaveBeenCalled();
  });

  it('clearable: pointerdown 保持 textarea 焦点并通过原生 setter 清空', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    function Controlled() {
      const [value, setValue] = React.useState('草稿');
      return (
        <InputTextarea
          aria-label="备注"
          clearable
          value={value}
          onBlur={onBlur}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    render(<Controlled />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    expect(textarea).toHaveValue('草稿');
    const clear = screen.getByRole('button', { name: '清除' });
    expect(fireEvent.pointerDown(clear)).toBe(false);
    expect(textarea).toHaveFocus();
    await user.click(clear);
    expect(textarea).toHaveValue('');
    expect(textarea).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
  });

  it('clearable: clears the submitted Form.Item value and validates it', async () => {
    const finish = vi.fn();
    render(
      <Form initialValues={{ bio: '介绍' }} onFinish={finish}>
        <Form.Item name="bio" label="简介" required>
          <InputTextarea clearable />
        </Form.Item>
        <button type="submit">保存</button>
      </Form>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '清除' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(finish).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByText('该项为必填')).toBeInTheDocument();
  });

  it('forwards ref to the native textarea element and passes rows through', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    const { container } = render(<InputTextarea aria-label="备注" ref={ref} rows={4} name="bio" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current).toBe(screen.getByRole('textbox'));
    expect(container.querySelector('[data-part="textarea"]')).toHaveAttribute('rows', '4');
    expect(container.querySelector('[data-part="textarea"]')).toHaveAttribute('name', 'bio');
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <InputTextarea
        aria-label="备注"
        clearable
        defaultValue="有值"
        className="my-root"
        classNames={{ root: 'cls-root', textarea: 'cls-textarea', clear: 'cls-clear' }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-input-textarea', 'my-root', 'cls-root');
    expect(screen.getByRole('textbox')).toHaveClass('z-input-field', 'cls-textarea');
    expect(root.querySelector('[data-part="clear"]')).toHaveClass('z-input-clear', 'cls-clear');
  });
});

describe('Input.Password', () => {
  it('renders password input with toggle button', () => {
    const { container } = render(<InputPassword aria-label="密码" />);
    const input = container.querySelector('[data-part="input"]') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: '显示密码' });
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('data-part', 'toggle');
    expect(toggle).toHaveClass('z-input-toggle');
  });

  it('toggle switches between hidden and visible and updates aria-label', async () => {
    const user = userEvent.setup();
    const { container } = render(<InputPassword aria-label="密码" defaultValue="secret" />);
    const input = container.querySelector('[data-part="input"]') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '显示密码' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret');
    expect(screen.getByRole('button', { name: '隐藏密码' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '隐藏密码' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('visibilityToggle=false hides the toggle button', () => {
    render(<InputPassword aria-label="密码" visibilityToggle={false} />);
    expect(screen.queryByRole('button', { name: '显示密码' })).not.toBeInTheDocument();
  });

  it('disabled input disables the toggle button', () => {
    render(<InputPassword aria-label="密码" disabled />);
    expect(screen.getByRole('button', { name: '显示密码' })).toBeDisabled();
  });

  it('forwards ref to the native input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(<InputPassword aria-label="密码" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(container.querySelector('[data-part="input"]'));
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <InputPassword
        aria-label="密码"
        className="my-root"
        classNames={{ root: 'cls-root', input: 'cls-input', toggle: 'cls-toggle' }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('my-root', 'cls-root');
    expect(container.querySelector('[data-part="input"]')).toHaveClass('cls-input');
    expect(screen.getByRole('button', { name: '显示密码' })).toHaveClass('cls-toggle');
  });
});

describe('Input.Search', () => {
  it('renders searchbox with search button', () => {
    const { container } = render(<InputSearch aria-label="搜索" />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('data-part', 'input');
    const button = screen.getByRole('button', { name: '搜索' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-part', 'search');
    expect(button).toHaveClass('z-input-search-button');
    expect(container).toBeDefined();
  });

  it('clicking the search button fires onSearch with the current value', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<InputSearch aria-label="搜索" onSearch={onSearch} />);
    await user.type(screen.getByRole('searchbox'), 'react');
    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(onSearch).toHaveBeenCalledWith('react');
  });

  it('Enter fires onSearch, Escape does not, and IME composing Enter is ignored', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<InputSearch aria-label="搜索" onSearch={onSearch} />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'vue{Enter}');
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith('vue');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSearch).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('calls the native onKeyDown first and lets preventDefault cancel Enter search', () => {
    const onSearch = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent<HTMLInputElement>) => {
      event.preventDefault();
    });
    render(<InputSearch aria-label="搜索" onSearch={onSearch} onKeyDown={onKeyDown} />);

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('keeps the native input type fixed to search even if unsafe runtime props contain type', () => {
    const unsafeProps = { type: 'email' } as unknown as React.ComponentProps<typeof InputSearch>;
    render(<InputSearch {...unsafeProps} aria-label="搜索" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('type', 'search');
  });

  it('disabled input disables the search button and suppresses onSearch', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<InputSearch aria-label="搜索" disabled onSearch={onSearch} defaultValue="关键词" />);
    expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '搜索' }));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('readOnly input disables the search action instead of leaving an inert enabled button', () => {
    const onSearch = vi.fn();
    render(<InputSearch aria-label="搜索" readOnly onSearch={onSearch} defaultValue="关键词" />);
    expect(screen.getByRole('button', { name: '搜索' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('clearable: pointerdown 保持搜索框焦点，点击后清空并触发 onClear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onBlur = vi.fn();
    render(
      <InputSearch
        aria-label="搜索"
        clearable
        defaultValue="关键词"
        onClear={onClear}
        onBlur={onBlur}
      />
    );
    const input = screen.getByRole('searchbox');
    input.focus();
    const clear = screen.getByRole('button', { name: '清除' });
    expect(fireEvent.pointerDown(clear)).toBe(false);
    expect(input).toHaveFocus();
    await user.click(clear);
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('forwards ref to the native input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<InputSearch aria-label="搜索" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByRole('searchbox'));
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <InputSearch
        aria-label="搜索"
        clearable
        defaultValue="有值"
        className="my-root"
        classNames={{
          root: 'cls-root',
          input: 'cls-input',
          clear: 'cls-clear',
          search: 'cls-search',
        }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-input-search', 'my-root', 'cls-root');
    expect(screen.getByRole('searchbox')).toHaveClass('cls-input');
    expect(root.querySelector('[data-part="clear"]')).toHaveClass('cls-clear');
    expect(root.querySelector('[data-part="search"]')).toHaveClass('cls-search');
  });
});
