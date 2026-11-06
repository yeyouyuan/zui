import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Segmented } from './index';
import type { SegmentedOption } from './index';

afterEach(cleanup);

const options: SegmentedOption[] = [
  { value: 'map', label: '地图' },
  { value: 'satellite', label: '卫星' },
  { value: 'terrain', label: '地形', disabled: true },
];

function getItems() {
  return screen.getAllByRole('radio');
}

describe('Segmented 渲染', () => {
  it('渲染 radiogroup 与 radio 项，非受控默认选中第一项', () => {
    render(<Segmented options={options} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-orientation', 'horizontal');
    expect(group).toHaveAttribute('data-part', 'root');
    expect(group).toHaveClass('z-segmented');
    const items = getItems();
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('aria-checked', 'true');
    expect(items[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('defaultValue 指定初始选中', () => {
    render(<Segmented options={options} defaultValue="satellite" />);
    const items = getItems();
    expect(items[1]).toHaveAttribute('aria-checked', 'true');
    expect(items[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('icon 渲染且 aria-hidden', () => {
    render(<Segmented options={[{ value: 'a', label: 'A', icon: <svg /> }]} />);
    const icon = document.querySelector('.z-segmented-icon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Segmented 受控/非受控', () => {
  it('非受控点击切换选中并触发 onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={options} onChange={onChange} />);
    await user.click(getItems()[1]);
    expect(onChange).toHaveBeenCalledWith('satellite');
    expect(getItems()[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('受控模式下点击只回调、值由外部决定', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Controlled() {
      const [v, setV] = useState('map');
      return (
        <Segmented
          options={options}
          value={v}
          onChange={(next) => {
            onChange(next);
            setV(next);
          }}
        />
      );
    }
    render(<Controlled />);
    await user.click(getItems()[1]);
    expect(onChange).toHaveBeenCalledWith('satellite');
    expect(getItems()[1]).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Segmented 键盘', () => {
  it('←→ 移动选中并跳过 disabled，Home/End 首尾', async () => {
    const user = userEvent.setup();
    render(<Segmented options={options} defaultValue="map" />);
    const items = getItems();
    items[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(getItems()[1]).toHaveAttribute('aria-checked', 'true');
    // terrain 禁用：右移回到 map
    await user.keyboard('{ArrowRight}');
    expect(getItems()[0]).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(getItems()[1]).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Home}');
    expect(getItems()[0]).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{End}');
    expect(getItems()[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('roving tabindex：选中项 tabIndex=0 其余 -1', async () => {
    const user = userEvent.setup();
    render(<Segmented options={options} defaultValue="map" />);
    await user.click(getItems()[1]);
    const items = getItems();
    expect(items[1]).toHaveAttribute('tabindex', '0');
    expect(items[0]).toHaveAttribute('tabindex', '-1');
  });
});

describe('Segmented 禁用与定制', () => {
  it('disabled 项不可点击', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={options} defaultValue="map" onChange={onChange} />);
    await user.click(getItems()[2]);
    expect(onChange).not.toHaveBeenCalled();
    expect(getItems()[2]).toBeDisabled();
    expect(getItems()[2]).toHaveAttribute('aria-disabled', 'true');
  });

  it('classNames / className / data-part 透传', () => {
    render(
      <Segmented
        options={options}
        className="seg-page"
        classNames={{ root: 'my-root', item: 'my-item', thumb: 'my-thumb' }}
        block
        size="lg"
      />
    );
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveClass('z-segmented', 'my-root', 'seg-page');
    expect(group).toHaveAttribute('data-size', 'lg');
    expect(group).toHaveAttribute('data-block', 'true');
    expect(getItems()[0]).toHaveClass('z-segmented-item', 'my-item');
    const thumb = document.querySelector('[data-part="thumb"]');
    expect(thumb).toHaveClass('z-segmented-thumb', 'my-thumb');
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
  });
});
