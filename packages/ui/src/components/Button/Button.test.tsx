import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

afterEach(cleanup);

function getButton(): HTMLButtonElement {
  return screen.getByRole('button') as HTMLButtonElement;
}

describe('Button', () => {
  it('renders with default variant/size and label part', () => {
    render(<Button>提交</Button>);
    const button = getButton();
    expect(button).toHaveAttribute('data-part', 'root');
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'md');
    expect(button).toHaveClass('z-button');
    expect(button).not.toBeDisabled();
    expect(screen.getByText('提交')).toBeInTheDocument();
  });

  it('exposes variant via data-variant', () => {
    const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>文本</Button>);
      expect(getButton()).toHaveAttribute('data-variant', variant);
      unmount();
    }
  });

  it('exposes size via data-size', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>文本</Button>);
      expect(getButton()).toHaveAttribute('data-size', size);
      unmount();
    }
  });

  it('exposes fullWidth via data-full-width', () => {
    render(<Button fullWidth>文本</Button>);
    expect(getButton()).toHaveAttribute('data-full-width', 'true');
  });

  it('omits loading/full-width data attributes by default', () => {
    render(<Button>文本</Button>);
    const button = getButton();
    expect(button).not.toHaveAttribute('data-loading');
    expect(button).not.toHaveAttribute('data-full-width');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('fires onClick on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>点我</Button>);
    await user.click(getButton());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled: uses native disabled and does not fire onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        禁用
      </Button>
    );
    const button = getButton();
    expect(button).toBeDisabled();
    await user.click(button).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading: sets aria-busy/aria-disabled, keeps focusable, intercepts click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        加载中
      </Button>
    );
    const button = getButton();
    expect(button).toHaveAttribute('data-loading', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();

    button.focus();
    expect(button).toHaveFocus();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading: renders spinner part', () => {
    const { container } = render(<Button loading>加载中</Button>);
    const spinner = container.querySelector('[data-part="spinner"]');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('z-button-spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders iconStart/iconEnd wrapped in icon parts', () => {
    const { container } = render(
      <Button iconStart={<i data-testid="start">A</i>} iconEnd={<i data-testid="end">B</i>}>
        文本
      </Button>
    );
    expect(screen.getByTestId('start')).toBeInTheDocument();
    expect(screen.getByTestId('end')).toBeInTheDocument();
    const icons = container.querySelectorAll('[data-part="icon"]');
    expect(icons).toHaveLength(2);
    expect(icons[0]).toHaveClass('z-button-icon');
    expect(icons[1]).toHaveClass('z-button-icon');
    expect(icons[0].contains(screen.getByTestId('start'))).toBe(true);
    expect(icons[1].contains(screen.getByTestId('end'))).toBe(true);
  });

  it('passes className and classNames to parts', () => {
    const { container } = render(
      <Button
        loading
        className="my-root"
        iconStart={<i>↑</i>}
        classNames={{ root: 'cls-root', icon: 'cls-icon', label: 'cls-label', spinner: 'cls-spinner' }}
      >
        文本
      </Button>
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-button', 'my-root', 'cls-root');
    const icon = root.querySelector('[data-part="icon"]');
    expect(icon).toHaveClass('z-button-icon', 'cls-icon');
    const label = root.querySelector('[data-part="label"]');
    expect(label).toHaveClass('z-button-label', 'cls-label');
    const spinner = root.querySelector('[data-part="spinner"]');
    expect(spinner).toHaveClass('z-button-spinner', 'cls-spinner');
  });

  it('forwards ref to the button element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>文本</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole('button'));
  });

  it('passes native props through to the button element', () => {
    render(
      <Button type="submit" id="my-btn" data-testid="btn" aria-label="自定义">
        文本
      </Button>
    );
    const button = getButton();
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('id', 'my-btn');
    expect(button).toHaveAttribute('data-testid', 'btn');
    expect(button).toHaveAttribute('aria-label', '自定义');
  });
});
