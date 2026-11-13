import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './ColorPicker';

afterEach(cleanup);

function getTrigger(): HTMLButtonElement {
  return screen.getByRole('button', { name: '颜色选择器' }) as HTMLButtonElement;
}

function getSv(): HTMLElement {
  return screen.getByRole('slider', { name: '饱和度与亮度' });
}

function getHue(): HTMLElement {
  return screen.getByRole('slider', { name: '色相' });
}

function getRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-part="root"]') as HTMLElement;
}

/** jsdom 矩形全 0，取色点定位依赖真实尺寸，测试里打桩 */
function stubRect(element: Element, rect: Partial<DOMRect>): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

describe('ColorPicker', () => {
  it('distinguishes labeled pickers and returns keyboard focus to the named trigger', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ColorPicker aria-label="文字颜色" />
        <ColorPicker aria-label="填充颜色" />
      </>
    );
    const text = screen.getByRole('button', { name: '文字颜色' });
    const fill = screen.getByRole('button', { name: '填充颜色' });
    await user.click(text);
    expect(text).toHaveAttribute('aria-expanded', 'true');
    expect(fill).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(text).toHaveFocus();
  });

  it('renders trigger with swatch + hex text and default value', () => {
    const { container } = render(<ColorPicker />);
    const root = getRoot(container);
    expect(root).toHaveAttribute('data-part', 'root');
    expect(root).toHaveAttribute('data-size', 'md');
    expect(root).toHaveClass('z-color-picker');
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('data-part', 'swatch');
    expect(trigger).toHaveClass('z-color-picker-swatch');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    const chip = container.querySelector('[data-part="swatch-color"]') as HTMLElement;
    expect(chip).toHaveClass('z-color-picker-swatch-color');
    expect(['#ff0000', 'rgb(255, 0, 0)']).toContain(chip.style.background);
    expect(container.querySelector('[data-part="swatch-hex"]')).toHaveTextContent('#ff0000');
  });

  it('opens the panel on trigger click and closes on second click', async () => {
    const user = userEvent.setup();
    const { container } = render(<ColorPicker />);
    await user.click(getTrigger());
    const trigger = getTrigger();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
    const panel = screen.getByRole('dialog', { name: '颜色选择面板' });
    expect(panel).toHaveAttribute('data-part', 'panel');
    expect(panel).toHaveClass('z-color-picker-panel');
    expect(getRoot(container)).toHaveAttribute('data-open', '');
    expect(getSv()).toHaveAttribute('data-part', 'sv');
    expect(getHue()).toHaveAttribute('data-part', 'hue');
    expect(getHue()).toHaveClass('z-color-picker-hue');
    expect(document.querySelector('[data-part="hex"]')).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the panel on outside click', async () => {
    const user = userEvent.setup();
    render(<ColorPicker />);
    await user.click(getTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ColorPicker />);
    await user.click(getTrigger());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTrigger()).toHaveFocus();
  });

  it('keyboard: ArrowLeft/ArrowRight adjust saturation, ArrowUp/ArrowDown adjust value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker defaultValue="#00ff00" onChange={onChange} />);
    await user.click(getTrigger());
    const sv = getSv();
    expect(sv).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(sv).toHaveAttribute('aria-valuenow', '98');
    expect(onChange).toHaveBeenLastCalledWith('#05ff05');
    await user.keyboard('{ArrowRight}');
    expect(sv).toHaveAttribute('aria-valuenow', '100');
    await user.keyboard('{ArrowDown}');
    expect(sv).toHaveAttribute('aria-valuetext', '饱和度 100%，亮度 98%');
    await user.keyboard('{ArrowUp}');
    expect(sv).toHaveAttribute('aria-valuetext', '饱和度 100%，亮度 100%');
  });

  it('keyboard: Home/End adjust the hue', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPicker defaultValue="#00ff00" onChange={onChange} />);
    await user.click(getTrigger());
    const hue = getHue();
    await user.keyboard('{Home}');
    expect(hue).toHaveAttribute('aria-valuenow', '0');
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    await user.keyboard('{End}');
    expect(hue).toHaveAttribute('aria-valuenow', '360');
  });

  it('hue slider: arrow keys adjust hue like an APG slider', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#00ff00" />);
    await user.click(getTrigger());
    const hue = getHue();
    hue.focus();
    await user.keyboard('{ArrowRight}');
    expect(hue).toHaveAttribute('aria-valuenow', '122');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(hue).toHaveAttribute('aria-valuenow', '118');
  });

  it('picks saturation/value from a click on the SV area', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#00ff00" />);
    await user.click(getTrigger());
    const sv = getSv();
    stubRect(sv, { left: 0, top: 0, width: 200, height: 100 });
    fireEvent.mouseDown(sv, { clientX: 50, clientY: 25 });
    fireEvent.mouseUp(sv);
    // s = 50/200*100 = 25，v = (1 - 25/100)*100 = 75
    expect(sv).toHaveAttribute('aria-valuenow', '25');
    expect(sv).toHaveAttribute('aria-valuetext', '饱和度 25%，亮度 75%');
  });

  it('picks hue from a click on the hue bar', async () => {
    const user = userEvent.setup();
    render(<ColorPicker defaultValue="#00ff00" />);
    await user.click(getTrigger());
    const hue = getHue();
    stubRect(hue, { left: 0, top: 0, width: 360, height: 12 });
    fireEvent.mouseDown(hue, { clientX: 180, clientY: 6 });
    fireEvent.mouseUp(hue);
    expect(hue).toHaveAttribute('aria-valuenow', '180');
  });

  it('hex input: typing a valid hex updates value and the trigger display', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<ColorPicker defaultValue="#ff0000" onChange={onChange} />);
    await user.click(getTrigger());
    const hexInput = screen.getByRole('textbox', { name: '十六进制颜色值' }) as HTMLInputElement;
    await user.clear(hexInput);
    await user.type(hexInput, '#00ff00');
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    expect(container.querySelector('[data-part="swatch-hex"]')).toHaveTextContent('#00ff00');
    expect(getSv()).toHaveAttribute('aria-valuenow', '100');
  });

  it('controlled: value prop wins, interactions report via onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender, container } = render(<ColorPicker value="#123456" onChange={onChange} />);
    expect(container.querySelector('[data-part="swatch-hex"]')).toHaveTextContent('#123456');
    await user.click(getTrigger());
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalled();
    // 受控值未更新则显示不漂移（s 回到 79）
    expect(getSv()).toHaveAttribute('aria-valuenow', '79');
    expect(getTrigger().querySelector('[data-part="swatch-hex"]')).toHaveTextContent('#123456');
    rerender(<ColorPicker value="#00ff00" onChange={onChange} />);
    expect(getTrigger().querySelector('[data-part="swatch-hex"]')).toHaveTextContent('#00ff00');
    expect(getSv()).toHaveAttribute('aria-valuenow', '100');
  });

  it('disabled: trigger disabled and the panel never opens', async () => {
    const user = userEvent.setup();
    const { container } = render(<ColorPicker disabled />);
    expect(getRoot(container)).toHaveAttribute('data-disabled', '');
    expect(getTrigger()).toBeDisabled();
    await user.click(getTrigger());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('passes className, classNames and size to parts', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ColorPicker
        size="lg"
        className="my-root"
        classNames={{ root: 'cls-root', swatch: 'cls-swatch', panel: 'cls-panel', hue: 'cls-hue' }}
      />
    );
    const root = getRoot(container);
    expect(root).toHaveClass('z-color-picker', 'my-root', 'cls-root');
    expect(root).toHaveAttribute('data-size', 'lg');
    expect(getTrigger()).toHaveClass('z-color-picker-swatch', 'cls-swatch');
    await user.click(getTrigger());
    expect(screen.getByRole('dialog')).toHaveClass('z-color-picker-panel', 'cls-panel');
    expect(getHue()).toHaveClass('z-color-picker-hue', 'cls-hue');
  });
});
