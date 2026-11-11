import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio, RadioGroup } from './index';

afterEach(cleanup);

describe('RadioGroup + Radio', () => {
  it('renders radios inside a radiogroup with default vertical orientation', () => {
    render(
      <RadioGroup defaultValue="a" name="plan">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-orientation', 'vertical');
    expect(group).toHaveAttribute('data-part', 'root');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect((radios[1] as HTMLInputElement).checked).toBe(false);
  });

  it('selects a radio on click and fires onChange with its value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" name="plan" onChange={onChange}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    await user.click(screen.getByText('B'));
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).toBe(false);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('controlled group: reflects value prop until parent updates', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <RadioGroup value="a" name="plan" onChange={onChange}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    await user.click(screen.getByText('B'));
    expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith('b');
    rerender(
      <RadioGroup value="b" name="plan" onChange={onChange}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
  });

  it('sets aria-orientation from orientation prop', () => {
    render(
      <RadioGroup orientation="horizontal" name="plan">
        <Radio value="a" label="A" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('group disabled disables every radio and blocks selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" name="plan" disabled onChange={onChange}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]).toBeDisabled();
    expect(radios[1]).toBeDisabled();
    await user.click(screen.getByText('B')).catch(() => undefined);
    expect(radios[1].checked).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('injects group name into radios', () => {
    render(
      <RadioGroup defaultValue="a" name="plan">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0].name).toBe('plan');
    expect(radios[1].name).toBe('plan');
  });

  it('without group: falls back to native name grouping and is toggleable', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Radio value="a" label="A" name="solo" />
        <Radio value="b" label="B" name="solo" />
      </>
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0].name).toBe('solo');
    expect(radios[0].value).toBe('a');
    expect(radios[1].value).toBe('b');
    await user.click(screen.getByText('A'));
    expect(radios[0].checked).toBe(true);
    await user.click(screen.getByText('B'));
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('individual disabled radio cannot be selected', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a" name="plan">
        <Radio value="a" label="A" />
        <Radio value="b" label="B" disabled />
      </RadioGroup>
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[1]).toBeDisabled();
    await user.click(screen.getByText('B')).catch(() => undefined);
    expect(radios[1].checked).toBe(false);
    expect(radios[0].checked).toBe(true);
  });

  it('passes classNames and data-part to radio parts', () => {
    render(
      <RadioGroup name="plan">
        <Radio
          value="a"
          label="A"
          classNames={{ root: 'cls-root', control: 'cls-control', label: 'cls-label' }}
          className="my-root"
        />
      </RadioGroup>
    );
    const group = screen.getByRole('radiogroup');
    const root = group.querySelector('[data-part="root"].z-radio') as HTMLElement;
    expect(root).toHaveClass('z-radio', 'my-root', 'cls-root');
    expect(root.querySelector('[data-part="control"]')).toHaveClass('z-radio-dot', 'cls-control');
    expect(root.querySelector('[data-part="label"]')).toHaveClass('z-radio-label', 'cls-label');
  });

  it('supports keyboard navigation via native radios', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" name="plan" onChange={onChange}>
        <Radio value="a" label="A" />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    await user.click(screen.getByText('A'));
    await user.keyboard('{ArrowDown}');
    const group = screen.getByRole('radiogroup');
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios[1].checked).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith('b');
  });

  it('bare radio: forwards user onChange and works uncontrolled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Radio value="a" label="甲" onChange={onChange} name="solo" />
        <Radio value="b" label="乙" onChange={onChange} name="solo" />
      </>
    );
    await user.click(screen.getByText('甲'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('甲')).toBeChecked();
  });
});
