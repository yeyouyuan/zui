import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

afterEach(cleanup);

describe('Switch', () => {
  it('renders a switch role with aria-checked=false by default', () => {
    render(<Switch label="通知" />);
    const sw = screen.getByRole('switch', { name: '通知' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('type', 'button');
  });

  it('uncontrolled: toggles on click and fires onChange with boolean', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="通知" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '通知' });
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledWith(true);
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('defaultChecked renders on initially', () => {
    render(<Switch label="通知" defaultChecked />);
    expect(screen.getByRole('switch', { name: '通知' })).toHaveAttribute('aria-checked', 'true');
  });

  it('controlled: reflects checked prop only', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="通知" checked onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '通知' });
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledWith(false);
    rerender(<Switch label="通知" checked={false} onChange={onChange} />);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles with Space and Enter keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="通知" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '通知' });
    sw.focus();
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Enter}');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenCalledWith(true);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('disabled switch cannot be toggled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="通知" disabled onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '通知' });
    expect(sw).toBeDisabled();
    await user.click(sw).catch(() => undefined);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('passes classNames, className and data-part to parts', () => {
    render(
      <Switch
        label="通知"
        className="my-root"
        classNames={{ root: 'cls-root', track: 'cls-track', thumb: 'cls-thumb', label: 'cls-label' }}
      />
    );
    const sw = screen.getByRole('switch', { name: '通知' });
    expect(sw).toHaveAttribute('data-part', 'root');
    expect(sw).toHaveClass('z-switch', 'my-root', 'cls-root');
    const track = sw.querySelector('[data-part="track"]');
    expect(track).toHaveClass('z-switch-track', 'cls-track');
    expect(track?.querySelector('.z-switch-thumb')).toHaveClass('z-switch-thumb', 'cls-thumb');
    expect(sw.querySelector('[data-part="label"]')).toHaveClass('z-switch-label', 'cls-label');
  });

  it('exposes size via data-size', () => {
    render(<Switch label="通知" size="sm" />);
    expect(screen.getByRole('switch', { name: '通知' })).toHaveAttribute('data-size', 'sm');
    render(<Switch label="通知" />);
    expect(screen.getAllByRole('switch')[1]).toHaveAttribute('data-size', 'md');
  });
});
