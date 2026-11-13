import ExcelJS from 'exceljs';
import FormulaParser from 'fast-formula-parser';
import JSZip from 'jszip';
import type { ExcelChanges } from './office-model';

export async function excelEditingIssue(source: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await source.arrayBuffer());
  if (
    Object.keys(zip.files).some(
      (name) =>
        /^xl\/(charts|pivotTables|pivotCache|externalLinks|activeX)\//.test(name) ||
        /vbaProject|_xmlsignatures/.test(name)
    )
  )
    return '此文件含有图表、透视表、外部连接或其他当前无法完整保存的对象。可预览单元格，请下载原文件在 Excel 中修改。';
  for (const file of Object.values(zip.files)) {
    if (
      /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name) &&
      /<sheetProtection\b/.test(await file.async('string'))
    )
      return '此工作簿含有受保护的工作表。可预览，请在 Excel 中按原有权限修改。';
  }
  return '';
}

export async function loadExcel(source: Blob): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await source.arrayBuffer());
  if (!workbook.worksheets.length)
    throw new Error('Excel 文件中没有工作表，请使用有效的 .xlsx 文件。');
  let count = 0;
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell(() => count++)));
  if (count > 100000) throw new Error('当前在线编辑器支持最多 100,000 个非空单元格。');
  return workbook;
}
export function cellInput(cell: ExcelJS.Cell): string {
  if (cell.type === ExcelJS.ValueType.Formula) return `=${cell.formula}`;
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  return cell.text;
}
export function inputValue(value: string): ExcelJS.CellValue {
  if (value.startsWith('=')) return { formula: value.slice(1) };
  if (value.startsWith("'")) return value.slice(1);
  if (value === '') return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  // Leading-zero identifiers remain text.
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)))
    return Number(value);
  return value;
}
export function applyExcelChanges(workbook: ExcelJS.Workbook, changes: ExcelChanges) {
  for (const [key, change] of Object.entries(changes.cells)) {
    const [id, address] = key.split(':');
    const sheet = workbook.getWorksheet(Number(id));
    if (!sheet) throw new Error('草稿指向不存在的工作表。');
    const cell = sheet.getCell(address);
    if (cell.isMerged && cell.master.address !== cell.address)
      throw new Error('请编辑合并区域的左上角单元格。');
    if (change.value !== cellInput(cell)) cell.value = inputValue(change.value);
    if (change.bold !== undefined) cell.font = { ...cell.font, bold: change.bold };
    if (change.numberFormat !== undefined) cell.numFmt = change.numberFormat;
  }
}
export function calculateExcel(workbook: ExcelJS.Workbook): {
  values: Map<string, unknown>;
  errors: Map<string, string>;
} {
  const values = new Map<string, unknown>();
  const errors = new Map<string, string>();
  const visiting = new Set<string>();
  let evaluations = 0;
  const read = (sheetName: string, row: number, col: number): unknown => {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet || row < 1 || col < 1 || row > 1048576 || col > 16384)
      throw FormulaParser.FormulaError.REF;
    const cell = sheet.getCell(row, col);
    const key = `${sheet.id}:${cell.address}`;
    if (values.has(key)) return values.get(key);
    if (visiting.has(key)) throw new Error('#CYCLE!');
    if (visiting.size > 200 || ++evaluations > 200000) throw new Error('#LIMIT!');
    let result: unknown;
    if (cell.type === ExcelJS.ValueType.Formula) {
      visiting.add(key);
      try {
        result = parser.parse(cell.formula, { sheet: sheet.name, row, col });
      } catch (error) {
        const label = String(error);
        const errorValue =
          /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|CYCLE!|LIMIT!)/.exec(label)?.[0] ?? '#VALUE!';
        errors.set(key, errorValue);
        throw error;
      } finally {
        visiting.delete(key);
      }
    } else if (typeof cell.value === 'object' && cell.value && 'error' in cell.value) {
      throw new Error(String(cell.value.error));
    } else
      result =
        cell.value instanceof Date
          ? cell.value.getTime() / 86400000 + 25569
          : typeof cell.value === 'object' && cell.value
            ? cell.text
            : (cell.value ?? 0);
    if (
      result &&
      typeof result === 'object' &&
      'toString' in result &&
      String(result).startsWith('#')
    ) {
      errors.set(key, String(result));
      throw result;
    }
    values.set(key, result);
    return result;
  };
  const parser = new FormulaParser({
    functions: {
      WEBSERVICE: () => {
        throw FormulaParser.FormulaError.NAME;
      },
    },
    onCell: ({ sheet, row, col }) => read(sheet, row, col),
    onRange: (range) => {
      const sheet = workbook.getWorksheet(range.sheet);
      if (!sheet) throw FormulaParser.FormulaError.REF;
      const lastRow = Math.min(range.to.row, Math.max(sheet.rowCount, 1));
      const lastCol = Math.min(range.to.col, Math.max(sheet.columnCount, 1));
      if ((lastRow - range.from.row + 1) * (lastCol - range.from.col + 1) > 100000)
        throw new Error('#LIMIT!');
      const rows: unknown[][] = [];
      for (let row = range.from.row; row <= lastRow; row++) {
        const cells: unknown[] = [];
        for (let col = range.from.col; col <= lastCol; col++)
          cells.push(read(sheet.name, row, col));
        rows.push(cells);
      }
      return rows.length ? rows : [[0]];
    },
  });
  workbook.eachSheet((sheet) =>
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) {
          try {
            read(sheet.name, Number(cell.row), Number(cell.col));
          } catch {
            /* Keep formula and surface its error. */
          }
        }
      })
    )
  );
  return { values, errors };
}
export async function exportExcel(source: Blob, changes: ExcelChanges): Promise<Blob> {
  const issue = await excelEditingIssue(source);
  if (issue) throw new Error(issue);
  const workbook = await loadExcel(source);
  applyExcelChanges(workbook, changes);
  const calculated = calculateExcel(workbook);
  workbook.eachSheet((sheet) =>
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type !== ExcelJS.ValueType.Formula) return;
        const key = `${sheet.id}:${cell.address}`;
        // Clear stale cached values for unsupported formulas; Excel recalculates on open.
        const result = calculated.values.get(key);
        cell.value = {
          formula: cell.formula,
          ...(typeof result === 'number' ||
          typeof result === 'string' ||
          typeof result === 'boolean'
            ? { result }
            : {}),
        };
      })
    )
  );
  workbook.calcProperties.fullCalcOnLoad = true;
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
