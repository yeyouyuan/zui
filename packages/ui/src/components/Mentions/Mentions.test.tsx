import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Mentions } from './index';
import type { MentionOption } from './index';

// 保证用例间 DOM 隔离（setup.ts 未注册自动 cleanup）
afterEach(cleanup);

const options: MentionOption[] = [
  { value: 'alice', label: 'Alice' },
  { value: 'bob', label: 'Bob' },
  { value: 'carol', label: 'Carol' },
];

function getTextarea() {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

function getPanel() {
  return screen.getByRole('listbox', { name: '提及建议' });
}

describe('Mentions 渲染', () => {
  it('渲染 textarea 与 placeholder', () => {
    render(<Mentions options={options} placeholder="说点什么，@ 提及" />);
    const textarea = getTextarea();
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', '说点什么，@ 提及');
    expect(textarea).toHaveAttribute('rows', '3');
  });

  it('输入 @ 触发建议下拉', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@');
    expect(getTextarea()).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Alice');
    expect(items[0]).toHaveAttribute('aria-selected', 'true');
    expect(getTextarea().getAttribute('aria-activedescendant')).toBe(items[0].id);
  });

  it('查询词过滤选项', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@al');
    const items = screen.getAllByRole('option');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Alice');
  });

  it('无匹配时显示空态', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@zzz');
    expect(getPanel()).toHaveTextContent('无匹配');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('Mentions 键盘', () => {
  it('↑↓ 移动 active 项', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter 插入选中文本并关闭下拉', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), 'hello @al');
    await user.keyboard('{Enter}');
    expect(getTextarea()).toHaveValue('hello alice ');
    expect(getTextarea()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Tab 同样插入', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@bo{Tab}');
    expect(getTextarea()).toHaveValue('bob ');
  });

  it('Esc 关闭且不插入', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@al');
    await user.keyboard('{Escape}');
    expect(getTextarea()).toHaveValue('@al');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('点击建议项插入', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} />);
    await user.type(getTextarea(), '@');
    await user.click(screen.getAllByRole('option')[2]);
    expect(getTextarea()).toHaveValue('carol ');
  });
});

describe('Mentions 状态', () => {
  it('受控模式：onChange 上抛并跟随 value', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [v, setV] = React.useState('hi ');
      return <Mentions options={options} value={v} onChange={setV} />;
    }
    render(<Controlled />);
    await user.type(getTextarea(), '@bo');
    expect(getTextarea()).toHaveValue('hi @bo');
    await user.keyboard('{Enter}');
    expect(getTextarea()).toHaveValue('hi bob ');
  });

  it('非受控 defaultValue 回显', () => {
    render(<Mentions options={options} defaultValue="已有内容" />);
    expect(getTextarea()).toHaveValue('已有内容');
  });

  it('disabled 时不可输入', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} disabled />);
    const textarea = getTextarea();
    expect(textarea).toBeDisabled();
    await user.type(textarea, '@');
    expect(textarea).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('自定义 prefix 触发', async () => {
    const user = userEvent.setup();
    render(<Mentions options={options} prefix="#" />);
    await user.type(getTextarea(), '@');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.type(getTextarea(), ' #al');
    expect(getPanel()).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});

describe('Mentions 定制出口', () => {
  it('classNames 追加到对应 part', async () => {
    const user = userEvent.setup();
    render(
      <Mentions
        options={options}
        className="my-mentions"
        classNames={{ root: 'r', textarea: 't', panel: 'p', item: 'i' }}
      />
    );
    expect(document.querySelector('[data-part="root"]')).toHaveClass('z-mentions', 'r', 'my-mentions');
    expect(document.querySelector('[data-part="textarea"]')).toHaveClass('z-mentions-textarea', 't');
    await user.type(getTextarea(), '@');
    expect(document.querySelector('[data-part="panel"]')).toHaveClass('z-mentions-panel', 'p');
    expect(document.querySelector('[data-part="item"]')).toHaveClass('z-mentions-item', 'i');
  });
});
