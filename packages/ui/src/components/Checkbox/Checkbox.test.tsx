import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './Checkbox';

afterEach(cleanup);

function getCheckbox(): HTMLInputElement {
  return screen.getByRole('checkbox') as HTMLInputElement;
}

describe('Checkbox', () => {
  it('renders unchecked by default with label', () => {
    render(<Checkbox label="同意" />);
    const input = getCheckbox();
    expect(input).not.toBeChecked();
    expect(screen.getByText('同意')).toBeInTheDocument();
  });

  it('uncontrolled: toggles on label click and fires onChange with boolean', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="同意" onChange={onChange} />);
    await user.click(screen.getByText('同意'));
    expect(getCheckbox()).toBeChecked();
    expect(onChange).toHaveBeenCalledWith(true);
    await user.click(screen.getByText('同意'));
    expect(getCheckbox()).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('controlled: reflects checked prop and does not toggle internally', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Checkbox label="同意" checked={false} onChange={onChange} />);
    await user.click(screen.getByText('同意'));
    expect(getCheckbox()).not.toBeChecked();
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Checkbox label="同意" checked onChange={onChange} />);
    expect(getCheckbox()).toBeChecked();
  });

  it('defaultChecked renders checked initially (uncontrolled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="同意" defaultChecked onChange={onChange} />);
    expect(getCheckbox()).toBeChecked();
    await user.click(screen.getByText('同意'));
    expect(getCheckbox()).not.toBeChecked();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('indeterminate sets aria-checked="mixed" and DOM indeterminate', () => {
    render(<Checkbox label="部分" indeterminate />);
    const input = getCheckbox();
    expect(input).toHaveAttribute('aria-checked', 'mixed');
    expect(input.indeterminate).toBe(true);
  });

  it('disabled: cannot be toggled and does not fire onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="同意" disabled onChange={onChange} />);
    const input = getCheckbox();
    expect(input).toBeDisabled();
    await user.click(screen.getByText('同意')).catch(() => undefined);
    expect(input).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('passes data-part, classNames and className to parts', () => {
    const { container } = render(
      <Checkbox
        label="同意"
        className="my-root"
        classNames={{ root: 'cls-root', control: 'cls-control', label: 'cls-label' }}
      />
    );
    const root = container.querySelector('[data-part="root"]') as HTMLElement;
    expect(root).toHaveClass('z-checkbox', 'my-root', 'cls-root');
    const control = root.querySelector('[data-part="control"]');
    expect(control).toHaveClass('z-checkbox-box', 'cls-control');
    const label = root.querySelector('[data-part="label"]');
    expect(label).toHaveClass('z-checkbox-label', 'cls-label');
  });

  it('renders hidden native input inside the label root', () => {
    const { container } = render(<Checkbox label="同意" />);
    const input = getCheckbox();
    expect(input).toHaveAttribute('type', 'checkbox');
    const root = container.querySelector('[data-part="root"]');
    expect(root?.contains(input)).toBe(true);
  });
});
