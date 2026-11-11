import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputNumber } from './InputNumber';

afterEach(cleanup);

function getInput(): HTMLInputElement {
  return screen.getByRole('spinbutton') as HTMLInputElement;
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

describe('InputNumber', () => {
  it('renders with default size, parts and spinbutton semantics', () => {
    const { container } = render(<InputNumber aria-label="数量" />);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveClass('z-input-number');
    const input = getInput();
    expect(input).toHaveAttribute('data-part', 'input');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveClass('z-input-number-input');
    expect(input.value).toBe('');
    const increase = screen.getByRole('button', { name: '增加' });
    const decrease = screen.getByRole('button', { name: '减少' });
    expect(increase).toHaveAttribute('data-part', 'increase');
    expect(increase).toHaveClass('z-input-number-increase');
    expect(increase).toHaveAttribute('type', 'button');
    expect(decrease).toHaveAttribute('data-part', 'decrease');
    expect(decrease).toHaveClass('z-input-number-decrease');
    expect(container.querySelector('[data-part="controls"]')).toBeInTheDocument();
  });

  it('exposes size via data-size', () => {
    const { container, unmount } = render(<InputNumber aria-label="数量" size="lg" />);
    expect(getRoot(container)).toHaveAttribute('data-size', 'lg');
    unmount();
    const second = render(<InputNumber aria-label="数量" size="sm" />);
    expect(getRoot(second.container)).toHaveAttribute('data-size', 'sm');
  });

  it('uncontrolled: +/- buttons step by step and fire onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" defaultValue={5} onChange={onChange} />);
    const input = getInput();
    expect(input).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: '增加' }));
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(input).toHaveValue(6);
    await user.click(screen.getByRole('button', { name: '减少' }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input).toHaveValue(5);
  });

  it('keyboard: ArrowUp/ArrowDown step with the step prop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" defaultValue={5} step={2} onChange={onChange} />);
    const input = getInput();
    await user.click(input);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(7);
    expect(input).toHaveValue(7);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(input).toHaveValue(3);
  });

  it('clamps at min/max bounds: buttons disable and stepping does not overshoot', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(
      <InputNumber aria-label="数量" min={0} max={10} defaultValue={10} onChange={onChange} />
    );
    expect(screen.getByRole('button', { name: '增加' })).toBeDisabled();
    const input = getInput();
    await user.click(input);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue(10);
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    onChange.mockClear();
    render(<InputNumber aria-label="数量" min={0} max={10} defaultValue={0} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '减少' })).toBeDisabled();
    await user.click(getInput());
    await user.keyboard('{ArrowDown}');
    expect(getInput()).toHaveValue(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps a typed value to max on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" max={10} defaultValue={1} onChange={onChange} />);
    const input = getInput();
    await user.clear(input);
    await user.type(input, '99');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(input).toHaveValue(10);
  });

  it('precision: formats the display and rounds committed values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" precision={2} defaultValue={1.5} onChange={onChange} />);
    const input = getInput();
    expect(input).toHaveValue(1.5);
    expect(input.value).toBe('1.50');
    await user.clear(input);
    // jsdom 的 number input 逐字键入小数点会被清空，用 change 直接提交完整数值
    fireEvent.change(input, { target: { value: '3.14159' } });
    expect(onChange).toHaveBeenLastCalledWith(3.14);
    await user.tab();
    expect(input.value).toBe('3.14');
  });

  it('controlled: value prop wins, onChange fires, rerender updates display', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<InputNumber aria-label="数量" value={5} onChange={onChange} />);
    const input = getInput();
    expect(input).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: '增加' }));
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(input).toHaveValue(5);
    rerender(<InputNumber aria-label="数量" value={8} onChange={onChange} />);
    expect(input).toHaveValue(8);
  });

  it('disabled: input and controls disabled, interactions do nothing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" defaultValue={5} disabled onChange={onChange} />);
    expect(getInput()).toBeDisabled();
    expect(screen.getByRole('button', { name: '增加' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '减少' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '增加' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('controls={false} hides the +/- buttons', () => {
    render(<InputNumber aria-label="数量" controls={false} />);
    expect(screen.queryByRole('button', { name: '增加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '减少' })).not.toBeInTheDocument();
  });

  it('clearing the input commits null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<InputNumber aria-label="数量" defaultValue={5} onChange={onChange} />);
    await user.clear(getInput());
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(getInput().value).toBe('');
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <InputNumber
        aria-label="数量"
        className="my-root"
        classNames={{
          root: 'cls-root',
          input: 'cls-input',
          increase: 'cls-inc',
          decrease: 'cls-dec',
        }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-input-number', 'my-root', 'cls-root');
    expect(getInput()).toHaveClass('z-input-number-input', 'cls-input');
    expect(screen.getByRole('button', { name: '增加' })).toHaveClass(
      'z-input-number-increase',
      'cls-inc'
    );
    expect(screen.getByRole('button', { name: '减少' })).toHaveClass(
      'z-input-number-decrease',
      'cls-dec'
    );
  });

  it('forwards ref to the native input and passes native props through', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <InputNumber ref={ref} aria-label="数量" placeholder="请输入" name="qty" maxLength={5} />
    );
    const input = getInput();
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('placeholder', '请输入');
    expect(input).toHaveAttribute('name', 'qty');
    expect(input).toHaveAttribute('maxlength', '5');
  });

  it('value={null} is a controlled empty state, not uncontrolled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <InputNumber
          aria-label="数量"
          value={value}
          onChange={onChange}
          // 父级拒绝更新：输入后 UI 必须服从 null
          onChangeCapture={() => setValue(null)}
        />
      );
    }
    render(<Controlled />);
    const input = getInput() as HTMLInputElement;
    // 键入过程显示草稿；失焦提交时父级仍拒绝（value 恒为 null），回滚为空显示
    await user.type(input, '5');
    expect(onChange).toHaveBeenCalled();
    await user.keyboard('{Tab}');
    expect(input.value).toBe('');
  });

  it('renders empty string (not crash) when Form injects a non-number value', () => {
    // Form.Item 会把 null 强转 '' 注入；此处模拟该契约外输入，要求按空值渲染
    const { container } = render(
      // @ts-expect-error 模拟 Form 运行时注入的契约外值
      <InputNumber aria-label="数量" value={''} precision={2} />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    // type=number 的 toHaveValue 语义不稳定，直接断言字符串值
    expect(input.value).toBe('');
  });
});
