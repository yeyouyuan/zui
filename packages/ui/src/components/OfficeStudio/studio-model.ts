import type { OfficeStudioDocument, OfficeStudioKind, StudioRichNode } from './studio-types';
import { studioIsSheetHyperlink } from './studio-sheet-hyperlinks';
import { studioCellStyleIssue } from './studio-cell-style';

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `studio-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Creates editable content without an Office server. PDF bytes are supplied by the host. */
export function createOfficeStudioDocument(kind: OfficeStudioKind = 'word'): OfficeStudioDocument {
  const id = newId();
  if (kind === 'word') {
    return {
      version: 1,
      id,
      name: '项目提案.docx',
      kind,
      page: { size: 'A4', orientation: 'portrait', margin: 20 },
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'ZUI STUDIO  /  项目工作文档',
                marks: [{ type: 'textStyle', attrs: { color: '#59746b' } }],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '让想法，成为下一步。' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '在页面中直接编辑正文，用清晰的结构记录目标、计划与成果。选中文字后，可以调整字体、颜色和段落样式。',
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '01  项目目标' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '建立一个顺手的文档空间，让预览、编辑和交付保持连贯。',
                marks: [{ type: 'bold' }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: '把重要内容写在前面，让每次沟通都有明确结论。' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '在同一张画布完成排版、表格和内容修改。' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '保存进度，并导出可继续编辑的 DOCX 文件。' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '02  交付计划' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '阶段' }] }],
                  },
                  {
                    type: 'tableHeader',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '交付内容' }] }],
                  },
                  {
                    type: 'tableHeader',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '状态' }] }],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '本周' }] }],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '完成项目提案与预算' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '进行中' }] }],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '下周' }] }],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '评审并确认实施计划' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: '待开始' }] }],
                  },
                ],
              },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '从这里开始，写下你的下一步。', marks: [{ type: 'italic' }] },
            ],
          },
        ],
      },
    };
  }
  if (kind === 'excel') {
    const sheetId = newId();
    const summaryId = newId();
    return {
      version: 1,
      id,
      name: '项目预算.xlsx',
      kind,
      activeSheetId: sheetId,
      sheets: [
        {
          id: sheetId,
          name: '预算',
          rowCount: 60,
          columnCount: 16,
          hyperlinks: [],
          columnWidths: { A: 200, B: 120, C: 120, D: 140 },
          cells: {
            A1: { input: '项目预算', bold: true, color: '#2f684e' },
            A3: { input: '交付项目', bold: true, background: '#e8f0ea' },
            B3: { input: '单价', bold: true, background: '#e8f0ea' },
            C3: { input: '数量', bold: true, background: '#e8f0ea' },
            D3: { input: '小计', bold: true, background: '#e8f0ea' },
            A4: { input: '产品设计' },
            B4: { input: '1800', numberFormat: '0.00' },
            C4: { input: '3' },
            D4: { input: '=B4*C4', numberFormat: '0.00' },
            A5: { input: '组件开发' },
            B5: { input: '2400', numberFormat: '0.00' },
            C5: { input: '5' },
            D5: { input: '=B5*C5', numberFormat: '0.00' },
            A6: { input: '质量验证' },
            B6: { input: '1600', numberFormat: '0.00' },
            C6: { input: '2' },
            D6: { input: '=B6*C6', numberFormat: '0.00' },
            A8: { input: '预算合计', bold: true },
            D8: { input: '=SUM(D4:D6)', bold: true, numberFormat: '0.00' },
            A10: { input: '双击单元格编辑，支持从表格复制并粘贴。', color: '#59746b' },
          },
        },
        {
          id: summaryId,
          name: '汇总',
          rowCount: 60,
          columnCount: 16,
          columnWidths: { A: 200, B: 160 },
          cells: {
            A1: { input: '预算总览', bold: true },
            A3: { input: '预算总额' },
            B3: { input: "='预算'!D8", bold: true, numberFormat: '0.00' },
          },
        },
      ],
    };
  }
  return {
    version: 1,
    id,
    name: '新建文档.pdf',
    kind,
    pageCount: 1,
    marks: [],
    rotations: {},
    fields: [],
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const optionalText = (value: unknown, limit = 32767) =>
  value === undefined || (typeof value === 'string' && value.length <= limit);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const optionalPositive = (value: unknown, max = 100000) =>
  value === undefined || (finite(value) && value > 0 && value <= max);
function cellPosition(address: unknown) {
  if (typeof address !== 'string') return null;
  const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  if (!match) return null;
  return {
    row: Number(match[2]),
    column: [...match[1]].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0),
  };
}
function cellRange(input: unknown, rows: number, columns: number) {
  if (typeof input !== 'string') return null;
  const parts = input.split(':');
  if (parts.length !== 2) return null;
  const start = cellPosition(parts[0]);
  const end = cellPosition(parts[1]);
  return start &&
    end &&
    end.row >= start.row &&
    end.column >= start.column &&
    end.row <= rows &&
    end.column <= columns
    ? { firstRow: start.row, lastRow: end.row, firstColumn: start.column, lastColumn: end.column }
    : null;
}

const comparisonOperators = new Set([
  'equal',
  'notEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'notBetween',
]);
const ruleColor = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const ruleId = (value: unknown) => typeof value === 'string' && !!value && value.length <= 128;
function ruleText(value: unknown, max: number): boolean {
  if (!optionalText(value, max)) return false;
  return (
    typeof value !== 'string' ||
    [...value].every((character) => {
      const code = character.codePointAt(0)!;
      return (
        (code >= 32 || code === 9 || code === 10 || code === 13) &&
        !(code >= 0xd800 && code <= 0xdfff) &&
        code !== 0xfffe &&
        code !== 0xffff
      );
    })
  );
}

/** @internal Shared validation for persisted cells and direct formatting edits. */
export function studioCellFontIssue(cell: { fontFamily?: unknown; fontSize?: unknown }) {
  if (
    cell.fontFamily !== undefined &&
    (typeof cell.fontFamily !== 'string' ||
      !cell.fontFamily.trim() ||
      !ruleText(cell.fontFamily, 255))
  )
    return '字体名称须为 1 至 255 个字符，并使用有效的 XML 文本。';
  if (
    cell.fontSize !== undefined &&
    (typeof cell.fontSize !== 'number' ||
      !Number.isFinite(cell.fontSize) ||
      cell.fontSize < 1 ||
      cell.fontSize > 409)
  )
    return '字号须为 1 至 409 磅之间的数值。';
}

/** Rule formulas share the editor's A1 subset and never trigger external reads. */
function ruleFormula(value: unknown, numeric = false): boolean {
  if (typeof value !== 'string' || !value.trim() || !ruleText(value, 4096)) return false;
  if (numeric && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
    return Number.isFinite(Number(value));
  if (!value.startsWith('=') || !value.slice(1).trim()) return false;
  let structure = '';
  for (let index = 1; index < value.length; index++) {
    if (value[index] === "'") {
      const start = index;
      let closed = false;
      while (++index < value.length) {
        if (value[index] !== "'") continue;
        if (value[index + 1] === "'") index++;
        else {
          closed = true;
          break;
        }
      }
      if (!closed) return false;
      structure += value.slice(start, index + 1);
      continue;
    }
    if (value[index] !== '"') {
      structure += value[index];
      continue;
    }
    let closed = false;
    while (++index < value.length) {
      if (value[index] !== '"') continue;
      if (value[index + 1] === '"') index++;
      else {
        closed = true;
        break;
      }
    }
    if (!closed) return false;
  }
  if (
    /[[\]]|\b(?:INDIRECT|OFFSET|WEBSERVICE)\s*\(/i.test(structure) ||
    /(?:^|[^\p{L}\p{N}_])(?:\$?[A-Z]{1,3}\s*:\s*\$?[A-Z]{1,3}|\$?[1-9]\d*\s*:\s*\$?[1-9]\d*)(?:[^\p{L}\p{N}_]|$)/iu.test(
      structure
    ) ||
    /:\s*(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!/u.test(structure) ||
    [...structure.matchAll(/('(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!/gu)].some((match) =>
      match[1].includes(':')
    )
  )
    return false;
  const expression = structure
    .replace(/#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|ERROR!)/gi, '')
    .replace(/('(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!/gu, '')
    .replace(/(?<![\p{L}\p{N}_.])\$?[A-Z]{1,3}\$?[1-9]\d*(?![\p{L}\p{N}_.])/giu, '0')
    .replace(/(?<![\p{L}\p{N}_.])(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?![\p{L}\p{N}_.])/giu, '0');
  if (/[#'!@$]/.test(expression)) return false;
  for (const match of expression.matchAll(/[\p{L}_][\p{L}\p{N}_.]*/gu)) {
    if (/^(?:TRUE|FALSE)$/i.test(match[0])) continue;
    if (!/^\s*\(/.test(expression.slice(match.index + match[0].length))) return false;
  }
  let depth = 0;
  for (const character of expression) {
    if (character === '(') depth++;
    if (character === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

function validationSource(value: unknown) {
  if (typeof value !== 'string' || !ruleText(value, 4096)) return null;
  if (value === '=#REF!') return { broken: true as const };
  const match =
    /^=?(?:('(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)(?::(\$?[A-Z]{1,3}\$?[1-9]\d*))?$/iu.exec(
      value
    );
  if (!match) return null;
  const range = cellRange(
    `${match[2]}:${match[3] ?? match[2]}`.replace(/\$/g, '').toUpperCase(),
    10000,
    256
  );
  if (
    !range ||
    (range.firstRow !== range.lastRow && range.firstColumn !== range.lastColumn) ||
    (range.lastRow - range.firstRow + 1) * (range.lastColumn - range.firstColumn + 1) > 1000
  )
    return null;
  const rawName = match[1];
  const name = rawName?.startsWith("'") ? rawName.slice(1, -1).replace(/''/g, "'") : rawName;
  return { broken: false as const, name, range };
}

function sheetRules(sheet: Record<string, unknown>, rows: number, columns: number): boolean {
  for (const field of ['conditionalFormats', 'dataValidations'] as const) {
    const rules = sheet[field];
    if (rules === undefined) continue;
    if (!Array.isArray(rules) || rules.length > 100) return false;
    const ids = new Set<string>();
    const ranges: NonNullable<ReturnType<typeof cellRange>>[] = [];
    let covered = 0;
    for (const rule of rules) {
      if (!record(rule) || !ruleId(rule.id) || typeof rule.id !== 'string' || ids.has(rule.id))
        return false;
      ids.add(rule.id);
      const range = cellRange(rule.range, rows, columns);
      if (!range) return false;
      covered += (range.lastRow - range.firstRow + 1) * (range.lastColumn - range.firstColumn + 1);
      if (covered > 100000) return false;
      if (field === 'conditionalFormats') {
        if (
          !finite(rule.priority) ||
          !Number.isInteger(rule.priority) ||
          rule.priority < 1 ||
          !optionalBoolean(rule.stopIfTrue)
        )
          return false;
        const base = ['id', 'range', 'priority', 'stopIfTrue', 'style', 'type'];
        let fields: string[];
        switch (rule.type) {
          case 'cellIs':
            fields = ['operator', 'formulae'];
            if (
              !comparisonOperators.has(String(rule.operator)) ||
              !Array.isArray(rule.formulae) ||
              rule.formulae.length !==
                (['between', 'notBetween'].includes(String(rule.operator)) ? 2 : 1) ||
              !rule.formulae.every((formula) => ruleFormula(formula, true))
            )
              return false;
            break;
          case 'expression':
            fields = ['formula'];
            if (!ruleFormula(rule.formula)) return false;
            break;
          case 'containsText':
            fields = ['text'];
            if (typeof rule.text !== 'string' || !rule.text || !ruleText(rule.text, 255))
              return false;
            break;
          case 'duplicateValues':
          case 'uniqueValues':
            fields = [];
            break;
          case 'top10':
            fields = ['rank', 'percent', 'bottom'];
            if (
              !finite(rule.rank) ||
              !Number.isInteger(rule.rank) ||
              rule.rank < 1 ||
              rule.rank > (rule.percent === true ? 100 : 1000) ||
              !optionalBoolean(rule.percent) ||
              !optionalBoolean(rule.bottom)
            )
              return false;
            break;
          case 'aboveAverage':
            fields = ['aboveAverage'];
            if (!optionalBoolean(rule.aboveAverage)) return false;
            break;
          case 'colorScale':
            fields = ['colors'];
            if (
              !Array.isArray(rule.colors) ||
              ![2, 3].includes(rule.colors.length) ||
              !rule.colors.every(ruleColor) ||
              rule.style !== undefined
            )
              return false;
            break;
          default:
            return false;
        }
        if (!Object.keys(rule).every((key) => [...base, ...fields].includes(key))) return false;
        if (rule.style !== undefined) {
          const style = rule.style;
          if (
            !record(style) ||
            !Object.keys(style).every((key) =>
              ['bold', 'italic', 'underline', 'color', 'background', 'numberFormat'].includes(key)
            ) ||
            ![style.bold, style.italic, style.underline].every(optionalBoolean) ||
            ![style.color, style.background].every(
              (color) => color === undefined || ruleColor(color)
            ) ||
            !ruleText(style.numberFormat, 256)
          )
            return false;
        }
      } else {
        if (
          ranges.some(
            (other) =>
              other.firstRow <= range.lastRow &&
              other.lastRow >= range.firstRow &&
              other.firstColumn <= range.lastColumn &&
              other.lastColumn >= range.firstColumn
          ) ||
          ![rule.allowBlank, rule.showInputMessage, rule.showErrorMessage].every(optionalBoolean) ||
          ![rule.inputTitle, rule.errorTitle].every((text) => ruleText(text, 32)) ||
          ![rule.inputMessage, rule.errorMessage].every((text) => ruleText(text, 255)) ||
          (rule.errorStyle !== undefined &&
            !['stop', 'warning', 'information'].includes(String(rule.errorStyle)))
        )
          return false;
        ranges.push(range);
        const base = [
          'id',
          'range',
          'type',
          'allowBlank',
          'showInputMessage',
          'inputTitle',
          'inputMessage',
          'showErrorMessage',
          'errorStyle',
          'errorTitle',
          'errorMessage',
        ];
        let fields: string[];
        if (rule.type === 'list') {
          fields = ['values', 'source'];
          if ((rule.values === undefined) === (rule.source === undefined)) return false;
          if (rule.values !== undefined) {
            if (
              !Array.isArray(rule.values) ||
              !rule.values.length ||
              rule.values.length > 100 ||
              !rule.values.every(
                (item) =>
                  typeof item === 'string' &&
                  !!item &&
                  ruleText(item, 255) &&
                  !item.includes(',') &&
                  !item.includes('"') &&
                  [...item].every(
                    (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
                  )
              ) ||
              rule.values.join(',').length > 255
            )
              return false;
          } else if (!validationSource(rule.source)) return false;
        } else if (rule.type === 'custom') {
          fields = ['formula'];
          if (!ruleFormula(rule.formula)) return false;
        } else {
          fields = ['operator', 'formula1', 'formula2'];
          const between = ['between', 'notBetween'].includes(String(rule.operator));
          if (
            !['whole', 'decimal', 'date', 'time', 'textLength'].includes(String(rule.type)) ||
            !comparisonOperators.has(String(rule.operator)) ||
            !ruleFormula(rule.formula1, true) ||
            (between ? !ruleFormula(rule.formula2, true) : rule.formula2 !== undefined)
          )
            return false;
        }
        if (!Object.keys(rule).every((key) => [...base, ...fields].includes(key))) return false;
      }
    }
  }
  return true;
}

function sheetValidationSources(sheets: unknown[]): boolean {
  return sheets.every((sheet) => {
    if (!record(sheet) || !Array.isArray(sheet.dataValidations)) return true;
    return sheet.dataValidations.every((rule) => {
      if (!record(rule) || rule.type !== 'list' || rule.source === undefined) return true;
      const source = validationSource(rule.source);
      if (!source) return false;
      if (source.broken) return true;
      const target = source.name
        ? sheets.find(
            (candidate) =>
              record(candidate) &&
              typeof candidate.name === 'string' &&
              candidate.name.toLocaleLowerCase() === source.name?.toLocaleLowerCase()
          )
        : sheet;
      return (
        record(target) &&
        finite(target.rowCount) &&
        finite(target.columnCount) &&
        source.range.lastRow <= target.rowCount &&
        source.range.lastColumn <= target.columnCount
      );
    });
  });
}

function sheetFeatures(sheet: Record<string, unknown>, rows: number, columns: number) {
  if (!sheetRules(sheet, rows, columns)) return false;
  if (sheet.structureEdits !== undefined) {
    if (!Array.isArray(sheet.structureEdits) || sheet.structureEdits.length > 500) return false;
    const dimensions = { row: rows, column: columns };
    for (const edit of [...sheet.structureEdits].reverse()) {
      if (
        !record(edit) ||
        (edit.axis !== 'row' && edit.axis !== 'column') ||
        (edit.type !== 'insert' && edit.type !== 'delete') ||
        !finite(edit.index) ||
        !Number.isInteger(edit.index) ||
        edit.index < 1 ||
        !finite(edit.count) ||
        !Number.isInteger(edit.count) ||
        edit.count < 1
      )
        return false;
      const limit = edit.axis === 'row' ? 10000 : 256;
      const current = dimensions[edit.axis];
      const previous = current + (edit.type === 'insert' ? -edit.count : edit.count);
      if (
        previous < 1 ||
        previous > limit ||
        (edit.type === 'insert'
          ? edit.index > previous + 1
          : edit.index + edit.count - 1 > previous)
      )
        return false;
      dimensions[edit.axis] = previous;
    }
  }
  if (sheet.columnWidths !== undefined) {
    if (
      !record(sheet.columnWidths) ||
      !Object.entries(sheet.columnWidths).every(([label, width]) => {
        const position = cellPosition(`${label}1`);
        return (
          position && position.column <= columns && finite(width) && width >= 12 && width <= 4000
        );
      })
    )
      return false;
  }
  if (
    sheet.defaultRowHeight !== undefined &&
    (!finite(sheet.defaultRowHeight) ||
      sheet.defaultRowHeight <= 0 ||
      sheet.defaultRowHeight > 409.5)
  )
    return false;
  if (
    sheet.rowHeights !== undefined &&
    (!record(sheet.rowHeights) ||
      !Object.entries(sheet.rowHeights).every(
        ([row, height]) =>
          /^[1-9]\d*$/.test(row) &&
          Number(row) <= rows &&
          finite(height) &&
          height > 0 &&
          height <= 409.5
      ))
  )
    return false;
  if (
    sheet.hiddenRows !== undefined &&
    (!Array.isArray(sheet.hiddenRows) ||
      sheet.hiddenRows.length > rows ||
      new Set(sheet.hiddenRows).size !== sheet.hiddenRows.length ||
      !sheet.hiddenRows.every(
        (row) => finite(row) && Number.isInteger(row) && row >= 1 && row <= rows
      ))
  )
    return false;
  const ranges: NonNullable<ReturnType<typeof cellRange>>[] = [];
  if (sheet.merges !== undefined) {
    if (!Array.isArray(sheet.merges) || sheet.merges.length > 1000) return false;
    for (const merge of sheet.merges) {
      const range = cellRange(merge, rows, columns);
      if (!range || (range.firstRow === range.lastRow && range.firstColumn === range.lastColumn))
        return false;
      if (
        ranges.some(
          (other) =>
            other.firstRow <= range.lastRow &&
            other.lastRow >= range.firstRow &&
            other.firstColumn <= range.lastColumn &&
            other.lastColumn >= range.firstColumn
        )
      )
        return false;
      ranges.push(range);
    }
  }
  if (sheet.freeze !== undefined) {
    const freeze = sheet.freeze;
    if (
      !record(freeze) ||
      !Number.isInteger(freeze.rows) ||
      !Number.isInteger(freeze.columns) ||
      !finite(freeze.rows) ||
      !finite(freeze.columns) ||
      freeze.rows < 0 ||
      freeze.columns < 0 ||
      freeze.rows > 100 ||
      freeze.columns > 20 ||
      freeze.rows >= rows ||
      freeze.columns >= columns
    )
      return false;
    const frozenRows = freeze.rows;
    const frozenColumns = freeze.columns;
    if (
      ranges.some(
        (range) =>
          (range.firstRow <= frozenRows && range.lastRow > frozenRows) ||
          (range.firstColumn <= frozenColumns && range.lastColumn > frozenColumns)
      )
    )
      return false;
  }
  if (sheet.filter !== undefined) {
    const filter = sheet.filter;
    if (!record(filter) || !record(filter.columns)) return false;
    const range = cellRange(filter.range, rows, columns);
    if (
      !range ||
      !Object.entries(filter.columns).every(([label, rule]) => {
        const position = cellPosition(`${label}1`);
        return (
          position &&
          position.column >= range.firstColumn &&
          position.column <= range.lastColumn &&
          record(rule) &&
          ['contains', 'equals', 'greater', 'less'].includes(String(rule.operator)) &&
          typeof rule.value === 'string' &&
          rule.value.length <= 32767 &&
          (!['greater', 'less'].includes(String(rule.operator)) ||
            (rule.value.trim() !== '' && Number.isFinite(Number(rule.value))))
        );
      })
    )
      return false;
  }
  if (sheet.charts !== undefined) {
    if (!Array.isArray(sheet.charts) || sheet.charts.length > 20) return false;
    const ids = new Set<string>();
    if (
      !sheet.charts.every((chart) => {
        if (
          !record(chart) ||
          typeof chart.id !== 'string' ||
          !chart.id ||
          ids.has(chart.id) ||
          !['bar', 'line'].includes(String(chart.type)) ||
          typeof chart.title !== 'string' ||
          chart.title.length > 256
        )
          return false;
        ids.add(chart.id);
        const range = cellRange(chart.range, rows, columns);
        return (
          !!range &&
          range.firstRow < range.lastRow &&
          range.firstColumn < range.lastColumn &&
          range.lastRow - range.firstRow <= 300 &&
          range.lastColumn - range.firstColumn <= 8
        );
      })
    )
      return false;
  }
  return true;
}

/** Checks persisted JSON before passing it to an editor. No HTML is evaluated. */
export function isOfficeStudioDocument(value: unknown): value is OfficeStudioDocument {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.name !== 'string'
  )
    return false;
  if (value.kind === 'word') {
    if (
      !record(value.page) ||
      !['A4', 'Letter'].includes(String(value.page.size)) ||
      !['portrait', 'landscape'].includes(String(value.page.orientation)) ||
      !finite(value.page.margin) ||
      value.page.margin < 0 ||
      value.page.margin > 80
    )
      return false;
    if (
      [value.page.headerDistance, value.page.footerDistance].some(
        (distance) => distance !== undefined && (!finite(distance) || distance < 0 || distance > 80)
      )
    )
      return false;
    let count = 0;
    const richNode = (node: unknown, depth: number): node is StudioRichNode => {
      if (!record(node) || depth > 64 || ++count > 50000 || typeof node.type !== 'string')
        return false;
      if (node.text !== undefined && typeof node.text !== 'string') return false;
      if (node.attrs !== undefined && !record(node.attrs)) return false;
      if (node.type === 'image') {
        if (
          !record(node.attrs) ||
          typeof node.attrs.src !== 'string' ||
          node.attrs.src.length > 8 * 1024 * 1024 ||
          !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(node.attrs.src) ||
          !optionalPositive(node.attrs.width, 10000) ||
          !optionalPositive(node.attrs.height, 10000) ||
          !optionalText(node.attrs.alt, 1000)
        )
          return false;
      }
      if (
        node.marks !== undefined &&
        (!Array.isArray(node.marks) ||
          !node.marks.every(
            (mark) =>
              record(mark) &&
              typeof mark.type === 'string' &&
              (mark.attrs === undefined || record(mark.attrs))
          ))
      )
        return false;
      return (
        node.content === undefined ||
        (Array.isArray(node.content) && node.content.every((child) => richNode(child, depth + 1)))
      );
    };
    return (
      richNode(value.content, 0) &&
      value.content.type === 'doc' &&
      optionalBoolean(value.pageNumbers) &&
      [value.header, value.footer].every(
        (body) => body === undefined || (richNode(body, 0) && body.type === 'doc')
      )
    );
  }
  if (value.kind === 'excel') {
    if (
      !Array.isArray(value.sheets) ||
      value.sheets.length < 1 ||
      value.sheets.length > 32 ||
      typeof value.activeSheetId !== 'string'
    )
      return false;
    const ids = new Set<string>();
    const names = new Set<string>();
    let storedCells = 0;
    let storedHyperlinks = 0;
    return (
      value.sheets.every((sheet) => {
        if (
          !record(sheet) ||
          typeof sheet.id !== 'string' ||
          ids.has(sheet.id) ||
          typeof sheet.name !== 'string' ||
          !sheet.name ||
          sheet.name.length > 31 ||
          /[\\/*?:[\]]/.test(sheet.name) ||
          names.has(sheet.name.toLocaleLowerCase()) ||
          !finite(sheet.rowCount) ||
          !Number.isInteger(sheet.rowCount) ||
          sheet.rowCount < 1 ||
          sheet.rowCount > 10000 ||
          !finite(sheet.columnCount) ||
          !Number.isInteger(sheet.columnCount) ||
          sheet.columnCount < 1 ||
          sheet.columnCount > 256 ||
          !record(sheet.cells)
        )
          return false;
        ids.add(sheet.id);
        names.add(sheet.name.toLocaleLowerCase());
        if (sheet.hyperlinks !== undefined) {
          if (!Array.isArray(sheet.hyperlinks) || !sheet.hyperlinks.every(studioIsSheetHyperlink))
            return false;
          const linkIds = new Set(sheet.hyperlinks.map((link) => link.id));
          storedHyperlinks += sheet.hyperlinks.length;
          if (linkIds.size !== sheet.hyperlinks.length || storedHyperlinks > 100000) return false;
        }
        const entries = Object.entries(sheet.cells);
        const rows = sheet.rowCount;
        const columns = sheet.columnCount;
        storedCells += entries.length;
        return (
          storedCells <= 100000 &&
          sheetFeatures(sheet, rows, columns) &&
          entries.every(([address, cell]) => {
            const position = cellPosition(address);
            if (!position) return false;
            return (
              position.row <= rows &&
              position.column <= columns &&
              record(cell) &&
              typeof cell.input === 'string' &&
              cell.input.length <= 32767 &&
              [cell.bold, cell.italic, cell.underline, cell.wrap].every(optionalBoolean) &&
              !studioCellFontIssue(cell) &&
              !studioCellStyleIssue(cell) &&
              [cell.color, cell.background, cell.numberFormat].every((item) =>
                optionalText(item, 256)
              ) &&
              (cell.align === undefined ||
                ['left', 'center', 'right', 'general'].includes(String(cell.align)))
            );
          })
        );
      }) &&
      ids.has(value.activeSheetId) &&
      sheetValidationSources(value.sheets)
    );
  }
  if (
    value.kind !== 'pdf' ||
    !finite(value.pageCount) ||
    !Number.isInteger(value.pageCount) ||
    value.pageCount < 1 ||
    value.pageCount > 200 ||
    !Array.isArray(value.marks) ||
    value.marks.length > 2000 ||
    !Array.isArray(value.fields) ||
    value.fields.length > 2000 ||
    !record(value.rotations)
  )
    return false;
  const pageCount = value.pageCount;
  const markIds = new Set<string>();
  const fieldNames = new Set<string>();
  let storedPoints = 0;
  return (
    value.marks.every((mark) => {
      if (!(
        record(mark) &&
        typeof mark.id === 'string' &&
        !!mark.id &&
        !markIds.has(mark.id) &&
        finite(mark.page) &&
        Number.isInteger(mark.page) &&
        mark.page >= 0 &&
        mark.page < pageCount &&
        ['text', 'highlight', 'rectangle', 'ink'].includes(String(mark.type)) &&
        finite(mark.x) &&
        finite(mark.y) &&
        finite(mark.size) &&
        mark.size > 0 &&
        mark.size <= 240 &&
        typeof mark.text === 'string' &&
        mark.text.length <= 10000 &&
        optionalPositive(mark.width) &&
        optionalPositive(mark.height) &&
        optionalPositive(mark.lineWidth, 40) &&
        (mark.lineWidth === undefined || (finite(mark.lineWidth) && mark.lineWidth >= 0.5)) &&
        optionalText(mark.color, 256)
      ))
        return false;
      markIds.add(mark.id);
      if (mark.type === 'rectangle' && (!finite(mark.width) || !finite(mark.height))) return false;
      if (mark.points !== undefined || mark.type === 'ink') {
        if (!Array.isArray(mark.points) || mark.points.length < 2 || mark.points.length > 10000)
          return false;
        storedPoints += mark.points.length;
        if (
          storedPoints > 100000 ||
          !mark.points.every(
            (point) => Array.isArray(point) && point.length === 2 && point.every(finite)
          )
        )
          return false;
      }
      return true;
    }) &&
    value.fields.every((field) => {
      if (!(
        record(field) &&
        typeof field.name === 'string' &&
        !!field.name &&
        !fieldNames.has(field.name) &&
        ['text', 'checkbox', 'choice'].includes(String(field.type)) &&
        (typeof field.value === 'string' || typeof field.value === 'boolean') &&
        typeof field.readOnly === 'boolean'
      ))
        return false;
      fieldNames.add(field.name);
      if (
        field.options !== undefined &&
        (!Array.isArray(field.options) ||
          field.options.length > 10000 ||
          !field.options.every((option) => typeof option === 'string'))
      )
        return false;
      if (!optionalBoolean(field.multiline)) return false;
      return (
        field.widgets === undefined ||
        (Array.isArray(field.widgets) &&
          field.widgets.length <= 2000 &&
          field.widgets.every(
            (widget) =>
              record(widget) &&
              finite(widget.page) &&
              Number.isInteger(widget.page) &&
              widget.page >= 0 &&
              widget.page < pageCount &&
              finite(widget.x) &&
              finite(widget.y) &&
              finite(widget.width) &&
              widget.width > 0 &&
              finite(widget.height) &&
              widget.height > 0 &&
              (widget.rotation === undefined ||
                (finite(widget.rotation) && widget.rotation % 90 === 0)) &&
              optionalText(widget.option)
          ))
      );
    }) &&
    Object.entries(value.rotations).every(
      ([page, rotation]) =>
        /^\d+$/.test(page) && Number(page) < pageCount && finite(rotation) && rotation % 90 === 0
    )
  );
}
