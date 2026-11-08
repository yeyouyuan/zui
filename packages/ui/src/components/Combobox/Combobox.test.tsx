import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form } from '../Form';
import { Combobox } from './index';
import type { ComboboxOption } from './index';

afterEach(cleanup);

const options: ComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'shanghai', label: '上海', keywords: ['sh'] },
];

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

describe('Combobox 渲染与 ARIA', () => {
  it('渲染文本输入、占位、parts 与关闭态 ARIA', () => {
    const { container } = render(
      <Combobox
        options={options}
        aria-label="城市"
        className="custom-root"
        classNames={{ root: 'slot-root', control: 'slot-control', input: 'slot-input' }}
        size="lg"
        status="error"
      />
    );

    const input = getInput();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', '请输入或选择');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    const root = container.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-combobox', 'custom-root', 'slot-root');
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(root).toHaveAttribute('data-status', 'error');
    expect(container.querySelector('[data-part="control"]')).toHaveClass('slot-control');
    expect(input).toHaveClass('slot-input');
  });

  it('打开后关联 listbox/option，首次跳过 disabled，option id 不拼 value', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        aria-label="特殊选项"
        options={[
          { value: 'unsafe value/with spaces', label: '不可选', disabled: true },
          { value: 'safe', label: <strong>可选项</strong>, textValue: '可选项文本' },
        ]}
      />
    );

    const input = getInput();
    input.focus();
    await user.keyboard('{ArrowDown}');

    const listbox = screen.getByRole('listbox');
    const renderedOptions = within(listbox).getAllByRole('option');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[1].id);
    expect(renderedOptions[0].id).not.toContain('unsafe value/with spaces');
    expect(renderedOptions[0]).toHaveAttribute('aria-disabled', 'true');
    expect(renderedOptions[1]).toHaveAccessibleName('可选项文本');
  });

  it('空字符串 value 始终按 disabled option 处理', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const blankOptions: ComboboxOption[] = [
      { value: '', label: '空值' },
      { value: 'available', label: '可选值' },
    ];
    const { unmount } = render(
      <Combobox options={blankOptions} defaultOpen aria-label="空值选项" onChange={onChange} />
    );

    const input = getInput();
    const renderedOptions = screen.getAllByRole('option');
    expect(renderedOptions[0]).toHaveAttribute('aria-disabled', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[1].id);
    await user.click(renderedOptions[0]);
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    const onExactMatch = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Combobox
        options={blankOptions}
        open={false}
        defaultInputValue="空值"
        aria-label="空值精确匹配"
        onChange={onExactMatch}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onExactMatch).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true, { reason: 'keyboard' });
  });

  it('defaultValue 优先展示提交文本，隐藏字段只序列化 committed value', () => {
    const { container } = render(
      <Combobox
        options={options}
        defaultValue="banana"
        defaultInputValue="不应展示"
        name="fruit"
        aria-label="水果"
      />
    );

    expect(getInput()).toHaveValue('Banana');
    expect(getInput()).not.toHaveAttribute('name');
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden).toHaveAttribute('name', 'fruit');
    expect(hidden).toHaveValue('banana');
  });
});

describe('Combobox 状态与搜索', () => {
  it('输入只更新草稿并过滤，选择后才更新 committed value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onInputValueChange = vi.fn();
    const onSearch = vi.fn();
    const { container } = render(
      <Combobox
        options={options}
        defaultValue="apple"
        name="fruit"
        aria-label="水果"
        onChange={onChange}
        onInputValueChange={onInputValueChange}
        onSearch={onSearch}
      />
    );

    const input = getInput();
    await user.clear(input);
    await user.type(input, 'Ban');

    expect(input).toHaveValue('Ban');
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')).toHaveValue('apple');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Banana');
    expect(onChange).not.toHaveBeenCalled();
    expect(onSearch).toHaveBeenLastCalledWith('Ban');
    expect(onInputValueChange).toHaveBeenLastCalledWith('Ban', {
      reason: 'input',
      isComposing: false,
    });

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('banana', expect.objectContaining({ value: 'banana' }), {
      reason: 'selection',
    });
    expect(input).toHaveValue('Banana');
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')).toHaveValue('banana');
  });

  it('受控 value/open 被父级拒绝时不乐观切换展示、隐藏值或面板', () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const { container } = render(
      <Combobox
        options={options}
        value="apple"
        open={false}
        name="fruit"
        aria-label="水果"
        onChange={onChange}
        onOpenChange={onOpenChange}
      />
    );

    const input = getInput();
    fireEvent.change(input, { target: { value: 'Banana' } });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(true, { reason: 'input' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('banana', expect.objectContaining({ value: 'banana' }), {
      reason: 'selection',
    });
    expect(input).toHaveValue('Apple');
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')).toHaveValue('apple');
  });

  it('受控 inputValue 外部更新会同步展示文本与过滤结果', () => {
    const { rerender } = render(
      <Combobox options={options} value="apple" inputValue="Apple" open aria-label="受控水果" />
    );

    expect(getInput()).toHaveValue('Apple');
    expect(screen.getAllByRole('option')).toHaveLength(3);

    rerender(
      <Combobox options={options} value="apple" inputValue="Ban" open aria-label="受控水果" />
    );

    expect(getInput()).toHaveValue('Ban');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Banana');
  });

  it('关闭态 Enter 仅提交唯一展示文本精确匹配，多个匹配不猜测', () => {
    const uniqueChange = vi.fn();
    const uniqueOpen = vi.fn();
    const { unmount } = render(
      <Combobox
        options={options}
        open={false}
        aria-label="唯一匹配"
        onChange={uniqueChange}
        onOpenChange={uniqueOpen}
      />
    );
    fireEvent.change(getInput(), { target: { value: 'Banana' } });
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(uniqueChange).toHaveBeenCalledWith(
      'banana',
      expect.objectContaining({ value: 'banana' }),
      { reason: 'selection' }
    );
    unmount();

    const ambiguousChange = vi.fn();
    const ambiguousOpen = vi.fn();
    render(
      <Combobox
        options={[
          { value: 'one', label: '一', textValue: 'Same' },
          { value: 'two', label: '二', textValue: 'Same' },
        ]}
        open={false}
        aria-label="多个匹配"
        onChange={ambiguousChange}
        onOpenChange={ambiguousOpen}
      />
    );
    fireEvent.change(getInput(), { target: { value: 'Same' } });
    ambiguousOpen.mockClear();
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(ambiguousChange).not.toHaveBeenCalled();
    expect(ambiguousOpen).toHaveBeenCalledWith(true, { reason: 'keyboard' });
  });

  it('loading 保留旧结果和导航位置，但 Enter/点击均不可提交', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={options}
        defaultValue="apple"
        defaultOpen
        loading
        aria-label="加载中的水果"
        onChange={onChange}
      />
    );

    const input = getInput();
    const renderedOptions = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(renderedOptions[0]).toHaveAttribute('data-stale', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    await user.click(renderedOptions[1]);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('Apple');
  });

  it('结果状态按 loading → error → empty 优先展示', () => {
    const { rerender } = render(
      <Combobox options={[]} defaultOpen loading errorContent="请求失败" aria-label="远程搜索" />
    );
    expect(document.querySelector('[data-part="loading"]')).toHaveTextContent('加载中');
    expect(document.querySelector('[data-part="error"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-part="empty"]')).not.toBeInTheDocument();

    rerender(<Combobox options={[]} defaultOpen errorContent="请求失败" aria-label="远程搜索" />);
    expect(document.querySelector('[data-part="loading"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-part="error"]')).toHaveTextContent('请求失败');
    expect(document.querySelector('[data-part="empty"]')).not.toBeInTheDocument();

    // 空 options 且无 loading/error → 空状态提示（defaultOpen 只在首次生效，
    // rerender 后内部 open 状态可能被重置，用 fresh render 确保面板打开）
    cleanup();
    render(<Combobox options={[]} defaultOpen aria-label="远程搜索" />);
    expect(document.querySelector('[data-part="empty"]')).toHaveTextContent('暂无匹配选项');
  });
});

describe('Combobox 键盘与焦点', () => {
  it('打开态 Alt+ArrowDown 不重置当前活动项', () => {
    render(<Combobox options={options} defaultOpen aria-label="水果" />);
    const input = getInput();
    const renderedOptions = screen.getAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[1].id);

    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[1].id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('方向导航可停在 disabled option，但 disabled option 不可提交', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={[
          { value: 'disabled', label: 'Disabled', disabled: true },
          { value: 'enabled', label: 'Enabled' },
        ]}
        aria-label="选项"
        onChange={onChange}
      />
    );
    const input = getInput();
    input.focus();
    await user.keyboard('{ArrowDown}');
    const renderedOptions = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[1].id);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', renderedOptions[0].id);
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('Tab 到 clear 属于内部移动，离开组件后才 blur、关闭并严格回退', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <>
        <Combobox
          options={options}
          defaultValue="apple"
          clearable
          aria-label="水果"
          onBlur={onBlur}
        />
        <button type="button">后续按钮</button>
      </>
    );
    const input = getInput();
    await user.clear(input);
    await user.type(input, '草稿');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await user.tab();
    expect(screen.getByRole('button', { name: '清除选择' })).toHaveFocus();
    expect(onBlur).not.toHaveBeenCalled();
    expect(input).toHaveValue('草稿');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await user.tab();
    expect(screen.getByRole('button', { name: '后续按钮' })).toHaveFocus();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('Apple');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('clear 可通过键盘激活，清除后焦点恢复 input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Combobox
        options={options}
        defaultValue="apple"
        clearable
        aria-label="水果"
        onChange={onChange}
      />
    );
    const input = getInput();
    input.focus();
    await user.tab();
    const clear = screen.getByRole('button', { name: '清除选择' });
    expect(clear).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenCalledWith(null, null, { reason: 'clear' });
    expect(screen.queryByRole('button', { name: '清除选择' })).not.toBeInTheDocument();
  });

  it('readOnly 可聚焦复制，但不渲染按钮、不打开或导航', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        options={options}
        defaultValue="apple"
        clearable
        readOnly
        openOnFocus
        aria-label="只读水果"
      />
    );
    const input = getInput();
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-readonly', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    input.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('Combobox IME', () => {
  it('组合输入同步草稿但不搜索/提交，compositionend 只搜索一次', () => {
    const onChange = vi.fn();
    const onInputValueChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <Combobox
        options={options}
        aria-label="城市"
        onChange={onChange}
        onInputValueChange={onInputValueChange}
        onSearch={onSearch}
      />
    );
    const input = getInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '上' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '上海' } });

    expect(onInputValueChange).toHaveBeenNthCalledWith(1, '上', {
      reason: 'input',
      isComposing: true,
    });
    expect(onInputValueChange).toHaveBeenNthCalledWith(2, '上海', {
      reason: 'input',
      isComposing: true,
    });
    expect(onSearch).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: '海' });
    fireEvent.change(input, { target: { value: '上海' } });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('上海');
    expect(onInputValueChange).toHaveBeenCalledTimes(2);
  });

  it('keyCode 229 兜底不会提交 active option', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} defaultOpen aria-label="城市" onChange={onChange} />);
    fireEvent.keyDown(getInput(), { key: 'Enter', keyCode: 229, which: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(getInput()).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Combobox Form 集成', () => {
  it('visible/hidden 都继承外置 form，只有 hidden 带 name 并提交 committed value', () => {
    const { container } = render(
      <>
        <form id="external-form" />
        <Combobox
          options={options}
          defaultValue="shanghai"
          name="city"
          form="external-form"
          aria-label="城市"
        />
      </>
    );
    const form = document.querySelector<HTMLFormElement>('#external-form')!;
    const input = getInput();
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
    expect(input).toHaveAttribute('form', 'external-form');
    expect(input).not.toHaveAttribute('name');
    expect(hidden).toHaveAttribute('form', 'external-form');
    expect(hidden).toHaveAttribute('name', 'city');
    expect(new FormData(form).get('city')).toBe('shanghai');
  });

  it('required 依据 committed value 校验，未匹配草稿不能绕过', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <Combobox options={options} name="city" required aria-label="城市" />
      </form>
    );
    const form = container.querySelector('form')!;
    const input = getInput();
    expect(input.checkValidity()).toBe(false);
    await user.type(input, '未匹配');
    expect(input.checkValidity()).toBe(false);
    expect(form.checkValidity()).toBe(false);

    await user.clear(input);
    await user.type(input, '上海');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(input.checkValidity()).toBe(true));
    expect(new FormData(form).get('city')).toBe('shanghai');
  });

  it('Form.Item 通过 onChange 第一参数收集 committed value', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(
      <Form initialValues={{ city: '' }} onFinish={onFinish}>
        <Form.Item name="city" label="城市" rules={[{ required: true }]}>
          <Combobox options={options} />
        </Form.Item>
        <button type="submit">提交</button>
      </Form>
    );

    const input = screen.getByRole('combobox', { name: '城市' });
    await user.type(input, '上海');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: '提交' }));
    expect(onFinish).toHaveBeenCalledWith({ city: 'shanghai' });
  });

  it('原生 form.reset 恢复默认值且不发出变更回调', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onInputValueChange = vi.fn();
    render(
      <form>
        <Combobox
          options={options}
          defaultValue="apple"
          name="fruit"
          aria-label="水果"
          onChange={onChange}
          onInputValueChange={onInputValueChange}
        />
        <button type="reset">重置</button>
      </form>
    );
    const input = getInput();
    input.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(input).toHaveValue('Banana');
    expect(onChange).toHaveBeenCalledTimes(1);
    const inputCalls = onInputValueChange.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '重置' }));
    await waitFor(() => expect(input).toHaveValue('Apple'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onInputValueChange).toHaveBeenCalledTimes(inputCalls);
  });
});

describe('Combobox 开发期警告', () => {
  it('重复 value 与复杂 label 缺 textValue 会警告', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      render(
        <Combobox
          aria-label="异常选项"
          options={[
            { value: 'same', label: <span>复杂</span> },
            { value: 'same', label: '重复' },
          ]}
        />
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('复杂 label'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('重复 option.value'));
    } finally {
      warn.mockRestore();
    }
  });
});
