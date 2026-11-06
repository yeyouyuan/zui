import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Cascader } from './index';
import type { CascaderOption } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const options: CascaderOption[] = [
  {
    value: 'zhejiang',
    label: '浙江',
    children: [
      {
        value: 'hangzhou',
        label: '杭州',
        children: [
          { value: 'xihu', label: '西湖' },
          { value: 'binjiang', label: '滨江', disabled: true },
        ],
      },
      { value: 'ningbo', label: '宁波' },
    ],
  },
  {
    value: 'jiangsu',
    label: '江苏',
    children: [{ value: 'nanjing', label: '南京' }],
  },
  { value: 'beijing', label: '北京' },
];

function getTrigger() {
  return screen.getByRole('button');
}

function getMenus() {
  return document.querySelectorAll('[data-part="menu"]');
}

function getItems(menuIndex: number) {
  return within(getMenus()[menuIndex] as HTMLElement).getAllByRole('option');
}

describe('Cascader 渲染', () => {
  it('默认渲染 placeholder', () => {
    render(<Cascader options={options} />);
    expect(getTrigger()).toHaveTextContent('请选择');
    expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('自定义 placeholder 与 defaultValue 路径标签', () => {
    render(
      <Cascader options={options} placeholder="挑地区" defaultValue={['zhejiang', 'ningbo']} />
    );
    expect(getTrigger()).toHaveTextContent('浙江');
    expect(getTrigger()).toHaveTextContent('宁波');
    expect(getTrigger()).not.toHaveTextContent('挑地区');
  });

  it('点击触发器打开面板，首列渲染选项', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} />);
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
    expect(getMenus()).toHaveLength(1);
    expect(getItems(0).map((item) => item.textContent)).toEqual(['浙江', '江苏', '北京']);
    expect(getItems(0)[2]).not.toHaveAttribute('data-active');
  });

  it('hover 有子级的项展开下一列', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} />);
    await user.click(getTrigger());
    await user.hover(getItems(0)[1]); // 江苏
    expect(getMenus()).toHaveLength(2);
    expect(getItems(1).map((item) => item.textContent)).toEqual(['南京']);
    await user.hover(getItems(0)[2]); // 北京（叶子）
    expect(getMenus()).toHaveLength(1);
  });
});

describe('Cascader 选中', () => {
  it('逐级点击叶子选中完整路径并触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={options} onChange={onChange} />);

    await user.click(getTrigger());
    await user.click(getItems(0)[0]); // 浙江 → 展开
    await user.click(getItems(1)[0]); // 杭州 → 展开
    await user.click(getItems(2)[0]); // 西湖 → 叶子选中

    expect(onChange).toHaveBeenCalledWith(['zhejiang', 'hangzhou', 'xihu']);
    expect(getTrigger()).toHaveTextContent('浙江');
    expect(getTrigger()).toHaveTextContent('杭州');
    expect(getTrigger()).toHaveTextContent('西湖');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('非受控维护 value，再次打开回显高亮', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} defaultValue={['jiangsu', 'nanjing']} />);
    await user.click(getTrigger());
    // 江苏列展开且南京高亮/选中
    expect(getMenus()).toHaveLength(2);
    expect(getItems(0)[1]).toHaveAttribute('data-active', 'true');
    expect(getItems(1)[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('受控模式 onChange 上抛路径', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={options} value={['beijing']} onChange={onChange} />);
    expect(getTrigger()).toHaveTextContent('北京');
    await user.click(getTrigger());
    await user.click(getItems(0)[0]);
    await user.click(getItems(1)[1]); // 宁波
    expect(onChange).toHaveBeenCalledWith(['zhejiang', 'ningbo']);
  });

  it('disabled 项不可选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={options} onChange={onChange} />);
    await user.click(getTrigger());
    await user.click(getItems(0)[0]);
    await user.click(getItems(1)[0]);
    const disabledItem = getItems(2)[1]; // 滨江
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
    await user.click(disabledItem);
    expect(onChange).not.toHaveBeenCalled();
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('disabled 时触发器禁用', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} disabled />);
    expect(getTrigger()).toBeDisabled();
    await user.click(getTrigger());
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Cascader 键盘', () => {
  it('↑↓ 移动高亮、Enter 展开/选中、←→ 切列', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={options} onChange={onChange} />);

    getTrigger().focus();
    await user.keyboard('{Enter}'); // 打开
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowDown}'); // 高亮浙江
    expect(getItems(0)[0]).toHaveAttribute('data-active', 'true');

    await user.keyboard('{Enter}'); // 展开第二列
    expect(getMenus()).toHaveLength(2);
    expect(getMenus()[1]).toHaveAttribute('data-focused', 'true');

    await user.keyboard('{ArrowLeft}'); // 切回第一列
    expect(getMenus()[0]).toHaveAttribute('data-focused', 'true');

    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowDown}'); // 切到第二列，经杭州移至宁波
    expect(getItems(1)[1]).toHaveAttribute('data-active', 'true');

    await user.keyboard('{Enter}'); // 选中叶子
    expect(onChange).toHaveBeenCalledWith(['zhejiang', 'ningbo']);
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getTrigger());
  });

  it('Esc 关闭面板并归还焦点', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} />);
    await user.click(getTrigger());
    await user.keyboard('{Escape}');
    expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(getTrigger());
  });

  it('Home/End 跳到列内首尾', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} />);
    await user.click(getTrigger());
    await user.keyboard('{End}');
    expect(getItems(0)[2]).toHaveAttribute('data-active', 'true');
    await user.keyboard('{Home}');
    expect(getItems(0)[0]).toHaveAttribute('data-active', 'true');
  });
});

describe('Cascader 搜索', () => {
  it('showSearch 过滤出扁平结果并可选中', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Cascader options={options} showSearch onChange={onChange} />);
    await user.click(getTrigger());
    await user.type(screen.getByRole('searchbox', { name: '搜索级联选项' }), '西湖');
    const results = within(screen.getByRole('listbox', { name: '搜索结果' })).getAllByRole('option');
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveTextContent('浙江');
    expect(results[0]).toHaveTextContent('西湖');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['zhejiang', 'hangzhou', 'xihu']);
  });

  it('搜索无匹配显示空态', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} showSearch />);
    await user.click(getTrigger());
    await user.type(screen.getByRole('searchbox', { name: '搜索级联选项' }), 'zzz');
    expect(screen.getByRole('listbox', { name: '搜索结果' })).toHaveTextContent('暂无匹配');
  });
});

describe('Cascader 定制出口', () => {
  it('classNames 追加到对应 part', () => {
    render(
      <Cascader
        options={options}
        className="my-cascader"
        classNames={{ root: 'r', trigger: 't', panel: 'p', menu: 'm', item: 'i' }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-cascader', 'r', 'my-cascader');
    expect(document.querySelector('[data-part="trigger"]')).toHaveClass('z-cascader-trigger', 't');
    expect(document.querySelector('[data-part="panel"]')).toHaveClass('z-cascader-panel', 'p');
  });

  it('data-part 与 data-size 完整', async () => {
    const user = userEvent.setup();
    render(<Cascader options={options} size="lg" />);
    expect(document.querySelector('[data-part="root"]')).toHaveAttribute('data-size', 'lg');
    await user.click(getTrigger());
    expect(document.querySelectorAll('[data-part="menu"]').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-part="item"]')).toBeInTheDocument();
  });
});
