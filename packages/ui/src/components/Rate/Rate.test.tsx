import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rate } from './Rate';

afterEach(cleanup);

function getGroup(): HTMLElement {
  return screen.getByRole('radiogroup');
}

function getStars(): HTMLElement[] {
  return screen.getAllByRole('radio') as HTMLElement[];
}

describe('Rate', () => {
  it('渲染 radiogroup + 默认 5 星（role=radio）', () => {
    render(<Rate />);
    const group = getGroup();
    expect(group).toHaveAttribute('data-part', 'root');
    expect(group).toHaveClass('z-rate');
    expect(group).toHaveAttribute('aria-label', '评分');
    const stars = getStars();
    expect(stars).toHaveLength(5);
    stars.forEach((star, i) => {
      expect(star).toHaveAttribute('data-part', 'star');
      expect(star).toHaveAttribute('aria-label', `${i + 1} 分`);
      expect(star).toHaveAttribute('type', 'button');
    });
  });

  it('count 自定义星星数量', () => {
    render(<Rate count={3} />);
    expect(getStars()).toHaveLength(3);
  });

  it('defaultValue：所有星明确 aria-checked，半星不伪报为完整选中', () => {
    const { rerender } = render(<Rate defaultValue={2} />);
    let stars = getStars();
    expect(stars.map((star) => star.getAttribute('data-filled'))).toEqual([
      'full',
      'full',
      'none',
      'none',
      'none',
    ]);
    expect(stars.map((star) => star.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);

    rerender(<Rate value={0} allowHalf />);
    stars = getStars();
    expect(stars.every((star) => star.getAttribute('aria-checked') === 'false')).toBe(true);

    rerender(<Rate value={2.5} allowHalf />);
    stars = getStars();
    expect(stars.map((star) => star.getAttribute('data-filled'))).toEqual([
      'full',
      'full',
      'half',
      'none',
      'none',
    ]);
    expect(stars.map((star) => star.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('点击星设值（非半星模式）', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rate defaultValue={1} onChange={onChange} />);
    const stars = getStars();
    await user.click(stars[2]);
    expect(onChange).toHaveBeenCalledWith(3);
    expect(stars[2]).toHaveAttribute('aria-checked', 'true');
    expect(stars[2]).toHaveAttribute('data-filled', 'full');
  });

  it('allowHalf：左半点击得 .5，右半点击得整数', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rate allowHalf onChange={onChange} />);
    const stars = getStars();
    const leftHalf = stars[2].querySelector('[data-half="0.5"]') as HTMLElement;
    await user.click(leftHalf);
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    const rightHalf = stars[3].querySelector('[data-half="1"]') as HTMLElement;
    await user.click(rightHalf);
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('受控：value 胜出，点击触发 onChange 但不自更新', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Rate value={2} onChange={onChange} />);
    await user.click(getStars()[4]);
    expect(onChange).toHaveBeenCalledWith(5);
    expect(getStars()[4]).toHaveAttribute('aria-checked', 'false');
    rerender(<Rate value={4} onChange={onChange} />);
    expect(getStars()[3]).toHaveAttribute('aria-checked', 'true');
  });

  it('键盘：←→/↑↓ 调整，焦点跟随选中星', () => {
    render(<Rate defaultValue={2} />);
    const stars = getStars();
    fireEvent.keyDown(stars[1], { key: 'ArrowRight' });
    expect(stars[2]).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(stars[2]);
    fireEvent.keyDown(stars[2], { key: 'ArrowLeft' });
    expect(stars[1]).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(stars[1], { key: 'ArrowDown' });
    expect(stars[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(stars[0], { key: 'ArrowUp' });
    expect(stars[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('键盘：allowHalf 步进 0.5，count 处 clamp', () => {
    const onChange = vi.fn();
    render(<Rate defaultValue={4.5} allowHalf onChange={onChange} />);
    const stars = getStars();
    fireEvent.keyDown(stars[4], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(stars[4]).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(stars[4], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(stars[4], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(4.5);
    expect(stars[4]).toHaveAttribute('data-filled', 'half');
    expect(stars[4]).toHaveAttribute('aria-checked', 'false');
    expect(stars[3]).toHaveAttribute('aria-checked', 'true');
  });

  it('键盘：0 处 clamp 不越界', () => {
    const onChange = vi.fn();
    render(<Rate defaultValue={0.5} allowHalf onChange={onChange} />);
    const stars = getStars();
    fireEvent.keyDown(stars[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(stars[0]).toHaveAttribute('aria-checked', 'false');
    fireEvent.keyDown(stars[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('roving tabindex：仅当前值所在星可 Tab 聚焦', () => {
    const { rerender } = render(<Rate value={3} />);
    let stars = getStars();
    expect(stars[2]).toHaveAttribute('tabindex', '0');
    expect(stars[0]).toHaveAttribute('tabindex', '-1');
    expect(stars[4]).toHaveAttribute('tabindex', '-1');

    rerender(<Rate value={0} />);
    stars = getStars();
    expect(stars[0]).toHaveAttribute('tabindex', '0');
    expect(stars[2]).toHaveAttribute('tabindex', '-1');
  });

  it('disabled：原生 disabled + aria-disabled，交互无效', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rate defaultValue={2} disabled onChange={onChange} />);
    const group = getGroup();
    expect(group).toHaveAttribute('data-disabled');
    expect(group).toHaveAttribute('aria-disabled', 'true');
    const stars = getStars();
    stars.forEach((star) => expect(star).toBeDisabled());
    await user.click(stars[4]);
    fireEvent.keyDown(stars[1], { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('readonly：只读展示，不可交互（aria-readonly）', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Rate defaultValue={2} readonly onChange={onChange} />);
    const group = getGroup();
    expect(group).toHaveAttribute('data-readonly');
    expect(group).toHaveAttribute('aria-readonly', 'true');
    const stars = getStars();
    stars.forEach((star) => expect(star).toHaveAttribute('tabindex', '-1'));
    await user.click(stars[4]);
    fireEvent.keyDown(stars[1], { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('classNames 槽位与 data-part 透传', () => {
    const { container } = render(
      <Rate
        defaultValue={1}
        classNames={{ root: 'my-root', star: 'my-star', half: 'my-half' }}
      />
    );
    expect(getGroup()).toHaveClass('my-root');
    const star = container.querySelector('[data-part="star"]');
    expect(star).toHaveClass('my-star');
    const halves = container.querySelectorAll('[data-part="half"]');
    expect(halves).toHaveLength(10);
    halves.forEach((half) => expect(half).toHaveClass('my-half'));
  });
});
