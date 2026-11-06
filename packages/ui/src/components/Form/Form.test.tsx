import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form, FormItem, useForm, type FormInstance, type FormValidateResult } from './Form';

afterEach(cleanup);

/** 捕获 Form 内 useForm() 实例 */
function CaptureInstance({ target }: { target: { current: FormInstance | null } }) {
  target.current = useForm();
  return null;
}

/** 数字控件：onChange 直接抛出 number（用于数值范围校验） */
function NumberControl(props: {
  value?: number | '';
  onChange?: (v: number) => void;
  [key: string]: unknown;
}) {
  const { value, onChange, ...rest } = props;
  return (
    <input
      {...rest}
      value={value === undefined || value === '' ? '' : String(value)}
      onChange={(event) => onChange?.(Number(event.target.value))}
    />
  );
}

describe('Form', () => {
  it('渲染 root/item/label/control 结构与 data-part', () => {
    const { container } = render(
      <Form>
        <Form.Item name="user" label="用户名">
          <input />
        </Form.Item>
      </Form>
    );
    const root = container.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-form');
    expect(root?.tagName).toBe('FORM');
    const item = container.querySelector('[data-part="item"]');
    expect(item).toHaveClass('z-form-item');
    expect(item).toHaveAttribute('data-field', 'user');
    const label = container.querySelector('[data-part="label"]');
    expect(label).toHaveClass('z-form-item-label');
    const control = container.querySelector('[data-part="control"]');
    expect(control).toHaveClass('z-form-item-control');
  });

  it('label 通过 htmlFor 关联注入的控件 id', () => {
    const { container } = render(
      <Form>
        <Form.Item name="user" label="用户名">
          <input />
        </Form.Item>
      </Form>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    const label = container.querySelector('[data-part="label"]') as HTMLLabelElement;
    expect(input.id).toBeTruthy();
    expect(label.htmlFor).toBe(input.id);
    expect(input).toHaveAttribute('name', 'user');
  });

  it('注入 value/onChange：输入受 Form 管理', async () => {
    const user = userEvent.setup();
    render(
      <Form>
        <Form.Item name="user">
          <input />
        </Form.Item>
      </Form>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });

  it('required 展示 * 并注入 aria-required', () => {
    const { container } = render(
      <Form>
        <Form.Item name="user" label="用户名" required>
          <input />
        </Form.Item>
      </Form>
    );
    expect(container.querySelector('.z-form-item-required')).toHaveTextContent('*');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('blur 时机：必填字段失焦校验并展示错误（aria-invalid + aria-describedby 关联）', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
      </Form>
    );
    // 未 blur 前不显示错误
    expect(container.querySelector('[data-part="error"]')).toBeNull();

    await user.click(screen.getByRole('textbox'));
    await user.tab();
    const input = screen.getByRole('textbox');
    const error = container.querySelector('[data-part="error"]') as HTMLElement;
    expect(error).toHaveTextContent('该项为必填');
    expect(error).toHaveClass('z-form-item-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('blur 时机：校验通过不展示错误，aria-invalid=false', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
      </Form>
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'ok');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('blur 再校验：修正后错误消失', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
      </Form>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).not.toBeNull();
    await user.type(input, 'x');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toBeNull();
  });

  it('规则 min（长度）：默认与自定义消息', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <Form>
        <Form.Item name="a" rules={[{ min: 3 }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'ab');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('长度不能少于 3');
    unmount();

    const second = render(
      <Form>
        <Form.Item name="a" rules={[{ min: 3, message: '至少 3 个字符' }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'ab');
    await user.tab();
    expect(second.container.querySelector('[data-part="error"]')).toHaveTextContent(
      '至少 3 个字符'
    );
  });

  it('规则 min/max（数值范围，含边界）', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form>
        <Form.Item name="age" rules={[{ min: 18, max: 60 }]}>
          <NumberControl aria-label="年龄" />
        </Form.Item>
      </Form>
    );
    const input = screen.getByRole('textbox', { name: '年龄' });
    await user.type(input, '17');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('数值不能小于 18');

    await user.clear(input);
    await user.type(input, '61');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('数值不能大于 60');

    await user.clear(input);
    await user.type(input, '18');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toBeNull();
  });

  it('规则 pattern：格式不匹配报错（自定义消息）', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form>
        <Form.Item name="code" rules={[{ pattern: /^\d+$/, message: '只能填数字' }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'abc');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('只能填数字');
  });

  it('规则 validator：false 用默认消息，字符串即错误消息，true 通过', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(
      <Form>
        <Form.Item name="a" rules={[{ validator: () => false }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'x');
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('校验不通过');
    unmount();

    const second = render(
      <Form>
        <Form.Item name="a" rules={[{ validator: () => '自定义错误' }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'x');
    await user.tab();
    expect(second.container.querySelector('[data-part="error"]')).toHaveTextContent('自定义错误');
    second.unmount();

    const third = render(
      <Form>
        <Form.Item name="a" rules={[{ validator: () => true }]}>
          <input />
        </Form.Item>
      </Form>
    );
    await user.type(screen.getByRole('textbox'), 'x');
    await user.tab();
    expect(third.container.querySelector('[data-part="error"]')).toBeNull();
  });

  it('提交：全量校验通过触发 onFinish 并 preventDefault', () => {
    const onFinish = vi.fn();
    const { container } = render(
      <Form initialValues={{ user: 'kobe', note: 'hi' }} onFinish={onFinish}>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
        <Form.Item name="note">
          <input />
        </Form.Item>
      </Form>
    );
    const form = container.querySelector('form') as HTMLFormElement;
    const notCancelled = fireEvent.submit(form);
    expect(notCancelled).toBe(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ user: 'kobe', note: 'hi' });
  });

  it('提交：校验失败触发 onFinishFailed（错误映射），不触发 onFinish', () => {
    const onFinish = vi.fn();
    const onFinishFailed = vi.fn();
    const { container } = render(
      <Form onFinish={onFinish} onFinishFailed={onFinishFailed}>
        <Form.Item name="user" rules={[{ required: true, message: '请填写用户名' }]}>
          <input />
        </Form.Item>
      </Form>
    );
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(onFinish).not.toHaveBeenCalled();
    expect(onFinishFailed).toHaveBeenCalledWith({ user: '请填写用户名' });
    // 错误同时上屏
    expect(container.querySelector('[data-part="error"]')).toHaveTextContent('请填写用户名');
  });

  it('checkbox 型子元素注入 checked，勾选后收集布尔值', async () => {
    const user = userEvent.setup();
    const target: { current: FormInstance | null } = { current: null };
    const { container } = render(
      <Form>
        <Form.Item name="agree">
          <input type="checkbox" aria-label="同意协议" />
        </Form.Item>
        <CaptureInstance target={target} />
      </Form>
    );
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(target.current?.getFieldsValue()).toEqual({ agree: true });
  });

  it('useForm：getFieldsValue / setFieldsValue', () => {
    const target: { current: FormInstance | null } = { current: null };
    render(
      <Form initialValues={{ user: 'a', note: 'b' }}>
        <Form.Item name="user">
          <input />
        </Form.Item>
        <Form.Item name="note">
          <input />
        </Form.Item>
        <CaptureInstance target={target} />
      </Form>
    );
    expect(target.current?.getFieldsValue()).toEqual({ user: 'a', note: 'b' });
    expect(target.current?.getFieldsValue(['user'])).toEqual({ user: 'a' });
    act(() => {
      target.current?.setFieldsValue({ user: 'changed' });
    });
    expect(target.current?.getFieldsValue()).toEqual({ user: 'changed', note: 'b' });
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('changed');
  });

  it('useForm：resetFields 归还 initialValues 并清空错误', async () => {
    const user = userEvent.setup();
    const target: { current: FormInstance | null } = { current: null };
    const { container } = render(
      <Form initialValues={{ user: 'init' }}>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
        <CaptureInstance target={target} />
      </Form>
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    await user.tab();
    expect(container.querySelector('[data-part="error"]')).not.toBeNull();

    act(() => {
      target.current?.resetFields();
    });
    expect(input).toHaveValue('init');
    expect(container.querySelector('[data-part="error"]')).toBeNull();
  });

  it('useForm：validateFields 返回值快照与错误映射', async () => {
    const target: { current: FormInstance | null } = { current: null };
    render(
      <Form initialValues={{ user: 'kobe' }}>
        <Form.Item name="user" rules={[{ required: true }]}>
          <input />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, message: '请填写邮箱' }]}>
          <input />
        </Form.Item>
        <CaptureInstance target={target} />
      </Form>
    );
    let result: FormValidateResult | undefined;
    await act(async () => {
      result = await target.current?.validateFields();
    });
    expect(result?.errors).toEqual({ email: '请填写邮箱' });
    expect(result?.values).toEqual({ user: 'kobe', email: undefined });

    let partial: FormValidateResult | undefined;
    await act(async () => {
      partial = await target.current?.validateFields(['user']);
    });
    expect(partial?.errors).toEqual({ email: '请填写邮箱' });
  });

  it('useForm：scrollToField 滚动并聚焦字段控件', () => {
    const target: { current: FormInstance | null } = { current: null };
    render(
      <Form>
        <Form.Item name="user">
          <input />
        </Form.Item>
        <Form.Item name="email">
          <input />
        </Form.Item>
        <CaptureInstance target={target} />
      </Form>
    );
    const inputs = screen.getAllByRole('textbox');
    act(() => {
      target.current?.scrollToField('email');
    });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('useForm 外部实例：通过 form prop 绑定', async () => {
    const target: { current: FormInstance | null } = { current: null };
    function Harness() {
      const form = useForm();
      target.current = form;
      return (
        <Form form={form}>
          <Form.Item name="user" rules={[{ required: true }]}>
            <input />
          </Form.Item>
        </Form>
      );
    }
    render(<Harness />);
    let result: FormValidateResult | undefined;
    await act(async () => {
      result = await target.current?.validateFields();
    });
    expect(result?.errors).toEqual({ user: '该项为必填' });
  });

  it('classNames 各槽位与 data-part 全量透传', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Form classNames={{ root: 'my-form' }}>
        <Form.Item
          name="user"
          label="用户名"
          rules={[{ required: true }]}
          classNames={{ item: 'my-item', label: 'my-label', control: 'my-control', error: 'my-error' }}
        >
          <input />
        </Form.Item>
      </Form>
    );
    await user.click(screen.getByRole('textbox'));
    await user.tab();
    expect(container.querySelector('[data-part="root"]')).toHaveClass('my-form');
    expect(container.querySelector('[data-part="item"]')).toHaveClass('my-item');
    expect(container.querySelector('[data-part="label"]')).toHaveClass('my-label');
    expect(container.querySelector('[data-part="control"]')).toHaveClass('my-control');
    expect(container.querySelector('[data-part="error"]')).toHaveClass('my-error');
  });

  it('Form.Item 在 Form 外使用时抛出明确错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <FormItem name="user">
          <input />
        </FormItem>
      )
    ).toThrow(/Form\.Item/);
    spy.mockRestore();
  });

  it('导出 Form.Item 复合组件形态可用', () => {
    render(
      <Form>
        <Form.Item name="user" label="用户名">
          <input />
        </Form.Item>
      </Form>
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
