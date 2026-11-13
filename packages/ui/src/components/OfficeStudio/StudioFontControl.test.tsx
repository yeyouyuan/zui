import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button';
import { StudioFontControl } from './StudioFontControl';
import { studioFontFamilyInput, studioFontSizeInput } from './studio-font-input';

afterEach(cleanup);
const options = [
  { value: 'Arial', label: 'Arial' },
  { value: 'SimSun', label: '宋体' },
];

function setup(kind: 'family' | 'size' = 'family') {
  const commit = vi.fn();
  const cancel = vi.fn();
  function Harness({ context = 'A1', disabled = false }: { context?: string; disabled?: boolean }) {
    const [value, setValue] = React.useState(kind === 'family' ? 'Arial' : '11');
    return (
      <>
        <StudioFontControl
          label="字体输入"
          kind={kind}
          options={options}
          value={value}
          contextKey={context}
          disabled={disabled}
          onCancel={cancel}
          onCommit={(next, reason) => {
            commit(next, reason);
            setValue(next);
          }}
        />
        <Button>后续操作</Button>
      </>
    );
  }
  const view = render(<Harness />);
  return { commit, cancel, input: screen.getByRole('combobox'), view, Harness };
}

describe('editable Office font control', () => {
  it('normalizes names and point sizes without accepting partial numbers or XML-invalid names', () => {
    expect(studioFontFamilyInput(' 宋体 ', options)).toBe('SimSun');
    expect(studioFontFamilyInput('arial', options)).toBe('Arial');
    expect(studioFontFamilyInput('Font "A"; & \\B')).toBe('Font "A"; & \\B');
    for (const input of ['', 'a'.repeat(256), 'Font\u0000', '\ud800'])
      expect(studioFontFamilyInput(input)).toBeNull();
    expect(studioFontSizeInput(' 12,5 PT ')).toBe('12.5');
    expect(studioFontSizeInput('12.3', 300, 0.5)).toBe('12.5');
    for (const input of ['0', '410', '12px', '1e2', '11x', 'NaN'])
      expect(studioFontSizeInput(input)).toBeNull();
    expect(studioFontSizeInput('301', 300)).toBeNull();
  });

  it('commits typed text with Enter and cancels a later draft with Escape', async () => {
    const user = userEvent.setup();
    const { input, commit, cancel } = setup();
    await user.click(input);
    await user.clear(input);
    await user.type(input, 'Custom Font{Enter}');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('Custom Font', 'enter');
    await user.clear(input);
    await user.type(input, 'Cancelled{Escape}');
    expect(input).toHaveValue('Custom Font');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('commits a dropdown selection once while preserving the destination of Tab', async () => {
    const user = userEvent.setup();
    const { input, commit } = setup();
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('SimSun', 'selection');
    await user.clear(input);
    await user.type(input, 'Next Font');
    await user.tab();
    expect(commit).toHaveBeenLastCalledWith('Next Font', 'blur');
    expect(screen.getByRole('button', { name: '后续操作' })).toHaveFocus();
  });

  it('retains an invalid size after blur until corrected or cancelled', async () => {
    const user = userEvent.setup();
    const { input, commit } = setup('size');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '0');
    await user.tab();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('1 至 409');
    expect(commit).not.toHaveBeenCalled();
    await user.click(input);
    await user.clear(input);
    await user.type(input, '12,5pt{Enter}');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('12.5', 'enter');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not commit IME Enter and finishes a pending blur after composition ends', () => {
    const { input, commit } = setup();
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '中文字体' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(commit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.compositionEnd(input, { target: { value: '中文字体' } });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('中文字体', 'blur');
  });

  it('discards stale drafts after the selected range or edit permission changes', async () => {
    const user = userEvent.setup();
    const { input, commit, view, Harness } = setup();
    await user.click(input);
    await user.clear(input);
    await user.type(input, 'Stale');
    view.rerender(<Harness context="B1" />);
    expect(input).toHaveValue('Arial');
    await user.keyboard('{Enter}');
    expect(commit).not.toHaveBeenCalled();
    await user.type(input, 'Stale');
    view.rerender(<Harness context="B1" disabled />);
    expect(input).toBeDisabled();
    expect(input).toHaveValue('Arial');
    expect(commit).not.toHaveBeenCalled();
  });
});
