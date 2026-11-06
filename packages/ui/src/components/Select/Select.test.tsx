import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './index';
import type { SelectOption } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

// jsdom 无 scrollIntoView，注入 mock 供「active 跟随滚动」断言
const scrollIntoViewMock = vi.fn();
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoViewMock,
  });
});
beforeEach(() => scrollIntoViewMock.mockClear());

const fruitOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function getTrigger() {
  return screen.getByRole('button');
}

function getListbox() {
  return screen.getByRole('listbox');
}

function getOptions() {
  return within(getListbox()).getAllByRole('option');
}

describe('Select 渲染', () => {
  it('默认渲染 placeholder', () => {
    render(<Select options={fruitOptions} />);
    expect(getTrigger()).toHaveTextContent('请选择');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('自定义 placeholder', () => {
    render(<Select options={fruitOptions} placeholder="挑一个" />);
    expect(getTrigger()).toHaveTextContent('挑一个');
  });

  it('defaultValue 时展示对应 label', () => {
    render(<Select options={fruitOptions} defaultValue="banana" />);
    expect(getTrigger()).toHaveTextContent('Banana');
    expect(getTrigger()).not.toHaveTextContent('请选择');
  });

  it('ARIA 结构：listbox/option/aria-selected/aria-controls 关联', () => {
    render(<Select options={fruitOptions} defaultValue="apple" />);
    const trigger = getTrigger();
    const listbox = getListbox();
    expect(listbox).toHaveAttribute('id');
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);

    const options = getOptions();
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(options[0]).toHaveAttribute('id');
    // 关闭时无 activedescendant
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
  });

  it('options 为空渲染 empty part', () => {
    render(<Select options={[]} />);
    const empty = document.querySelector('[data-part="empty"]');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveClass('z-select-empty');
    expect(empty).toHaveTextContent('暂无选项');
    expect(getListbox()).toBeInTheDocument();
  });

  it('name 渲染隐藏 input 供表单提交', () => {
    const { container } = render(<Select options={fruitOptions} name="fruit" defaultValue="cherry" />);
    const input = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('name', 'fruit');
    expect(input?.value).toBe('cherry');
  });

  it('无 name 不渲染隐藏 input', () => {
    const { container } = render(<Select options={fruitOptions} />);
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });

  it('disabled 时触发器禁用', () => {
    render(<Select options={fruitOptions} disabled />);
    expect(getTrigger()).toBeDisabled();
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-disabled', 'true');
  });

  it('classNames / data-part / className 透传', () => {
    render(
      <Select
        options={[{ value: 'a', label: 'A' }]}
        className="extra-root"
        classNames={{
          root: 'c-root',
          trigger: 'c-trigger',
          value: 'c-value',
          listbox: 'c-listbox',
          option: 'c-option',
          empty: 'c-empty',
        }}
      />
    );
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveClass('z-select', 'c-root', 'extra-root');
    const trigger = document.querySelector('[data-part="trigger"]');
    expect(trigger).toHaveClass('z-select-trigger', 'c-trigger');
    expect(document.querySelector('[data-part="value"]')).toHaveClass('c-value');
    expect(document.querySelector('[data-part="listbox"]')).toHaveClass('c-listbox');
    expect(document.querySelector('[data-part="option"]')).toHaveClass('c-option');
  });

  it('empty part 支持 classNames.empty', () => {
    render(<Select options={[]} classNames={{ empty: 'c-empty' }} />);
    expect(document.querySelector('[data-part="empty"]')).toHaveClass('c-empty');
  });

  it('size/status 通过 data 属性暴露', () => {
    render(<Select options={fruitOptions} size="lg" status="error" />);
    const root = document.querySelector('[data-part="root"]');
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(root).toHaveAttribute('data-status', 'error');
  });
});

describe('Select 打开/关闭', () => {
  it('点击切换打开（aria-expanded / data-open）', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-open', 'true');
    expect(document.querySelector('[data-part="listbox"]')).toHaveAttribute('data-open', 'true');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-open', 'false');
  });

  it('关闭态 Enter 打开', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('关闭态 Space 打开', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('关闭态 ArrowDown 打开', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('关闭态 ArrowUp 打开', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard('{ArrowUp}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('Esc 关闭并焦点回触发器', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('Tab 关闭列表', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.tab();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('点击外部关闭（useOnClickOutside）', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);

    const outside = document.createElement('button');
    outside.textContent = '外部';
    document.body.appendChild(outside);
    await user.click(outside);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    outside.remove();
  });

  it('点击 option 不会因失焦中断（mousedown preventDefault）', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);

    await user.click(getOptions()[1]);
    // 选中后焦点保持/回到触发器
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Select 键盘导航', () => {
  it('ArrowDown/ArrowUp 移动 active（aria-activedescendant）', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);

    const options = getOptions();
    // 打开后 active 在首个选项
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);

    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[2].id);
    // 到底不越界
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[2].id);

    await user.keyboard('{ArrowUp}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1].id);
  });

  it('打开时 active 标记 data-active', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    await user.click(getTrigger());
    await user.keyboard('{ArrowDown}');
    const options = getOptions();
    expect(options[1]).toHaveAttribute('data-active', 'true');
    expect(options[0]).not.toHaveAttribute('data-active');
  });

  it('Home/End 跳到首尾', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);
    const options = getOptions();

    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[2].id);
    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('active option 滚动跟随（scrollIntoView block:nearest）', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    await user.click(getTrigger());
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest' });
    scrollIntoViewMock.mockClear();

    await user.keyboard('{ArrowDown}');
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('首字母 typeahead 快速定位', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);
    const options = getOptions();

    await user.keyboard('b');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1].id);
  });

  it('typeahead 连续输入按前缀匹配', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    await user.click(trigger);
    const options = getOptions();

    await user.keyboard('ch');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[2].id);
  });

  it('typeahead 同字母重复输入循环匹配', async () => {
    const user = userEvent.setup();
    render(
      <Select
        options={[
          { value: 'apple', label: 'Apple' },
          { value: 'avocado', label: 'Avocado' },
          { value: 'banana', label: 'Banana' },
        ]}
      />
    );
    const trigger = getTrigger();
    await user.click(trigger);
    const options = getOptions();

    await user.keyboard('a');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);
    await user.keyboard('a');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[1].id);
    await user.keyboard('a');
    expect(trigger).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('关闭态输入首字母打开并定位', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard('c');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = getOptions();
    expect(trigger).toHaveAttribute('aria-activedescendant', options[2].id);
  });
});

describe('Select 选中', () => {
  it('Enter 选中并回调 onChange，关闭并更新展示', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={fruitOptions} onChange={onChange} />);
    const trigger = getTrigger();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('banana');
    expect(trigger).toHaveTextContent('Banana');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('打开态 Space 选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={fruitOptions} defaultValue="apple" onChange={onChange} />);
    const trigger = getTrigger();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('banana');
    expect(trigger).toHaveTextContent('Banana');
  });

  it('鼠标点击 option 选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={fruitOptions} onChange={onChange} />);
    await user.click(getTrigger());

    await user.click(getOptions()[2]);
    expect(onChange).toHaveBeenCalledWith('cherry');
    expect(getTrigger()).toHaveTextContent('Cherry');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('disabled option 可导航但不可选', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options: SelectOption[] = [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two', disabled: true },
      { value: 'three', label: 'Three' },
    ];
    render(<Select options={options} onChange={onChange} />);
    const trigger = getTrigger();
    await user.click(trigger);
    const optionEls = getOptions();

    // 可导航到 disabled option
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', optionEls[1].id);
    expect(optionEls[1]).toHaveAttribute('aria-disabled', 'true');

    // 不可选
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // 鼠标点击也不选
    await user.click(optionEls[1]);
    expect(onChange).not.toHaveBeenCalled();

    // 正常 option 仍可选
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('受控 value：展示跟随 props，变更只回调', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Select options={fruitOptions} value="apple" onChange={onChange} />
    );
    expect(getTrigger()).toHaveTextContent('Apple');

    await user.click(getTrigger());
    await user.click(getOptions()[1]);
    expect(onChange).toHaveBeenCalledWith('banana');
    // 受控未跟随
    expect(getTrigger()).toHaveTextContent('Apple');

    rerender(<Select options={fruitOptions} value="banana" onChange={onChange} />);
    expect(getTrigger()).toHaveTextContent('Banana');
  });

  it('隐藏 input 随选中值同步', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Select options={fruitOptions} name="fruit" defaultValue="apple" />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(input?.value).toBe('apple');

    await user.click(getTrigger());
    await user.click(getOptions()[2]);
    expect(input?.value).toBe('cherry');
  });
});
