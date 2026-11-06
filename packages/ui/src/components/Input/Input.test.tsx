import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';
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

  it('clearable: clicking clear empties the value, focuses input and fires onClear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Input aria-label="名称" clearable defaultValue="有值" onClear={onClear} />);
    const input = getInput();
    expect(input).toHaveValue('有值');
    await user.click(screen.getByRole('button', { name: '清除' }));
    expect(input).toHaveValue('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
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
    render(<Form initialValues={{ name: 'Alice' }} onFinish={finish}>
      <Form.Item name="name" label="名称" required><Input clearable /></Form.Item>
      <button type="submit">保存</button>
    </Form>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '清除' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(finish).not.toHaveBeenCalled();
    expect(getInput()).toHaveValue('');
    expect(screen.getByText('该项为必填')).toBeInTheDocument();
  });

  it('renders prefix and suffix with data-part', () => {
    const { container } = render(<Input aria-label="搜索" prefix={<span>搜索</span>} suffix="个" />);
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
