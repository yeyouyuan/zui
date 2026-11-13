import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@zui/react';
import type ExcelJS from 'exceljs';
import {
  applyExcelChanges,
  calculateExcel,
  cellInput,
  excelEditingIssue,
  exportExcel,
  loadExcel,
} from './excel-document';
import type { EditorProps, ExcelChanges } from './office-model';

export default function ExcelEditor({
  source,
  changes,
  disabled,
  onChange,
  onExporter,
}: EditorProps<ExcelChanges>) {
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [error, setError] = useState('');
  const [editingIssue, setEditingIssue] = useState('正在检查文件兼容性…');
  const [sheetId, setSheetId] = useState(0);
  const [selected, setSelected] = useState('A1');
  const [startRow, setStartRow] = useState(1);
  const [startCol, setStartCol] = useState(1);
  const formulaInput = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void loadExcel(source)
      .then((book) => {
        if (active) {
          setWorkbook(book);
          setSheetId(book.worksheets[0].id);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    void excelEditingIssue(source)
      .then((issue) => {
        if (active) setEditingIssue(issue);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [source]);
  // Changes are reversible; reset to the original model when dropping a draft.
  const [display, setDisplay] = useState<ExcelJS.Workbook | null>(null);
  useEffect(() => {
    let active = true;
    if (!workbook) return;
    void loadExcel(source)
      .then((book) => {
        applyExcelChanges(book, changes);
        if (active) setDisplay(book);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [source, changes, workbook]);
  useEffect(() => {
    onExporter(workbook && !error && !editingIssue ? () => exportExcel(source, changes) : null);
    return () => onExporter(null);
  }, [source, changes, workbook, error, editingIssue, onExporter]);
  const calculations = useMemo(
    () =>
      display
        ? calculateExcel(display)
        : { values: new Map<string, unknown>(), errors: new Map<string, string>() },
    [display]
  );
  const sheet = display?.getWorksheet(sheetId);
  const cell = sheet?.getCell(selected);
  const key = `${sheetId}:${selected}`;
  const input = changes.cells[key]?.value ?? (cell ? cellInput(cell) : '');
  const modify = (value: string, extra: { bold?: boolean; numberFormat?: string } = {}) => {
    if (
      !disabled &&
      !editingIssue &&
      cell &&
      (!cell.isMerged || cell.master.address === cell.address)
    )
      onChange({ cells: { ...changes.cells, [key]: { ...changes.cells[key], value, ...extra } } });
  };
  const columnName = (col: number) => sheet?.getColumn(col).letter ?? '';
  const rows = Array.from({ length: 25 }, (_, index) => startRow + index);
  const cols = Array.from({ length: 10 }, (_, index) => startCol + index);
  const cellDisplay = (cell: ExcelJS.Cell) => {
    const key = `${sheetId}:${cell.address}`;
    if (calculations.errors.has(key)) return calculations.errors.get(key);
    const result = calculations.values.get(key);
    if (result !== undefined) return String(result);
    return cell.text;
  };
  const formattedDisplay = (cell: ExcelJS.Cell) => {
    const calculated = calculations.values.get(`${sheetId}:${cell.address}`);
    if (typeof cell.value !== 'number' && typeof calculated !== 'number') return cellDisplay(cell);
    const value = Number(cellDisplay(cell));
    if (cellDisplay(cell) === '' || !Number.isFinite(value)) return cellDisplay(cell);
    if (cell.numFmt === '0.00') return value.toFixed(2);
    if (cell.numFmt === '0%')
      return new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 0 }).format(
        value
      );
    if (cell.numFmt === '¥#,##0.00')
      return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
    return cellDisplay(cell);
  };
  const choose = (row: number, col: number, focus = false) => {
    if (!sheet) return;
    const next = sheet.getCell(row, col).master.address;
    setSelected(next);
    if (focus)
      requestAnimationFrame(() =>
        grid.current?.querySelector<HTMLButtonElement>(`button[data-cell="${next}"]`)?.focus()
      );
  };
  return (
    <>
      <p className="office-help">
        选择单元格后编辑公式栏，支持数值、文本、公式、加粗和数字格式。公式实时计算；不支持的公式会显示错误并保留公式，导出后由
        Excel 重算。旧版 XLS、宏、图表和透视表请使用桌面 Excel。
      </p>
      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      {editingIssue && (
        <p className="office-notice" role="status">
          {editingIssue}
        </p>
      )}
      {!sheet && !error && (
        <p className="office-loading" role="status">
          正在读取工作表…
        </p>
      )}
      {sheet && cell && (
        <>
          <div className="office-sheet-tabs" role="group" aria-label="Excel 工作表">
            {display!.worksheets.map((sheet) => (
              <button
                type="button"
                key={sheet.id}
                aria-pressed={sheetId === sheet.id}
                onClick={() => {
                  setSheetId(sheet.id);
                  setSelected('A1');
                  setStartRow(1);
                  setStartCol(1);
                }}
              >
                {sheet.name}
              </button>
            ))}
          </div>
          <div className="office-formula-bar">
            <strong aria-label="当前单元格">{selected}</strong>
            <span aria-hidden="true">fx</span>
            <input
              ref={formulaInput}
              aria-label={`单元格 ${selected} 的值或公式`}
              value={input}
              disabled={
                disabled ||
                Boolean(editingIssue) ||
                (cell.isMerged && cell.master.address !== cell.address)
              }
              onChange={(event) => modify(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                  grid.current
                    ?.querySelector<HTMLButtonElement>(`button[data-cell="${selected}"]`)
                    ?.focus();
              }}
            />
            <Button
              size="sm"
              variant="outline"
              aria-pressed={Boolean(cell.font?.bold)}
              disabled={disabled || Boolean(editingIssue)}
              onClick={() => modify(input, { bold: !cell.font?.bold })}
            >
              加粗
            </Button>
            <select
              aria-label="单元格数字格式"
              disabled={disabled || Boolean(editingIssue)}
              value={
                ['General', '0.00', '0%', '¥#,##0.00'].includes(cell.numFmt)
                  ? cell.numFmt
                  : 'General'
              }
              onChange={(event) => modify(input, { numberFormat: event.target.value })}
            >
              <option value="General">常规</option>
              <option value="0.00">两位小数</option>
              <option value="0%">百分比</option>
              <option value="¥#,##0.00">人民币</option>
            </select>
          </div>
          {calculations.errors.size > 0 && (
            <p className="office-notice" role="status">
              {calculations.errors.size} 个公式暂时无法计算，请检查公式或导出到 Excel 复核。
            </p>
          )}
          <div
            ref={grid}
            className="office-sheet-grid"
            tabIndex={0}
            role="region"
            aria-label="Excel 单元格预览"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col" aria-label="行号">
                    行
                  </th>
                  {cols.map((col) => (
                    <th scope="col" key={col}>
                      {columnName(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {cols.map((col) => {
                      const current = sheet.getCell(row, col);
                      const isOtherMergedCell =
                        current.isMerged && current.master.address !== current.address;
                      return (
                        <td
                          key={col}
                          data-selected={selected === current.address || undefined}
                          style={{
                            background:
                              current.fill?.type === 'pattern' && current.fill.fgColor?.argb
                                ? `#${current.fill.fgColor.argb.slice(-6)}`
                                : '#ffffff',
                          }}
                        >
                          <button
                            type="button"
                            data-cell={current.address}
                            tabIndex={selected === current.address ? 0 : -1}
                            aria-label={`单元格 ${current.address}，${isOtherMergedCell ? '↖ 合并' : formattedDisplay(current) || '空白'}`}
                            aria-pressed={selected === current.address}
                            style={{
                              fontWeight: current.font?.bold ? 700 : undefined,
                              textAlign:
                                typeof current.value === 'number' || current.formula
                                  ? 'right'
                                  : 'left',
                              color: current.font?.color?.argb
                                ? `#${current.font.color.argb.slice(-6)}`
                                : undefined,
                            }}
                            onClick={() => choose(row, col)}
                            onDoubleClick={() => formulaInput.current?.focus()}
                            onKeyDown={(event) => {
                              const direction = {
                                ArrowDown: [1, 0],
                                ArrowUp: [-1, 0],
                                ArrowRight: [0, 1],
                                ArrowLeft: [0, -1],
                              }[event.key];
                              if (direction) {
                                event.preventDefault();
                                choose(
                                  Math.max(startRow, Math.min(startRow + 24, row + direction[0])),
                                  Math.max(startCol, Math.min(startCol + 9, col + direction[1])),
                                  true
                                );
                              }
                              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                formulaInput.current?.focus();
                              }
                            }}
                          >
                            {isOtherMergedCell ? '↖ 合并' : formattedDisplay(current)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="office-sheet-pagination">
            <span>
              {sheet.name} · {Math.max(sheet.rowCount, 1)} 行 × {Math.max(sheet.columnCount, 1)} 列
              · 展示第 {startRow}–{startRow + 24} 行
            </span>
            <label>
              起始行
              <input
                aria-label="Excel 起始行"
                type="number"
                min={1}
                max={1048552}
                value={startRow}
                onChange={(event) => {
                  const row = Math.max(1, Math.min(1048552, Number(event.target.value) || 1));
                  setStartRow(row);
                  setSelected(sheet.getCell(row, startCol).address);
                }}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={startCol <= 1}
              onClick={() => {
                setStartCol(Math.max(1, startCol - 10));
                setSelected(sheet.getCell(startRow, Math.max(1, startCol - 10)).address);
              }}
            >
              前十列
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={startCol > 16364}
              onClick={() => {
                setStartCol(startCol + 10);
                setSelected(sheet.getCell(startRow, startCol + 10).address);
              }}
            >
              后十列
            </Button>
          </div>
        </>
      )}
    </>
  );
}
