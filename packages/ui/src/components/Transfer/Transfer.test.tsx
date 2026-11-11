import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Transfer } from './index';
import type { TransferItem } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const data: TransferItem[] = [
  { key: 'a', title: 'Apple' },
  { key: 'b', title: 'Banana' },
  { key: 'c', title: 'Cherry', disabled: true },
  { key: 'd', title: 'Durian' },
];

function getList(side: '源列表' | '目标列表') {
  return screen.getByRole('listbox', { name: side });
}

function getPanel(side: 'source' | 'target') {
  return document.querySelector(`[data-part="list"][data-side="${side}"]`) as HTMLElement;
}

describe('Transfer 渲染', () => {
  it('渲染双列与默认标题', () => {
    render(<Transfer dataSource={data} />);
    expect(screen.getByRole('listbox', { name: '源列表' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: '目标列表' })).toBeInTheDocument();
    expect(screen.getByText('源列表')).toBeInTheDocument();
    expect(screen.getByText('目标列表')).toBeInTheDocument();
  });

  it('targetKeys 决定初始分布', () => {
    render(<Transfer dataSource={data} defaultTargetKeys={['b']} />);
    expect(within(getList('源列表')).getAllByRole('option')).toHaveLength(3);
    const targetOptions = within(getList('目标列表')).getAllByRole('option');
    expect(targetOptions).toHaveLength(1);
    expect(targetOptions[0]).toHaveTextContent('Banana');
  });

  it('自定义 titles', () => {
    render(<Transfer dataSource={data} titles={['可选', '已选']} />);
    expect(screen.getByRole('listbox', { name: '可选' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: '已选' })).toBeInTheDocument();
  });

  it('ARIA 结构：listbox/option/aria-selected', () => {
    render(<Transfer dataSource={data} defaultTargetKeys={['a']} />);
    const sourceOptions = within(getList('源列表')).getAllByRole('option');
    const targetOptions = within(getList('目标列表')).getAllByRole('option');
    expect(sourceOptions[0]).toHaveAttribute('aria-selected', 'false');
    expect(targetOptions[0]).toHaveAttribute('aria-selected', 'false');
    expect(getList('源列表')).toHaveAttribute('aria-multiselectable', 'true');
  });
});

describe('Transfer 选择与移动', () => {
  it('勾选后点 → 移入目标列表并触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Transfer dataSource={data} onChange={onChange} />);

    await user.click(within(getList('源列表')).getByRole('option', { name: 'Apple' }).querySelector('input')!);
    await user.click(screen.getByRole('button', { name: '移动到目标列表' }));

    expect(onChange).toHaveBeenCalledWith(['a']);
    expect(within(getList('目标列表')).getByRole('option', { name: 'Apple' })).toBeInTheDocument();
  });

  it('移动后将焦点迁移到目标列表首个可用项', async () => {
    const user = userEvent.setup();
    render(<Transfer dataSource={data} defaultTargetKeys={['b']} />);

    await user.click(
      within(getList('源列表')).getByRole('option', { name: 'Apple' }).querySelector('input')!
    );
    await user.click(screen.getByRole('button', { name: '移动到目标列表' }));

    const firstTargetInput = within(getList('目标列表'))
      .getByRole('option', { name: 'Apple' })
      .querySelector('input');
    expect(firstTargetInput).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('非受控内部维护 targetKeys，可移回源列表', async () => {
    const user = userEvent.setup();
    render(<Transfer dataSource={data} defaultTargetKeys={['a', 'b']} />);

    await user.click(within(getList('目标列表')).getByRole('option', { name: 'Apple' }).querySelector('input')!);
    await user.click(screen.getByRole('button', { name: '移动到源列表' }));

    expect(within(getList('源列表')).getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    expect(within(getList('目标列表')).queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
  });

  it('受控模式：onChange 上抛新 targetKeys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Transfer dataSource={data} targetKeys={['b']} onChange={onChange} />
    );
    await user.click(within(getList('目标列表')).getByRole('option', { name: 'Banana' }).querySelector('input')!);
    await user.click(screen.getByRole('button', { name: '移动到源列表' }));
    expect(onChange).toHaveBeenCalledWith([]);

    // 受控：父组件不更新值时列表分布不变
    rerender(<Transfer dataSource={data} targetKeys={['b']} onChange={onChange} />);
    expect(within(getList('目标列表')).getByRole('option', { name: 'Banana' })).toBeInTheDocument();
  });

  it('未勾选任何项时移动按钮禁用', () => {
    render(<Transfer dataSource={data} />);
    expect(screen.getByRole('button', { name: '移动到目标列表' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '移动到源列表' })).toBeDisabled();
  });

  it('disabled 项不可勾选且不被移动', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Transfer dataSource={data} onChange={onChange} />);

    const disabledOption = within(getList('源列表')).getByRole('option', { name: 'Cherry' });
    expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
    expect(disabledOption.querySelector('input')).toBeDisabled();

    // 全选只覆盖可用项，Cherry 不进选择集
    await user.click(within(getPanel('source')).getByRole('checkbox', { name: '全选源列表' }));
    await user.click(screen.getByRole('button', { name: '移动到目标列表' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b', 'd']);
    expect(within(getList('源列表')).getByRole('option', { name: 'Cherry' })).toBeInTheDocument();
  });

  it('表头全选复选框支持 indeterminate', async () => {
    const user = userEvent.setup();
    render(<Transfer dataSource={data} />);
    const selectAll = within(getPanel('source')).getByRole('checkbox', { name: '全选源列表' });
    expect(selectAll).not.toBeChecked();

    await user.click(within(getList('源列表')).getByRole('option', { name: 'Apple' }).querySelector('input')!);
    expect(selectAll).toBePartiallyChecked();

    await user.click(selectAll);
    expect(selectAll).toBeChecked();
  });
});

describe('Transfer 搜索与键盘', () => {
  it('showSearch 过滤两侧列表', async () => {
    const user = userEvent.setup();
    render(<Transfer dataSource={data} showSearch defaultTargetKeys={['b']} />);
    await user.type(screen.getByRole('searchbox', { name: '搜索源列表' }), 'an');
    // Banana 在目标列，源列含 Apple/Cherry/Durian，"an" 只命中 Durian
    expect(within(getList('源列表')).getAllByRole('option')).toHaveLength(1);
    expect(within(getList('源列表')).getByRole('option', { name: 'Durian' })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: '搜索目标列表' }), 'zz');
    expect(within(getList('目标列表')).queryAllByRole('option')).toHaveLength(0);
    expect(within(getList('目标列表')).getByText('暂无数据')).toBeInTheDocument();
  });

  it('键盘 ↑↓ 移动焦点、Space 勾选', async () => {
    const user = userEvent.setup();
    render(<Transfer dataSource={data} />);
    const firstInput = within(getList('源列表')).getByRole('option', { name: 'Apple' }).querySelector('input')!;
    firstInput.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      within(getList('源列表')).getByRole('option', { name: 'Banana' }).querySelector('input')
    );
    await user.keyboard(' ');
    expect(
      within(getList('源列表')).getByRole('option', { name: 'Banana' }).querySelector('input')
    ).toBeChecked();
  });
});

describe('Transfer 定制出口', () => {
  it('classNames 追加到对应 part', () => {
    render(
      <Transfer
        dataSource={data}
        className="my-transfer"
        classNames={{ root: 'r', list: 'l', item: 'i', buttons: 'b' }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-transfer', 'r', 'my-transfer');
    expect(document.querySelector('[data-part="list"]')).toHaveClass('z-transfer-list', 'l');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('z-transfer-item', 'i');
    expect(document.querySelector('[data-part="buttons"]')).toHaveClass('z-transfer-buttons', 'b');
  });

  it('data-part 结构完整', () => {
    render(<Transfer dataSource={data} showSearch />);
    expect(document.querySelector('[data-part="root"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-part="list"]')).toHaveLength(2);
    expect(document.querySelectorAll('[data-part="item"]').length).toBe(4);
    expect(document.querySelector('[data-part="buttons"]')).toBeInTheDocument();
  });
});
