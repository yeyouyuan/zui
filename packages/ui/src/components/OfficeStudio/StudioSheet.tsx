'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Plus, Trash } from '@zui/icons';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { Tabs } from '../Tabs';
import { ColorPicker } from '../ColorPicker';
import { Collapse } from '../Collapse';
import { Table } from '../Table';
import { Modal } from '../Modal';
import { StudioFontControl } from './StudioFontControl';
import { StudioSheetSearch } from './StudioSheetSearch';
import { studioCellBordersCss } from './studio-cell-style';
import {
  studioApplyBorders,
  studioColumnCharacterWidth,
  studioColumnPixelWidth,
  studioDefaultCellFormat,
  studioFormattingSelection,
  studioReplaceSheetCells,
  studioSetColumnWidths,
  type StudioSheetSearchOptions,
  type StudioSheetMatch,
} from './studio-sheet-editing';
import {
  STUDIO_MAX_ROW_HEIGHT,
  STUDIO_POINTS_TO_PIXELS,
  studioBuildRowLayout,
  studioViewportRows,
  studioRowTop,
  studioRowSpanHeight,
  studioFitRowHeight,
  type StudioRowFitCell,
} from './studio-sheet-layout';
import {
  STUDIO_SHEET_LIMITS,
  STUDIO_SHEET_CLIPBOARD_TYPE,
  studioCalculate,
  studioAddChart,
  studioChartData,
  studioCellAddress,
  studioColumnLabel,
  studioCopyTsv,
  studioCopySheetClipboard,
  studioClipboardOrigin,
  studioDisplayCell,
  studioInputValue,
  studioHiddenRows,
  studioMergeCells,
  studioMergedRange,
  studioParseAddress,
  studioParseRange,
  studioParseTsv,
  studioPasteCells,
  studioPatchCells,
  studioRenameSheet,
  studioDeleteSheet,
  studioSelectionAddresses,
  studioSelectionBounds,
  studioRangeAddress,
  studioSetFilter,
  studioSetFreeze,
  studioSetRowHeight,
  studioSortRange,
} from './studio-sheet-model';
import { studioChangeSheetStructure } from './studio-sheet-structure';
import {
  studioCellValidation,
  studioConditionalCellStyle,
  studioRemoveConditionalFormat,
  studioRemoveDataValidation,
  studioSetConditionalFormat,
  studioSetDataValidation,
} from './studio-sheet-rules';
import { studioFillCells, studioFillSeries } from './studio-sheet-fill';
import { StudioSheetRuleDialog } from './StudioSheetRuleDialog';
import { StudioRibbonTabs } from './StudioRibbon';
import { StudioSheetHyperlinkDialog } from './StudioSheetHyperlinkDialog';
import type { SheetHyperlinkDialogState } from './StudioSheetHyperlinkDialog';
import {
  studioCellHyperlink,
  studioRemoveSheetHyperlinks,
  studioResolveSheetHyperlink,
  studioSetSheetHyperlink,
} from './studio-sheet-hyperlinks';
import type { SheetRuleDialogMode } from './StudioSheetRuleDialog';
import type {
  SheetPosition,
  SheetSelection,
  StudioSheetClipboardOrigin,
  StudioSheetPasteMode,
} from './studio-sheet-model';
import type {
  StudioCell,
  StudioEditorProps,
  StudioExcelDocument,
  StudioSheetChart,
  StudioSheetFilter,
  StudioSheetStructureEdit,
} from './studio-types';
import './StudioSheet.css';

const HEADER_HEIGHT = 24;
const ROW_HEADER_WIDTH = 40;
const INITIAL_SELECTION: SheetSelection = { anchor: { row: 1, col: 1 }, focus: { row: 1, col: 1 } };
const DEFAULT_FONT = 'Calibri';
const DEFAULT_FONT_SIZE = 11;
const fontOptions = [
  'Calibri',
  'Arial',
  'Aptos',
  'Times New Roman',
  'Courier New',
  'Noto Sans SC',
  '宋体',
  '微软雅黑',
  '等线',
].map((value) => ({ value, label: value }));
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72, 96];
const fontSizeOptions = fontSizes.map((size) => ({ value: String(size), label: String(size) }));
const alignments = [
  { value: 'left', label: '左对齐', Icon: AlignLeft },
  { value: 'center', label: '居中对齐', Icon: AlignCenter },
  { value: 'right', label: '右对齐', Icon: AlignRight },
] as const;

function quotedFontFamily(value: string) {
  return `"${value
    .replace(/[\\"]/g, '\\$&')
    .replace(/[\t\n\r]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`;
}

const formats = [
  { value: 'General', label: '常规' },
  { value: '0.00', label: '数字 · 2 位小数' },
  { value: '#,##0.00', label: '千位分隔' },
  { value: '0.00%', label: '百分比' },
  { value: '¥#,##0.00', label: '人民币' },
  { value: 'yyyy-mm-dd', label: '日期' },
  { value: '@', label: '文本' },
];

const pasteModes: Array<{
  value: StudioSheetPasteMode;
  label: string;
  description: string;
}> = [
  { value: 'all', label: '全部', description: '粘贴内容、公式、格式、链接和合并单元格。' },
  { value: 'formulas', label: '仅公式', description: '粘贴公式和常量，不改变目标格式。' },
  { value: 'values', label: '仅值', description: '使用复制时已经计算好的值。' },
  { value: 'formats', label: '仅格式', description: '保留目标内容，替换格式和合并状态。' },
  {
    value: 'formulas-number-format',
    label: '公式与数字格式',
    description: '粘贴公式、常量和数字格式。',
  },
  {
    value: 'values-number-format',
    label: '值与数字格式',
    description: '粘贴复制时的值和数字格式。',
  },
  {
    value: 'source-formatting',
    label: '保留源格式',
    description: '粘贴全部内容并保留复制区域格式。',
  },
  {
    value: 'without-borders',
    label: '除边框外全部',
    description: '粘贴全部内容和格式，保留目标边框。',
  },
  { value: 'column-widths', label: '仅列宽', description: '只把源列宽应用到目标列。' },
  {
    value: 'transpose',
    label: '转置',
    description: '互换行列后粘贴内容、格式、链接和合并单元格。',
  },
];

interface CellEditing {
  sheetId: string;
  address: string;
  value: string;
  origin: 'cell' | 'formula';
}

export function StudioSheet({
  document,
  onChange,
  disabled,
  readOnly,
}: StudioEditorProps<StudioExcelDocument>) {
  const [activeId, setActiveId] = React.useState(document.activeSheetId);
  const [selection, setSelection] = React.useState<SheetSelection>(INITIAL_SELECTION);
  const [editing, setEditing] = React.useState<CellEditing | null>(null);
  const [ribbon, setRibbon] = React.useState('home');
  const [notice, setNotice] = React.useState('双击或直接输入编辑，Shift + 方向键选择区域。');
  const [historyVersion, setHistoryVersion] = React.useState(0);
  const [rename, setRename] = React.useState<string | null>(null);
  const [addressDraft, setAddressDraft] = React.useState('A1');
  const [viewport, setViewport] = React.useState({ top: 0, left: 0, width: 900, height: 420 });
  const [filterRange, setFilterRange] = React.useState('');
  const [filterColumn, setFilterColumn] = React.useState('A');
  const [filterOperator, setFilterOperator] = React.useState<
    'contains' | 'equals' | 'greater' | 'less'
  >('contains');
  const [filterValue, setFilterValue] = React.useState('');
  const [chartRange, setChartRange] = React.useState('');
  const [chartPanel, setChartPanel] = React.useState(false);
  const [selectedChart, setSelectedChart] = React.useState('');
  const [pasteDialog, setPasteDialog] = React.useState(false);
  const [pasteMode, setPasteMode] = React.useState<StudioSheetPasteMode>('all');
  const [pasteAvailable, setPasteAvailable] = React.useState(false);
  const [ruleDialog, setRuleDialog] = React.useState<SheetRuleDialogMode | null>(null);
  const [linkDialog, setLinkDialog] = React.useState<SheetHyperlinkDialogState | null>(null);
  const [heightDialog, setHeightDialog] = React.useState<{
    firstRow: number;
    lastRow: number;
  } | null>(null);
  const [heightDraft, setHeightDraft] = React.useState('18');
  const [heightError, setHeightError] = React.useState('');
  const [widthDialog, setWidthDialog] = React.useState<{
    firstCol: number;
    lastCol: number;
  } | null>(null);
  const [widthDraft, setWidthDraft] = React.useState('');
  const [widthError, setWidthError] = React.useState('');
  const [widthPreview, setWidthPreview] = React.useState<{
    sheetId: string;
    col: number;
    width: number;
  } | null>(null);
  const [heightPreview, setHeightPreview] = React.useState<{
    sheetId: string;
    row: number;
    height: number;
  } | null>(null);
  const [search, setSearch] = React.useState<{
    mode: 'find' | 'replace';
    snapshot: { sheetId: string; selection: SheetSelection };
  } | null>(null);
  const [searchFocusVersion, setSearchFocusVersion] = React.useState(0);
  const [searchReveal, setSearchReveal] = React.useState<{ sheetId: string; row: number } | null>(
    null
  );
  const [borderStyle, setBorderStyle] = React.useState<
    'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed'
  >('thin');
  const [borderColor, setBorderColor] = React.useState('#000000');
  const resizeCleanup = React.useRef<(() => void) | null>(null);
  const permissionRef = React.useRef(false);
  const [viewExtents, setViewExtents] = React.useState<Record<string, SheetPosition>>({});
  const pendingNavigation = React.useRef<{ sheetId: string; position: SheetPosition } | null>(null);
  const [inputError, setInputError] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const cellInputRef = React.useRef<HTMLInputElement>(null);
  const formulaRef = React.useRef<HTMLInputElement>(null);
  const editingRef = React.useRef<CellEditing | null>(null);
  const latestRef = React.useRef(document);
  const expectedRef = React.useRef(document);
  const lastIdRef = React.useRef(document.id);
  const pastRef = React.useRef<StudioExcelDocument[]>([]);
  const futureRef = React.useRef<StudioExcelDocument[]>([]);
  const clipboardRef = React.useRef<{
    text: string;
    payload: string;
    source: StudioSheetClipboardOrigin;
  } | null>(null);
  const draggingRef = React.useRef(false);
  const gridId = React.useId();
  const blocked = disabled || readOnly;
  permissionRef.current = !!blocked;
  latestRef.current = document;
  const sheet = document.sheets.find((item) => item.id === activeId) ?? document.sheets[0];
  const extent = sheet ? viewExtents[sheet.id] : undefined;
  const rowCount = Math.min(
    STUDIO_SHEET_LIMITS.rows,
    Math.max(1, sheet?.rowCount ?? 1, extent?.row ?? 1)
  );
  const columnCount = Math.min(
    STUDIO_SHEET_LIMITS.columns,
    Math.max(1, sheet?.columnCount ?? 1, extent?.col ?? 1)
  );
  const address = studioCellAddress(selection.focus.row, selection.focus.col);
  const cell = sheet?.cells[address];
  const calculated = React.useMemo(() => studioCalculate(document), [document]);
  const activeLink = sheet
    ? studioCellHyperlink(document, sheet.id, address, calculated)
    : undefined;
  const nativeLink = activeLink && sheet?.hyperlinks?.includes(activeLink) ? activeLink : undefined;
  const activeValidation = sheet ? studioCellValidation(sheet, address, calculated) : undefined;
  const hiddenRows = React.useMemo(() => {
    const hidden = new Set(sheet ? studioHiddenRows(sheet, calculated) : []);
    if (searchReveal?.sheetId === sheet?.id) hidden.delete(searchReveal!.row);
    return hidden;
  }, [calculated, sheet, searchReveal]);
  const shownRows = React.useMemo(
    () =>
      Array.from({ length: rowCount }, (_, index) => index + 1).filter(
        (row) => !hiddenRows.has(row)
      ),
    [hiddenRows, rowCount]
  );
  const rowLayout = React.useMemo(
    () =>
      studioBuildRowLayout(
        shownRows,
        heightPreview?.sheetId === sheet?.id
          ? { ...sheet?.rowHeights, [String(heightPreview.row)]: heightPreview.height }
          : sheet?.rowHeights,
        sheet?.defaultRowHeight
      ),
    [heightPreview, shownRows, sheet?.id, sheet?.rowHeights, sheet?.defaultRowHeight]
  );
  const rowIndexes = rowLayout.indexes;
  const freezeRows = shownRows.filter((row) => row <= (sheet?.freeze?.rows ?? 0)).length;
  const freezeColumns = sheet?.freeze?.columns ?? 0;
  const bounds = studioSelectionBounds(selection);
  const count = (bounds.lastRow - bounds.firstRow + 1) * (bounds.lastCol - bounds.firstCol + 1);
  const offsets = React.useMemo(() => {
    const values = [ROW_HEADER_WIDTH];
    for (let col = 1; col <= columnCount; col++)
      values.push(
        values[col - 1] +
          Math.max(
            12,
            Math.min(
              4000,
              widthPreview?.sheetId === sheet?.id && widthPreview.col === col
                ? widthPreview.width
                : (sheet?.columnWidths?.[studioColumnLabel(col)] ?? 112)
            )
          )
      );
    return values;
  }, [columnCount, sheet?.columnWidths, sheet?.id, widthPreview]);
  const visibleRows = studioViewportRows(
    rowLayout,
    viewport.top,
    viewport.height,
    freezeRows,
    HEADER_HEIGHT
  );
  // A merged origin can be above the viewport while the merged box is still visible.
  for (const input of sheet?.merges ?? []) {
    const range = studioParseRange(input);
    if (
      range &&
      visibleRows.some((row) => row >= range.firstRow && row <= range.lastRow) &&
      !visibleRows.includes(range.firstRow)
    )
      visibleRows.push(range.firstRow);
  }
  const visibleColumns: number[] = [];
  for (let col = 1; col <= columnCount; col++) {
    if (
      col <= freezeColumns ||
      (offsets[col] >= viewport.left - 120 &&
        offsets[col - 1] <= viewport.left + viewport.width + 120)
    )
      visibleColumns.push(col);
  }
  for (const input of sheet?.merges ?? []) {
    const range = studioParseRange(input);
    if (
      range &&
      visibleColumns.some((col) => col >= range.firstCol && col <= range.lastCol) &&
      !visibleColumns.includes(range.firstCol)
    )
      visibleColumns.push(range.firstCol);
  }
  const activeVisible =
    visibleRows.includes(selection.focus.row) && visibleColumns.includes(selection.focus.col);
  const ensureVisible = React.useCallback(
    (position: SheetPosition) => {
      const grid = gridRef.current;
      if (!grid) return;
      const rowIndex = rowIndexes.get(position.row);
      if (rowIndex === undefined) return;
      const top = rowLayout.offsets[rowIndex] + HEADER_HEIGHT;
      const bottom = rowLayout.offsets[rowIndex + 1] + HEADER_HEIGHT;
      const left = offsets[position.col - 1];
      const right = offsets[position.col];
      const height = grid.clientHeight || viewport.height;
      const width = grid.clientWidth || viewport.width;
      if (rowIndex >= freezeRows) {
        const frozenHeight = rowLayout.offsets[freezeRows];
        const usableHeight = height - HEADER_HEIGHT - frozenHeight;
        if (top < grid.scrollTop + HEADER_HEIGHT + frozenHeight || bottom - top > usableHeight)
          grid.scrollTop = Math.max(0, top - HEADER_HEIGHT - frozenHeight);
        else if (bottom > grid.scrollTop + height) grid.scrollTop = bottom - height;
      }
      if (position.col > freezeColumns && left < grid.scrollLeft + offsets[freezeColumns])
        grid.scrollLeft = Math.max(0, left - offsets[freezeColumns]);
      if (right > grid.scrollLeft + width) grid.scrollLeft = right - width;
      setViewport({ top: grid.scrollTop, left: grid.scrollLeft, width, height });
    },
    [freezeColumns, freezeRows, offsets, rowLayout, rowIndexes, viewport.height, viewport.width]
  );

  React.useEffect(() => {
    if (document !== expectedRef.current) {
      pastRef.current = [];
      futureRef.current = [];
      setHistoryVersion((version) => version + 1);
    }
    if (document.id !== lastIdRef.current) {
      lastIdRef.current = document.id;
      setActiveId(document.activeSheetId);
      setSelection(INITIAL_SELECTION);
      setAddressDraft('A1');
      setEditing(null);
      editingRef.current = null;
      setRename(null);
      setChartPanel(false);
      setSelectedChart('');
      setRuleDialog(null);
      setLinkDialog(null);
      setSearch(null);
      setSearchReveal(null);
      resizeCleanup.current?.();
      setViewExtents({});
      pendingNavigation.current = null;
      setInputError(null);
      if (gridRef.current) {
        gridRef.current.scrollTop = 0;
        gridRef.current.scrollLeft = 0;
      }
    }
    expectedRef.current = document;
  }, [document]);

  React.useEffect(() => {
    setFilterRange(sheet?.filter?.range ?? '');
  }, [sheet?.id, sheet?.filter?.range]);

  React.useEffect(() => {
    setChartRange('');
    setFilterColumn('A');
    setFilterValue('');
    setSelectedChart('');
    setRuleDialog(null);
    setLinkDialog(null);
    setHeightDialog(null);
    setWidthDialog(null);
  }, [sheet?.id]);

  React.useEffect(() => () => resizeCleanup.current?.(), []);

  React.useEffect(() => {
    if (
      searchReveal &&
      (!search || searchReveal.sheetId !== sheet?.id || searchReveal.row !== selection.focus.row)
    )
      setSearchReveal(null);
  }, [search, searchReveal, sheet?.id, selection.focus.row]);

  React.useEffect(() => {
    const destination = pendingNavigation.current;
    if (!destination || destination.sheetId !== sheet?.id) return;
    ensureVisible(destination.position);
    gridRef.current?.focus();
    pendingNavigation.current = null;
  }, [sheet?.id, rowCount, columnCount, selection, ensureVisible]);

  React.useEffect(() => {
    if (hiddenRows.has(selection.focus.row)) {
      const nextRow = shownRows.find((row) => row >= selection.focus.row) ?? shownRows[0];
      if (nextRow === undefined) return;
      const position = {
        row: nextRow,
        col: selection.focus.col,
      };
      setSelection({ anchor: position, focus: position });
    }
  }, [hiddenRows, shownRows, selection.focus.row, selection.focus.col]);

  React.useEffect(() => {
    if (blocked) {
      setRename(null);
      return;
    }
    const current = editingRef.current;
    if (!current) return;
    const position = studioParseAddress(current.address);
    setActiveId(current.sheetId);
    if (position) setSelection({ anchor: position, focus: position });
  }, [blocked]);

  React.useEffect(() => {
    setAddressDraft(address);
  }, [address]);

  React.useEffect(() => {
    setSelection((current) => {
      const constrain = (position: SheetPosition) => ({
        row: Math.min(rowCount, position.row),
        col: Math.min(columnCount, position.col),
      });
      const anchor = constrain(current.anchor);
      const focus = constrain(current.focus);
      return anchor.row === current.anchor.row &&
        anchor.col === current.anchor.col &&
        focus.row === current.focus.row &&
        focus.col === current.focus.col
        ? current
        : { anchor, focus };
    });
  }, [rowCount, columnCount, sheet?.id]);

  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () =>
      setViewport({
        top: grid.scrollTop,
        left: grid.scrollLeft,
        width: grid.clientWidth || 900,
        height: grid.clientHeight || 420,
      });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const finishDrag = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, []);

  React.useEffect(() => {
    if (
      blocked ||
      !editing?.address ||
      editing.sheetId !== sheet?.id ||
      editing.address !== address
    )
      return;
    const position = studioParseAddress(editing.address);
    if (position) ensureVisible(position);
    const input = editing.origin === 'cell' ? cellInputRef.current : formulaRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [
    activeVisible,
    address,
    blocked,
    editing?.address,
    editing?.origin,
    editing?.sheetId,
    ensureVisible,
    sheet?.id,
  ]);

  function replaceDocument(next: StudioExcelDocument, addHistory = true) {
    if (blocked || next === latestRef.current) return;
    if (addHistory) {
      pastRef.current = [...pastRef.current.slice(-39), latestRef.current];
      futureRef.current = [];
    }
    latestRef.current = next;
    expectedRef.current = next;
    onChange(next);
    setHistoryVersion((version) => version + 1);
  }

  function validationNotice(
    next: StudioExcelDocument,
    sheetId: string,
    addresses: Iterable<string>,
    success: string
  ) {
    const nextSheet = next.sheets.find((item) => item.id === sheetId);
    if (!nextSheet?.dataValidations?.length) return success;
    const calculation = next === document ? calculated : studioCalculate(next);
    let invalid = 0;
    let firstMessage = '';
    for (const address of new Set(addresses)) {
      const result = studioCellValidation(nextSheet, address, calculation);
      if (!result || result.valid || result.blocking || result.rule.showErrorMessage === false)
        continue;
      invalid++;
      if (!firstMessage) firstMessage = `${result.address}：${result.message}`;
    }
    return invalid ? `${success} ${invalid} 个单元格不符合数据验证；${firstMessage}` : success;
  }

  function fillAddresses(direction: 'down' | 'right', seedCount = 1) {
    return studioSelectionAddresses(selection).filter((address) => {
      const position = studioParseAddress(address)!;
      return direction === 'down'
        ? position.row >= bounds.firstRow + seedCount
        : position.col >= bounds.firstCol + seedCount;
    });
  }

  function patch(updates: Record<string, Partial<StudioCell>>, success = '已更新单元格。') {
    if (blocked || !sheet) return false;
    try {
      const next = studioPatchCells(latestRef.current, sheet.id, updates);
      const message = validationNotice(
        next,
        sheet.id,
        Object.keys(updates).filter(
          (address) => updates[address].input !== undefined || 'numberFormat' in updates[address]
        ),
        success
      );
      replaceDocument(next);
      setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '单元格修改失败。');
      return false;
    }
  }

  function moveSelection(rowDelta: number, colDelta: number, extend = false) {
    const merge = sheet && studioMergedRange(sheet, selection.focus);
    const rowIndex =
      rowIndexes.get(rowDelta > 0 && merge && !extend ? merge.lastRow : selection.focus.row) ?? 0;
    const position = {
      row: rowDelta
        ? shownRows[Math.max(0, Math.min(shownRows.length - 1, rowIndex + rowDelta))]
        : selection.focus.row,
      col: Math.max(1, Math.min(columnCount, selection.focus.col + colDelta)),
    };
    if (colDelta > 0 && merge && !extend)
      position.col = Math.min(columnCount, merge.lastCol + colDelta);
    const destination = sheet && studioMergedRange(sheet, position);
    if (destination && !extend) {
      position.row = destination.firstRow;
      position.col = destination.firstCol;
    }
    setSelection({ anchor: extend ? selection.anchor : position, focus: position });
    ensureVisible(position);
  }

  function setEdit(next: CellEditing | null) {
    editingRef.current = next;
    setEditing(next);
    if (!next) setInputError(null);
  }

  function commitEditing(focusGrid = false) {
    const current = editingRef.current;
    if (blocked || !current) return true;
    try {
      const next = studioPatchCells(latestRef.current, current.sheetId, {
        [current.address]: { input: current.value },
      });
      const message = validationNotice(next, current.sheetId, [current.address], '已更新单元格。');
      replaceDocument(next);
      setEdit(null);
      setNotice(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '单元格修改失败。';
      setInputError(message);
      setNotice(message);
      return false;
    }
    if (focusGrid) gridRef.current?.focus();
    return true;
  }

  function beginEditing(origin: CellEditing['origin'], value?: string, targetAddress = address) {
    if (blocked || !sheet) return;
    setEdit({
      sheetId: sheet.id,
      address: targetAddress,
      value:
        value ??
        (editingRef.current?.sheetId === sheet.id && editingRef.current.address === targetAddress
          ? editingRef.current.value
          : sheet.cells[targetAddress]?.input) ??
        '',
      origin,
    });
  }

  function selectCell(position: SheetPosition, extend = false) {
    if (disabled || !commitEditing()) return false;
    const merge = sheet && studioMergedRange(sheet, position);
    if (merge && !extend) position = { row: merge.firstRow, col: merge.firstCol };
    setSelection({ anchor: extend ? selection.anchor : position, focus: position });
    gridRef.current?.focus();
    return true;
  }

  function formatSelection(update: Partial<StudioCell>) {
    if (blocked || !commitEditing()) return false;
    try {
      const updates = Object.fromEntries(
        studioSelectionAddresses(
          'input' in update || !sheet ? selection : studioFormattingSelection(sheet, selection)
        ).map((item) => [item, update])
      );
      return patch(updates, `已设置 ${count} 个单元格的格式。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '格式设置失败。');
      return false;
    }
  }

  function rowHeightDocument(lastRow: number) {
    const current = latestRef.current;
    return {
      ...current,
      sheets: current.sheets.map((item) =>
        item.id === sheet?.id && item.rowCount < lastRow ? { ...item, rowCount: lastRow } : item
      ),
    };
  }

  function openRowHeight() {
    if (blocked || !sheet || !commitEditing()) return;
    setHeightDraft(
      String(sheet.rowHeights?.[String(bounds.firstRow)] ?? sheet.defaultRowHeight ?? 18)
    );
    setHeightError('');
    setHeightDialog({ firstRow: bounds.firstRow, lastRow: bounds.lastRow });
  }

  function openSearch(mode: 'find' | 'replace') {
    if (disabled || !sheet || !commitEditing()) return;
    setSearchFocusVersion((version) => version + 1);
    setSearch((current) =>
      current
        ? { ...current, mode: readOnly ? 'find' : mode }
        : { mode: readOnly ? 'find' : mode, snapshot: { sheetId: sheet.id, selection } }
    );
  }

  function navigateSearch(match: StudioSheetMatch) {
    if (disabled || !commitEditing()) return;
    const position = studioParseAddress(match.address)!;
    const target = latestRef.current.sheets.find((item) => item.id === match.sheetId);
    if (!target) return;
    const hidden = studioHiddenRows(target, studioCalculate(latestRef.current)).has(position.row);
    setSearchReveal(hidden ? { sheetId: target.id, row: position.row } : null);
    pendingNavigation.current = { sheetId: target.id, position };
    setActiveId(target.id);
    setSelection({ anchor: position, focus: position });
    if (latestRef.current.activeSheetId !== target.id)
      replaceDocument({ ...latestRef.current, activeSheetId: target.id }, false);
    setNotice(
      `找到 ${target.name}!${match.address}${hidden ? '；临时显示隐藏行，关闭查找后恢复。' : '。'}`
    );
  }

  function replaceSearch(
    options: StudioSheetSearchOptions,
    replacement: string,
    only?: StudioSheetMatch
  ) {
    if (blocked || !commitEditing()) return '当前无法替换。';
    try {
      const result = studioReplaceSheetCells(latestRef.current, options, replacement, only);
      replaceDocument(result.document);
      const message = `已替换 ${result.changed} 个单元格${result.skipped ? `，跳过 ${result.skipped} 个公式或格式化值` : ''}；可撤销。`;
      setNotice(message);
      return message;
    } catch (error) {
      const message = error instanceof Error ? error.message : '替换失败。';
      setNotice(message);
      return message;
    }
  }

  function openColumnWidth(range = { firstCol: bounds.firstCol, lastCol: bounds.lastCol }) {
    if (blocked || !sheet || !commitEditing()) return;
    setWidthDraft(
      String(
        Number(
          studioColumnCharacterWidth(
            sheet.columnWidths?.[studioColumnLabel(range.firstCol)] ?? 112
          ).toFixed(2)
        )
      )
    );
    setWidthError('');
    setWidthDialog(range);
  }

  function applyColumnWidths(range: { firstCol: number; lastCol: number }, width: number) {
    if (!sheet) return;
    const widths = Object.fromEntries(
      Array.from({ length: range.lastCol - range.firstCol + 1 }, (_, index) => [
        studioColumnLabel(range.firstCol + index),
        width,
      ])
    );
    return studioSetColumnWidths(latestRef.current, sheet.id, widths);
  }

  function commitColumnWidth() {
    if (blocked || !widthDialog || !commitEditing()) return;
    const input = widthDraft.trim().replace(',', '.');
    const width = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input) ? Number(input) : NaN;
    try {
      if (!Number.isFinite(width) || width < 1 || width > 255)
        throw new Error('列宽须为 1–255 个字符。');
      const next = applyColumnWidths(widthDialog, studioColumnPixelWidth(width));
      if (next) replaceDocument(next);
      setWidthDialog(null);
      setNotice(`已将所选列设为 ${width} 个字符宽；可撤销。`);
    } catch (error) {
      setWidthError(error instanceof Error ? error.message : '列宽设置失败。');
    }
  }

  function fitColumnWidths(range = { firstCol: bounds.firstCol, lastCol: bounds.lastCol }) {
    if (blocked || !sheet || !commitEditing()) return;
    const current = latestRef.current;
    const target = current.sheets.find((item) => item.id === sheet.id)!;
    const calculation = studioCalculate(current);
    const widths: Record<string, number> = {};
    const measuredColumns = new Set<number>();
    const probe = globalThis.document.createElement('span');
    probe.className = 'z-studio-sheet-fit-probe';
    gridRef.current?.append(probe);
    try {
      for (let col = range.firstCol; col <= range.lastCol; col++)
        widths[studioColumnLabel(col)] = 112;
      for (const [address, cell] of Object.entries(target.cells)) {
        const pos = studioParseAddress(address)!;
        if (pos.col < range.firstCol || pos.col > range.lastCol) continue;
        const merge = studioMergedRange(target, pos);
        if (merge && (merge.firstCol !== merge.lastCol || merge.firstRow !== pos.row)) continue;
        const key = `${target.id}:${address}`;
        const link = studioCellHyperlink(current, target.id, address, calculation);
        const text = cell.input
          ? studioDisplayCell(cell, calculation.values.get(key), calculation.errors.get(key))
          : link?.display || link?.target || link?.location || '';
        if (!text) continue;
        Object.assign(probe.style, {
          width: 'max-content',
          fontFamily: `${quotedFontFamily(cell.fontFamily ?? DEFAULT_FONT)}, var(--z-font-sans)`,
          fontSize: `${cell.fontSize ?? DEFAULT_FONT_SIZE}pt`,
          fontWeight: cell.bold ? '700' : '400',
          fontStyle: cell.italic ? 'italic' : 'normal',
          whiteSpace: 'pre',
          overflowWrap: 'normal',
        });
        probe.textContent = text;
        const measured = probe.getBoundingClientRect().width;
        const width =
          measured > 0
            ? measured + 12
            : Math.max(...text.split('\n').map((line) => Array.from(line).length)) *
                (cell.fontSize ?? 11) *
                0.8 +
              12;
        widths[studioColumnLabel(pos.col)] = Math.min(
          1790,
          Math.max(
            measuredColumns.has(pos.col) ? widths[studioColumnLabel(pos.col)] : 12,
            Math.ceil(width)
          )
        );
        if (text) measuredColumns.add(pos.col);
      }
      replaceDocument(studioSetColumnWidths(current, target.id, widths));
      setNotice('已按内容自动调整所选列宽；跨列合并区域不参与适配。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '自动调整列宽失败。');
    } finally {
      probe.remove();
    }
  }

  function startColumnResize(event: React.PointerEvent<HTMLElement>, col: number) {
    event.stopPropagation();
    event.preventDefault();
    if (blocked || event.button !== 0 || !sheet || !commitEditing()) return;
    resizeCleanup.current?.();
    const initial = latestRef.current;
    const initialX = event.clientX;
    const width =
      initial.sheets.find((item) => item.id === sheet.id)?.columnWidths?.[studioColumnLabel(col)] ??
      112;
    let nextWidth = width;
    const pointerId = event.pointerId;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      nextWidth = Math.max(12, Math.min(1790, width + moveEvent.clientX - initialX));
      setWidthPreview({ sheetId: sheet.id, col, width: nextWidth });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', cancel);
      resizeCleanup.current = null;
      setWidthPreview(null);
    };
    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      move(upEvent);
      cleanup();
      if (permissionRef.current || latestRef.current !== initial || width === nextWidth) return;
      try {
        replaceDocument(
          studioSetColumnWidths(initial, sheet.id, { [studioColumnLabel(col)]: nextWidth })
        );
        setNotice('已调整列宽；可撤销。');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '列宽调整失败。');
      }
    };
    const cancel = () => {
      cleanup();
      setNotice('已取消列宽拖动。');
    };
    const escape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();
        cancel();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancel);
    resizeCleanup.current = cleanup;
  }

  function startRowResize(event: React.PointerEvent<HTMLElement>, row: number) {
    event.stopPropagation();
    event.preventDefault();
    if (blocked || event.button !== 0 || !sheet || !commitEditing()) return;
    resizeCleanup.current?.();
    const initial = latestRef.current;
    const currentSheet = initial.sheets.find((item) => item.id === sheet.id)!;
    const initialY = event.clientY;
    const height = currentSheet.rowHeights?.[String(row)] ?? currentSheet.defaultRowHeight ?? 18;
    let nextHeight = height;
    const pointerId = event.pointerId;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      nextHeight =
        Math.round(
          Math.max(
            0.75,
            Math.min(
              STUDIO_MAX_ROW_HEIGHT,
              height + (moveEvent.clientY - initialY) / STUDIO_POINTS_TO_PIXELS
            )
          ) * 4
        ) / 4;
      setHeightPreview({ sheetId: sheet.id, row, height: nextHeight });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', cancel);
      resizeCleanup.current = null;
      setHeightPreview(null);
    };
    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      move(upEvent);
      cleanup();
      if (permissionRef.current || latestRef.current !== initial || height === nextHeight) return;
      try {
        replaceDocument(
          studioSetRowHeight(initial, sheet.id, { firstRow: row, lastRow: row }, nextHeight)
        );
        setNotice('已调整行高；可撤销。');
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '行高调整失败。');
      }
    };
    const cancel = () => {
      cleanup();
      setNotice('已取消行高拖动。');
    };
    const escape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();
        cancel();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancel);
    resizeCleanup.current = cleanup;
  }

  function applyRowHeight() {
    if (blocked || !sheet || !heightDialog || !commitEditing()) return;
    const input = heightDraft
      .trim()
      .replace(/\s*pt$/i, '')
      .trim()
      .replace(',', '.');
    const height = /^\+?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input) ? Number(input) : NaN;
    try {
      const next = studioSetRowHeight(
        rowHeightDocument(heightDialog.lastRow),
        sheet.id,
        heightDialog,
        height
      );
      replaceDocument(next);
      setHeightDialog(null);
      setNotice(
        height === 0 ? '已隐藏所选行，可撤销或恢复默认行高。' : `已将所选行设为 ${height} 磅。`
      );
    } catch (error) {
      setHeightError(error instanceof Error ? error.message : '行高设置失败。');
    }
  }

  function fitRowHeights(range = { firstRow: bounds.firstRow, lastRow: bounds.lastRow }) {
    if (blocked || !sheet || !commitEditing()) return;
    const current = latestRef.current;
    const currentSheet = current.sheets.find((item) => item.id === sheet.id)!;
    const calculation = studioCalculate(current);
    const grouped = new Map<number, StudioRowFitCell[]>();
    for (const [address, cell] of Object.entries(currentSheet.cells)) {
      const position = studioParseAddress(address)!;
      if (position.row < range.firstRow || position.row > range.lastRow) continue;
      const merge = studioMergedRange(currentSheet, position);
      // Multi-row merges cannot determine the height of one individual row.
      if (merge && (merge.firstRow !== merge.lastRow || merge.firstCol !== position.col)) continue;
      const key = `${sheet.id}:${address}`;
      const link = studioCellHyperlink(current, sheet.id, address, calculation);
      const text = cell.input
        ? studioDisplayCell(cell, calculation.values.get(key), calculation.errors.get(key))
        : link?.display || link?.target || link?.location || '';
      const cells = grouped.get(position.row) ?? [];
      cells.push({
        ...cell,
        text,
        width: offsets[merge?.lastCol ?? position.col] - offsets[position.col - 1],
      });
      grouped.set(position.row, cells);
    }
    const probe = globalThis.document.createElement('span');
    probe.className = 'z-studio-sheet-fit-probe';
    gridRef.current?.append(probe);
    try {
      const heights = { ...currentSheet.rowHeights };
      const hidden = new Set(currentSheet.hiddenRows ?? []);
      for (let row = range.firstRow; row <= range.lastRow; row++) {
        const height = studioFitRowHeight(
          grouped.get(row) ?? [],
          currentSheet.defaultRowHeight ?? 18,
          (cell) => {
            Object.assign(probe.style, {
              width: `${Math.max(1, cell.width - 10)}px`,
              fontFamily: `${quotedFontFamily(cell.fontFamily ?? DEFAULT_FONT)}, var(--z-font-sans)`,
              fontSize: `${cell.fontSize ?? DEFAULT_FONT_SIZE}pt`,
              fontWeight: cell.bold ? '700' : '400',
              fontStyle: cell.italic ? 'italic' : 'normal',
              whiteSpace: cell.wrap ? 'pre-wrap' : 'pre',
              overflowWrap: cell.wrap ? 'anywhere' : 'normal',
            });
            probe.textContent = cell.text;
            return probe.getBoundingClientRect().height;
          }
        );
        heights[String(row)] = height;
        hidden.delete(row);
      }
      const current = rowHeightDocument(range.lastRow);
      const next = {
        ...current,
        sheets: current.sheets.map((item) =>
          item.id === sheet.id
            ? { ...item, rowHeights: heights, hiddenRows: [...hidden].sort((a, b) => a - b) }
            : item
        ),
      };
      replaceDocument(next);
      setNotice('已根据文字、字号和换行调整行高；跨多行合并的内容不参与计算。');
    } finally {
      probe.remove();
    }
  }

  function resetRowHeights() {
    if (blocked || !sheet || !commitEditing()) return;
    replaceDocument(
      studioSetRowHeight(rowHeightDocument(bounds.lastRow), sheet.id, bounds, undefined)
    );
    setNotice('已恢复所选行的默认行高并取消手动隐藏。');
  }

  function undo() {
    if (blocked || !pastRef.current.length) return;
    setEdit(null);
    const previous = pastRef.current.pop()!;
    futureRef.current.push(latestRef.current);
    replaceDocument(previous, false);
    setActiveId(previous.activeSheetId);
    setNotice('已撤销。');
  }

  function redo() {
    if (blocked || !futureRef.current.length) return;
    setEdit(null);
    const next = futureRef.current.pop()!;
    pastRef.current.push(latestRef.current);
    replaceDocument(next, false);
    setActiveId(next.activeSheetId);
    setNotice('已重做。');
  }

  function insertFunction(name: string) {
    if (blocked) return;
    const range =
      count > 1
        ? `${studioCellAddress(bounds.firstRow, bounds.firstCol)}:${studioCellAddress(bounds.lastRow, bounds.lastCol)}`
        : selection.focus.row > 1
          ? `${studioColumnLabel(selection.focus.col)}1:${studioColumnLabel(selection.focus.col)}${selection.focus.row - 1}`
          : '';
    let targetAddress = address;
    if (count > 1 && name !== 'IF') {
      if (bounds.lastRow >= rowCount) {
        setNotice('请选择下方留有空白行的区域，计算结果会写在选区下方。');
        return;
      }
      const destination = { row: bounds.lastRow + 1, col: bounds.firstCol };
      targetAddress = studioCellAddress(destination.row, destination.col);
      setSelection({ anchor: destination, focus: destination });
      ensureVisible(destination);
    }
    const reference =
      selection.focus.row > 1
        ? studioCellAddress(selection.focus.row - 1, selection.focus.col)
        : selection.focus.col > 1
          ? studioCellAddress(selection.focus.row, selection.focus.col - 1)
          : 'B1';
    beginEditing(
      'formula',
      name === 'IF' ? `=IF(${reference}>0,"是","否")` : `=${name}(${range})`,
      targetAddress
    );
    formulaRef.current?.focus();
    setNotice('在公式栏确认引用范围后按 Enter 应用。');
  }

  function addSheet() {
    if (blocked) return;
    if (!commitEditing()) return;
    const current = latestRef.current;
    if (current.sheets.length >= STUDIO_SHEET_LIMITS.sheets) {
      setNotice('首版最多支持 32 张工作表。');
      return;
    }
    let index = current.sheets.length + 1;
    while (current.sheets.some((item) => item.name.toLowerCase() === `sheet${index}`)) index++;
    const id = `sheet-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`}`;
    replaceDocument({
      ...current,
      activeSheetId: id,
      sheets: [
        ...current.sheets,
        { id, name: `Sheet${index}`, cells: {}, rowCount: 200, columnCount: 26, hyperlinks: [] },
      ],
    });
    switchSheet(id);
    setNotice('已新增工作表。');
  }

  function deleteSheet() {
    if (blocked || !sheet) return;
    if (!commitEditing()) return;
    try {
      const next = studioDeleteSheet(latestRef.current, sheet.id);
      replaceDocument(next);
      switchSheet(next.activeSheetId);
      setNotice('已删除工作表，可撤销恢复。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '工作表删除失败。');
    }
  }

  function changeStructure(
    axis: StudioSheetStructureEdit['axis'],
    type: StudioSheetStructureEdit['type']
  ) {
    if (blocked || !sheet) return;
    if (!commitEditing()) return;
    try {
      const next = studioChangeSheetStructure(latestRef.current, sheet.id, {
        axis,
        type,
        index: axis === 'row' ? bounds.firstRow : bounds.firstCol,
        count:
          axis === 'row'
            ? bounds.lastRow - bounds.firstRow + 1
            : bounds.lastCol - bounds.firstCol + 1,
      });
      const changedSheet = next.sheets.find((item) => item.id === sheet.id)!;
      const position = {
        row: Math.min(bounds.firstRow, changedSheet.rowCount),
        col: Math.min(bounds.firstCol, changedSheet.columnCount),
      };
      replaceDocument(next);
      setSelection({ anchor: position, focus: position });
      gridRef.current?.focus();
      setNotice(
        `已${type === 'insert' ? '插入' : '删除'}所选${axis === 'row' ? '行' : '列'}，可撤销恢复。`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '行列修改失败。');
    }
  }

  function switchSheet(id: string) {
    if (disabled) return;
    if (!commitEditing()) return;
    if (!blocked && latestRef.current.activeSheetId !== id)
      replaceDocument({ ...latestRef.current, activeSheetId: id }, false);
    setActiveId(id);
    setSelection(INITIAL_SELECTION);
    setRename(null);
    if (gridRef.current) {
      gridRef.current.scrollTop = 0;
      gridRef.current.scrollLeft = 0;
    }
    setViewport((current) => ({ ...current, top: 0, left: 0 }));
  }

  function commitRename() {
    if (blocked || rename === null || !sheet) return;
    try {
      replaceDocument(studioRenameSheet(latestRef.current, sheet.id, rename.trim()));
      setRename(null);
      setNotice('已重命名工作表，并更新公式中的工作表引用。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '重命名失败。');
    }
  }

  function expandSheet(axis: 'rows' | 'columns') {
    if (blocked || !sheet) return;
    if (!commitEditing()) return;
    const current = latestRef.current;
    const key = axis === 'rows' ? 'rowCount' : 'columnCount';
    replaceDocument({
      ...current,
      sheets: current.sheets.map((item) =>
        item.id === sheet.id
          ? {
              ...item,
              [key]: Math.min(STUDIO_SHEET_LIMITS[axis], item[key] + (axis === 'rows' ? 100 : 5)),
            }
          : item
      ),
    });
  }

  function transform(
    action: (current: StudioExcelDocument) => StudioExcelDocument,
    success: string,
    validationAddresses?: () => Iterable<string>
  ) {
    if (blocked || !sheet) return;
    if (!commitEditing()) return;
    try {
      const next = action(latestRef.current);
      const message = validationAddresses
        ? validationNotice(next, sheet.id, validationAddresses(), success)
        : success;
      replaceDocument(next);
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败。');
    }
  }

  function openRuleDialog(kind: SheetRuleDialogMode['kind']) {
    if (disabled || !commitEditing()) return;
    setRuleDialog({ kind });
  }

  function openHyperlink() {
    if (disabled || !sheet || !commitEditing()) return;
    const current = latestRef.current;
    const link = studioCellHyperlink(current, sheet.id, address, studioCalculate(current));
    if (!link) return;
    const destination = studioResolveSheetHyperlink(current, sheet.id, link);
    if (destination.kind === 'blocked') {
      setNotice(destination.reason);
      return;
    }
    if (destination.kind === 'external') {
      window.open(destination.href, '_blank', 'noopener,noreferrer');
      setNotice('已打开超链接。');
      return;
    }
    if (
      destination.focus.row > STUDIO_SHEET_LIMITS.rows ||
      destination.focus.col > STUDIO_SHEET_LIMITS.columns
    ) {
      setNotice('此链接超出当前编辑器支持的范围，引用已保留。');
      return;
    }
    const targetSheet = current.sheets.find((item) => item.id === destination.sheetId)!;
    const filtered = studioHiddenRows(targetSheet, studioCalculate(current));
    if (filtered.has(destination.anchor.row) || filtered.has(destination.focus.row)) {
      setNotice('目标单元格被隐藏，请先清除目标工作表的筛选或恢复行高。');
      return;
    }
    setViewExtents((current) => ({
      ...current,
      [destination.sheetId]: {
        row: Math.max(current[destination.sheetId]?.row ?? 1, destination.focus.row),
        col: Math.max(current[destination.sheetId]?.col ?? 1, destination.focus.col),
      },
    }));
    pendingNavigation.current = { sheetId: destination.sheetId, position: destination.anchor };
    setActiveId(destination.sheetId);
    setSelection({ anchor: destination.focus, focus: destination.anchor });
    setNotice(`已转到 ${targetSheet.name}!${destination.ref}。`);
  }

  function openHyperlinkDialog() {
    if (blocked || !sheet || !commitEditing()) return;
    const current = latestRef.current;
    const currentSheet = current.sheets.find((item) => item.id === sheet.id)!;
    const calculation = studioCalculate(current);
    const link = studioCellHyperlink(current, sheet.id, address, calculation);
    const native = link && currentSheet.hyperlinks?.includes(link) ? link : undefined;
    if (link && !native) {
      beginEditing('formula', currentSheet.cells[address]?.input);
      setNotice('此超链接来自 HYPERLINK 公式，可在公式栏中修改。');
      return;
    }
    const id = `link-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    setLinkDialog({
      sheetId: sheet.id,
      address,
      isNew: !native,
      link: native ?? { id, ref: studioRangeAddress(bounds) },
      displayText: currentSheet.cells[address]?.input
        ? studioDisplayCell(
            currentSheet.cells[address],
            calculation.values.get(`${sheet.id}:${address}`),
            calculation.errors.get(`${sheet.id}:${address}`)
          )
        : native?.display || native?.target || native?.location || '',
    });
  }

  function removeHyperlink() {
    if (blocked || !sheet || !commitEditing()) return;
    const current = latestRef.current;
    const calculation = studioCalculate(current);
    const link = studioCellHyperlink(current, sheet.id, address, calculation);
    if (!link) return;
    const currentSheet = current.sheets.find((item) => item.id === sheet.id)!;
    if (currentSheet.hyperlinks?.includes(link)) {
      transform(
        (document) => studioRemoveSheetHyperlinks(document, sheet.id, studioRangeAddress(bounds)),
        '已移除选区中的超链接，可撤销恢复。'
      );
    } else {
      const value = calculation.values.get(`${sheet.id}:${address}`) ?? '';
      transform(
        (document) =>
          studioPatchCells(document, sheet.id, {
            [address]: {
              input:
                typeof value === 'string'
                  ? `'${value}`
                  : currentSheet.cells[address]?.numberFormat === '@'
                    ? typeof value === 'boolean'
                      ? value
                        ? '=TRUE()'
                        : '=FALSE()'
                      : `=${String(value)}`
                    : String(value),
            },
          }),
        '已将超链接公式转为显示值，可撤销恢复。'
      );
    }
  }

  function fill(direction: 'down' | 'right') {
    if (!sheet) return;
    transform(
      (current) => studioFillCells(current, sheet.id, selection, direction),
      `已向${direction === 'down' ? '下' : '右'}填充，公式与直接格式已同步。`,
      () => fillAddresses(direction)
    );
  }

  function applyFilter() {
    if (!sheet) return;
    const current = latestRef.current.sheets.find((item) => item.id === sheet.id)!;
    const range = filterRange || current.filter?.range || studioRangeAddress(bounds);
    const columns = range === current.filter?.range ? { ...current.filter.columns } : {};
    if (filterValue !== '')
      columns[filterColumn] = { operator: filterOperator, value: filterValue };
    else delete columns[filterColumn];
    transform(
      (document) => studioSetFilter(document, sheet.id, { range, columns }),
      '已应用筛选，源数据与公式均保留。'
    );
    setFilterRange(range);
  }

  function addChart(type: StudioSheetChart['type']) {
    if (!sheet) return;
    transform((current) => {
      const next = studioAddChart(
        current,
        sheet.id,
        chartRange || studioRangeAddress(bounds),
        type
      );
      setSelectedChart(next.sheets.find((item) => item.id === sheet.id)!.charts!.at(-1)!.id);
      setChartPanel(true);
      return next;
    }, '已插入图表，导出 XLSX 时会保存为可编辑的原生图表。');
  }

  function mergeSelection(split = false) {
    if (!sheet) return;
    transform(
      (current) => {
        const next = studioMergeCells(current, sheet.id, selection, split);
        if (!split) {
          const position = { row: bounds.firstRow, col: bounds.firstCol };
          setSelection({ anchor: position, focus: position });
        }
        return next;
      },
      split ? '已拆分选区。' : '已合并选区。'
    );
  }

  function changeChart(id: string, patch?: Partial<StudioSheetChart>) {
    if (!sheet) return;
    transform(
      (current) => ({
        ...current,
        sheets: current.sheets.map((item) =>
          item.id === sheet.id
            ? {
                ...item,
                charts: patch
                  ? item.charts?.map((chart) => (chart.id === id ? { ...chart, ...patch } : chart))
                  : item.charts?.filter((chart) => chart.id !== id),
              }
            : item
        ),
      }),
      patch ? '图表已更新。' : '图表已删除，可撤销。'
    );
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      disabled ||
      event.target !== event.currentTarget ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key === 'Enter' && activeLink) {
      event.preventDefault();
      openHyperlink();
      return;
    }
    if (command && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openHyperlinkDialog();
      return;
    }
    if (command && event.altKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      if (!blocked && pasteAvailable) {
        setPasteMode('all');
        setPasteDialog(true);
      }
      return;
    }
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (command && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelection({ anchor: { row: 1, col: 1 }, focus: { row: rowCount, col: columnCount } });
      return;
    }
    if (command && !blocked && count > 1 && ['d', 'r'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      fill(event.key.toLowerCase() === 'd' ? 'down' : 'right');
      return;
    }
    if (command && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      formatSelection(
        event.key.toLowerCase() === 'b'
          ? { bold: !cell?.bold }
          : event.key.toLowerCase() === 'i'
            ? { italic: !cell?.italic }
            : { underline: !cell?.underline }
      );
      return;
    }
    const movement: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      Tab: [0, event.shiftKey ? -1 : 1],
    };
    if (movement[event.key]) {
      event.preventDefault();
      moveSelection(...movement[event.key], event.key !== 'Tab' && event.shiftKey);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const position = {
        row: command ? (event.key === 'Home' ? 1 : rowCount) : selection.focus.row,
        col: event.key === 'Home' ? 1 : columnCount,
      };
      setSelection({ anchor: event.shiftKey ? selection.anchor : position, focus: position });
      ensureVisible(position);
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      beginEditing('cell');
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      formatSelection({ input: '' });
      return;
    }
    if (!command && !event.altKey && event.key.length === 1) {
      event.preventDefault();
      beginEditing('cell', event.key);
    }
  }

  function onEditorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (blocked || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setEdit(null);
      gridRef.current?.focus();
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (!commitEditing(true)) return;
      moveSelection(
        event.key === 'Enter' ? (event.shiftKey ? -1 : 1) : 0,
        event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0
      );
    }
  }

  function pasteClipboard(
    text: string,
    source: StudioSheetClipboardOrigin | undefined,
    mode: StudioSheetPasteMode
  ) {
    if (blocked || !sheet) return false;
    try {
      const parsed = studioParseTsv(text);
      const count = parsed.reduce((sum, row) => sum + row.length, 0);
      if (count > STUDIO_SHEET_LIMITS.clipboardCells)
        throw new Error('单次最多粘贴 10,000 个单元格，请缩小复制区域。');
      const result = studioPasteCells(
        latestRef.current,
        sheet.id,
        selection.focus,
        text,
        source,
        mode
      );
      const rows = Math.abs(result.selection.focus.row - result.selection.anchor.row) + 1;
      const cols = Math.abs(result.selection.focus.col - result.selection.anchor.col) + 1;
      const label = pasteModes.find((item) => item.value === mode)?.label ?? '粘贴';
      const success =
        mode === 'all'
          ? `已粘贴 ${rows}×${cols}，可撤销整个粘贴操作。`
          : `${label}已应用到 ${rows}×${cols}。`;
      const message = validationNotice(result.document, sheet.id, result.addresses, success);
      replaceDocument(result.document);
      setSelection(result.selection);
      gridRef.current?.focus();
      setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '粘贴失败。');
      return false;
    }
  }

  function onCopy(event: React.ClipboardEvent<HTMLDivElement>) {
    if (disabled || !sheet || event.target !== event.currentTarget) return;
    try {
      const text = studioCopyTsv(sheet, selection);
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
      try {
        const payload = studioCopySheetClipboard(latestRef.current, sheet.id, selection);
        const source = studioClipboardOrigin(payload, text);
        if (!source) throw new Error('复制元数据无效。');
        clipboardRef.current = { text, payload, source };
        setPasteAvailable(true);
        try {
          event.clipboardData.setData(STUDIO_SHEET_CLIPBOARD_TYPE, payload);
        } catch {
          /* The in-editor clipboard cache still enables Paste Special. */
        }
        setNotice(`已复制 ${count} 个单元格，可使用选择性粘贴。`);
      } catch (error) {
        clipboardRef.current = null;
        setPasteAvailable(false);
        setNotice(
          `已复制 ${count} 个单元格（纯文本）；${
            error instanceof Error ? error.message : '选择性粘贴数据生成失败。'
          }`
        );
      }
    } catch (error) {
      event.preventDefault();
      setNotice(error instanceof Error ? error.message : '复制失败。');
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    if (blocked || !sheet) return;
    const text = event.clipboardData.getData('text/plain');
    if (event.target !== event.currentTarget && !/[\t\r\n]/.test(text)) return;
    event.preventDefault();
    if (editingRef.current && !commitEditing()) return;
    setEdit(null);
    let source: StudioSheetClipboardOrigin | undefined;
    try {
      const payload = event.clipboardData.getData(STUDIO_SHEET_CLIPBOARD_TYPE);
      source = studioClipboardOrigin(payload, text);
      if (source) {
        clipboardRef.current = { text, payload, source };
        setPasteAvailable(true);
      }
    } catch {
      /* Custom clipboard formats are optional. */
    }
    pasteClipboard(text, source, 'all');
  }

  const summary = React.useMemo(() => {
    if (!sheet || count > STUDIO_SHEET_LIMITS.clipboardCells) return '';
    let sum = 0;
    let numbers = 0;
    for (const selected of studioSelectionAddresses(selection)) {
      const selectedCell = sheet.cells[selected];
      if (!selectedCell) continue;
      const value =
        calculated.values.get(`${sheet.id}:${selected}`) ??
        studioInputValue(selectedCell.input, selectedCell.numberFormat);
      if (typeof value === 'number' && !calculated.errors.has(`${sheet.id}:${selected}`)) {
        sum += value;
        numbers++;
      }
    }
    return numbers
      ? `求和 ${Number(sum.toPrecision(12))} · 平均 ${Number((sum / numbers).toPrecision(12))}`
      : '';
  }, [calculated, count, selection, sheet]);
  const formulaValue =
    editing?.sheetId === sheet?.id && editing.address === address
      ? editing.value
      : (cell?.input ?? '');
  const error = sheet ? calculated.errors.get(`${sheet.id}:${address}`) : undefined;
  const validationPrompt = activeValidation
    ? !activeValidation.valid && activeValidation.rule.showErrorMessage !== false
      ? `${address}：${activeValidation.message}`
      : activeValidation.rule.showInputMessage !== false
        ? activeValidation.rule.inputTitle || activeValidation.rule.inputMessage
          ? `${activeValidation.rule.inputTitle ? `${activeValidation.rule.inputTitle}：` : ''}${activeValidation.rule.inputMessage ?? ''}`
          : `${address}：${activeValidation.rule.type === 'list' ? '从列表选择或输入允许的值。' : '已设置输入验证。'}`
        : null
    : null;
  const noticeText =
    blocked && editing
      ? '待确认的输入已保留，恢复编辑权限后可继续。'
      : inputError
        ? `${inputError}。可修正输入或按 Esc 取消。`
        : error
          ? `${address}：${error}。请检查公式。`
          : notice;

  if (!sheet) return <div className="z-studio-sheet-empty">工作簿中没有工作表。</div>;

  return (
    <div
      className="z-studio-sheet"
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-studio-input-error={inputError ?? undefined}
      onKeyDownCapture={(event) => {
        if (
          !disabled &&
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229 &&
          (event.ctrlKey || event.metaKey) &&
          ['f', 'h'].includes(event.key.toLowerCase()) &&
          !heightDialog &&
          !widthDialog &&
          !pasteDialog &&
          !ruleDialog &&
          !linkDialog
        ) {
          event.preventDefault();
          event.stopPropagation();
          openSearch(event.key.toLowerCase() === 'h' ? 'replace' : 'find');
          return;
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 's' &&
          !event.nativeEvent.isComposing &&
          editingRef.current
        )
          flushSync(() => commitEditing());
      }}
    >
      <Tabs
        value={ribbon}
        onValueChange={setRibbon}
        className="z-studio-sheet-ribbon z-studio-ribbon"
      >
        <StudioRibbonTabs>
          <Tabs.List aria-label="表格工具栏">
            <Tabs.Trigger value="home" disabled={disabled}>
              开始
            </Tabs.Trigger>
            <Tabs.Trigger value="insert" disabled={disabled}>
              插入
            </Tabs.Trigger>
            <Tabs.Trigger value="layout" disabled={disabled}>
              布局
            </Tabs.Trigger>
            <Tabs.Trigger value="formulas" disabled={disabled}>
              公式
            </Tabs.Trigger>
            <Tabs.Trigger value="data" disabled={disabled}>
              数据
            </Tabs.Trigger>
            <Tabs.Trigger value="view" disabled={disabled}>
              视图
            </Tabs.Trigger>
          </Tabs.List>
        </StudioRibbonTabs>
        <Tabs.Panel value="home">
          <div className="z-studio-sheet-tools">
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="撤销表格修改"
                  title="撤销（Ctrl / ⌘ + Z）"
                  disabled={blocked || !historyVersion || !pastRef.current.length}
                  onClick={undo}
                >
                  ↶
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="重做表格修改"
                  title="重做（Ctrl / ⌘ + Shift + Z）"
                  disabled={blocked || !futureRef.current.length}
                  onClick={redo}
                >
                  ↷
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => formatSelection({ input: '' })}
                >
                  清空
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || !pasteAvailable}
                  title="选择性粘贴（Ctrl / ⌘ + Alt + V）"
                  onClick={() => {
                    if (!commitEditing()) return;
                    setEdit(null);
                    setPasteMode('all');
                    setPasteDialog(true);
                  }}
                >
                  选择性粘贴
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => formatSelection(studioDefaultCellFormat())}
                >
                  清除格式
                </Button>
              </div>
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  title="Ctrl / ⌘ + F"
                  onClick={() => openSearch('find')}
                >
                  查找
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  title="Ctrl / ⌘ + H"
                  onClick={() => openSearch('replace')}
                >
                  替换
                </Button>
              </div>
              <span>编辑</span>
            </div>
            <div className="z-studio-sheet-toolgroup z-studio-sheet-fontgroup">
              <div className="z-studio-sheet-toolrow">
                <StudioFontControl
                  label="表格字体"
                  kind="family"
                  className="z-studio-sheet-font"
                  value={cell?.fontFamily ?? DEFAULT_FONT}
                  options={fontOptions}
                  contextKey={`${document.id}:${sheet.id}:${studioRangeAddress(bounds)}:${address}`}
                  disabled={blocked}
                  onEditStart={() => commitEditing()}
                  onCommit={(fontFamily, reason) => {
                    const accepted = formatSelection({ fontFamily });
                    if (accepted && reason !== 'blur') gridRef.current?.focus();
                    return accepted;
                  }}
                  onCancel={() => gridRef.current?.focus()}
                />
                <StudioFontControl
                  label="表格字号"
                  kind="size"
                  className="z-studio-sheet-fontsize"
                  value={String(cell?.fontSize ?? DEFAULT_FONT_SIZE)}
                  options={fontSizeOptions}
                  contextKey={`${document.id}:${sheet.id}:${studioRangeAddress(bounds)}:${address}`}
                  disabled={blocked}
                  onEditStart={() => commitEditing()}
                  onCommit={(fontSize, reason) => {
                    const accepted = formatSelection({ fontSize: Number(fontSize) });
                    if (accepted && reason !== 'blur') gridRef.current?.focus();
                    return accepted;
                  }}
                  onCancel={() => gridRef.current?.focus()}
                />
              </div>
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant={cell?.bold ? 'outline' : 'ghost'}
                  aria-label="表格加粗"
                  aria-pressed={!!cell?.bold}
                  disabled={blocked}
                  onClick={() => formatSelection({ bold: !cell?.bold })}
                >
                  <strong>B</strong>
                </Button>
                <Button
                  size="sm"
                  variant={cell?.italic ? 'outline' : 'ghost'}
                  aria-label="表格斜体"
                  aria-pressed={!!cell?.italic}
                  disabled={blocked}
                  onClick={() => formatSelection({ italic: !cell?.italic })}
                >
                  <i>I</i>
                </Button>
                <Button
                  size="sm"
                  variant={cell?.underline ? 'outline' : 'ghost'}
                  aria-label="表格下划线"
                  aria-pressed={!!cell?.underline}
                  disabled={blocked}
                  onClick={() => formatSelection({ underline: !cell?.underline })}
                >
                  <u>U</u>
                </Button>
                <ColorPicker
                  size="sm"
                  aria-label="表格文字颜色"
                  value={cell?.color ?? '#253044'}
                  disabled={blocked}
                  onChange={(color) => formatSelection({ color })}
                />
                <ColorPicker
                  size="sm"
                  aria-label="表格填充颜色"
                  value={
                    cell?.background && cell.background !== 'none' ? cell.background : '#ffffff'
                  }
                  disabled={blocked}
                  onChange={(background) => formatSelection({ background })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() =>
                    formatSelection({
                      background: cell?.background === '#eef4ff' ? '#ffffff' : '#eef4ff',
                    })
                  }
                >
                  底色
                </Button>
              </div>
              <span>字体</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                {alignments.map(({ value: align, label, Icon }) => (
                  <Button
                    key={align}
                    size="sm"
                    variant={cell?.align === align ? 'outline' : 'ghost'}
                    aria-label={label}
                    aria-pressed={cell?.align === align}
                    disabled={blocked}
                    onClick={() => formatSelection({ align })}
                  >
                    <Icon size={16} />
                  </Button>
                ))}
              </div>
              <span>对齐</span>
              <Select
                size="sm"
                aria-label="单元格垂直对齐"
                value={cell?.verticalAlign ?? 'bottom'}
                disabled={blocked}
                onChange={(verticalAlign) =>
                  formatSelection({ verticalAlign: verticalAlign as StudioCell['verticalAlign'] })
                }
                options={[
                  { value: 'top', label: '顶端对齐' },
                  { value: 'middle', label: '垂直居中' },
                  { value: 'bottom', label: '底端对齐' },
                ]}
              />
            </div>
            <div className="z-studio-sheet-toolgroup z-studio-sheet-bordergroup">
              <div className="z-studio-sheet-toolrow">
                <Select
                  size="sm"
                  aria-label="边框线型"
                  value={borderStyle}
                  disabled={blocked}
                  onChange={(value) => setBorderStyle(value as typeof borderStyle)}
                  options={[
                    { value: 'thin', label: '细实线' },
                    { value: 'medium', label: '中实线' },
                    { value: 'thick', label: '粗实线' },
                    { value: 'double', label: '双线' },
                    { value: 'dotted', label: '点线' },
                    { value: 'dashed', label: '虚线' },
                  ]}
                />
                <ColorPicker
                  size="sm"
                  aria-label="边框颜色"
                  value={borderColor}
                  disabled={blocked}
                  onChange={setBorderColor}
                />
              </div>
              <div className="z-studio-sheet-toolrow">
                {(
                  [
                    { value: 'all', label: '所有边框' },
                    { value: 'outer', label: '外侧边框' },
                    { value: 'none', label: '无边框' },
                  ] as const
                ).map((preset) => (
                  <Button
                    key={preset.value}
                    size="sm"
                    variant="ghost"
                    disabled={blocked}
                    onClick={() =>
                      transform(
                        (current) =>
                          studioApplyBorders(current, sheet.id, selection, preset.value, {
                            style: borderStyle,
                            color: borderColor,
                          }),
                        `已设置${preset.label}；可撤销。`
                      )
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <span>边框</span>
            </div>
            <div className="z-studio-sheet-toolgroup z-studio-sheet-numbergroup">
              <Select
                size="sm"
                aria-label="单元格数字格式"
                options={
                  formats.some((item) => item.value === cell?.numberFormat) || !cell?.numberFormat
                    ? formats
                    : [...formats, { value: cell.numberFormat, label: '自定义格式' }]
                }
                value={cell?.numberFormat ?? 'General'}
                onChange={(numberFormat) => formatSelection({ numberFormat })}
                disabled={blocked}
              />
              <span>数字格式</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  aria-pressed={!!cell?.wrap}
                  onClick={() => formatSelection({ wrap: !cell?.wrap })}
                >
                  自动换行
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => mergeSelection()}
                >
                  合并单元格
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => mergeSelection(true)}
                >
                  拆分单元格
                </Button>
              </div>
              <span>单元格布局</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button size="sm" variant="ghost" disabled={blocked} onClick={openRowHeight}>
                  行高
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => fitRowHeights()}
                >
                  自动调整行高
                </Button>
              </div>
              <div className="z-studio-sheet-toolrow">
                <Button size="sm" variant="ghost" disabled={blocked} onClick={resetRowHeights}>
                  恢复默认行高
                </Button>
              </div>
              <span>行大小 · 磅</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => openColumnWidth()}
                >
                  列宽
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => fitColumnWidths()}
                >
                  自动调整列宽
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={blocked}
                onClick={() =>
                  transform(
                    (current) =>
                      studioSetColumnWidths(
                        current,
                        sheet.id,
                        Object.fromEntries(
                          Array.from(
                            { length: bounds.lastCol - bounds.firstCol + 1 },
                            (_, index) => [studioColumnLabel(bounds.firstCol + index), 112]
                          )
                        )
                      ),
                    '已恢复默认列宽；可撤销。'
                  )
                }
              >
                恢复默认列宽
              </Button>
              <span>列大小 · 字符</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <Button
                size="sm"
                variant="ghost"
                disabled={blocked}
                onClick={() => insertFunction('SUM')}
              >
                Σ 自动求和
              </Button>
              <span>公式</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => openRuleDialog('conditional')}
                >
                  条件格式
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || bounds.firstRow === bounds.lastRow}
                  onClick={() => fill('down')}
                  title="Ctrl / ⌘ + D"
                >
                  向下填充
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || bounds.firstCol === bounds.lastCol}
                  onClick={() => fill('right')}
                  title="Ctrl / ⌘ + R"
                >
                  向右填充
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || count < 2}
                  onClick={() => openRuleDialog('series')}
                >
                  序列填充
                </Button>
              </div>
              <span>规则与填充</span>
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="insert">
          <div className="z-studio-sheet-tools">
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Input
                  size="sm"
                  aria-label="图表数据区域"
                  placeholder="例如 A3:D6"
                  value={chartRange}
                  disabled={blocked}
                  onChange={(event) => setChartRange(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => addChart('bar')}
                >
                  柱状图
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => addChart('line')}
                >
                  折线图
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || !sheet.charts?.length}
                  aria-pressed={chartPanel}
                  onClick={() => setChartPanel((open) => !open)}
                >
                  查看图表 {sheet.charts?.length ?? 0}
                </Button>
              </div>
              <span title="首行作为系列名、首列作为分类；区域留空时使用选区。">图表</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={openHyperlinkDialog}
                  aria-label={
                    nativeLink ? '编辑超链接' : activeLink ? '编辑链接公式' : '插入超链接'
                  }
                  title="插入或编辑超链接（Ctrl / ⌘ + K）"
                >
                  超链接
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled || !activeLink}
                  onClick={openHyperlink}
                  title="打开超链接（Ctrl / ⌘ + Enter）"
                >
                  打开链接
                </Button>
              </div>
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || !activeLink}
                  onClick={removeHyperlink}
                >
                  移除超链接
                </Button>
              </div>
              <span>链接</span>
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="data">
          <div className="z-studio-sheet-tools z-studio-sheet-data-tools">
            <div className="z-studio-sheet-toolgroup">
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => openRuleDialog('validation')}
              >
                数据验证
              </Button>
              <span title={`${sheet.dataValidations?.length ?? 0} 条规则`}>数据工具</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() =>
                    transform(
                      (current) =>
                        studioSortRange(current, sheet.id, selection, selection.focus.col, 'asc'),
                      '已按活动列升序排列，首行保留为标题。',
                      () => fillAddresses('down')
                    )
                  }
                >
                  升序排序
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() =>
                    transform(
                      (current) =>
                        studioSortRange(current, sheet.id, selection, selection.focus.col, 'desc'),
                      '已按活动列降序排列，首行保留为标题。',
                      () => fillAddresses('down')
                    )
                  }
                >
                  降序排序
                </Button>
              </div>
              <span>排序当前选区，活动列为排序列</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Input
                  size="sm"
                  aria-label="筛选区域"
                  placeholder="例如 A3:D6"
                  value={filterRange}
                  disabled={blocked}
                  onChange={(event) => setFilterRange(event.target.value)}
                />
                <Select
                  size="sm"
                  aria-label="筛选列"
                  value={filterColumn}
                  disabled={blocked}
                  options={Array.from({ length: columnCount }, (_, index) => ({
                    value: studioColumnLabel(index + 1),
                    label: studioColumnLabel(index + 1),
                  }))}
                  onChange={(column) => {
                    setFilterColumn(column);
                    const condition = sheet.filter?.columns[column];
                    setFilterOperator(condition?.operator ?? 'contains');
                    setFilterValue(condition?.value ?? '');
                  }}
                />
                <Select
                  size="sm"
                  aria-label="筛选条件"
                  value={filterOperator}
                  disabled={blocked}
                  options={[
                    { value: 'contains', label: '包含' },
                    { value: 'equals', label: '等于' },
                    { value: 'greater', label: '大于' },
                    { value: 'less', label: '小于' },
                  ]}
                  onChange={(value) =>
                    setFilterOperator(value as StudioSheetFilter['columns'][string]['operator'])
                  }
                />
                <Input
                  size="sm"
                  aria-label="筛选值"
                  placeholder="留空清除此列条件"
                  value={filterValue}
                  disabled={blocked}
                  onChange={(event) => setFilterValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) applyFilter();
                  }}
                />
                <Button size="sm" disabled={blocked} onClick={applyFilter}>
                  应用筛选
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || !sheet.filter}
                  onClick={() =>
                    transform(
                      (current) => studioSetFilter(current, sheet.id),
                      '已清除筛选并显示全部数据。'
                    )
                  }
                >
                  清除筛选
                </Button>
              </div>
              <span title={`首行作为标题；当前隐藏 ${hiddenRows.size} 行`}>排序和筛选</span>
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="formulas">
          <div className="z-studio-sheet-tools">
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                {['SUM', 'AVERAGE', 'COUNT', 'IF'].map((name) => (
                  <Button
                    key={name}
                    size="sm"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => insertFunction(name)}
                  >
                    {name === 'SUM'
                      ? 'Σ 求和'
                      : name === 'AVERAGE'
                        ? '平均值'
                        : name === 'COUNT'
                          ? '计数'
                          : 'IF 条件'}
                  </Button>
                ))}
              </div>
              <span>插入函数</span>
            </div>
            <p className="z-studio-sheet-help">
              以 = 开头输入公式，支持跨工作表引用，如 =SUM(Sheet1!A1:A5)。
            </p>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="layout">
          <div className="z-studio-sheet-tools">
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => changeStructure('row', 'insert')}
                >
                  插入行
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || bounds.lastRow - bounds.firstRow + 1 >= rowCount}
                  onClick={() => changeStructure('row', 'delete')}
                >
                  删除行
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => changeStructure('column', 'insert')}
                >
                  插入列
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || bounds.lastCol - bounds.firstCol + 1 >= columnCount}
                  onClick={() => changeStructure('column', 'delete')}
                >
                  删除列
                </Button>
              </div>
              <span title="按选区操作，插入在选区之前；删除可撤销。">单元格</span>
            </div>
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button size="sm" variant="outline" disabled={blocked} onClick={addSheet}>
                  ＋ 新工作表
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => setRename(sheet.name)}
                >
                  重命名
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || rowCount >= STUDIO_SHEET_LIMITS.rows}
                  onClick={() => expandSheet('rows')}
                >
                  ＋ 100 行
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked || columnCount >= STUDIO_SHEET_LIMITS.columns}
                  onClick={() => expandSheet('columns')}
                >
                  ＋ 5 列
                </Button>
              </div>
              <span>工作表</span>
            </div>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="view">
          <div className="z-studio-sheet-tools">
            <div className="z-studio-sheet-toolgroup">
              <div className="z-studio-sheet-toolrow">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() =>
                    transform(
                      (current) =>
                        studioSetFreeze(current, sheet.id, 1, sheet.freeze?.columns ?? 0),
                      '已冻结首行。'
                    )
                  }
                >
                  冻结首行
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() =>
                    transform(
                      (current) => studioSetFreeze(current, sheet.id, sheet.freeze?.rows ?? 0, 1),
                      '已冻结首列。'
                    )
                  }
                >
                  冻结首列
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={blocked}
                  onClick={() =>
                    transform(
                      (current) => studioSetFreeze(current, sheet.id, 0, 0),
                      '已取消冻结窗格。'
                    )
                  }
                >
                  取消冻结
                </Button>
              </div>
              <span>冻结窗格</span>
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>
      <div className="z-studio-sheet-formulabar">
        <Input
          size="sm"
          className="z-studio-sheet-address"
          aria-label="单元格地址"
          value={addressDraft}
          disabled={disabled}
          onChange={(event) => setAddressDraft(event.target.value)}
          onBlur={() => setAddressDraft(address)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const range = studioParseRange(addressDraft);
            if (!range || range.lastRow > rowCount || range.lastCol > columnCount) {
              setNotice(
                `请输入 A1 至 ${studioCellAddress(rowCount, columnCount)} 范围内的地址或区域，例如 A1:D6。`
              );
              return;
            }
            if (range.firstRow !== range.lastRow || range.firstCol !== range.lastCol) {
              if (!commitEditing()) return;
              setSelection({
                anchor: { row: range.firstRow, col: range.firstCol },
                focus: { row: range.lastRow, col: range.lastCol },
              });
              gridRef.current?.focus();
              ensureVisible({ row: range.firstRow, col: range.firstCol });
            } else {
              const target = { row: range.firstRow, col: range.firstCol };
              selectCell(target);
              ensureVisible(target);
            }
          }}
        />
        <span className="z-studio-sheet-fx" aria-hidden="true">
          ƒx
        </span>
        <Input
          size="sm"
          ref={formulaRef}
          className="z-studio-sheet-formula"
          aria-label="表格公式栏"
          value={formulaValue}
          placeholder="输入内容或公式"
          disabled={disabled}
          readOnly={readOnly}
          status={inputError ? 'error' : 'default'}
          aria-invalid={!!inputError || undefined}
          aria-describedby={
            inputError ? `${gridId}-notice` : validationPrompt ? `${gridId}-validation` : undefined
          }
          onFocus={() => {
            if (editingRef.current?.origin !== 'formula' || editingRef.current.sheetId !== sheet.id)
              beginEditing('formula');
          }}
          onChange={(event) => {
            if (blocked) return;
            setEdit({ sheetId: sheet.id, address, value: event.target.value, origin: 'formula' });
          }}
          onBlur={() => commitEditing()}
          onKeyDown={onEditorKeyDown}
        />
        {editing && (
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label="确认单元格编辑"
              disabled={blocked}
              onClick={() => commitEditing(true)}
            >
              ✓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="取消单元格编辑"
              onClick={() => {
                setEdit(null);
                gridRef.current?.focus();
              }}
            >
              ×
            </Button>
          </>
        )}
        {activeValidation?.rule.type === 'list' && !!activeValidation.options?.length && (
          <Select
            size="sm"
            className="z-studio-sheet-validation-list"
            aria-label={`${address} 数据验证选项`}
            value={String(calculated.read(sheet.id, address).value ?? '')}
            placeholder="选择列表值"
            options={activeValidation.options.map((value) => ({ value, label: value }))}
            disabled={blocked}
            onChange={(value) => {
              if (
                patch({
                  [address]: {
                    input: /^[=']/.test(value) ? `'${value}` : value,
                  },
                })
              )
                setEdit(null);
            }}
          />
        )}
      </div>
      {validationPrompt && activeValidation && (
        <div
          id={`${gridId}-validation`}
          className="z-studio-sheet-validation-prompt"
          data-invalid={!activeValidation.valid || undefined}
        >
          {validationPrompt}
        </div>
      )}
      {search && (
        <StudioSheetSearch
          document={document}
          activeSheetId={sheet.id}
          selection={selection}
          snapshot={search.snapshot}
          mode={search.mode}
          focusVersion={searchFocusVersion}
          disabled={disabled}
          readOnly={readOnly}
          onModeChange={(mode) =>
            setSearch((current) => (current ? { ...current, mode } : current))
          }
          onNavigate={navigateSearch}
          onReplace={replaceSearch}
          onClose={() => {
            setSearch(null);
            setSearchReveal(null);
            gridRef.current?.focus();
          }}
        />
      )}
      <div className="z-studio-sheet-workarea">
        <div
          ref={gridRef}
          id={`${gridId}-grid`}
          className="z-studio-sheet-grid"
          role="grid"
          aria-label={`${sheet.name} 单元格网格`}
          aria-rowcount={rowCount + 1}
          aria-colcount={columnCount + 1}
          aria-readonly={readOnly}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          aria-activedescendant={activeVisible ? `${gridId}-${address}` : undefined}
          onKeyDown={onGridKeyDown}
          onCopy={onCopy}
          onPaste={onPaste}
          onScroll={(event) => {
            const grid = event.currentTarget;
            setViewport({
              top: grid.scrollTop,
              left: grid.scrollLeft,
              width: grid.clientWidth || 900,
              height: grid.clientHeight || 420,
            });
          }}
        >
          <div
            className="z-studio-sheet-canvas"
            style={{
              width: offsets[columnCount],
              height: HEADER_HEIGHT + rowLayout.offsets[shownRows.length],
            }}
          >
            <div
              role="row"
              aria-rowindex={1}
              className="z-studio-sheet-columnheaders"
              style={{ width: offsets[columnCount] }}
            >
              <div role="columnheader" aria-label="行号" className="z-studio-sheet-corner" />
              {visibleColumns.map((col) => (
                <div
                  key={col}
                  role="columnheader"
                  aria-colindex={col + 1}
                  className="z-studio-sheet-columnheader"
                  data-selected={(col >= bounds.firstCol && col <= bounds.lastCol) || undefined}
                  data-frozen={col <= freezeColumns || undefined}
                  style={{
                    left: offsets[col - 1] + (col <= freezeColumns ? viewport.left : 0),
                    width: offsets[col] - offsets[col - 1],
                    zIndex: col <= freezeColumns ? 7 : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (disabled) return;
                    event.preventDefault();
                    if (!commitEditing()) return;
                    setSelection({ anchor: { row: 1, col }, focus: { row: rowCount, col } });
                    gridRef.current?.focus();
                  }}
                  onDoubleClick={() => fitColumnWidths({ firstCol: col, lastCol: col })}
                >
                  {studioColumnLabel(col)}
                  <span
                    role="separator"
                    aria-label={`${studioColumnLabel(col)} 列宽`}
                    aria-disabled={!!blocked}
                    aria-orientation="vertical"
                    aria-valuemin={1}
                    aria-valuemax={255}
                    aria-valuenow={Number(
                      studioColumnCharacterWidth(offsets[col] - offsets[col - 1]).toFixed(2)
                    )}
                    tabIndex={blocked ? -1 : 0}
                    className="z-studio-sheet-column-resize"
                    onPointerDown={(event) => startColumnResize(event, col)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      fitColumnWidths({ firstCol: col, lastCol: col });
                    }}
                    onKeyDown={(event) => {
                      if (blocked || !commitEditing()) return;
                      const width = offsets[col] - offsets[col - 1];
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        openColumnWidth({ firstCol: col, lastCol: col });
                      }
                      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        const next =
                          event.key === 'Home'
                            ? 12
                            : event.key === 'End'
                              ? 1790
                              : Math.max(
                                  12,
                                  Math.min(
                                    1790,
                                    width +
                                      (event.key === 'ArrowRight' ? 7 : -7) *
                                        (event.shiftKey ? 4 : 1)
                                  )
                                );
                        transform(
                          (current) =>
                            studioSetColumnWidths(current, sheet.id, {
                              [studioColumnLabel(col)]: next,
                            }),
                          '已通过键盘调整列宽；可撤销。'
                        );
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            {visibleRows.map((row) => (
              <div
                key={`${sheet.id}-${row}`}
                role="row"
                aria-rowindex={row + 1}
                className="z-studio-sheet-row"
                data-frozen={row <= (sheet.freeze?.rows ?? 0) || undefined}
                style={{
                  top:
                    HEADER_HEIGHT +
                    studioRowTop(rowLayout, row) +
                    (row <= (sheet.freeze?.rows ?? 0) ? viewport.top : 0),
                  width: offsets[columnCount],
                  height: studioRowSpanHeight(rowLayout, row),
                  zIndex: row <= (sheet.freeze?.rows ?? 0) ? 4 : undefined,
                }}
              >
                <div
                  role="rowheader"
                  aria-colindex={1}
                  className="z-studio-sheet-rowheader"
                  style={{ height: studioRowSpanHeight(rowLayout, row) }}
                  onDoubleClick={() => fitRowHeights({ firstRow: row, lastRow: row })}
                  data-selected={(row >= bounds.firstRow && row <= bounds.lastRow) || undefined}
                  onPointerDown={(event) => {
                    if (disabled) return;
                    event.preventDefault();
                    if (!commitEditing()) return;
                    setSelection({ anchor: { row, col: 1 }, focus: { row, col: columnCount } });
                    gridRef.current?.focus();
                  }}
                >
                  {row}
                  <span
                    role="separator"
                    aria-label={`${row} 行高`}
                    aria-disabled={!!blocked}
                    aria-orientation="horizontal"
                    aria-valuemin={0.75}
                    aria-valuemax={STUDIO_MAX_ROW_HEIGHT}
                    aria-valuenow={Number(
                      (sheet.rowHeights?.[String(row)] ?? sheet.defaultRowHeight ?? 18).toFixed(2)
                    )}
                    tabIndex={blocked ? -1 : 0}
                    className="z-studio-sheet-row-resize"
                    onPointerDown={(event) => startRowResize(event, row)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      fitRowHeights({ firstRow: row, lastRow: row });
                    }}
                    onKeyDown={(event) => {
                      if (blocked || !commitEditing()) return;
                      const height =
                        sheet.rowHeights?.[String(row)] ?? sheet.defaultRowHeight ?? 18;
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setSelection({
                          anchor: { row, col: 1 },
                          focus: { row, col: columnCount },
                        });
                        setHeightDraft(String(height));
                        setHeightError('');
                        setHeightDialog({ firstRow: row, lastRow: row });
                      }
                      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                        event.preventDefault();
                        const next =
                          event.key === 'Home'
                            ? 0.75
                            : event.key === 'End'
                              ? STUDIO_MAX_ROW_HEIGHT
                              : Math.max(
                                  0.75,
                                  Math.min(
                                    STUDIO_MAX_ROW_HEIGHT,
                                    height +
                                      (event.key === 'ArrowDown' ? 0.75 : -0.75) *
                                        (event.shiftKey ? 4 : 1)
                                  )
                                );
                        transform(
                          (current) =>
                            studioSetRowHeight(
                              current,
                              sheet.id,
                              { firstRow: row, lastRow: row },
                              next
                            ),
                          '已通过键盘调整行高；可撤销。'
                        );
                      }
                    }}
                  />
                </div>
                {visibleColumns.map((col) => {
                  const merge = studioMergedRange(sheet, { row, col });
                  if (merge && (merge.firstRow !== row || merge.firstCol !== col)) return null;
                  const currentAddress = studioCellAddress(row, col);
                  const currentCell = sheet.cells[currentAddress];
                  const conditionalStyle = studioConditionalCellStyle(
                    sheet,
                    currentAddress,
                    calculated
                  );
                  const displayCell = { ...(currentCell ?? { input: '' }), ...conditionalStyle };
                  const validation = studioCellValidation(sheet, currentAddress, calculated);
                  const key = `${sheet.id}:${currentAddress}`;
                  const currentError = calculated.errors.get(key);
                  const currentLink = studioCellHyperlink(
                    document,
                    sheet.id,
                    currentAddress,
                    calculated
                  );
                  const value =
                    calculated.values.get(key) ??
                    studioInputValue(currentCell?.input ?? '', currentCell?.numberFormat);
                  const selected =
                    row >= bounds.firstRow &&
                    row <= bounds.lastRow &&
                    col >= bounds.firstCol &&
                    col <= bounds.lastCol;
                  const active = currentAddress === address;
                  const currentEditing =
                    editing?.origin === 'cell' &&
                    editing.sheetId === sheet.id &&
                    editing.address === currentAddress;
                  return (
                    <div
                      key={col}
                      id={`${gridId}-${currentAddress}`}
                      role="gridcell"
                      aria-colindex={col + 1}
                      aria-colspan={merge ? merge.lastCol - merge.firstCol + 1 : undefined}
                      aria-rowspan={merge ? merge.lastRow - merge.firstRow + 1 : undefined}
                      aria-selected={selected}
                      aria-invalid={(validation && !validation.valid) || undefined}
                      aria-describedby={
                        active && validationPrompt ? `${gridId}-validation` : undefined
                      }
                      aria-label={`${currentAddress}${currentError ? ` ${currentError}` : ''}`}
                      className="z-studio-sheet-cell"
                      data-active={active || undefined}
                      data-selected={selected || undefined}
                      data-error={!!currentError || undefined}
                      data-invalid={(validation && !validation.valid) || undefined}
                      data-conditional={Object.keys(conditionalStyle).length > 0 || undefined}
                      data-merged={!!merge || undefined}
                      data-frozen={col <= freezeColumns || undefined}
                      data-wrap={currentCell?.wrap || undefined}
                      style={{
                        left: offsets[col - 1] + (col <= freezeColumns ? viewport.left : 0),
                        width: offsets[merge?.lastCol ?? col] - offsets[col - 1],
                        height: studioRowSpanHeight(rowLayout, row, merge?.lastRow ?? row),
                        zIndex: col <= freezeColumns ? 3 : merge ? 2 : undefined,
                        fontWeight: displayCell.bold ? 700 : undefined,
                        fontStyle: displayCell.italic ? 'italic' : undefined,
                        fontFamily: displayCell.fontFamily
                          ? `${quotedFontFamily(displayCell.fontFamily)}, var(--z-font-sans)`
                          : undefined,
                        fontSize:
                          displayCell.fontSize === undefined
                            ? undefined
                            : `${displayCell.fontSize}pt`,
                        textDecoration:
                          displayCell.underline || currentLink ? 'underline' : undefined,
                        color:
                          displayCell.color ?? (currentLink ? 'var(--z-color-link)' : undefined),
                        backgroundColor: displayCell.background,
                        alignItems:
                          (currentCell?.verticalAlign ?? 'bottom') === 'top'
                            ? 'flex-start'
                            : currentCell?.verticalAlign === 'middle'
                              ? 'center'
                              : 'flex-end',
                        ...studioCellBordersCss({
                          ...currentCell,
                          input: currentCell?.input ?? '',
                          borders: merge
                            ? {
                                ...currentCell?.borders,
                                right:
                                  sheet.cells[studioCellAddress(merge.firstRow, merge.lastCol)]
                                    ?.borders?.right ?? currentCell?.borders?.right,
                                bottom:
                                  sheet.cells[studioCellAddress(merge.lastRow, merge.firstCol)]
                                    ?.borders?.bottom ?? currentCell?.borders?.bottom,
                              }
                            : currentCell?.borders,
                        }),
                        textAlign:
                          currentCell?.align && currentCell.align !== 'general'
                            ? currentCell.align
                            : typeof value === 'number'
                              ? 'right'
                              : 'left',
                      }}
                      data-hyperlink={!!currentLink || undefined}
                      title={
                        currentError ??
                        currentLink?.tooltip ??
                        currentLink?.target ??
                        currentLink?.location ??
                        currentCell?.input
                      }
                      onPointerDown={(event) => {
                        if (disabled || currentEditing || event.button !== 0) return;
                        event.preventDefault();
                        if (!selectCell({ row, col }, event.shiftKey)) return;
                        draggingRef.current = true;
                      }}
                      onPointerEnter={() => {
                        if (!disabled && draggingRef.current)
                          setSelection((current) => ({ ...current, focus: { row, col } }));
                      }}
                      onDoubleClick={() => {
                        if (blocked) return;
                        if (editingRef.current?.address !== currentAddress && !commitEditing())
                          return;
                        const position = { row, col };
                        setSelection({ anchor: position, focus: position });
                        beginEditing('cell', undefined, currentAddress);
                      }}
                    >
                      {currentEditing ? (
                        <Input
                          ref={cellInputRef}
                          size="sm"
                          aria-label={`编辑 ${currentAddress}`}
                          value={editing.value}
                          disabled={blocked}
                          status={inputError ? 'error' : 'default'}
                          aria-invalid={!!inputError || undefined}
                          aria-describedby={
                            inputError
                              ? `${gridId}-notice`
                              : active && validationPrompt
                                ? `${gridId}-validation`
                                : undefined
                          }
                          onChange={(event) => {
                            if (!blocked) setEdit({ ...editing, value: event.target.value });
                          }}
                          onBlur={() => commitEditing()}
                          onKeyDown={onEditorKeyDown}
                        />
                      ) : (
                        <span>
                          {currentCell?.input
                            ? studioDisplayCell(
                                displayCell,
                                calculated.values.get(key),
                                currentError
                              )
                            : currentLink?.display ||
                              currentLink?.target ||
                              currentLink?.location ||
                              ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {chartPanel && (
          <aside className="z-studio-sheet-chartpanel" aria-label="工作表图表">
            <div className="z-studio-sheet-chartheading">
              <strong>图表</strong>
              <Button
                size="sm"
                variant="ghost"
                aria-label="关闭图表面板"
                onClick={() => setChartPanel(false)}
              >
                ×
              </Button>
            </div>
            {(sheet.charts ?? []).map((chart) => (
              <div
                className="z-studio-sheet-chartcard"
                key={chart.id}
                data-selected={chart.id === selectedChart || undefined}
              >
                <Input
                  size="sm"
                  aria-label={`图表标题 ${chart.id}`}
                  value={chart.title}
                  maxLength={256}
                  readOnly={readOnly}
                  disabled={disabled}
                  onFocus={() => setSelectedChart(chart.id)}
                  onChange={(event) => changeChart(chart.id, { title: event.target.value })}
                />
                <SheetChartPreview chart={chart} data={studioChartData(sheet, chart, calculated)} />
                <div className="z-studio-sheet-chartcontrols">
                  <span>{chart.range}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={blocked}
                    onClick={() =>
                      changeChart(chart.id, { type: chart.type === 'bar' ? 'line' : 'bar' })
                    }
                  >
                    切换为{chart.type === 'bar' ? '折线图' : '柱状图'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={blocked}
                    aria-label={`删除图表 ${chart.title}`}
                    onClick={() => changeChart(chart.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
            {!sheet.charts?.length && <p>在插入工具栏选择数据区域后创建图表。</p>}
          </aside>
        )}
      </div>
      <div className="z-studio-sheet-bottom">
        <Tabs value={sheet.id} onValueChange={switchSheet} className="z-studio-sheet-tabs">
          <Tabs.List aria-label="工作表">
            {document.sheets.map((item) => (
              <Tabs.Trigger
                key={item.id}
                value={item.id}
                disabled={disabled}
                aria-controls={`${gridId}-grid`}
                onDoubleClick={() => {
                  if (!blocked && item.id === sheet.id) setRename(item.name);
                }}
              >
                {item.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <Button
          size="sm"
          variant="ghost"
          aria-label="新增工作表"
          title="新增工作表"
          disabled={blocked}
          onClick={addSheet}
        >
          <Plus size={16} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="删除工作表"
          title="删除工作表"
          disabled={blocked || document.sheets.length <= 1}
          onClick={deleteSheet}
        >
          <Trash size={16} />
        </Button>
        <span
          id={`${gridId}-notice`}
          className="z-studio-sheet-notice"
          role="status"
          title={noticeText}
        >
          {noticeText}
        </span>
        <span
          className="z-studio-sheet-summary"
          title={`${count > 1 ? `选中 ${count} 格` : address}${summary ? ` · ${summary}` : ''}`}
        >
          {count > 1 ? `选中 ${count} 格` : address}
          {summary ? ` · ${summary}` : ''}
        </span>
      </div>
      {rename !== null && (
        <div className="z-studio-sheet-rename">
          <Input
            size="sm"
            aria-label="工作表新名称"
            value={rename}
            autoFocus
            disabled={blocked}
            onChange={(event) => setRename(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') setRename(null);
            }}
          />
          <Button size="sm" disabled={blocked} onClick={commitRename}>
            确认名称
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRename(null)}>
            取消
          </Button>
        </div>
      )}
      {pasteDialog && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setPasteDialog(false);
          }}
        >
          <Modal.Content size="md">
            <Modal.Header>
              <Modal.Title>选择性粘贴</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p className="z-studio-sheet-paste-help">
                从最近一次在 OfficeStudio 中复制的区域粘贴到 {address}。
              </p>
              <div
                className="z-studio-sheet-paste-options"
                role="radiogroup"
                aria-label="选择粘贴方式"
              >
                {pasteModes.map((option) => (
                  <label
                    key={option.value}
                    className="z-studio-sheet-paste-option"
                    data-checked={pasteMode === option.value || undefined}
                  >
                    <input
                      type="radio"
                      name={`${gridId}-paste-mode`}
                      value={option.value}
                      checked={pasteMode === option.value}
                      onChange={() => setPasteMode(option.value)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setPasteDialog(false)}>
                取消
              </Button>
              <Button
                disabled={blocked || !clipboardRef.current}
                onClick={() => {
                  const clipboard = clipboardRef.current;
                  if (!clipboard) {
                    setNotice('请先在 OfficeStudio 中复制单元格区域。');
                    return;
                  }
                  if (pasteClipboard(clipboard.text, clipboard.source, pasteMode))
                    setPasteDialog(false);
                }}
              >
                粘贴
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      )}
      {heightDialog && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setHeightDialog(null);
          }}
        >
          <Modal.Content size="sm">
            <Modal.Header>
              <Modal.Title>设置行高</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <form
                id={`${gridId}-height-form`}
                onSubmit={(event) => {
                  event.preventDefault();
                  applyRowHeight();
                }}
              >
                <p>
                  第 {heightDialog.firstRow}–{heightDialog.lastRow} 行；0–409.5 磅，0 表示隐藏。
                </p>
                <Input
                  aria-label="行高（磅）"
                  inputMode="decimal"
                  data-autofocus
                  value={heightDraft}
                  disabled={blocked}
                  status={heightError ? 'error' : 'default'}
                  aria-describedby={heightError ? `${gridId}-height-error` : undefined}
                  onChange={(event) => {
                    setHeightDraft(event.target.value);
                    setHeightError('');
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
                    )
                      event.preventDefault();
                  }}
                />
                {heightError && (
                  <p id={`${gridId}-height-error`} role="alert">
                    {heightError}
                  </p>
                )}
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setHeightDialog(null)}>
                取消
              </Button>
              <Button type="submit" form={`${gridId}-height-form`} disabled={blocked}>
                确定行高
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      )}
      {widthDialog && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setWidthDialog(null);
          }}
        >
          <Modal.Content size="sm">
            <Modal.Header>
              <Modal.Title>设置列宽</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <form
                id={`${gridId}-width-form`}
                onSubmit={(event) => {
                  event.preventDefault();
                  commitColumnWidth();
                }}
              >
                <p>
                  {studioColumnLabel(widthDialog.firstCol)}–{studioColumnLabel(widthDialog.lastCol)}{' '}
                  列；1–255 个字符宽。
                </p>
                <Input
                  aria-label="列宽（字符）"
                  inputMode="decimal"
                  data-autofocus
                  value={widthDraft}
                  disabled={blocked}
                  status={widthError ? 'error' : 'default'}
                  aria-describedby={widthError ? `${gridId}-width-error` : undefined}
                  onChange={(event) => {
                    setWidthDraft(event.target.value);
                    setWidthError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.nativeEvent.isComposing)
                      event.preventDefault();
                  }}
                />
                <p>宽度按默认字体字符估算，1 字符约 7 像素，另加 5 像素留白。</p>
                {widthError && (
                  <p id={`${gridId}-width-error`} role="alert">
                    {widthError}
                  </p>
                )}
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onClick={() => setWidthDialog(null)}>
                取消
              </Button>
              <Button type="submit" form={`${gridId}-width-form`} disabled={blocked}>
                应用列宽
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      )}
      {ruleDialog && (
        <StudioSheetRuleDialog
          key={`${sheet.id}:${ruleDialog.kind}:${ruleDialog.ruleId ?? 'new'}`}
          mode={ruleDialog}
          sheet={sheet}
          range={studioRangeAddress(bounds)}
          blocked={blocked}
          onClose={() => setRuleDialog(null)}
          onEdit={setRuleDialog}
          onConditional={(rule) => {
            if (blocked || !commitEditing()) throw new Error('请先确认单元格输入。');
            replaceDocument(studioSetConditionalFormat(latestRef.current, sheet.id, rule));
            setNotice('已应用条件格式，可在规则窗口中管理或撤销。');
          }}
          onValidation={(rule) => {
            if (blocked || !commitEditing()) throw new Error('请先确认单元格输入。');
            replaceDocument(studioSetDataValidation(latestRef.current, sheet.id, rule));
            setNotice('已应用数据验证，现有无效值会显示标记。');
          }}
          onRemove={(kind, id) => {
            if (blocked) return;
            replaceDocument(
              kind === 'conditional'
                ? studioRemoveConditionalFormat(latestRef.current, sheet.id, id)
                : studioRemoveDataValidation(latestRef.current, sheet.id, id)
            );
            if (ruleDialog.ruleId === id) setRuleDialog({ kind });
            setNotice('已删除规则，可撤销恢复。');
          }}
          onSeries={(options) => {
            if (blocked || !commitEditing()) throw new Error('请先确认单元格输入。');
            const next = studioFillSeries(latestRef.current, sheet.id, selection, options);
            const message = validationNotice(
              next,
              sheet.id,
              fillAddresses(options.direction, options.seedCount),
              '已完成序列填充，可撤销恢复。'
            );
            replaceDocument(next);
            setNotice(message);
          }}
        />
      )}
      {linkDialog && (
        <StudioSheetHyperlinkDialog
          state={linkDialog}
          document={document}
          blocked={!!blocked}
          onClose={() => setLinkDialog(null)}
          onSave={(link, displayText) => {
            if (blocked || !commitEditing()) throw new Error('请先确认单元格输入。');
            let next = studioSetSheetHyperlink(latestRef.current, linkDialog.sheetId, link);
            if (displayText !== undefined) {
              next = studioPatchCells(next, linkDialog.sheetId, {
                [linkDialog.address]: { input: displayText ? `'${displayText}` : '' },
              });
            }
            replaceDocument(next);
            setNotice('已保存超链接，可撤销恢复。');
          }}
        />
      )}
    </div>
  );
}

export default StudioSheet;

const chartPalette = [
  'var(--z-color-primary)',
  'var(--z-color-info)',
  'var(--z-color-warning)',
  'var(--z-color-link)',
  'var(--z-color-danger)',
  'var(--z-color-success)',
  'var(--z-color-fg-muted)',
  'var(--z-color-primary-hover)',
];

function SheetChartPreview({
  chart,
  data,
}: {
  chart: StudioSheetChart;
  data: ReturnType<typeof studioChartData>;
}) {
  const numbers = data.series.flatMap((series) =>
    series.values.filter((value): value is number => value !== null)
  );
  const low = Math.min(0, ...numbers);
  const high = Math.max(0, ...numbers);
  const span = high - low || 1;
  const count = Math.max(1, data.categories.length);
  const y = (value: number) => 145 - ((value - low) / span) * 125;
  const zero = y(0);
  const group = 230 / count;
  const labelStep = Math.max(1, Math.ceil(count / 5));
  return (
    <>
      <svg
        className="z-studio-sheet-chart"
        role="img"
        aria-label={`${chart.title} ${chart.type === 'bar' ? '柱状图' : '折线图'}`}
        viewBox="0 0 300 190"
      >
        <title>{chart.title}</title>
        <line x1="48" y1={zero} x2="282" y2={zero} stroke="var(--z-color-border-strong)" />
        <line x1="48" y1="18" x2="48" y2="145" stroke="var(--z-color-border-strong)" />
        <text x="43" y="24" textAnchor="end" fill="currentColor">
          {Number(high.toPrecision(3))}
        </text>
        <text x="43" y="145" textAnchor="end" fill="currentColor">
          {Number(low.toPrecision(3))}
        </text>
        {data.series.map((series, index) =>
          chart.type === 'bar' ? (
            <g key={index} fill={chartPalette[index]}>
              {series.values.map((value, row) =>
                value === null ? null : (
                  <rect
                    key={row}
                    x={50 + row * group + (index * group * 0.8) / data.series.length}
                    y={Math.min(zero, y(value))}
                    width={Math.max(0.3, (group * 0.8) / data.series.length)}
                    height={Math.abs(y(value) - zero)}
                  >
                    <title>{`${data.categories[row]} · ${series.name}: ${value}`}</title>
                  </rect>
                )
              )}
            </g>
          ) : (
            <path
              key={index}
              fill="none"
              stroke={chartPalette[index]}
              strokeWidth="2"
              d={series.values
                .map((value, row) =>
                  value === null
                    ? ''
                    : `${row === 0 || series.values[row - 1] === null ? 'M' : 'L'}${50 + (row + 0.5) * group},${y(value)}`
                )
                .join(' ')}
            />
          )
        )}
        {data.categories.map((label, index) =>
          index % labelStep === 0 ? (
            <text
              key={index}
              x={50 + (index + 0.5) * group}
              y="160"
              textAnchor="middle"
              fill="currentColor"
            >
              {label.slice(0, 7)}
            </text>
          ) : null
        )}
        {data.series.map((series, index) =>
          index < 4 ? (
            <g key={index}>
              <rect x={50 + index * 62} y="176" width="7" height="7" fill={chartPalette[index]} />
              <text x={60 + index * 62} y="183" fill="currentColor">
                {series.name.slice(0, 5)}
              </text>
            </g>
          ) : null
        )}
      </svg>
      <Collapse
        className="z-studio-sheet-chartdata"
        items={[
          {
            key: 'data',
            label: '查看图表数据',
            children: (
              <Table density="compact" aria-label={`${chart.title} 数据`}>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell scope="col">分类</Table.HeaderCell>
                    {data.series.map((series, index) => (
                      <Table.HeaderCell scope="col" key={index}>
                        {series.name}
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {data.categories.map((category, row) => (
                    <Table.Row key={row}>
                      <Table.HeaderCell scope="row">{category}</Table.HeaderCell>
                      {data.series.map((series, index) => (
                        <Table.Cell key={index}>{series.values[row] ?? ''}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ),
          },
        ]}
      />
    </>
  );
}
