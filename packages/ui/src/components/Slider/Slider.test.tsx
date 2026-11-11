import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';

afterEach(cleanup);

function getThumb(): HTMLElement {
  return screen.getByRole('slider');
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

function mockTrackRect(track: HTMLElement, width = 100, left = 0): void {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 6,
    left,
    top: 0,
    right: left + width,
    bottom: 6,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/** jsdom 无 PointerEvent 构造器，用 MouseEvent 派发指针事件（保留 clientX） */
function firePointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: Element | Window,
  clientX: number
): void {
  fireEvent(
    target,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0 })
  );
}

describe('Slider', () => {
  it('渲染 root/track/fill/thumb 结构与默认 ARIA', () => {
    const { container } = render(<Slider aria-label="音量" />);
    expect(getRoot(container)).toHaveClass('z-slider');
    expect(container.querySelector('[data-part="track"]')).toHaveClass('z-slider-track');
    expect(container.querySelector('[data-part="fill"]')).toHaveClass('z-slider-fill');
    const thumb = getThumb();
    expect(thumb).toHaveAttribute('data-part', 'thumb');
    expect(thumb).toHaveClass('z-slider-thumb');
    expect(thumb).toHaveAttribute('aria-valuemin', '0');
    expect(thumb).toHaveAttribute('aria-valuemax', '100');
    expect(thumb).toHaveAttribute('aria-valuenow', '0');
    expect(thumb).toHaveAttribute('aria-valuetext', '0');
    expect(thumb).toHaveAttribute('aria-label', '音量');
    expect(thumb).toHaveAttribute('tabindex', '0');
  });

  it('非受控：defaultValue 生效并可交互更新', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Slider defaultValue={30} onChange={onChange} aria-label="音量" />);
    const thumb = getThumb();
    expect(thumb).toHaveAttribute('aria-valuenow', '30');
    await user.click(thumb);
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(31);
    expect(thumb).toHaveAttribute('aria-valuenow', '31');
  });

  it('受控：value 胜出，键盘触发 onChange 但不自更新', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Slider value={30} onChange={onChange} aria-label="音量" />);
    const thumb = getThumb();
    await user.click(thumb);
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(31);
    expect(thumb).toHaveAttribute('aria-valuenow', '30');
    rerender(<Slider value={50} onChange={onChange} aria-label="音量" />);
    expect(getThumb()).toHaveAttribute('aria-valuenow', '50');
  });

  it('键盘：←→/↑↓ 按 step 步进（自定义 min/max/step）', () => {
    render(<Slider min={0} max={10} step={2} defaultValue={4} aria-label="档位" />);
    const thumb = getThumb();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb).toHaveAttribute('aria-valuenow', '6');
    fireEvent.keyDown(thumb, { key: 'ArrowUp' });
    expect(thumb).toHaveAttribute('aria-valuenow', '8');
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(thumb).toHaveAttribute('aria-valuenow', '6');
    fireEvent.keyDown(thumb, { key: 'ArrowDown' });
    expect(thumb).toHaveAttribute('aria-valuenow', '4');
  });

  it('键盘：Home/End 跳到 min/max', () => {
    render(<Slider defaultValue={50} aria-label="音量" />);
    const thumb = getThumb();
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(thumb).toHaveAttribute('aria-valuenow', '100');
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(thumb).toHaveAttribute('aria-valuenow', '0');
  });

  it('键盘：PageUp/PageDown 大步进（step*10）', () => {
    render(<Slider step={2} defaultValue={50} aria-label="音量" />);
    const thumb = getThumb();
    fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(thumb).toHaveAttribute('aria-valuenow', '70');
    fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(thumb).toHaveAttribute('aria-valuenow', '50');
  });

  it('边界 clamp：min/max 处不再触发 onChange', () => {
    const onChange = vi.fn();
    render(<Slider defaultValue={100} onChange={onChange} aria-label="音量" />);
    const thumb = getThumb();
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(thumb).toHaveAttribute('aria-valuenow', '100');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(thumb).toHaveAttribute('aria-valuenow', '0');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('禁用：aria-disabled + data-disabled，键盘/指针无效', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider defaultValue={40} disabled onChange={onChange} aria-label="音量" />
    );
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-disabled');
    const thumb = getThumb();
    expect(thumb).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    const track = container.querySelector('[data-part="track"]') as HTMLElement;
    fireEvent.pointerDown(track, { clientX: 10 });
    expect(onChange).not.toHaveBeenCalled();
    expect(thumb).toHaveAttribute('aria-valuenow', '40');
  });

  it('指针：点按轨道聚焦实际 thumb，随后方向键继续调节', () => {
    const { container } = render(
      <Slider min={0} max={100} step={10} defaultValue={0} aria-label="音量" />
    );
    const track = container.querySelector('[data-part="track"]') as HTMLElement;
    mockTrackRect(track);

    firePointer('pointerdown', track, 33);

    const thumb = getThumb();
    expect(thumb).toHaveFocus();
    expect(thumb).toHaveAttribute('aria-valuenow', '30');
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    expect(thumb).toHaveAttribute('aria-valuenow', '40');
  });

  it('指针：点按轨道按位置取值（含 step 吸附），拖动连续更新', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} step={10} defaultValue={0} onChange={onChange} aria-label="音量" />
    );
    const track = container.querySelector('[data-part="track"]') as HTMLElement;
    mockTrackRect(track);
    firePointer('pointerdown', track, 33);
    expect(onChange).toHaveBeenLastCalledWith(30);
    firePointer('pointermove', window, 60);
    expect(onChange).toHaveBeenLastCalledWith(60);
    firePointer('pointerup', window, 60);
    firePointer('pointermove', window, 90);
    expect(onChange).toHaveBeenLastCalledWith(60);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('tooltip：聚焦/拖动显示数值气泡（aria-hidden），失焦隐藏', () => {
    const { container } = render(<Slider defaultValue={30} aria-label="音量" />);
    const thumb = getThumb();
    expect(container.querySelector('[data-part="tooltip"]')).toBeNull();
    fireEvent.focus(thumb);
    const tooltip = container.querySelector('[data-part="tooltip"]');
    expect(tooltip).toHaveTextContent('30');
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    fireEvent.blur(thumb);
    expect(container.querySelector('[data-part="tooltip"]')).toBeNull();
  });

  it('tooltip=false 时不渲染气泡', () => {
    const { container } = render(<Slider defaultValue={30} tooltip={false} aria-label="音量" />);
    fireEvent.focus(getThumb());
    expect(container.querySelector('[data-part="tooltip"]')).toBeNull();
  });

  it('marks：刻度渲染 data-part="mark"，值覆盖处 active', () => {
    const { container } = render(
      <Slider defaultValue={60} marks={{ 0: '零', 50: '半', 100: '满' }} aria-label="音量" />
    );
    const marks = container.querySelectorAll('[data-part="mark"]');
    expect(marks).toHaveLength(3);
    expect(marks[0]).toHaveTextContent('零');
    expect(marks[0]).toHaveAttribute('data-active');
    expect(marks[1]).toHaveAttribute('data-active');
    expect(marks[2]).not.toHaveAttribute('data-active');
    expect(marks[1]).toHaveStyle({ left: '50%' });
  });

  it('classNames 槽位与 data-part 透传', () => {
    const { container } = render(
      <Slider
        defaultValue={20}
        aria-label="音量"
        classNames={{
          root: 'my-root',
          track: 'my-track',
          fill: 'my-fill',
          thumb: 'my-thumb',
          mark: 'my-mark',
        }}
        marks={{ 0: 'A' }}
      />
    );
    expect(getRoot(container)).toHaveClass('my-root');
    expect(container.querySelector('[data-part="track"]')).toHaveClass('my-track');
    expect(container.querySelector('[data-part="fill"]')).toHaveClass('my-fill');
    expect(container.querySelector('[data-part="thumb"]')).toHaveClass('my-thumb');
    expect(container.querySelector('[data-part="mark"]')).toHaveClass('my-mark');
    expect(container.querySelector('[data-part="fill"]')).toHaveStyle({ width: '20%' });
  });
});
