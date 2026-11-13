import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { StudioSheetSearch } from './StudioSheetSearch';
import type { StudioExcelDocument } from './studio-types';

afterEach(cleanup);
const document: StudioExcelDocument = {
  version: 1,
  id: 'search',
  kind: 'excel',
  name: '查找.xlsx',
  activeSheetId: 'a',
  sheets: [
    {
      id: 'a',
      name: '查找',
      rowCount: 10,
      columnCount: 5,
      cells: { A1: { input: 'Alpha' }, A2: { input: 'alpha' } },
    },
  ],
};
const selection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } };

it('focuses search, navigates with Enter and closes with Escape without editing content', async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  const close = vi.fn();
  const replace = vi.fn();
  render(
    <StudioSheetSearch
      document={document}
      activeSheetId="a"
      selection={selection}
      snapshot={{ sheetId: 'a', selection }}
      mode="find"
      onModeChange={vi.fn()}
      onNavigate={navigate}
      onReplace={replace}
      onClose={close}
    />
  );
  const input = screen.getByRole('textbox', { name: '表格查找内容' });
  expect(input).toHaveFocus();
  await user.type(input, 'alpha{Enter}');
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ address: 'A2' }));
  expect(screen.getByRole('status')).toHaveTextContent('找到 2 个单元格');
  await user.click(screen.getByRole('checkbox', { name: '区分大小写' }));
  expect(screen.getByRole('status')).toHaveTextContent('找到 1 个单元格');
  await user.click(input);
  await user.keyboard('{Escape}');
  expect(close).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();
});

it('keeps search available in read-only mode and blocks all replacement actions', async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  const replace = vi.fn();
  const view = render(
    <StudioSheetSearch
      document={document}
      activeSheetId="a"
      selection={selection}
      snapshot={{ sheetId: 'a', selection }}
      mode="replace"
      readOnly
      onModeChange={vi.fn()}
      onNavigate={navigate}
      onReplace={replace}
      onClose={vi.fn()}
    />
  );
  await user.type(screen.getByRole('textbox', { name: '表格查找内容' }), 'alpha');
  expect(screen.getByRole('button', { name: '替换当前' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '全部替换' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '查找下一个' }));
  expect(navigate).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();
  view.rerender(
    <StudioSheetSearch
      document={document}
      activeSheetId="a"
      selection={selection}
      snapshot={{ sheetId: 'a', selection }}
      mode="find"
      disabled
      onModeChange={vi.fn()}
      onNavigate={navigate}
      onReplace={replace}
      onClose={vi.fn()}
    />
  );
  expect(screen.getByRole('textbox', { name: '表格查找内容' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '查找下一个' })).toBeDisabled();
});

it('replacement and previous buttons do not also submit the next-result form', async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  const replace = vi.fn(() => '已替换 2 个单元格。');
  render(
    <StudioSheetSearch
      document={document}
      activeSheetId="a"
      selection={selection}
      snapshot={{ sheetId: 'a', selection }}
      mode="replace"
      onModeChange={vi.fn()}
      onNavigate={navigate}
      onReplace={replace}
      onClose={vi.fn()}
    />
  );
  await user.type(screen.getByRole('textbox', { name: '表格查找内容' }), 'alpha');
  await user.click(screen.getByRole('button', { name: '全部替换' }));
  expect(replace).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('已替换 2 个单元格');
  await user.click(screen.getByRole('button', { name: '查找上一个' }));
  expect(navigate).toHaveBeenCalledOnce();
});
