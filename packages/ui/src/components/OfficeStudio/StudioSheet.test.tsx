import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StudioSheet from './StudioSheet';
import { STUDIO_SHEET_CLIPBOARD_TYPE } from './studio-sheet-model';
import type { StudioExcelDocument } from './studio-types';

beforeEach(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function documentFixture(): StudioExcelDocument {
  return {
    version: 1,
    id: 'sheet-test',
    name: '预算.xlsx',
    kind: 'excel',
    activeSheetId: 'main',
    sheets: [
      {
        id: 'main',
        name: '预算',
        rowCount: 10000,
        columnCount: 26,
        cells: { A1: { input: '3' }, A2: { input: '4' }, B1: { input: '=SUM(A1:A2)' } },
      },
      {
        id: 'other',
        name: '汇总',
        rowCount: 200,
        columnCount: 26,
        cells: { A1: { input: "='预算'!B1" } },
      },
    ],
  };
}

function setup({
  readOnly = false,
  disabled = false,
  document: initial = documentFixture(),
}: { readOnly?: boolean; disabled?: boolean; document?: StudioExcelDocument } = {}) {
  const changed = vi.fn();
  let current = initial;
  function Harness(permissions: { readOnly?: boolean; disabled?: boolean }) {
    const [document, setDocument] = React.useState(current);
    return (
      <StudioSheet
        document={document}
        onChange={(next) => {
          current = next;
          changed(next);
          setDocument(next);
        }}
        disabled={permissions.disabled ?? false}
        readOnly={permissions.readOnly ?? false}
      />
    );
  }
  const view = render(<Harness readOnly={readOnly} disabled={disabled} />);
  return {
    changed,
    current: () => current,
    setPermissions: (permissions: { readOnly?: boolean; disabled?: boolean }) =>
      view.rerender(<Harness {...permissions} />),
  };
}

describe('StudioSheet Office editing details', () => {
  it('uses ZUI controls for every ribbon action and exposes pressed state without native button chrome', () => {
    const document = documentFixture();
    document.sheets[0].cells.A1 = { input: 'Alpha', bold: true, wrap: true };
    setup({ document });
    const tabs = screen.getByRole('tablist', { name: '表格工具栏' });
    const ribbon = tabs.closest('.z-studio-ribbon');
    expect(ribbon).not.toBeNull();
    const expectZuiButtons = () => {
      const actions = Array.from(ribbon!.querySelectorAll('button'));
      expect(actions.length).toBeGreaterThan(0);
      expect(
        actions.every((button) =>
          [
            'z-button',
            'z-tab',
            'z-select-trigger',
            'z-combobox-toggle',
            'z-color-picker-swatch',
          ].some((className) => button.classList.contains(className))
        )
      ).toBe(true);
    };
    for (const name of ['开始', '插入', '布局', '公式', '数据', '视图']) {
      fireEvent.click(within(tabs).getByRole('tab', { name }));
      expectZuiButtons();
    }
    fireEvent.click(within(tabs).getByRole('tab', { name: '开始' }));
    for (const name of ['自动换行', '合并单元格', '拆分单元格'])
      expect(screen.getByRole('button', { name })).toHaveClass('z-button');
    expect(screen.getByRole('button', { name: '自动换行' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  function smallFixture() {
    const document = documentFixture();
    document.sheets[0].rowCount = 20;
    document.sheets[0].columnCount = 6;
    document.sheets[0].cells = {
      A1: { input: 'Alpha', bold: true },
      A2: { input: 'alpha' },
      B1: { input: '=1+2' },
    };
    document.sheets[1].cells = { A1: { input: 'alpha' } };
    return document;
  }

  it('opens search with shortcuts, replaces only captured selection and undoes once', async () => {
    const user = userEvent.setup();
    const view = setup({ document: smallFixture() });
    const grid = screen.getByRole('grid');
    grid.focus();
    fireEvent.keyDown(grid, { key: 'h', metaKey: true });
    const panel = screen.getByRole('region', { name: '表格查找与替换' });
    await user.type(within(panel).getByRole('textbox', { name: '表格查找内容' }), 'alpha');
    await user.click(within(panel).getByLabelText('表格查找范围'));
    await user.click(screen.getByRole('option', { name: '打开时的选区' }));
    await user.type(within(panel).getByRole('textbox', { name: '表格替换为' }), 'Beta');
    await user.click(within(panel).getByRole('button', { name: '全部替换' }));
    expect(view.current().sheets[0].cells.A1.input).toBe('Beta');
    expect(view.current().sheets[0].cells.A2.input).toBe('alpha');
    expect(view.changed).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(view.current().sheets[0].cells.A1.input).toBe('Alpha');
    fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
    expect(within(panel).getByRole('textbox', { name: '表格查找内容' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: '表格查找与替换' })).not.toBeInTheDocument();
  });

  it('searches across worksheets and temporarily reveals hidden matches without changing hidden rows', async () => {
    const user = userEvent.setup();
    const initial = smallFixture();
    initial.sheets[0].hiddenRows = [2];
    const view = setup({ document: initial, readOnly: true });
    const grid = screen.getByRole('grid');
    grid.focus();
    fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
    const panel = screen.getByRole('region', { name: '表格查找与替换' });
    await user.type(within(panel).getByRole('textbox', { name: '表格查找内容' }), 'alpha');
    await user.click(within(panel).getByRole('button', { name: '查找下一个' }));
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveAttribute('data-active');
    expect(view.current().sheets[0].hiddenRows).toEqual([2]);
    await user.click(within(panel).getByLabelText('表格查找范围'));
    await user.click(screen.getByRole('option', { name: '整个工作簿' }));
    await user.click(within(panel).getByRole('button', { name: '查找下一个' }));
    expect(screen.getByRole('grid', { name: '汇总 单元格网格' })).toBeInTheDocument();
    expect(view.changed).not.toHaveBeenCalled();
    expect(within(panel).getByRole('button', { name: '替换' })).toBeDisabled();
  });

  it('sets selected column widths, validates inputs, restores default and supports undo', async () => {
    const user = userEvent.setup();
    const view = setup({ document: smallFixture() });
    const grid = screen.getByRole('grid');
    grid.focus();
    fireEvent.keyDown(grid, { key: 'ArrowRight', shiftKey: true });
    await user.click(screen.getByRole('button', { name: '列宽' }));
    const input = screen.getByRole('textbox', { name: '列宽（字符）' });
    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: '应用列宽' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1–255');
    expect(view.changed).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '20.5');
    await user.click(screen.getByRole('button', { name: '应用列宽' }));
    expect(view.current().sheets[0].columnWidths).toEqual({ A: 148.5, B: 148.5 });
    await user.click(screen.getByRole('button', { name: '恢复默认列宽' }));
    expect(view.current().sheets[0].columnWidths).toEqual({ A: 112, B: 112 });
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(view.current().sheets[0].columnWidths).toEqual({ A: 148.5, B: 148.5 });
  });

  it('commits pointer resize once, cancels with Escape and exposes keyboard resizing', () => {
    const view = setup({ document: smallFixture() });
    const handle = screen.getByRole('separator', { name: 'A 列宽' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 112 });
    fireEvent.pointerMove(window, { clientX: 152 });
    expect(view.changed).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 172 });
    expect(view.current().sheets[0].columnWidths?.A).toBe(172);
    expect(view.changed).toHaveBeenCalledOnce();
    fireEvent.pointerDown(handle, { button: 0, clientX: 172 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.pointerUp(window, { clientX: 200 });
    expect(view.changed).toHaveBeenCalledOnce();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(view.current().sheets[0].columnWidths?.A).toBe(179);
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('applies borders and vertical alignment and clears formatting while retaining formulas', async () => {
    const user = userEvent.setup();
    const view = setup({ document: smallFixture() });
    await user.click(screen.getByLabelText('单元格垂直对齐'));
    await user.click(screen.getByRole('option', { name: '顶端对齐' }));
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveStyle({ alignItems: 'flex-start' });
    await user.click(screen.getByRole('button', { name: '所有边框' }));
    expect(view.current().sheets[0].cells.A1.borders?.bottom?.style).toBe('thin');
    await user.click(screen.getByRole('button', { name: '清除格式' }));
    expect(view.current().sheets[0].cells.A1).toMatchObject({
      input: 'Alpha',
      bold: false,
      borders: {},
      align: 'general',
      background: 'none',
    });
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'B1' }), { button: 0 });
    await user.click(screen.getByRole('button', { name: '清除格式' }));
    expect(view.current().sheets[0].cells.B1.input).toBe('=1+2');
  });

  it('blocks formatting and sizing in read-only and disabled mode', () => {
    const view = setup({ document: smallFixture(), readOnly: true });
    expect(screen.getByRole('button', { name: '列宽' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '所有边框' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '清除格式' })).toBeDisabled();
    view.setPermissions({ disabled: true });
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
    expect(screen.queryByRole('region', { name: '表格查找与替换' })).not.toBeInTheDocument();
    expect(view.changed).not.toHaveBeenCalled();
  });
});

describe('StudioSheet hyperlinks', () => {
  it('keeps empty formula and hidden numeric displays while showing labels for truly empty linked cells', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].cells = {
      A1: { input: '=""' },
      A2: { input: '=HYPERLINK("https://example.com/formula","")' },
      A3: { input: '0', numberFormat: '0;-0;;@' },
      A4: { input: '' },
    };
    initial.sheets[0].hyperlinks = [
      { id: 'empty-formula', ref: 'A1', target: 'https://example.com/native', display: '导入标签' },
      { id: 'hidden-number', ref: 'A3', target: 'https://example.com/hidden', display: '隐藏标签' },
      { id: 'empty-cell', ref: 'A4', target: 'https://example.com/empty', display: '空格标签' },
    ];
    const state = setup({ document: initial });
    for (const address of ['A1', 'A2', 'A3']) {
      expect(screen.getByRole('gridcell', { name: address })).toHaveTextContent(/^$/);
      expect(screen.getByRole('gridcell', { name: address })).toHaveAttribute(
        'data-hyperlink',
        'true'
      );
    }
    expect(screen.getByRole('gridcell', { name: 'A4' })).toHaveTextContent('空格标签');
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.click(screen.getByRole('button', { name: '编辑超链接' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: '超链接显示文字' })).toHaveValue('');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接屏幕提示' }), {
      target: { value: '保留空结果' },
    });
    await user.click(within(dialog).getByRole('button', { name: '确定' }));
    expect(state.current().sheets[0].cells.A1.input).toBe('=""');
    expect(state.current().sheets[0].hyperlinks![0].display).toBe('导入标签');
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveTextContent(/^$/);
  });

  it('preserves numeric input when editing link metadata and undoes display text with its link in one step', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].cells.A1 = { input: '12.5', numberFormat: '0.00' };
    initial.sheets[0].hyperlinks = [];
    const state = setup({ document: initial });
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.click(screen.getByRole('button', { name: '插入超链接' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: '超链接显示文字' })).toHaveValue('12.50');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接地址' }), {
      target: { value: 'https://example.com/budget' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接屏幕提示' }), {
      target: { value: '查看预算' },
    });
    await user.click(within(dialog).getByRole('button', { name: '确定' }));
    expect(state.changed).toHaveBeenCalledTimes(1);
    expect(state.current().sheets[0].cells.A1).toEqual(initial.sheets[0].cells.A1);
    expect(state.current().sheets[0].hyperlinks).toEqual([
      expect.objectContaining({
        ref: 'A1',
        target: 'https://example.com/budget',
        tooltip: '查看预算',
      }),
    ]);
    await user.click(screen.getByRole('button', { name: '编辑超链接' }));
    dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接显示文字' }), {
      target: { value: '001' },
    });
    await user.click(within(dialog).getByRole('button', { name: '确定' }));
    expect(state.changed).toHaveBeenCalledTimes(2);
    expect(state.current().sheets[0].cells.A1.input).toBe("'001");
    expect(state.current().sheets[0].hyperlinks![0].display).toBe('001');
    await user.click(screen.getByRole('tab', { name: '开始' }));
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.A1).toEqual(initial.sheets[0].cells.A1);
    expect(state.current().sheets[0].hyperlinks![0].display).toBeUndefined();
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.click(screen.getByRole('button', { name: '移除超链接' }));
    expect(state.current().sheets[0].hyperlinks).toEqual([]);
    expect(state.current().sheets[0].cells.A1).toEqual(initial.sheets[0].cells.A1);
  });

  it('keeps both the input and link unchanged when edited display text fails data validation', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [];
    initial.sheets[0].dataValidations = [
      {
        id: 'small-number',
        range: 'A1',
        type: 'whole',
        operator: 'between',
        formula1: '1',
        formula2: '5',
        errorMessage: '只允许 1 到 5',
      },
    ];
    const state = setup({ document: initial });
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.click(screen.getByRole('button', { name: '插入超链接' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接地址' }), {
      target: { value: 'https://example.com' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '超链接显示文字' }), {
      target: { value: '文字' },
    });
    await user.click(within(dialog).getByRole('button', { name: '确定' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('只允许 1 到 5');
    expect(state.changed).not.toHaveBeenCalled();
    expect(state.current()).toBe(initial);
  });

  it('scrolls to same-sheet links and expands another sheet view without editing its saved dimensions in read-only mode', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [
      { id: 'same', ref: 'A1', location: "'预算'!T2000" },
      { id: 'other', ref: 'T2000', location: "'汇总'!AZ500:BA502" },
    ];
    const state = setup({ document: initial, readOnly: true });
    await user.click(screen.getByRole('tab', { name: '插入' }));
    expect(screen.getByRole('button', { name: '编辑超链接' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '打开链接' }));
    const grid = screen.getByRole('grid');
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: 'T2000' })).toBeInTheDocument()
    );
    expect(grid.scrollTop).toBeGreaterThan(0);
    expect(grid.scrollLeft).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '打开链接' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: '汇总' })).toHaveAttribute('aria-selected', 'true')
    );
    expect(screen.getByRole('textbox', { name: '单元格地址' })).toHaveValue('AZ500');
    expect(within(grid).getAllByRole('gridcell', { selected: true })).toHaveLength(6);
    expect(screen.getByRole('gridcell', { name: 'BA502' })).toBeInTheDocument();
    expect(state.changed).not.toHaveBeenCalled();
    expect(state.current()).toBe(initial);
    expect(state.current().sheets[1].rowCount).toBe(200);
    expect(state.current().sheets[1].columnCount).toBe(26);
    expect(state.current().activeSheetId).toBe('main');
  });

  it('retains imported unsupported targets and refuses to open them', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [
      { id: 'unsupported', ref: 'A1', target: 'javascript:alert(1)' },
    ];
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      const state = setup({ document: initial, readOnly: true });
      await user.click(screen.getByRole('tab', { name: '插入' }));
      await user.click(screen.getByRole('button', { name: '打开链接' }));
      expect(screen.getByRole('status')).toHaveTextContent('不能打开');
      expect(open).not.toHaveBeenCalled();
      expect(state.current()).toBe(initial);
      expect(state.changed).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });

  it('retains links outside the editing bounds and keeps the current selection usable', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [{ id: 'large', ref: 'A1', location: "'汇总'!XFD1048576" }];
    const state = setup({ document: initial, readOnly: true });
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.click(screen.getByRole('button', { name: '打开链接' }));
    expect(screen.getByRole('status')).toHaveTextContent('超出当前支持的');
    expect(screen.getByRole('textbox', { name: '单元格地址' })).toHaveValue('A1');
    expect(screen.getByRole('tab', { name: '预算' })).toHaveAttribute('aria-selected', 'true');
    expect(state.current()).toBe(initial);
    expect(state.changed).not.toHaveBeenCalled();
  });

  it('copies hyperlink ranges in the version 3 clipboard and pastes values and links together', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [
      { id: 'copied', ref: 'A1:A2', target: 'https://example.com', tooltip: '预算' },
    ];
    const state = setup({ document: initial });
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    const data = new Map<string, string>();
    fireEvent.copy(grid, {
      clipboardData: { setData: (type: string, value: string) => data.set(type, value) },
    });
    expect(JSON.parse(data.get(STUDIO_SHEET_CLIPBOARD_TYPE)!)).toEqual(
      expect.objectContaining({
        version: 3,
        text: '3\n4',
        hyperlinks: [expect.objectContaining({ ref: 'A1:A2', target: 'https://example.com' })],
      })
    );
    await user.click(screen.getByRole('gridcell', { name: 'C2' }));
    fireEvent.paste(grid, { clipboardData: { getData: (type: string) => data.get(type) ?? '' } });
    expect(state.current().sheets[0].cells.C2.input).toBe('3');
    expect(state.current().sheets[0].cells.C3.input).toBe('4');
    expect(state.current().sheets[0].hyperlinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: 'A1:A2', target: 'https://example.com' }),
        expect.objectContaining({ ref: 'C2:C3', target: 'https://example.com', tooltip: '预算' }),
      ])
    );
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it('removes formula links without turning a FALSE value in text formatting into truthy text', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].hyperlinks = [
      { id: 'formula:main:A1', ref: 'A2', target: 'https://example.com/native' },
    ];
    initial.sheets[0].cells.A1 = {
      input: '=HYPERLINK("https://example.com",FALSE())',
      numberFormat: '@',
    };
    initial.sheets[0].cells.B1 = { input: '=IF(A1,7,9)' };
    const state = setup({ document: initial });
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('9');
    await user.click(screen.getByRole('tab', { name: '插入' }));
    expect(screen.getByRole('button', { name: '编辑链接公式' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '移除超链接' }));
    expect(state.current().sheets[0].cells.A1.input).not.toContain('HYPERLINK');
    expect(state.current().sheets[0].hyperlinks).toBe(initial.sheets[0].hyperlinks);
    expect(screen.getByRole('gridcell', { name: 'A1' })).not.toHaveAttribute('data-hyperlink');
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('9');
    await user.click(screen.getByRole('tab', { name: '开始' }));
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.A1).toEqual(initial.sheets[0].cells.A1);
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveAttribute('data-hyperlink', 'true');
  });
});

describe('StudioSheet rules and fill', () => {
  it('creates, recalculates and deletes a conditional format with undo and rule editing', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.click(screen.getByRole('button', { name: '条件格式' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '规则应用范围' }), {
      target: { value: 'A1:A2' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '规则比较值' }), {
      target: { value: '3' },
    });
    await user.click(within(dialog).getByRole('button', { name: '应用规则' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(state.current().sheets[0].conditionalFormats).toHaveLength(1);
    expect(screen.getByRole('gridcell', { name: 'A1' })).not.toHaveAttribute('data-conditional');
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveAttribute(
      'data-conditional',
      'true'
    );
    await user.dblClick(screen.getByRole('gridcell', { name: 'A2' }));
    fireEvent.change(screen.getByRole('textbox', { name: '编辑 A2' }), { target: { value: '2' } });
    await user.keyboard('{Enter}');
    expect(screen.getByRole('gridcell', { name: 'A2' })).not.toHaveAttribute('data-conditional');
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveAttribute(
      'data-conditional',
      'true'
    );
    await user.click(screen.getByRole('button', { name: '条件格式' }));
    await user.click(screen.getByRole('button', { name: '编辑条件格式规则 1' }));
    expect(screen.getByRole('textbox', { name: '规则比较值' })).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: '删除条件格式规则 1' }));
    expect(state.current().sheets[0].conditionalFormats).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '关闭' }));
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveAttribute(
      'data-conditional',
      'true'
    );
  });

  it('uses a numeric validation list and preserves a rejected draft across pointer selection and atomic paste', async () => {
    const user = userEvent.setup();
    const document = documentFixture();
    document.sheets[0].dataValidations = [
      {
        id: 'numbers',
        range: 'A1:A2',
        type: 'list',
        values: ['3', '4'],
        inputTitle: '数量',
        inputMessage: '选择允许的数量',
        errorMessage: '请选择 3 或 4',
      },
    ];
    const state = setup({ document });
    expect(screen.getByText('数量：选择允许的数量')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^A1 数据验证选项/ }));
    await user.click(screen.getByRole('option', { name: '4' }));
    expect(state.current().sheets[0].cells.A1).toEqual({ input: '4' });
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('8');
    await user.dblClick(screen.getByRole('gridcell', { name: 'A1' }));
    const input = screen.getByRole('textbox', { name: '编辑 A1' });
    fireEvent.change(input, { target: { value: '9' } });
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('9');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(state.current().sheets[0].cells.A1.input).toBe('4');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'A2' }), { button: 0 });
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'B1' }));
    fireEvent.doubleClick(screen.getByRole('gridcell', { name: 'A2' }));
    expect(screen.getByRole('textbox', { name: '编辑 A1' })).toHaveValue('9');
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveAttribute('data-active', 'true');
    state.setPermissions({ readOnly: true });
    expect(screen.getByRole('textbox', { name: '编辑 A1' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: '编辑 A1' }).closest('[data-studio-input-error]')
    ).not.toBeNull();
    state.setPermissions({ readOnly: false });
    await user.click(screen.getByRole('button', { name: '取消单元格编辑' }));
    expect(screen.getByRole('textbox', { name: '表格公式栏' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: '表格公式栏' })).not.toHaveAttribute('aria-invalid');
    const before = state.current();
    fireEvent.paste(screen.getByRole('grid'), {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? '3\n9' : '') },
    });
    expect(state.current()).toBe(before);
    expect(screen.getByRole('status')).toHaveTextContent('请选择 3 或 4');
  });

  it('creates a validation rule and permits warning values while marking them invalid', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.click(screen.getByRole('tab', { name: '数据' }));
    await user.click(screen.getByRole('button', { name: '数据验证' }));
    await user.click(screen.getByRole('button', { name: /^数据验证类型/ }));
    await user.click(screen.getByRole('option', { name: '整数' }));
    fireEvent.change(screen.getByRole('textbox', { name: '规则比较值上限' }), {
      target: { value: '10' },
    });
    await user.click(screen.getByRole('button', { name: /^验证错误级别/ }));
    await user.click(screen.getByRole('option', { name: /警告/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '验证输入提示内容' }), {
      target: { value: '请输入数量\n允许 0 到 10' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '验证错误内容' }), {
      target: { value: '数量超出范围\n允许保留但请核对' },
    });
    await user.click(screen.getByRole('button', { name: '应用规则' }));
    await user.dblClick(screen.getByRole('gridcell', { name: 'A1' }));
    fireEvent.change(screen.getByRole('textbox', { name: '编辑 A1' }), { target: { value: '99' } });
    await user.keyboard('{Enter}');
    expect(state.current().sheets[0].cells.A1.input).toBe('99');
    expect(state.current().sheets[0].dataValidations?.[0].errorStyle).toBe('warning');
    expect(state.current().sheets[0].dataValidations?.[0].inputMessage).toBe(
      '请输入数量\n允许 0 到 10'
    );
    expect(state.current().sheets[0].dataValidations?.[0].errorMessage).toBe(
      '数量超出范围\n允许保留但请核对'
    );
    expect(screen.getByRole('status')).toHaveTextContent('1 个单元格不符合数据验证');
    expect(screen.getByRole('status')).toHaveTextContent('A1：数量超出范围');
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveAttribute('data-invalid', 'true');
    expect(screen.getByRole('textbox', { name: '表格公式栏' })).not.toHaveAttribute('aria-invalid');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'A1' }), { button: 0 });
    expect(
      screen.getByRole('gridcell', { name: 'A1' }).getAttribute('aria-describedby')
    ).toBeTruthy();
  });

  it.each([
    ['warning', true],
    ['information', true],
    ['warning', false],
  ] as const)(
    'summarizes actual invalid destinations for %s rules with error prompts %s after unchanged fill, series and ragged paste',
    async (errorStyle, showErrorMessage) => {
      const user = userEvent.setup();
      const document = documentFixture();
      document.sheets[0].cells = {
        A1: { input: '3' },
        A2: { input: '3' },
        A3: { input: '3' },
        B1: { input: '3' },
        C1: { input: '3' },
        B3: { input: '9' },
      };
      document.sheets[0].dataValidations = ['A2:A4', 'B1:C1', 'B3:B3'].map((range, index) => ({
        id: `rule-${index}`,
        range,
        type: 'whole',
        operator: 'equal',
        formula1: '2',
        errorStyle,
        showErrorMessage,
        errorMessage: '仅允许 2',
      }));
      const state = setup({ document });
      const grid = screen.getByRole('grid');
      const address = screen.getByRole('textbox', { name: '单元格地址' });
      const select = (value: string) => {
        fireEvent.change(address, { target: { value } });
        fireEvent.keyDown(address, { key: 'Enter' });
      };
      const expectNotice = (count: number, first: string) => {
        if (showErrorMessage) {
          expect(screen.getByRole('status')).toHaveTextContent(`${count} 个单元格不符合数据验证`);
          expect(screen.getByRole('status')).toHaveTextContent(`${first}：仅允许 2`);
        } else {
          expect(screen.getByRole('status')).not.toHaveTextContent('不符合数据验证');
          expect(screen.queryByText(/仅允许 2/)).not.toBeInTheDocument();
        }
      };
      fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'A3' }), { button: 0 });
      fireEvent.pointerEnter(screen.getByRole('gridcell', { name: 'A1' }));
      fireEvent.pointerUp(window);
      expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveAttribute('data-active', 'true');
      await user.click(screen.getByRole('button', { name: '向下填充' }));
      expect(state.current()).toBe(document);
      expectNotice(2, 'A2');
      select('A1:C1');
      fireEvent.keyDown(grid, { key: 'r', ctrlKey: true });
      expect(state.current()).toBe(document);
      expectNotice(2, 'B1');
      select('A1:A4');
      await user.click(screen.getByRole('button', { name: '序列填充' }));
      await user.click(screen.getByRole('button', { name: '填充序列' }));
      expect(state.current().sheets[0].cells.A4.input).toBe('6');
      expectNotice(3, 'A2');
      await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
      expect(state.current()).toBe(document);
      select('A2');
      fireEvent.paste(grid, {
        clipboardData: { getData: (type: string) => (type === 'text/plain' ? '3\t3\n3' : '') },
      });
      expect(state.current().sheets[0].cells.B3.input).toBe('9');
      expectNotice(2, 'A2');
      expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveAttribute('data-invalid', 'true');
    }
  );

  it('respects disabled validation prompts without dangling accessibility descriptions', () => {
    const document = documentFixture();
    document.sheets[0].dataValidations = [
      {
        id: 'quiet',
        range: 'A1:A1',
        type: 'whole',
        operator: 'equal',
        formula1: '1',
        showInputMessage: false,
        showErrorMessage: false,
        inputMessage: '隐藏的提示',
        errorMessage: '隐藏的错误',
      },
    ];
    setup({ document });
    expect(screen.queryByText(/隐藏的/)).not.toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('gridcell', { name: 'A1' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('textbox', { name: '表格公式栏' })).not.toHaveAttribute(
      'aria-describedby'
    );
  });

  it('fills relative formulas and full direct styles using the toolbar and keyboard', async () => {
    const user = userEvent.setup();
    const document = documentFixture();
    document.sheets[0].cells.B1.bold = true;
    document.sheets[0].cells.B3 = { input: 'old', background: '#FF0000' };
    const state = setup({ document });
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'B1:B3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '向下填充' }));
    expect(state.current().sheets[0].cells.B2).toMatchObject({ input: '=SUM(A2:A3)', bold: true });
    expect(state.current().sheets[0].cells.B3).toMatchObject({ input: '=SUM(A3:A4)', bold: true });
    expect(state.current().sheets[0].cells.B3.background).toBeUndefined();
    fireEvent.change(address, { target: { value: 'B1:C1' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'r', ctrlKey: true });
    expect(state.current().sheets[0].cells.C1.input).toBe('=SUM(B1:B2)');
    expect(screen.getByRole('gridcell', { name: 'C1' })).toHaveTextContent('11');
  });

  it('fills a leap-day date series and prevents changes in read-only rule inspection', async () => {
    const user = userEvent.setup();
    const document = documentFixture();
    document.sheets[0].cells.C1 = { input: '2024-02-28', numberFormat: 'yyyy-mm-dd' };
    const state = setup({ document });
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'C1:C3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '序列填充' }));
    await user.click(screen.getByRole('button', { name: /^序列类型/ }));
    await user.click(screen.getByRole('option', { name: '日期（步长单位：天）' }));
    await user.click(screen.getByRole('button', { name: '填充序列' }));
    expect(screen.getByRole('gridcell', { name: 'C2' })).toHaveTextContent('2024-02-29');
    expect(screen.getByRole('gridcell', { name: 'C3' })).toHaveTextContent('2024-03-01');
    const before = state.current();
    state.setPermissions({ readOnly: true });
    expect(screen.getByRole('button', { name: '向下填充' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '序列填充' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '条件格式' }));
    expect(screen.getByRole('textbox', { name: '规则应用范围' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '应用规则' })).toBeDisabled();
    expect(state.current()).toBe(before);
  });

  it('rejects a toolbar fill atomically when a destination violates its validation', async () => {
    const user = userEvent.setup();
    const document = documentFixture();
    document.sheets[0].dataValidations = [
      {
        id: 'second',
        range: 'A2:A2',
        type: 'whole',
        operator: 'equal',
        formula1: '4',
        errorMessage: '第二行只能是 4',
      },
    ];
    const state = setup({ document });
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:A2' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    const before = state.current();
    await user.click(screen.getByRole('button', { name: '向下填充' }));
    expect(state.current()).toBe(before);
    expect(screen.getByRole('status')).toHaveTextContent('第二行只能是 4');
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveTextContent('3');
    expect(screen.getByRole('gridcell', { name: 'A2' })).toHaveTextContent('4');
  });
});

describe('StudioSheet', () => {
  it('edits selected fonts and sizes, keeps links and values, and restores both with undo', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].cells.A1 = { input: '3', fontFamily: 'Imported Serif', fontSize: 12.5 };
    initial.sheets[0].hyperlinks = [
      { id: 'font-link', ref: 'A1:A2', target: 'https://example.com' },
    ];
    const state = setup({ document: initial });
    expect(screen.getByRole('combobox', { name: '表格字体' })).toHaveValue('Imported Serif');
    expect(screen.getByRole('combobox', { name: '表格字号' })).toHaveValue('12.5');
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:A2' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('combobox', { name: '表格字体' }));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('option', { name: 'Arial' }));
    expect(state.changed).toHaveBeenCalledTimes(1);
    for (const key of ['A1', 'A2'])
      expect(state.current().sheets[0].cells[key].fontFamily).toBe('Arial');
    await user.click(screen.getByRole('combobox', { name: '表格字号' }));
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('option', { name: '14' }));
    expect(state.changed).toHaveBeenCalledTimes(2);
    for (const key of ['A1', 'A2']) {
      expect(state.current().sheets[0].cells[key].fontSize).toBe(14);
      expect(screen.getByRole('gridcell', { name: key }).style.fontFamily).toContain('Arial');
      expect(screen.getByRole('gridcell', { name: key })).toHaveStyle({ fontSize: '14pt' });
    }
    expect(state.current().sheets[0].cells.A1.input).toBe('3');
    expect(state.current().sheets[0].cells.A2.input).toBe('4');
    expect(state.current().sheets[0].hyperlinks).toBe(initial.sheets[0].hyperlinks);
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.A1.fontSize).toBe(12.5);
    expect(state.current().sheets[0].cells.A2.fontSize).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.A1).toEqual(initial.sheets[0].cells.A1);
    expect(state.current().sheets[0].cells.A2).toEqual(initial.sheets[0].cells.A2);
    state.setPermissions({ readOnly: true });
    for (const name of ['表格字体', '表格字号'])
      expect(screen.getByRole('combobox', { name })).toBeDisabled();
    for (const name of ['表格文字颜色', '表格填充颜色'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    expect(state.changed).toHaveBeenCalledTimes(4);
  });

  it('edits a cell and recalculates dependencies; blur followed by formatting preserves the new value', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.dblClick(screen.getByRole('gridcell', { name: 'A1' }));
    const input = screen.getByRole('textbox', { name: '编辑 A1' });
    await user.clear(input);
    await user.type(input, '8{Enter}');
    expect(state.current().sheets[0].cells.A1.input).toBe('8');
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('12');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'A1' }), { button: 0 });
    const formula = screen.getByRole('textbox', { name: '表格公式栏' });
    await user.click(formula);
    await user.clear(formula);
    await user.type(formula, '9');
    await user.click(screen.getByRole('button', { name: '表格加粗' }));
    expect(state.current().sheets[0].cells.A1).toMatchObject({ input: '9', bold: true });
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('13');
  });

  it.each([
    ['disabled', 'cell'],
    ['readOnly', 'cell'],
    ['disabled', 'formula'],
    ['readOnly', 'formula'],
  ] as const)(
    'preserves a staged %s %s input until editing resumes',
    async (permission, origin) => {
      const user = userEvent.setup();
      const state = setup();
      if (origin === 'cell') await user.dblClick(screen.getByRole('gridcell', { name: 'A1' }));
      const label = origin === 'cell' ? '编辑 A1' : '表格公式栏';
      const input = screen.getByRole('textbox', { name: label });
      if (origin === 'formula') await user.click(input);
      await user.clear(input);
      await user.type(input, '123');
      expect(state.changed).not.toHaveBeenCalled();

      state.setPermissions({ [permission]: true });
      expect(input).toHaveValue('123');
      if (permission === 'readOnly' && origin === 'formula')
        expect(input).toHaveAttribute('readonly');
      else expect(input).toBeDisabled();
      fireEvent.blur(input);
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.change(input, { target: { value: '不应写入' } });
      expect(screen.getByRole('textbox', { name: label })).toHaveValue('123');
      expect(screen.getByRole('status')).toHaveTextContent('待确认的输入已保留');
      expect(state.changed).not.toHaveBeenCalled();

      state.setPermissions({});
      const resumed = screen.getByRole('textbox', { name: label });
      expect(resumed).toHaveValue('123');
      expect(resumed).toBeEnabled();
      expect(resumed).toHaveFocus();
      await user.type(resumed, '4{Enter}');
      expect(state.current().sheets[0].cells.A1.input).toBe('1234');
      expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('1238');
      expect(state.changed).toHaveBeenCalledTimes(1);
    }
  );

  it('returns to the staged cell after another sheet is viewed while read-only', async () => {
    const user = userEvent.setup();
    const state = setup();
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'D9800' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.dblClick(screen.getByRole('gridcell', { name: 'D9800' }));
    await user.type(screen.getByRole('textbox', { name: '编辑 D9800' }), '待确认');
    state.setPermissions({ readOnly: true });
    await user.click(screen.getByRole('tab', { name: '汇总' }));
    expect(screen.getByRole('grid', { name: '汇总 单元格网格' })).toBeInTheDocument();
    expect(state.changed).not.toHaveBeenCalled();

    state.setPermissions({});
    const resumed = screen.getByRole('textbox', { name: '编辑 D9800' });
    expect(screen.getByRole('grid', { name: '预算 单元格网格' })).toBeInTheDocument();
    expect(resumed).toHaveValue('待确认');
    expect(resumed).toHaveFocus();
    await user.type(resumed, '完成{Enter}');
    expect(state.current().sheets[0].cells.D9800.input).toBe('待确认完成');
    expect(state.current().sheets[1].cells.D9800).toBeUndefined();
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it('appends typed characters after the key that starts editing a cell', async () => {
    const user = userEvent.setup();
    const state = setup();
    const grid = screen.getByRole('grid');
    grid.focus();
    await user.keyboard('123{Enter}');
    expect(state.current().sheets[0].cells.A1.input).toBe('123');
  });

  it('pastes and copies a rectangular selection, then undoes and redoes the batch', async () => {
    const user = userEvent.setup();
    const state = setup();
    const grid = screen.getByRole('grid');
    fireEvent.paste(grid, { clipboardData: { getData: () => '5\t=SUM(A1:A2)\n6\t名称' } });
    expect(state.changed).toHaveBeenCalledTimes(1);
    expect(state.current().sheets[0].cells.A2.input).toBe('6');
    expect(screen.getByRole('gridcell', { name: 'B1' })).toHaveTextContent('11');
    const setData = vi.fn();
    fireEvent.copy(grid, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '5\t=SUM(A1:A2)\n6\t名称');
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.A1.input).toBe('3');
    await user.click(screen.getByRole('button', { name: '重做表格修改' }));
    expect(state.current().sheets[0].cells.A1.input).toBe('5');
  });

  it('opens Paste Special for an internal copy, pastes the copied value once and undoes atomically', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].cells.B1 = {
      input: '=SUM(A1:A2)',
      bold: true,
      numberFormat: '0.00',
    };
    initial.sheets[0].cells.C3 = { input: '旧值', background: '#eeeeee' };
    const state = setup({ document: initial });
    const grid = screen.getByRole('grid');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'B1' }), { button: 0 });
    const clipboard = new Map<string, string>();
    fireEvent.copy(grid, {
      clipboardData: { setData: (type: string, value: string) => clipboard.set(type, value) },
    });
    expect(clipboard.has(STUDIO_SHEET_CLIPBOARD_TYPE)).toBe(true);
    expect(screen.getByRole('button', { name: '选择性粘贴' })).toBeEnabled();

    await user.click(screen.getByRole('gridcell', { name: 'C3' }));
    await user.click(screen.getByRole('button', { name: '选择性粘贴' }));
    const dialog = screen.getByRole('dialog', { name: '选择性粘贴' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(10);
    await user.click(within(dialog).getByRole('radio', { name: /仅值/ }));
    await user.click(within(dialog).getByRole('button', { name: '粘贴' }));

    expect(state.current().sheets[0].cells.C3).toEqual({
      input: '7',
      background: '#eeeeee',
    });
    expect(state.changed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '选择性粘贴' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.C3).toEqual({
      input: '旧值',
      background: '#eeeeee',
    });
  });

  it('relocates internally copied formulas and keeps external TSV formulas unchanged', async () => {
    const user = userEvent.setup();
    const state = setup();
    const grid = screen.getByRole('grid');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'B1' }), { button: 0 });
    const clipboard = new Map<string, string>();
    fireEvent.copy(grid, {
      clipboardData: { setData: (type: string, value: string) => clipboard.set(type, value) },
    });
    expect(clipboard.get('text/plain')).toBe('=SUM(A1:A2)');
    expect(clipboard.has(STUDIO_SHEET_CLIPBOARD_TYPE)).toBe(true);
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'C3' }), { button: 0 });
    fireEvent.paste(grid, {
      clipboardData: { getData: (type: string) => clipboard.get(type) ?? '' },
    });
    expect(state.current().sheets[0].cells.C3.input).toBe('=SUM(B3:B4)');
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].cells.C3).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '重做表格修改' }));
    expect(state.current().sheets[0].cells.C3.input).toBe('=SUM(B3:B4)');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'D3' }), { button: 0 });
    fireEvent.paste(grid, {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? '=SUM(A1:A2)' : '') },
    });
    expect(state.current().sheets[0].cells.D3.input).toBe('=SUM(A1:A2)');
  });

  it('deletes an unreferenced active sheet with undo and redo while protecting formulas and the final sheet', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.click(screen.getByRole('button', { name: '删除工作表' }));
    expect(state.current().sheets).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('仍引用');
    await user.click(screen.getByRole('tab', { name: '汇总' }));
    await user.click(screen.getByRole('button', { name: '删除工作表' }));
    expect(state.current().sheets).toHaveLength(1);
    expect(state.current().activeSheetId).toBe('main');
    expect(screen.queryByRole('tab', { name: '汇总' })).toBeNull();
    expect(screen.getByRole('button', { name: '删除工作表' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets).toHaveLength(2);
    expect(screen.getByRole('tab', { name: '汇总' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: '重做表格修改' }));
    expect(state.current().sheets).toHaveLength(1);
  });

  it('inserts and deletes selected rows and columns with pending input, dependent formulas and full undo snapshots', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0] = {
      ...initial.sheets[0],
      rowCount: 12,
      columnCount: 8,
      columnWidths: { B: 120 },
      merges: ['D1:E2'],
      freeze: { rows: 2, columns: 1 },
      charts: [{ id: 'chart', type: 'bar', title: '预算', range: 'A1:B3' }],
    };
    const state = setup({ document: initial });
    const restore = async (action: '撤销' | '重做') => {
      await user.click(screen.getByRole('tab', { name: '开始' }));
      await user.click(screen.getByRole('button', { name: `${action}表格修改` }));
      await user.click(screen.getByRole('tab', { name: '布局' }));
    };
    await user.click(screen.getByRole('tab', { name: '布局' }));
    const formula = screen.getByRole('textbox', { name: '表格公式栏' });
    await user.click(formula);
    await user.clear(formula);
    await user.type(formula, '9');
    expect(state.changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '插入行' }));
    expect(state.current().sheets[0].cells.A2.input).toBe('9');
    expect(state.current().sheets[0].cells.B2.input).toBe('=SUM(A2:A3)');
    expect(state.current().sheets[1].cells.A1.input).toBe("='预算'!B2");
    expect(state.current().sheets[0].merges).toEqual(['D2:E3']);
    expect(state.current().sheets[0].freeze).toEqual({ rows: 3, columns: 1 });
    expect(state.current().sheets[0].structureEdits).toEqual([
      { axis: 'row', type: 'insert', index: 1, count: 1 },
    ]);
    await restore('撤销');
    expect(state.current().sheets[0].cells.A1.input).toBe('9');
    expect(state.current().sheets[0].structureEdits).toBeUndefined();
    await restore('重做');
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'B2:C3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '插入列' }));
    expect(state.current().sheets[0].columnCount).toBe(10);
    expect(state.current().sheets[0].cells.D2.input).toBe('=SUM(A2:A3)');
    expect(state.current().sheets[0].columnWidths).toEqual({ D: 120 });
    expect(state.current().sheets[0].merges).toEqual(['F2:G3']);
    expect(state.current().sheets[0].charts?.[0].range).toBe('A2:D4');
    expect(state.current().sheets[1].cells.A1.input).toBe("='预算'!D2");
    fireEvent.change(address, { target: { value: 'B2:C3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '删除列' }));
    expect(state.current().sheets[0].columnCount).toBe(8);
    expect(state.current().sheets[0].cells.B2.input).toBe('=SUM(A2:A3)');
    expect(state.current().sheets[0].columnWidths).toEqual({ B: 120 });
    fireEvent.change(address, { target: { value: 'A2:A3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '删除行' }));
    expect(state.current().sheets[0].rowCount).toBe(11);
    expect(state.current().sheets[0].cells.A2).toBeUndefined();
    expect(state.current().sheets[0].merges).toBeUndefined();
    expect(state.current().sheets[0].charts).toBeUndefined();
    expect(state.current().sheets[1].cells.A1.input).toBe('=#REF!');
    await restore('撤销');
    expect(state.current().sheets[0].cells.A2.input).toBe('9');
    expect(state.current().sheets[0].merges).toEqual(['D2:E3']);
    expect(state.current().sheets[0].charts?.[0].range).toBe('A2:B4');
    expect(state.current().sheets[0].structureEdits).toHaveLength(3);
    await restore('重做');
    expect(state.current().sheets[1].cells.A1.input).toBe('=#REF!');
  });

  it('rejects out-of-capacity insertion without changing the model', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.click(screen.getByRole('tab', { name: '布局' }));
    await user.click(screen.getByRole('button', { name: '插入行' }));
    expect(state.changed).not.toHaveBeenCalled();
    expect(state.current().sheets[0].rowCount).toBe(10000);
    expect(screen.getByRole('status')).toHaveTextContent('限制');
  });

  it('inserts an automatic sum below the selection and preserves the formula when the formula bar gains focus', async () => {
    const user = userEvent.setup();
    const state = setup();
    const grid = screen.getByRole('grid');
    grid.focus();
    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    await user.click(screen.getByRole('button', { name: 'Σ 自动求和' }));
    const formula = screen.getByRole('textbox', { name: '表格公式栏' });
    expect(formula).toHaveValue('=SUM(A1:A2)');
    await user.keyboard('{Enter}');
    expect(state.current().sheets[0].cells.A3.input).toBe('=SUM(A1:A2)');
    expect(screen.getByRole('gridcell', { name: 'A3' })).toHaveTextContent('7');
  });

  it('commits pending input before a save shortcut reaches the parent workspace', () => {
    let current = documentFixture();
    const saved = vi.fn();
    function Harness() {
      const [document, setDocument] = React.useState(current);
      return (
        <div
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 's') saved(current);
          }}
        >
          <StudioSheet
            document={document}
            onChange={(next) => {
              current = next;
              setDocument(next);
            }}
            disabled={false}
            readOnly={false}
          />
        </div>
      );
    }
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: '表格公式栏' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 's', ctrlKey: true });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][0].sheets[0].cells.A1.input).toBe('99');
  });

  it('keeps the large sheet windowed and navigates to cells beyond the initial viewport', () => {
    const state = setup();
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '10001');
    expect(within(grid).getAllByRole('gridcell').length).toBeLessThan(500);
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'D9800' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    expect(screen.getByRole('gridcell', { name: 'D9800' })).toHaveAttribute('data-active', 'true');
    expect(within(grid).getAllByRole('gridcell').length).toBeLessThan(500);
    expect(state.changed).not.toHaveBeenCalled();
  });

  it('allows viewing other sheets in read-only mode without allowing document mutations', async () => {
    const user = userEvent.setup();
    const state = setup({ readOnly: true });
    const grid = screen.getByRole('grid');
    fireEvent.doubleClick(screen.getByRole('gridcell', { name: 'A1' }));
    expect(screen.queryByRole('textbox', { name: '编辑 A1' })).toBeNull();
    fireEvent.keyDown(grid, { key: 'Delete' });
    fireEvent.paste(grid, { clipboardData: { getData: () => '坏数据' } });
    expect(screen.getByRole('button', { name: '表格加粗' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '表格公式栏' })).toHaveAttribute('readonly');
    await user.click(screen.getByRole('tab', { name: '布局' }));
    for (const name of ['插入行', '删除行', '插入列', '删除列'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: '汇总' }));
    expect(screen.getByRole('grid', { name: '汇总 单元格网格' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'A1' })).toHaveTextContent('7');
    expect(state.changed).not.toHaveBeenCalled();
  });

  it('adds and renames a worksheet and updates dependent formula references', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.dblClick(screen.getByRole('tab', { name: '预算' }));
    const name = screen.getByRole('textbox', { name: '工作表新名称' });
    await user.clear(name);
    await user.type(name, '预算新版');
    await user.click(screen.getByRole('button', { name: '确认名称' }));
    expect(state.current().sheets[1].cells.A1.input).toBe("='预算新版'!B1");
    await user.click(screen.getByRole('button', { name: '新增工作表' }));
    expect(state.current().sheets).toHaveLength(3);
    expect(screen.getByRole('grid', { name: 'Sheet3 单元格网格' })).toBeInTheDocument();
    expect(state.current().activeSheetId).toBe(state.current().sheets[2].id);
  });

  it('prevents destructive merges, merges empty descendants with editable master, and splits via the same toolbar', async () => {
    const user = userEvent.setup();
    const state = setup();
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:B2' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '合并单元格' }));
    expect(state.changed).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('覆盖');
    fireEvent.change(address, { target: { value: 'C1:E2' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '合并单元格' }));
    expect(state.current().sheets[0].merges).toEqual(['C1:E2']);
    expect(screen.getByRole('gridcell', { name: 'C1' })).toHaveAttribute('aria-colspan', '3');
    expect(screen.getByRole('gridcell', { name: 'C1' })).toHaveAttribute('aria-rowspan', '2');
    expect(screen.queryByRole('gridcell', { name: 'D1' })).toBeNull();
    const formula = screen.getByRole('textbox', { name: '表格公式栏' });
    await user.click(formula);
    await user.type(formula, '合并内容{Enter}');
    expect(state.current().sheets[0].cells.C1.input).toBe('合并内容');
    fireEvent.pointerDown(screen.getByRole('gridcell', { name: 'C1' }), { button: 0 });
    await user.click(screen.getByRole('button', { name: '拆分单元格' }));
    expect(state.current().sheets[0].merges).toEqual([]);
    expect(screen.getByRole('gridcell', { name: 'C1' })).toHaveTextContent('合并内容');
    expect(screen.getByRole('gridcell', { name: 'D1' })).toBeInTheDocument();
  });

  it('keeps frozen rows and columns mounted and pinned after the virtual viewport scrolls', async () => {
    const user = userEvent.setup();
    const state = setup();
    await user.click(screen.getByRole('tab', { name: '视图' }));
    await user.click(screen.getByRole('button', { name: '冻结首行' }));
    await user.click(screen.getByRole('button', { name: '冻结首列' }));
    expect(state.current().sheets[0].freeze).toEqual({ rows: 1, columns: 1 });
    const grid = screen.getByRole('grid');
    grid.scrollTop = 1500;
    grid.scrollLeft = 400;
    fireEvent.scroll(grid);
    const cell = screen.getByRole('gridcell', { name: 'A1' });
    expect(cell).toHaveAttribute('data-frozen', 'true');
    expect(cell).toHaveStyle({ left: '440px' });
    expect(cell.parentElement).toHaveStyle({ top: '1524px' });
    expect(within(grid).getAllByRole('gridcell').length).toBeLessThan(500);
    await user.click(screen.getByRole('button', { name: '取消冻结' }));
    expect(state.current().sheets[0].freeze).toEqual({ rows: 0, columns: 0 });
  });

  it('freezes only visible rows inside the actual freeze boundary when filtering hides earlier rows', () => {
    const initial = documentFixture();
    initial.sheets[0].freeze = { rows: 2, columns: 0 };
    initial.sheets[0].filter = {
      range: 'A1:A3',
      columns: { A: { operator: 'equals', value: '3' } },
    };
    setup({ document: initial });
    expect(screen.queryByRole('gridcell', { name: 'A2' })).toBeNull();
    expect(screen.queryByRole('gridcell', { name: 'A3' })).toBeNull();
    expect(screen.getByRole('gridcell', { name: 'A1' }).parentElement).toHaveAttribute(
      'data-frozen',
      'true'
    );
    expect(screen.getByRole('gridcell', { name: 'A4' }).parentElement).not.toHaveAttribute(
      'data-frozen'
    );
    const grid = screen.getByRole('grid');
    grid.scrollTop = 1500;
    fireEvent.scroll(grid);
    expect(screen.getByRole('gridcell', { name: 'A1' })).toBeInTheDocument();
    expect(screen.queryByRole('gridcell', { name: 'A4' })).toBeNull();
  });

  it('sorts data with formulas, filters rows without deletion, and creates an editable chart from the same cells', async () => {
    const user = userEvent.setup();
    const document = documentFixture();
    document.sheets[0].cells = {
      A1: { input: '项目' },
      B1: { input: '金额' },
      C1: { input: '小计' },
      A2: { input: '开发' },
      B2: { input: '20' },
      C2: { input: '=B2*2' },
      A3: { input: '设计' },
      B3: { input: '10' },
      C3: { input: '=B3*2' },
      A4: { input: '验证' },
      B4: { input: '30' },
      C4: { input: '=B4*2' },
    };
    const state = setup({ document });
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:C4' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('tab', { name: '数据' }));
    await user.click(screen.getByRole('button', { name: '升序排序' }));
    expect(state.current().sheets[0].cells.A2.input).toBe('设计');
    expect(state.current().sheets[0].cells.C2.input).toBe('=B2*2');
    await user.type(screen.getByRole('textbox', { name: '筛选区域' }), 'A1:C4');
    await user.type(screen.getByRole('textbox', { name: '筛选值' }), '开');
    await user.click(screen.getByRole('button', { name: '应用筛选' }));
    expect(screen.queryByRole('gridcell', { name: 'A2' })).toBeNull();
    expect(screen.getByRole('gridcell', { name: 'A3' })).toHaveTextContent('开发');
    expect(state.current().sheets[0].cells.A2.input).toBe('设计');
    await user.click(screen.getByRole('tab', { name: '插入' }));
    await user.type(screen.getByRole('textbox', { name: '图表数据区域' }), 'A1:C4');
    await user.click(screen.getByRole('button', { name: '柱状图' }));
    expect(state.current().sheets[0].charts).toHaveLength(1);
    expect(screen.getByRole('img', { name: '柱状图 柱状图' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', {
      name: `图表标题 ${state.current().sheets[0].charts![0].id}`,
    });
    await user.clear(title);
    await user.type(title, '预算图表');
    expect(state.current().sheets[0].charts![0].title).toBe('预算图表');
    expect(screen.getByRole('img', { name: '预算图表 柱状图' })).toBeInTheDocument();
    const chartData = screen.getByRole('button', { name: '查看图表数据' });
    expect(chartData).toHaveAttribute('aria-expanded', 'false');
    await user.click(chartData);
    expect(chartData).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table', { name: '预算图表 数据' })).toHaveTextContent('开发');
    await user.click(screen.getByRole('button', { name: '切换为折线图' }));
    expect(state.current().sheets[0].charts![0].type).toBe('line');
    state.setPermissions({ readOnly: true });
    expect(title).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '删除图表 预算图表' })).toBeDisabled();
  });
});

describe('StudioSheet row sizes and font drafts', () => {
  it('uses imported fractional heights, hidden rows and merged spans in frozen and scrolled viewports', () => {
    const initial = documentFixture();
    initial.sheets[0].rowHeights = { '1': 30.75, '2': 80, '3': 30, '4': 300 };
    initial.sheets[0].hiddenRows = [2];
    initial.sheets[0].merges = ['A1:A3'];
    initial.sheets[0].cells.A2 = { input: '' };
    initial.sheets[0].freeze = { rows: 3, columns: 1 };
    setup({ document: initial });
    expect(screen.queryByRole('row', { name: /^2 / })).toBeNull();
    const merged = screen.getByRole('gridcell', { name: 'A1' });
    expect(merged).toHaveStyle({ height: '81px' });
    const tall = screen.getByRole('gridcell', { name: 'A4' });
    expect(tall).toHaveStyle({ height: '400px' });
    expect(tall.parentElement).toHaveStyle({ top: '105px', height: '400px' });
    const grid = screen.getByRole('grid');
    grid.scrollTop = 200;
    fireEvent.scroll(grid);
    expect(screen.getByRole('gridcell', { name: 'A1' }).parentElement).toHaveStyle({
      top: '224px',
    });
    expect(screen.getByRole('gridcell', { name: 'A4' })).toHaveStyle({ height: '400px' });
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
  });

  it('sets selected row heights, rejects malformed input, hides with zero and restores dimensions with undo', async () => {
    const user = userEvent.setup();
    const state = setup();
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:A3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '行高' }));
    const input = screen.getByRole('textbox', { name: '行高（磅）' });
    await user.clear(input);
    await user.type(input, '410');
    await user.click(screen.getByRole('button', { name: '确定行高' }));
    expect(screen.getByRole('alert')).toHaveTextContent('0–409.5');
    expect(state.changed).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '30,75{Enter}');
    expect(state.current().sheets[0].rowHeights).toEqual({ 1: 30.75, 2: 30.75, 3: 30.75 });
    expect(screen.getByRole('gridcell', { name: 'A2' }).parentElement).toHaveStyle({ top: '65px' });
    await user.click(screen.getByRole('button', { name: '行高' }));
    const hide = screen.getByRole('textbox', { name: '行高（磅）' });
    await user.clear(hide);
    await user.type(hide, '0');
    // Initial dialog focus runs on the next frame and must preserve the input.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(hide).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(state.current().sheets[0].hiddenRows).toEqual([1, 2, 3]);
    expect(screen.getByRole('button', { name: /^行高$/ })).toHaveFocus();
    expect(screen.queryByRole('gridcell', { name: 'A1' })).toBeNull();
    expect(screen.getByRole('gridcell', { name: 'A4' })).toHaveAttribute('data-active', 'true');
    await user.click(screen.getByRole('button', { name: '撤销表格修改' }));
    expect(state.current().sheets[0].hiddenRows).toEqual([]);
    expect(state.current().sheets[0].rowHeights?.['1']).toBe(30.75);
    fireEvent.change(address, { target: { value: 'A1:A3' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '恢复默认行高' }));
    expect(state.current().sheets[0].rowHeights).toEqual({});
    expect(screen.getByRole('gridcell', { name: 'A3' })).toHaveStyle({ height: '24px' });
  });

  it('fits large wrapped fonts and multiline text while excluding multi-row merged content', async () => {
    const user = userEvent.setup();
    const initial = documentFixture();
    initial.sheets[0].cells = {
      A1: { input: '长文字长文字长文字', fontSize: 36, wrap: true },
      A2: { input: '第一行\n第二行\n第三行' },
      A3: { input: '跨行合并', fontSize: 100 },
    };
    initial.sheets[0].merges = ['A3:A4'];
    const state = setup({ document: initial });
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:A4' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    await user.click(screen.getByRole('button', { name: '自动调整行高' }));
    const heights = state.current().sheets[0].rowHeights!;
    expect(heights['1']).toBeGreaterThan(heights['2']);
    expect(heights['2']).toBeGreaterThan(18);
    expect(heights['3']).toBe(18);
    expect(heights['4']).toBe(18);
    expect(state.changed).toHaveBeenCalledTimes(1);
    state.setPermissions({ readOnly: true });
    for (const name of ['行高', '自动调整行高', '恢复默认行高'])
      expect(screen.getByRole('button', { name })).toBeDisabled();
  });

  it('applies a typed decimal font size to the retained selected range, then cancels a draft without editing it', async () => {
    const user = userEvent.setup();
    const state = setup();
    const address = screen.getByRole('textbox', { name: '单元格地址' });
    fireEvent.change(address, { target: { value: 'A1:B2' } });
    fireEvent.keyDown(address, { key: 'Enter' });
    const size = screen.getByRole('combobox', { name: '表格字号' });
    await user.click(size);
    await user.clear(size);
    await user.type(size, '17,25pt{Enter}');
    expect(screen.getByRole('grid')).toHaveFocus();
    for (const address of ['A1', 'A2', 'B1', 'B2'])
      expect(state.current().sheets[0].cells[address].fontSize).toBe(17.25);
    await user.click(size);
    await user.clear(size);
    await user.type(size, '99{Escape}');
    expect(size).toHaveValue('17.25');
    expect(state.changed).toHaveBeenCalledTimes(1);
  });
});
