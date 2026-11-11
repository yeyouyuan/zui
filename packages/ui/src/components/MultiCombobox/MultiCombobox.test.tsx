import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiCombobox } from './index';
import type { MultiComboboxOption } from './index';

afterEach(cleanup);

const options: MultiComboboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'shanghai', label: '上海', keywords: ['sh'] },
  { value: 'disabled', label: '不可选', disabled: true },
];

function getInput(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

/** 聚焦输入并按 ArrowDown 打开面板 */
async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  getInput().focus();
  await user.keyboard('{ArrowDown}');
}

function getTags(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('[data-part="tag"]')) as HTMLElement[];
}

function hiddenValues(name: string): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)
  ).map((node) => node.value);
}

describe('MultiCombobox 渲染与 ARIA', () => {
  it('渲染输入、占位、parts 与关闭态 ARIA；defaultValue 渲染标签', () => {
    const { container } = render(
      <MultiCombobox
        options={options}
        defaultValue={['apple', 'shanghai']}
        aria-label="标签"
        className="custom-root"
        classNames={{ root: 'slot-root', control: 'slot-control', input: 'slot-input' }}
        size="lg"
        status="error"
      />
    );

    const input = getInput();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    const root = getRoot(container);
    expect(root).toHaveClass('z-multicombobox', 'custom-root', 'slot-root');
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(root).toHaveAttribute('data-status', 'error');
    expect(container.querySelector('[data-part="control"]')).toHaveClass('slot-control');
    expect(input).toHaveClass('slot-input');

    const tags = getTags(root);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toHaveTextContent('Apple');
    expect(tags[1]).toHaveTextContent('上海');
  });

  it('listbox 带 aria-multiselectable，option aria-selected 随选中变化', async () => {
    const user = userEvent.setup();
    render(<MultiCombobox options={options} defaultValue={['apple']} aria-label="标签" />);
    await openPanel(user);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    const rendered = within(listbox).getAllByRole('option');
    expect(rendered[0]).toHaveAttribute('aria-selected', 'true');
    expect(rendered[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('无选中且无草稿时显示占位；有标签后隐藏占位', () => {
    render(<MultiCombobox options={options} aria-label="标签" />);
    expect(getInput()).toHaveAttribute('placeholder', '请输入或选择');
    cleanup();
    render(<MultiCombobox options={options} defaultValue={['apple']} aria-label="标签" />);
    expect(getInput()).not.toHaveAttribute('placeholder');
  });
});

describe('MultiCombobox 选中与标签', () => {
  it('点击 option：toggle 加入、清空草稿、面板保持打开、onChange reason=selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiCombobox options={options} onChange={onChange} aria-label="标签" />);
    await openPanel(user);

    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).toHaveBeenCalledWith(['apple'], { reason: 'selection' });
    expect(getInput()).toHaveValue('');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenLastCalledWith(['apple', 'banana'], { reason: 'selection' });
  });

  it('再次点击已选 option：toggle 移除，reason=remove', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiCombobox
        options={options}
        defaultValue={['apple']}
        onChange={onChange}
        aria-label="标签"
      />
    );
    await openPanel(user);
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).toHaveBeenLastCalledWith([], { reason: 'remove' });
  });

  it('标签删除按钮：移除对应值、focus 回输入框', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiCombobox
        options={options}
        defaultValue={['apple', 'banana']}
        onChange={onChange}
        aria-label="标签"
      />
    );
    await user.click(screen.getAllByRole('button', { name: '移除 Apple' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(['banana'], { reason: 'remove' });
    expect(getInput()).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('input 为空时 Backspace 删除最后一个标签；有草稿时不删', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiCombobox
        options={options}
        defaultValue={['apple', 'banana']}
        onChange={onChange}
        aria-label="标签"
      />
    );
    getInput().focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(['apple'], { reason: 'backspace' });
    await user.keyboard('a');
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(getInput()).toHaveValue('');
  });

  it('clearable：清空按钮移除全部并 reason=clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiCombobox
        options={options}
        defaultValue={['apple']}
        clearable
        onChange={onChange}
        aria-label="标签"
      />
    );
    await user.click(screen.getByRole('button', { name: '清除选择' }));
    expect(onChange).toHaveBeenLastCalledWith([], { reason: 'clear' });
    expect(screen.queryByRole('button', { name: '清除选择' })).not.toBeInTheDocument();
  });

  it('1000 个选项下用索引解析标签，不回退到 options.find per tag', async () => {
    const user = userEvent.setup();
    const indexedOptions = Array.from({ length: 1000 }, (_, index) => ({
      value: `value-${index}`,
      label: `选项 ${index}`,
    }));
    const find = vi.spyOn(indexedOptions, 'find');
    const selectedValues = ['value-0', 'value-500', 'value-999'];
    const onChange = vi.fn();

    const { container } = render(
      <MultiCombobox
        options={indexedOptions}
        defaultValue={selectedValues}
        onChange={onChange}
        aria-label="大列表标签"
      />
    );

    const root = getRoot(container);
    const tags = getTags(root);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toHaveTextContent('选项 0');
    expect(tags[1]).toHaveTextContent('选项 500');
    expect(tags[2]).toHaveTextContent('选项 999');
    expect(find).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '移除 选项 999' }));
    expect(onChange).toHaveBeenLastCalledWith(['value-0', 'value-500'], { reason: 'remove' });
    expect(getTags(root)).toHaveLength(2);
  });

  it('受控 value 不自我更新，父组件更新后同步', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiCombobox options={options} value={['apple']} onChange={onChange} aria-label="标签" />
    );
    await openPanel(user);
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith(['apple', 'banana'], { reason: 'selection' });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[1]).toHaveAttribute(
      'aria-selected',
      'false'
    );
    rerender(
      <MultiCombobox
        options={options}
        value={['apple', 'banana']}
        onChange={onChange}
        aria-label="标签"
      />
    );
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[1]).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('受控父级拒绝选择时在提交周期后恢复搜索草稿', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiCombobox options={options} value={[]} onChange={onChange} aria-label="标签" />);

    await user.type(getInput(), 'ban');
    await user.click(screen.getByRole('option', { name: 'Banana' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['banana'], { reason: 'selection' });
    expect(getInput()).toHaveValue('ban');
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('受控父级接受选择时按约定清空搜索草稿', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function AcceptedSelection() {
      const [value, setValue] = React.useState<string[]>([]);
      return (
        <MultiCombobox
          options={options}
          value={value}
          onChange={(next, details) => {
            onChange(next, details);
            setValue(next);
          }}
          aria-label="标签"
        />
      );
    }

    const { container } = render(<AcceptedSelection />);
    await user.type(getInput(), 'ban');
    await user.click(screen.getByRole('option', { name: 'Banana' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['banana'], { reason: 'selection' });
    expect(getInput()).toHaveValue('');
    expect(getTags(getRoot(container))).toHaveLength(1);
    expect(getTags(getRoot(container))[0]).toHaveTextContent('Banana');
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('MultiCombobox 键盘与 IME', () => {
  it('Enter 选中活动项；连续添加两个', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiCombobox options={options} onChange={onChange} aria-label="标签" />);
    await user.type(getInput(), 'apple');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['apple'], { reason: 'selection' });
    await user.keyboard('{Escape}');
    await user.type(getInput(), 'ban');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['apple', 'banana'], { reason: 'selection' });
  });

  it('disabled option 不可提交，首次高亮跳过', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const disabledOnly: MultiComboboxOption[] = [
      { value: 'no', label: '不可选', disabled: true },
      { value: 'yes', label: '可选' },
    ];
    render(<MultiCombobox options={disabledOnly} onChange={onChange} aria-label="标签" />);
    await openPanel(user);
    const rendered = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(getInput()).toHaveAttribute('aria-activedescendant', rendered[1].id);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['yes'], { reason: 'selection' });
    onChange.mockClear();
    await user.click(screen.getByRole('option', { name: '不可选' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Escape 关闭面板并清空草稿', async () => {
    const user = userEvent.setup();
    render(<MultiCombobox options={options} aria-label="标签" />);
    await user.type(getInput(), 'app');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(getInput()).toHaveValue('');
  });

  it('IME 组合中的 Enter 不提交，compositionend 后才触发 onSearch', async () => {
    const onSearch = vi.fn();
    const onChange = vi.fn();
    render(
      <MultiCombobox options={options} onSearch={onSearch} onChange={onChange} aria-label="标签" />
    );
    const input = getInput();
    input.focus();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '上海' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(onSearch).toHaveBeenLastCalledWith('上海');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['shanghai'], { reason: 'selection' });
  });
});

describe('MultiCombobox 异步与过滤', () => {
  it('loading 中 aria-busy 且旧结果不可提交', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiCombobox options={options} loading onChange={onChange} aria-label="标签" />);
    await openPanel(user);

    expect(getInput()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('加载中')).toBeInTheDocument();
    const rendered = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(rendered[0]).toHaveAttribute('data-stale', 'true');
    await user.click(rendered[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filterOption=false 关闭本地过滤，onSearch 驱动外部结果', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <MultiCombobox
        options={[{ value: 'remote-1', label: 'Remote One' }]}
        filterOption={false}
        onSearch={onSearch}
        aria-label="标签"
      />
    );
    await user.type(getInput(), 'rem');
    expect(onSearch).toHaveBeenLastCalledWith('rem');
    expect(screen.getByRole('option', { name: 'Remote One' })).toBeInTheDocument();
  });

  it('空态与错误态', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MultiCombobox options={[]} aria-label="标签" />);
    await openPanel(user);
    expect(screen.getByText('暂无匹配选项')).toBeInTheDocument();

    rerender(<MultiCombobox options={[]} errorContent="加载失败，请重试" aria-label="标签" />);
    expect(screen.getByText('加载失败，请重试')).toBeInTheDocument();
    expect(screen.queryByText('暂无匹配选项')).not.toBeInTheDocument();
  });

  it('结果 status 区播报过滤数量', async () => {
    const user = userEvent.setup();
    render(<MultiCombobox options={options} aria-label="标签" />);
    await openPanel(user);
    const status = document.querySelector('[data-part="status"][data-kind="results"]');
    expect(status).toHaveTextContent('找到 4 项');
    await user.type(getInput(), 'ban');
    expect(status).toHaveTextContent('找到 1 项');
  });
});

describe('MultiCombobox 表单', () => {
  it('name 下每个选中值渲染一个 hidden input，移除后同步', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MultiCombobox
        options={options}
        defaultValue={['apple', 'banana']}
        name="tags"
        aria-label="标签"
      />
    );
    const hidden = container.querySelectorAll('input[type="hidden"][name="tags"]');
    expect(hidden).toHaveLength(2);
    expect(hidden[0]).toHaveValue('apple');
    await user.click(screen.getAllByRole('button', { name: '移除 Apple' })[0]);
    expect(container.querySelectorAll('input[type="hidden"][name="tags"]')).toHaveLength(1);
  });

  it('required 未选时 setCustomValidity，选中后清除', async () => {
    const user = userEvent.setup();
    render(<MultiCombobox options={options} required name="tags" aria-label="标签" />);
    const input = getInput();
    expect(input.validationMessage).not.toBe('');
    await openPanel(user);
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(input.validationMessage).toBe('');
  });

  it('原生 form reset 恢复 defaultValue 并清空草稿', async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <MultiCombobox options={options} defaultValue={['apple']} name="tags" aria-label="标签" />
      </form>
    );
    await user.click(screen.getAllByRole('button', { name: '移除 Apple' })[0]);
    expect(hiddenValues('tags')).toEqual([]);
    fireEvent.reset(screen.getByTestId('form'));
    expect(hiddenValues('tags')).toEqual(['apple']);
    expect(getInput()).toHaveValue('');
  });
});

describe('MultiCombobox 杂项', () => {
  it('blur 后清空草稿并关闭面板', async () => {
    const user = userEvent.setup();
    render(<MultiCombobox options={options} aria-label="标签" />);
    await user.type(getInput(), 'app');
    expect(getInput()).toHaveValue('app');
    await user.click(document.body);
    expect(getInput()).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ref 转发到 input；classNames 全 slot 透传', () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(
      <MultiCombobox
        options={options}
        defaultValue={['apple']}
        aria-label="标签"
        ref={ref}
        clearable
        classNames={{
          root: 'cls-root',
          control: 'cls-control',
          tags: 'cls-tags',
          tag: 'cls-tag',
          tagLabel: 'cls-tag-label',
          tagRemove: 'cls-tag-remove',
          input: 'cls-input',
          toggle: 'cls-toggle',
        }}
      />
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(getInput());
    expect(getRoot(container)).toHaveClass('cls-root');
    expect(container.querySelector('[data-part="tags"]')).toHaveClass('cls-tags');
    const tag = container.querySelector('[data-part="tag"]') as HTMLElement;
    expect(tag).toHaveClass('cls-tag');
    expect(tag.querySelector('[data-part="tag-label"]')).toHaveClass('cls-tag-label');
    expect(tag.querySelector('[data-part="tag-remove"]')).toHaveClass('cls-tag-remove');
    expect(container.querySelector('[data-part="toggle"]')).toHaveClass('cls-toggle');
  });

  it('readOnly 与 disabled 阻止交互', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiCombobox
        options={options}
        defaultValue={['apple']}
        readOnly
        onChange={onChange}
        aria-label="标签"
      />
    );
    await openPanel(user);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '展开选项' })).not.toBeInTheDocument();
    rerender(
      <MultiCombobox
        options={options}
        defaultValue={['apple']}
        disabled
        onChange={onChange}
        aria-label="标签"
      />
    );
    expect(getInput()).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '移除 Apple' })[0]).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
