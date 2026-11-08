/**
 * a11y.roles.test.tsx —— 全组件 ARIA 角色/状态矩阵断言（a11y 组）
 *
 * 覆盖 CONTRACTS.md §2 / CONTRACTS-V2.md §4 要求的角色与状态语义：
 * Select / Modal / Tabs / Message / Switch / Checkbox / RadioGroup / Table。
 * 只断言 DOM 上的 ARIA 语义（jsdom 测不了真实读屏，见 docs/a11y-notes.md）。
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '../components/Checkbox';
import { Combobox } from '../components/Combobox';
import { DatePicker } from '../components/DatePicker';
import { MessageProvider, useMessage, type MessageApi } from '../components/Message';
import { Modal } from '../components/Modal';
import { Radio, RadioGroup } from '../components/Radio';
import { Segmented } from '../components/Segmented';
import { Select, type SelectOption } from '../components/Select';
import { Switch } from '../components/Switch';
import { Table } from '../components/Table';
import { Tabs } from '../components/Tabs';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const fruitOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

describe('Combobox ARIA 角色与状态', () => {
  it('关闭态不引用未挂载列表，打开后关联 listbox 与活动 option', async () => {
    const user = userEvent.setup();
    render(<Combobox options={fruitOptions} aria-label="水果搜索" />);
    const input = screen.getByRole('combobox', { name: '水果搜索' });

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    input.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('active 与 selected 分离，loading 同步 aria-busy', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        options={fruitOptions}
        defaultValue="banana"
        defaultOpen
        loading
        aria-label="加载中的水果"
      />
    );
    const input = screen.getByRole('combobox', { name: '加载中的水果' });
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');

    expect(input).toHaveAttribute('aria-busy', 'true');
    expect(listbox).toHaveAttribute('aria-busy', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    input.focus();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('readOnly 暴露只读状态且不挂载 listbox', () => {
    render(
      <Combobox
        options={fruitOptions}
        defaultValue="apple"
        defaultOpen
        readOnly
        aria-label="只读水果"
      />
    );
    const input = screen.getByRole('combobox', { name: '只读水果' });
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-readonly', 'true');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('Select ARIA 角色与状态', () => {
  it('触发器：aria-haspopup="listbox" + aria-expanded + aria-controls 关联列表', async () => {
    const user = userEvent.setup();
    render(<Select options={fruitOptions} />);
    const trigger = screen.getByRole('button');

    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const listbox = screen.getByRole('listbox');
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('列表：role="listbox"，选项 role="option" + aria-selected 状态', () => {
    render(<Select options={fruitOptions} defaultValue="banana" />);
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(3);
    // 仅选中项 aria-selected=true，其余 false
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('disabled option 带 aria-disabled，仍保持 option 角色', () => {
    render(
      <Select
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two', disabled: true },
        ]}
      />
    );
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-disabled', 'true');
    expect(options[0]).not.toHaveAttribute('aria-disabled');
  });
});

describe('Modal ARIA 角色与关联', () => {
  it('dialog：role="dialog" + aria-modal="true" + aria-labelledby/aria-describedby 关联', () => {
    render(
      <Modal defaultOpen>
        <Modal.Trigger>打开</Modal.Trigger>
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>弹窗标题</Modal.Title>
            <Modal.Description>弹窗描述</Modal.Description>
          </Modal.Header>
          <Modal.Body>内容</Modal.Body>
        </Modal.Content>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('tabindex', '-1');

    const title = screen.getByText('弹窗标题');
    const description = screen.getByText('弹窗描述');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(description.id);
    expect(title.id).toBeTruthy();
    expect(description.id).toBeTruthy();
  });

  it('Modal.Close：aria-label="关闭"，Trigger：aria-haspopup="dialog"', async () => {
    const user = userEvent.setup();
    render(
      <Modal>
        <Modal.Trigger>打开弹窗</Modal.Trigger>
        <Modal.Content>
          <Modal.Title>标题</Modal.Title>
          <Modal.Body>内容</Modal.Body>
          <Modal.Close>×</Modal.Close>
        </Modal.Content>
      </Modal>
    );

    expect(screen.getByRole('button', { name: '打开弹窗' })).toHaveAttribute(
      'aria-haspopup',
      'dialog'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开弹窗' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });
});

describe('Tabs ARIA 角色与关联', () => {
  function BasicTabs(props: { orientation?: 'horizontal' | 'vertical' }) {
    return (
      <Tabs defaultValue="one" orientation={props.orientation}>
        <Tabs.List>
          <Tabs.Trigger value="one">Tab One</Tabs.Trigger>
          <Tabs.Trigger value="two">Tab Two</Tabs.Trigger>
          <Tabs.Trigger value="three">Tab Three</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="one">Panel One</Tabs.Panel>
        <Tabs.Panel value="two">Panel Two</Tabs.Panel>
        <Tabs.Panel value="three">Panel Three</Tabs.Panel>
      </Tabs>
    );
  }

  it('tablist/tab/tabpanel 角色 + aria-selected + aria-controls/aria-labelledby 双向关联', () => {
    render(<BasicTabs />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    // tab → panel（aria-controls）与 panel → tab（aria-labelledby）双向
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
  });

  it('切换选中后 aria-selected 跟随，关联指向新面板', async () => {
    const user = userEvent.setup();
    render(<BasicTabs />);
    const tabs = screen.getAllByRole('tab');

    await user.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Panel Two');
    expect(tabs[1].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id);
  });

  it('vertical 模式 tablist 带 aria-orientation="vertical"', () => {
    render(<BasicTabs orientation="vertical" />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  });
});

describe('Message live region 语义', () => {
  let api: MessageApi;

  function Harness() {
    api = useMessage();
    return null;
  }

  function renderMessage() {
    return render(
      <MessageProvider>
        <Harness />
      </MessageProvider>
    );
  }

  it('普通/成功消息：role="status" + aria-live="polite"', () => {
    renderMessage();
    act(() => {
      api.success('保存成功');
    });
    const item = screen.getByText('保存成功').closest('[data-part="item"]') as HTMLElement;
    expect(item).toHaveAttribute('role', 'status');
    expect(item).toHaveAttribute('aria-live', 'polite');
    expect(item).toHaveAttribute('data-variant', 'success');
  });

  it('error 消息：role="status" + aria-live="assertive"', () => {
    renderMessage();
    act(() => {
      api.error('提交失败');
    });
    const item = screen.getByText('提交失败').closest('[data-part="item"]') as HTMLElement;
    expect(item).toHaveAttribute('role', 'status');
    expect(item).toHaveAttribute('aria-live', 'assertive');
    expect(item).toHaveAttribute('data-variant', 'error');
  });
});

describe('Switch ARIA 角色与状态', () => {
  it('role="switch" + aria-checked 双态', async () => {
    const user = userEvent.setup();
    render(<Switch label="深色模式" defaultChecked={false} />);
    const sw = screen.getByRole('switch', { name: '深色模式' });

    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Checkbox aria-checked 状态', () => {
  it('indeterminate：aria-checked="mixed" + DOM indeterminate 属性', () => {
    render(<Checkbox label="全选" indeterminate />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    expect(box.indeterminate).toBe(true);
  });

  it('普通态不带 aria-checked="mixed"（true/false 交给原生 checked）', () => {
    const { rerender } = render(
      <Checkbox label="同意" checked={false} onChange={() => undefined} />
    );
    let box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box).not.toHaveAttribute('aria-checked', 'mixed');
    expect(box.checked).toBe(false);

    rerender(<Checkbox label="同意" checked onChange={() => undefined} />);
    box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box).not.toHaveAttribute('aria-checked', 'mixed');
    expect(box.checked).toBe(true);
  });
});

describe('RadioGroup ARIA 角色与方向', () => {
  it('role="radiogroup" + aria-orientation 默认 vertical', () => {
    render(
      <RadioGroup defaultValue="a">
        <Radio value="a" label="选项 A" />
        <Radio value="b" label="选项 B" />
      </RadioGroup>
    );
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-orientation', 'vertical');
    // 组内是原生 radio 语义
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('horizontal 映射 aria-orientation="horizontal"', () => {
    render(
      <RadioGroup orientation="horizontal">
        <Radio value="a" label="选项 A" />
        <Radio value="b" label="选项 B" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'horizontal');
  });
});

describe('Table 表头语义', () => {
  it('th[scope=col]：所有表头单元格声明列作用域', () => {
    render(
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>姓名</Table.HeaderCell>
            <Table.HeaderCell>年龄</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.Cell>张三</Table.Cell>
            <Table.Cell>18</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const th of headers) {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'col');
    }
  });
});

describe('DatePicker ARIA 角色与状态', () => {
  it('打开面板后：role="grid" + gridcell 日期格 + aria-selected 选中态', async () => {
    const user = userEvent.setup();
    render(<DatePicker defaultValue="2024-03-11" />);
    // 面板经 Portal 渲染，先打开再查询
    await user.click(screen.getByRole('textbox', { name: '日期' }));

    const grid = screen.getByRole('grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('aria-labelledby');

    const cells = within(grid).getAllByRole('gridcell');
    // 6 周完整日历
    expect(cells).toHaveLength(42);

    // 唯一选中格 = 默认值当天
    const selectedCells = cells.filter((cell) => cell.getAttribute('aria-selected') === 'true');
    expect(selectedCells).toHaveLength(1);
    expect(selectedCells[0]).toHaveTextContent('11');
  });
});

describe('Segmented ARIA 角色与状态', () => {
  it('role="radiogroup" + 横向 orientation + role="radio" 项 aria-checked', async () => {
    const user = userEvent.setup();
    render(
      <Segmented
        aria-label="视图切换"
        options={[
          { value: 'day', label: '日' },
          { value: 'week', label: '周' },
          { value: 'month', label: '月' },
        ]}
      />
    );

    const group = screen.getByRole('radiogroup', { name: '视图切换' });
    expect(group).toHaveAttribute('aria-orientation', 'horizontal');

    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    // 非受控默认选中第一项
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    expect(radios[2]).toHaveAttribute('aria-checked', 'false');

    await user.click(radios[2]);
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });
});
