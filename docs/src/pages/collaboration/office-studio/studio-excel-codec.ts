import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  studioBorderSides,
  studioBorderStyles,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-cell-style';
import { isOfficeStudioDocument } from '../../../../../packages/ui/src/components/OfficeStudio/studio-model';
import {
  STUDIO_SHEET_LIMITS,
  studioCalculate,
  studioChartData,
  studioColumnLabel,
  studioFilteredRows,
  studioHiddenRows,
  studioInputValue,
  studioParseAddress,
  studioParseRange,
  studioRangeAddress,
  studioSetFilter,
  studioSetFreeze,
  studioMergeCells,
  studioAddChart,
  studioSheetNameIssue,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model';
import {
  studioTransformSheetIndex,
  studioTransformSheetRange,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-structure';
import {
  studioDeleteSheetHyperlinks,
  studioRenameSheetHyperlinks,
  studioTransformSheetHyperlinks,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-hyperlinks';
import type {
  StudioCell,
  StudioExcelDocument,
  StudioSheet,
  StudioSheetChart,
  StudioSheetComparisonOperator,
  StudioSheetConditionalFormat,
  StudioSheetConditionalStyle,
  StudioSheetDataValidation,
  StudioSheetHyperlink,
  StudioSheetStructureEdit,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const excelErrors = ['#DIV/0!', '#N/A', '#NAME?', '#NULL!', '#NUM!', '#REF!', '#VALUE!'] as const;

const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HYPERLINK_RELATIONSHIP = `${R}/hyperlink`;
const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

function xmlDocument(text: string): XMLDocument {
  if (text.length > 50 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('XLSX XML 内容无效。');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('XLSX XML 无法解析。');
  return xml;
}
function xmlElements(parent: Document | Element, namespace: string, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS(namespace, name));
}
function first(parent: Document | Element, namespace: string, name: string): Element | undefined {
  return xmlElements(parent, namespace, name)[0];
}
function text(parent: Document | Element, namespace: string, name: string): string {
  return first(parent, namespace, name)?.textContent ?? '';
}
function val(parent: Document | Element, namespace: string, name: string): string | undefined {
  return first(parent, namespace, name)?.getAttribute('val') ?? undefined;
}
function escapeXml(input: string): string {
  for (const character of input) {
    const code = character.codePointAt(0)!;
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffe ||
      code === 0xffff
    )
      throw new Error('工作簿文字包含无效 XML 字符，请删除该字符后重试。');
  }
  return input.replace(
    /[<>&"'\t\r\n]/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
        '\t': '&#9;',
        '\r': '&#13;',
        '\n': '&#10;',
      })[char]!
  );
}
function packagePath(base: string, target: string): string {
  if (!target || target.includes('\\') || target.includes('?') || target.includes('#'))
    throw new Error('工作簿对象关系无效。');
  const output = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!output.length) throw new Error('工作簿对象路径无效。');
      output.pop();
    } else output.push(part);
  }
  return output.join('/');
}
interface NativeRelationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

function relationshipPart(part: string): string {
  return `${part.slice(0, part.lastIndexOf('/') + 1)}_rels/${part.slice(part.lastIndexOf('/') + 1)}.rels`;
}

async function readRelationships(zip: JSZip, part: string): Promise<NativeRelationship[]> {
  const entry = zip.file(relationshipPart(part));
  const result: NativeRelationship[] = [];
  if (!entry) return result;
  const xml = xmlDocument(await entry.async('string'));
  for (const relation of Array.from(xml.documentElement.children)) {
    const id = relation.getAttribute('Id');
    const target = relation.getAttribute('Target');
    if (id && target !== null)
      result.push({
        id,
        type: relation.getAttribute('Type') ?? '',
        target,
        ...(relation.hasAttribute('TargetMode')
          ? { targetMode: relation.getAttribute('TargetMode')! }
          : {}),
      });
  }
  return result;
}

function internalRelationships(part: string, entries: NativeRelationship[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const relation of entries) {
    // Hyperlink Targets are user metadata, including file paths and unrecognised schemes.
    if (relation.targetMode === 'External' || relation.type.endsWith('/hyperlink')) continue;
    result.set(relation.id, packagePath(part, relation.target));
  }
  return result;
}

async function relationships(zip: JSZip, part: string): Promise<Map<string, string>> {
  return internalRelationships(part, await readRelationships(zip, part));
}

function readHyperlinks(
  xml: XMLDocument,
  entries: NativeRelationship[],
  sheetId: number
): StudioSheetHyperlink[] {
  const targets = new Map(entries.map((relation) => [relation.id, relation.target]));
  return xmlElements(xml, S, 'hyperlink').map((node, index) => {
    const ref = (node.getAttribute('ref') ?? '').replace(/\$/g, '').toUpperCase();
    const range = studioParseRange(ref);
    if (!range || range.lastRow > 1048576 || range.lastCol > 16384)
      throw new Error('工作表超链接引用范围无效。');
    const relationshipId = node.getAttributeNS(R, 'id');
    const target = relationshipId ? targets.get(relationshipId) : undefined;
    return {
      id: `xlsx-hyperlink-${sheetId}-${index + 1}`,
      ref,
      ...(target !== undefined ? { target } : {}),
      ...(node.hasAttribute('location') ? { location: node.getAttribute('location')! } : {}),
      ...(node.hasAttribute('tooltip') ? { tooltip: node.getAttribute('tooltip')! } : {}),
      ...(node.hasAttribute('display') ? { display: node.getAttribute('display')! } : {}),
    };
  });
}

type NativeFont = Partial<ExcelJS.Font> & {
  condense?: boolean;
  extend?: boolean;
  shadow?: boolean;
  color?: Partial<ExcelJS.Color> & { indexed?: number; tint?: number };
};

interface NativeSheetFonts {
  styles: Array<NativeFont | undefined>;
  cells: Map<string, number | undefined>;
  rows: Map<number, number>;
  columns: Map<number, number>;
}

interface SheetMetadata {
  name: string;
  numericInputs: Map<string, string>;
  fonts: NativeSheetFonts;
  rowLayout: NativeRowLayout;
  hyperlinks: StudioSheetHyperlink[];
  merges: string[];
  freeze?: StudioSheet['freeze'];
  filter?: StudioSheet['filter'];
  charts: StudioSheetChart[];
  conditionalFormats: StudioSheetConditionalFormat[];
  dataValidations: StudioSheetDataValidation[];
  pageBreaks: { rowBreaks: NativePageBreak[]; colBreaks: NativePageBreak[] };
}

interface NativeRowLayout {
  defaultRowHeight?: number;
  rowHeights: Record<string, number>;
  hiddenRows: number[];
  visibleRows: number[];
  defaultHidden: boolean;
  lastRow: number;
}

function nativeRowLayout(xml: XMLDocument): NativeRowLayout {
  const format = first(xml, S, 'sheetFormatPr');
  const boolean = (node: Element | undefined, name: string) => {
    const value = node?.getAttribute(name);
    if (value === null || value === undefined) return false;
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    throw new Error('工作表行高或隐藏属性无效。');
  };
  const pointHeight = (node: Element | undefined, name: string) => {
    const value = node?.getAttribute(name);
    if (value === null || value === undefined) return undefined;
    const height = Number(value);
    if (
      !value.trim() ||
      !Number.isFinite(height) ||
      height < 0 ||
      height > STUDIO_SHEET_LIMITS.rowHeight
    )
      throw new Error('工作表行高需要在 0–409.5 磅之间。');
    return height;
  };
  const height = pointHeight(format, 'defaultRowHeight');
  const layout: NativeRowLayout = {
    ...(height !== undefined && height > 0 ? { defaultRowHeight: height } : {}),
    rowHeights: {},
    hiddenRows: [],
    visibleRows: [],
    defaultHidden: height === 0 || boolean(format, 'zeroHeight'),
    lastRow: 0,
  };
  const seen = new Set<number>();
  const sheetData = first(xml, S, 'sheetData');
  for (const row of sheetData ? xmlElements(sheetData, S, 'row') : []) {
    const index = row.hasAttribute('r') ? Number(row.getAttribute('r')) : layout.lastRow + 1;
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > STUDIO_SHEET_LIMITS.rows ||
      seen.has(index)
    )
      throw new Error('工作表行索引无效或超过 10,000 行。');
    seen.add(index);
    layout.lastRow = Math.max(layout.lastRow, index);
    const height = pointHeight(row, 'ht');
    if (height !== undefined && height > 0) layout.rowHeights[String(index)] = height;
    if (height === 0 || boolean(row, 'hidden')) layout.hiddenRows.push(index);
    else layout.visibleRows.push(index);
  }
  return layout;
}

const RULE_OPERATORS: StudioSheetComparisonOperator[] = [
  'equal',
  'notEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'notBetween',
];
const NUMERIC_RULE_FORMULA = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function ruleShape(element: Element, children: string[], attributes: string[]) {
  if (
    element.namespaceURI !== S ||
    Array.from(element.children).some(
      (child) => child.namespaceURI !== S || !children.includes(child.localName)
    ) ||
    Array.from(element.attributes).some(
      (attribute) =>
        attribute.namespaceURI !== 'http://www.w3.org/2000/xmlns/' &&
        !attributes.includes(attribute.name)
    )
  )
    throw new Error('工作表包含不受支持的条件格式或数据验证属性。');
}

function ruleBoolean(element: Element, name: string, fallback?: boolean): boolean | undefined {
  const value = element.getAttribute(name);
  if (value === null) return fallback;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  throw new Error('条件格式或数据验证的布尔属性无效。');
}

function ruleInteger(element: Element, name: string, fallback?: number): number {
  const raw = element.getAttribute(name);
  if (raw !== null && !/^\+?\d+$/.test(raw.trim()))
    throw new Error('条件格式或数据验证的数字属性无效。');
  const value = raw === null ? fallback : Number(raw);
  if (value === undefined || !Number.isSafeInteger(value) || value < 0)
    throw new Error('条件格式或数据验证的数字属性无效。');
  return value;
}

function ruleOperator(value: string | null): StudioSheetComparisonOperator {
  const operator = RULE_OPERATORS.find((entry) => entry === value);
  if (!operator) throw new Error('工作表包含不受支持的条件比较方式。');
  return operator;
}

function ruleRange(input: string): string {
  const reference = input.trim();
  const endpoints = /^\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?$/i.test(reference)
    ? reference.split(':').map((address) => studioParseAddress(address.replace(/\$/g, '')))
    : [];
  const range = studioParseRange(reference);
  if (
    !range ||
    !endpoints[0] ||
    endpoints[0].row !== range.firstRow ||
    endpoints[0].col !== range.firstCol ||
    range.lastRow > STUDIO_SHEET_LIMITS.rows ||
    range.lastCol > STUDIO_SHEET_LIMITS.columns ||
    (range.lastRow - range.firstRow + 1) * (range.lastCol - range.firstCol + 1) > 100000
  )
    throw new Error('条件格式和数据验证只支持预算内的单一矩形区域。');
  return studioRangeAddress(range);
}

function importedRuleFormula(value: string, numeric = false): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4096) throw new Error('条件格式或数据验证公式无效。');
  if (numeric && NUMERIC_RULE_FORMULA.test(trimmed)) return trimmed;
  return value.startsWith('=') ? value : `=${value}`;
}

function listSourceReference(value: string): { name?: string; range: string } {
  const match =
    /^=?(?:('(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)(?::(\$?[A-Z]{1,3}\$?[1-9]\d*))?$/iu.exec(
      value
    );
  if (!match) throw new Error('数据验证列表必须引用单行或单列区域，暂不支持命名或外部区域。');
  const reference = ruleRange(`${match[2]}:${match[3] ?? match[2]}`);
  const range = studioParseRange(reference)!;
  if (
    (range.firstRow !== range.lastRow && range.firstCol !== range.lastCol) ||
    (range.lastRow - range.firstRow + 1) * (range.lastCol - range.firstCol + 1) > 1000
  )
    throw new Error('数据验证列表源区域必须是1000格以内的单行或单列。');
  const name = match[1]?.startsWith("'") ? match[1].slice(1, -1).replace(/''/g, "'") : match[1];
  return { name, range: reference };
}

function ruleColor(element: Element): string {
  ruleShape(element, [], ['rgb', 'tint']);
  const value = element.getAttribute('rgb') ?? '';
  if (
    !/^(?:FF)?[\da-f]{6}$/i.test(value) ||
    (element.hasAttribute('tint') && Number(element.getAttribute('tint')) !== 0)
  )
    throw new Error('条件格式只支持不透明 RGB 颜色，暂不支持主题或索引颜色。');
  return `#${value.slice(-6).toLowerCase()}`;
}

function importedRuleStyle(element: Element): StudioSheetConditionalStyle {
  ruleShape(element, ['font', 'fill', 'numFmt'], []);
  const uniqueChildren = [element];
  const style: StudioSheetConditionalStyle = {};
  const font = first(element, S, 'font');
  if (font) {
    uniqueChildren.push(font);
    ruleShape(font, ['b', 'i', 'u', 'color'], []);
    for (const [tag, key] of [
      ['b', 'bold'],
      ['i', 'italic'],
    ] as const) {
      const node = first(font, S, tag);
      if (node) {
        ruleShape(node, [], ['val']);
        style[key] = ruleBoolean(node, 'val', true);
      }
    }
    const underline = first(font, S, 'u');
    if (underline) {
      ruleShape(underline, [], ['val']);
      const value = underline.getAttribute('val') ?? 'single';
      if (!['single', 'none'].includes(value))
        throw new Error('条件格式暂不支持双线或会计下划线。');
      style.underline = value === 'single';
    }
    const color = first(font, S, 'color');
    if (color) style.color = ruleColor(color);
  }
  const fill = first(element, S, 'fill');
  if (fill) {
    uniqueChildren.push(fill);
    ruleShape(fill, ['patternFill'], []);
    const pattern = first(fill, S, 'patternFill');
    if (!pattern) throw new Error('条件格式暂不支持渐变或复杂填充。');
    uniqueChildren.push(pattern);
    ruleShape(pattern, ['fgColor', 'bgColor'], ['patternType']);
    const foreground = first(pattern, S, 'fgColor');
    const background = first(pattern, S, 'bgColor');
    if (pattern.getAttribute('patternType') === 'solid' && foreground) {
      style.background = ruleColor(foreground);
      if (background) {
        if (background.getAttribute('indexed') === '64') ruleShape(background, [], ['indexed']);
        else ruleColor(background);
      }
    } else if (!pattern.hasAttribute('patternType') && !foreground && background)
      // Excel's built-in highlight styles encode their solid colour as DXF bgColor.
      style.background = ruleColor(background);
    else throw new Error('条件格式暂不支持非纯色填充。');
  }
  const format = first(element, S, 'numFmt');
  if (format) {
    ruleShape(format, [], ['numFmtId', 'formatCode']);
    if (!format.hasAttribute('formatCode')) throw new Error('条件格式数字格式无效。');
    if (format.hasAttribute('numFmtId')) ruleInteger(format, 'numFmtId');
    style.numberFormat = format.getAttribute('formatCode')!;
  }
  for (const parent of uniqueChildren) {
    const names = Array.from(parent.children).map((child) => child.localName);
    if (new Set(names).size !== names.length) throw new Error('条件格式包含重复的样式字段。');
  }
  return style;
}

function containsTextFormula(value: string, anchor: string): string {
  const literal = value.replace(/~/g, '~~').replace(/[?*]/g, '~$&').replace(/"/g, '""');
  return `NOT(ISERROR(SEARCH("${literal}",${anchor})))`;
}

function importedContainsText(element: Element, range: string, formulae: string[]): string {
  let value = element.getAttribute('text');
  if (formulae.length > 1) throw new Error('条件格式文本规则包含不受支持的公式。');
  if (formulae.length) {
    const formula = formulae[0]
      .replace(/^=/, '')
      .replace(/"(?:[^"]|"")*"|\s+/g, (token) => (token.startsWith('"') ? token : ''));
    const match = /SEARCH\("((?:[^"]|"")*)",([A-Z]{1,3}[1-9]\d*)\)/i.exec(formula);
    if (!match) throw new Error('条件格式文本规则包含不受支持的公式。');
    const literal = match[1].replace(/""/g, '"').replace(/~([~*?])/g, '$1');
    value ??= literal;
    const anchor = range.split(':')[0];
    const expected = containsTextFormula(value, anchor);
    const alternative = expected.replace(/^NOT\(ISERROR\(/, 'ISNUMBER(').replace(/\)\)$/, ')');
    if (
      ![expected, alternative].some(
        (candidate) => candidate.toLowerCase() === formula.toLowerCase()
      )
    )
      throw new Error('条件格式文本规则包含复杂通配符或不同的引用。');
  }
  if (value === null) throw new Error('条件格式文本规则缺少文字。');
  return value;
}

function importedConditionalFormat(
  element: Element,
  range: string,
  id: string,
  styles: Element[]
): StudioSheetConditionalFormat {
  const base: {
    id: string;
    range: string;
    priority: number;
    stopIfTrue?: boolean;
    style?: StudioSheetConditionalStyle;
  } = { id, range, priority: ruleInteger(element, 'priority') };
  if (element.hasAttribute('stopIfTrue')) base.stopIfTrue = ruleBoolean(element, 'stopIfTrue');
  if (element.hasAttribute('dxfId')) {
    const style = styles[ruleInteger(element, 'dxfId')];
    if (!style) throw new Error('条件格式引用的差异样式不存在。');
    base.style = importedRuleStyle(style);
  }
  const formulae = Array.from(element.children)
    .filter((child) => child.namespaceURI === S && child.localName === 'formula')
    .map((child) => {
      ruleShape(child, [], ['xml:space']);
      return child.textContent ?? '';
    });
  const attributes = ['type', 'priority', 'stopIfTrue', 'dxfId'];
  switch (element.getAttribute('type')) {
    case 'cellIs': {
      ruleShape(element, ['formula'], [...attributes, 'operator']);
      const operator = ruleOperator(element.getAttribute('operator'));
      if (formulae.length !== (['between', 'notBetween'].includes(operator) ? 2 : 1))
        throw new Error('条件格式比较规则的公式数量无效。');
      return {
        ...base,
        type: 'cellIs',
        operator,
        formulae: formulae.map((value) => importedRuleFormula(value, true)),
      };
    }
    case 'expression':
      ruleShape(element, ['formula'], attributes);
      if (formulae.length !== 1) throw new Error('条件格式表达式的公式数量无效。');
      return { ...base, type: 'expression', formula: importedRuleFormula(formulae[0]) };
    case 'containsText':
      ruleShape(element, ['formula'], [...attributes, 'operator', 'text']);
      if (element.hasAttribute('operator') && element.getAttribute('operator') !== 'containsText')
        throw new Error('暂不支持此条件格式文本操作。');
      return {
        ...base,
        type: 'containsText',
        text: importedContainsText(element, range, formulae),
      };
    case 'duplicateValues':
    case 'uniqueValues': {
      ruleShape(element, [], attributes);
      const type =
        element.getAttribute('type') === 'duplicateValues' ? 'duplicateValues' : 'uniqueValues';
      return { ...base, type };
    }
    case 'top10':
      ruleShape(element, [], [...attributes, 'rank', 'percent', 'bottom']);
      return {
        ...base,
        type: 'top10',
        rank: ruleInteger(element, 'rank', 10),
        ...(element.hasAttribute('percent') ? { percent: ruleBoolean(element, 'percent') } : {}),
        ...(element.hasAttribute('bottom') ? { bottom: ruleBoolean(element, 'bottom') } : {}),
      };
    case 'aboveAverage':
      ruleShape(element, [], [...attributes, 'aboveAverage', 'equalAverage', 'stdDev']);
      if (ruleBoolean(element, 'equalAverage', false) || ruleInteger(element, 'stdDev', 0))
        throw new Error('暂不支持包含等于平均值或标准差的条件格式。');
      return {
        ...base,
        type: 'aboveAverage',
        ...(element.hasAttribute('aboveAverage')
          ? { aboveAverage: ruleBoolean(element, 'aboveAverage') }
          : {}),
      };
    case 'colorScale': {
      ruleShape(element, ['colorScale'], attributes);
      const scale = first(element, S, 'colorScale');
      if (!scale || element.children.length !== 1 || base.style !== undefined)
        throw new Error('工作表色阶内容无效。');
      ruleShape(scale, ['cfvo', 'color'], []);
      const points = xmlElements(scale, S, 'cfvo');
      const colors = xmlElements(scale, S, 'color').map(ruleColor);
      if (![2, 3].includes(points.length) || points.length !== colors.length)
        throw new Error('当前只支持二色或三色色阶。');
      points.forEach((point, index) => {
        ruleShape(point, [], ['type', 'val', 'gte']);
        const type = index === 0 ? 'min' : index === points.length - 1 ? 'max' : 'percentile';
        if (
          point.getAttribute('type') !== type ||
          ruleBoolean(point, 'gte', true) !== true ||
          (type === 'percentile'
            ? Number(point.getAttribute('val')) !== 50
            : point.hasAttribute('val') && Number(point.getAttribute('val')) !== 0)
        )
          throw new Error('当前色阶只支持最小值、50百分位和最大值。');
      });
      return {
        ...base,
        type: 'colorScale',
        colors: colors.length === 2 ? [colors[0], colors[1]] : [colors[0], colors[1], colors[2]],
      };
    }
    default:
      throw new Error(
        `工作表包含不受支持的条件格式规则：${element.getAttribute('type') ?? '未知'}。`
      );
  }
}

function importedDataValidation(element: Element, id: string): StudioSheetDataValidation {
  ruleShape(
    element,
    ['formula1', 'formula2'],
    [
      'type',
      'sqref',
      'operator',
      'allowBlank',
      'showInputMessage',
      'showErrorMessage',
      'promptTitle',
      'prompt',
      'errorStyle',
      'errorTitle',
      'error',
      'showDropDown',
      'imeMode',
    ]
  );
  if (
    ruleBoolean(element, 'showDropDown', false) ||
    (element.hasAttribute('imeMode') && element.getAttribute('imeMode') !== 'noControl')
  )
    throw new Error('暂不支持隐藏下拉箭头或指定输入法的数据验证。');
  const base: {
    id: string;
    range: string;
    allowBlank?: boolean;
    showInputMessage?: boolean;
    inputTitle?: string;
    inputMessage?: string;
    showErrorMessage?: boolean;
    errorStyle?: 'stop' | 'warning' | 'information';
    errorTitle?: string;
    errorMessage?: string;
  } = { id, range: ruleRange(element.getAttribute('sqref') ?? '') };
  for (const key of ['allowBlank', 'showInputMessage', 'showErrorMessage'] as const)
    if (element.hasAttribute(key)) base[key] = ruleBoolean(element, key);
  for (const [attribute, key] of [
    ['promptTitle', 'inputTitle'],
    ['prompt', 'inputMessage'],
    ['errorTitle', 'errorTitle'],
    ['error', 'errorMessage'],
  ] as const)
    if (element.hasAttribute(attribute)) base[key] = element.getAttribute(attribute)!;
  const errorStyle = element.getAttribute('errorStyle');
  if (errorStyle !== null) {
    if (errorStyle !== 'stop' && errorStyle !== 'warning' && errorStyle !== 'information')
      throw new Error('数据验证错误提示类型无效。');
    base.errorStyle = errorStyle;
  }
  const firstFormula = xmlElements(element, S, 'formula1');
  const secondFormula = xmlElements(element, S, 'formula2');
  for (const formula of [...firstFormula, ...secondFormula]) ruleShape(formula, [], ['xml:space']);
  if (firstFormula.length !== 1 || secondFormula.length > 1)
    throw new Error('数据验证公式数量无效。');
  const formula = firstFormula[0].textContent ?? '';
  const type = element.getAttribute('type');
  if (type === 'list' || type === 'custom') {
    if (secondFormula.length || element.hasAttribute('operator'))
      throw new Error('列表或自定义数据验证包含不受支持的附加条件。');
    if (type === 'custom') return { ...base, type, formula: importedRuleFormula(formula) };
    const literal = /^"([^"]*)"$/.exec(formula.trim());
    return literal
      ? { ...base, type, values: literal[1].split(',') }
      : { ...base, type, source: importedRuleFormula(formula) };
  }
  if (
    type === 'whole' ||
    type === 'decimal' ||
    type === 'date' ||
    type === 'time' ||
    type === 'textLength'
  ) {
    const operator = ruleOperator(element.getAttribute('operator') ?? 'between');
    if (secondFormula.length !== (['between', 'notBetween'].includes(operator) ? 1 : 0))
      throw new Error('数据验证比较规则的公式数量无效。');
    return {
      ...base,
      type,
      operator,
      formula1: importedRuleFormula(formula, true),
      ...(secondFormula.length
        ? { formula2: importedRuleFormula(secondFormula[0].textContent ?? '', true) }
        : {}),
    };
  }
  throw new Error(`工作表包含不受支持的数据验证规则：${type ?? '未知'}。`);
}

function readSheetRules(xml: XMLDocument, styles: Element[], sheetId: number) {
  if (
    Array.from(xml.getElementsByTagName('*')).some(
      (element) =>
        /^(?:conditionalFormatting|conditionalFormattings|cfRule|dataValidations|dataValidation)$/.test(
          element.localName
        ) && element.namespaceURI !== S
    )
  )
    throw new Error('暂不支持扩展命名空间中的条件格式或数据验证。');
  const conditionalFormats: StudioSheetConditionalFormat[] = [];
  for (const parent of xmlElements(xml, S, 'conditionalFormatting')) {
    ruleShape(parent, ['cfRule'], ['sqref', 'pivot']);
    if (parent.parentElement !== xml.documentElement || ruleBoolean(parent, 'pivot', false))
      throw new Error('暂不支持嵌套或透视表条件格式。');
    const range = ruleRange(parent.getAttribute('sqref') ?? '');
    if (!parent.children.length || conditionalFormats.length + parent.children.length > 100)
      throw new Error('每张工作表最多支持100个条件格式规则。');
    for (const rule of Array.from(parent.children))
      conditionalFormats.push(
        importedConditionalFormat(
          rule,
          range,
          `xlsx-cf-${sheetId}-${conditionalFormats.length + 1}`,
          styles
        )
      );
  }
  const dataValidations: StudioSheetDataValidation[] = [];
  const parents = xmlElements(xml, S, 'dataValidations');
  if (parents.length > 1) throw new Error('工作表包含重复的数据验证集合。');
  for (const parent of parents) {
    ruleShape(parent, ['dataValidation'], ['count', 'disablePrompts', 'xWindow', 'yWindow']);
    if (
      parent.parentElement !== xml.documentElement ||
      ruleBoolean(parent, 'disablePrompts', false) ||
      ruleInteger(parent, 'xWindow', 0) ||
      ruleInteger(parent, 'yWindow', 0)
    )
      throw new Error('暂不支持全局禁用或定位提示的数据验证。');
    if (
      parent.children.length > 100 ||
      (parent.hasAttribute('count') && ruleInteger(parent, 'count') !== parent.children.length)
    )
      throw new Error('数据验证规则数量无效或超过100个。');
    for (const rule of Array.from(parent.children))
      dataValidations.push(
        importedDataValidation(rule, `xlsx-dv-${sheetId}-${dataValidations.length + 1}`)
      );
  }
  for (const rules of [conditionalFormats, dataValidations]) {
    const covered = rules.reduce((sum, rule) => {
      const range = studioParseRange(rule.range)!;
      return sum + (range.lastRow - range.firstRow + 1) * (range.lastCol - range.firstCol + 1);
    }, 0);
    if (covered > 100000) throw new Error('条件格式或数据验证覆盖单元格超过100000个。');
  }
  return { conditionalFormats, dataValidations };
}

interface NativePageBreak extends ExcelJS.RowBreak {
  pt?: number;
}

function readPageBreaks(xml: XMLDocument, name: 'rowBreaks' | 'colBreaks'): NativePageBreak[] {
  const parent = first(xml, S, name);
  const entries = parent ? xmlElements(parent, S, 'brk') : [];
  if (entries.length > 1026) throw new Error('工作表打印分页符数量超出支持范围。');
  const limit = name === 'rowBreaks' ? 1048576 : 16384;
  const spanLimit = name === 'rowBreaks' ? 16384 : 1048576;
  return entries.map((entry) => {
    const id = Number(entry.getAttribute('id'));
    const min = Number(entry.getAttribute('min') ?? 0);
    const max = Number(entry.getAttribute('max') ?? spanLimit - 1);
    const man = Number(entry.getAttribute('man') ?? 1);
    const pt = entry.hasAttribute('pt') ? Number(entry.getAttribute('pt')) : undefined;
    if (
      !entry.hasAttribute('id') ||
      !Number.isInteger(id) ||
      id < 0 ||
      id > limit ||
      !Number.isInteger(min) ||
      min < 0 ||
      !Number.isInteger(max) ||
      max < min ||
      max >= spanLimit ||
      ![0, 1].includes(man) ||
      (pt !== undefined && ![0, 1].includes(pt))
    )
      throw new Error('工作表打印分页符无效。');
    return { id, min, max, man, ...(pt !== undefined ? { pt } : {}) };
  });
}

function chartReference(input: string): { sheet: string; range: string } {
  const match =
    /^(?:'((?:[^']|'')+)'|([^!]+))!((?:\$?[A-Z]{1,3}\$?[1-9]\d*)(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?)$/i.exec(
      input
    );
  const range = match && studioParseRange(match[3]);
  if (!match || !range) throw new Error('图表包含无法支持的引用或外部数据。');
  return {
    sheet: match[1] ? match[1].replace(/''/g, "'") : match[2],
    range: studioRangeAddress(range),
  };
}

function importedChart(xml: XMLDocument, sheetName: string, path: string): StudioSheetChart {
  const plot = first(xml, C, 'plotArea');
  if (!plot) throw new Error('图表内容无效。');
  const graphs = Array.from(plot.children).filter(
    (element) => element.namespaceURI === C && /Chart$/.test(element.localName)
  );
  const graph = graphs[0];
  if (
    graphs.length !== 1 ||
    !graph ||
    !['barChart', 'lineChart'].includes(graph.localName) ||
    (graph.localName === 'barChart' &&
      (val(graph, C, 'barDir') !== 'col' || val(graph, C, 'grouping') !== 'clustered')) ||
    (graph.localName === 'lineChart' &&
      !['standard', undefined].includes(val(graph, C, 'grouping'))) ||
    first(xml, C, 'externalData') ||
    first(xml, C, 'pivotSource') ||
    first(graph, C, 'trendline') ||
    first(graph, C, 'errBars')
  )
    throw new Error('当前支持二维簇状柱状图和标准折线图，暂不支持组合、堆叠、外部数据及复杂图表。');
  const series = xmlElements(graph, C, 'ser');
  if (!series.length || series.length > 8) throw new Error('图表系列数量超出支持范围。');
  let shared: ReturnType<typeof studioParseRange>;
  for (let index = 0; index < series.length; index++) {
    const item = series[index];
    const category = first(item, C, 'cat');
    const values = first(item, C, 'val');
    const title = first(item, C, 'tx');
    if (!category || !values || !title || !first(title, C, 'strRef'))
      throw new Error('图表需使用首行系列名、首列分类的连续单元格区域。');
    const catRef = chartReference(text(category, C, 'f'));
    const valueRef = chartReference(text(values, C, 'f'));
    const titleRef = chartReference(text(title, C, 'f'));
    const catRange = studioParseRange(catRef.range)!;
    const valueRange = studioParseRange(valueRef.range)!;
    const titleRange = studioParseRange(titleRef.range)!;
    if (
      catRef.sheet !== sheetName ||
      valueRef.sheet !== sheetName ||
      titleRef.sheet !== sheetName ||
      catRange.firstCol !== catRange.lastCol ||
      valueRange.firstCol !== valueRange.lastCol ||
      catRange.firstRow !== valueRange.firstRow ||
      catRange.lastRow !== valueRange.lastRow ||
      titleRange.firstRow !== catRange.firstRow - 1 ||
      titleRange.lastRow !== titleRange.firstRow ||
      titleRange.firstCol !== valueRange.firstCol ||
      titleRange.lastCol !== titleRange.firstCol ||
      valueRange.firstCol !== catRange.firstCol + index + 1 ||
      (shared &&
        (shared.firstRow !== catRange.firstRow - 1 ||
          shared.lastRow !== catRange.lastRow ||
          shared.firstCol !== catRange.firstCol))
    )
      throw new Error('图表的数据区域必须位于本工作表，系列应为紧邻分类列的连续列。');
    shared = {
      firstRow: catRange.firstRow - 1,
      lastRow: catRange.lastRow,
      firstCol: catRange.firstCol,
      lastCol: valueRange.lastCol,
    };
  }
  if (!shared || shared.firstRow < 1 || shared.lastRow - shared.firstRow > 300)
    throw new Error('图表分类数量超出支持范围。');
  const chartTitle = first(first(xml, C, 'chart')!, C, 'title');
  const title = chartTitle
    ? xmlElements(chartTitle, A, 't')
        .map((node) => node.textContent)
        .join('')
    : '';
  if (chartTitle && first(chartTitle, C, 'strRef'))
    throw new Error('暂不支持引用单元格的图表标题。');
  return {
    id: `xlsx-${path}`,
    type: graph.localName === 'barChart' ? 'bar' : 'line',
    title: chartTitle
      ? title
      : val(xml, C, 'autoTitleDeleted') === '1'
        ? ''
        : graph.localName === 'barChart'
          ? '柱状图'
          : '折线图',
    range: studioRangeAddress(shared),
  };
}

function nativeFont(element: Element): NativeFont {
  const font: NativeFont = {};
  const name = val(element, S, 'name');
  if (name !== undefined) font.name = name;
  const size = val(element, S, 'sz');
  if (size !== undefined) {
    const number = Number(size);
    if (!NUMERIC_RULE_FORMULA.test(size) || !Number.isFinite(number) || number < 1 || number > 409)
      throw new Error('工作簿字号必须是 1 到 409 磅之间的有效数值。');
    font.size = number;
  }
  for (const [tag, key] of [
    ['b', 'bold'],
    ['i', 'italic'],
    ['strike', 'strike'],
    ['outline', 'outline'],
    ['shadow', 'shadow'],
    ['condense', 'condense'],
    ['extend', 'extend'],
  ] as const) {
    const node = first(element, S, tag);
    if (node) font[key] = ruleBoolean(node, 'val', true);
  }
  for (const key of ['family', 'charset'] as const) {
    const value = val(element, S, key);
    if (value !== undefined) font[key] = Number(value);
  }
  const scheme = val(element, S, 'scheme');
  if (scheme === 'minor' || scheme === 'major' || scheme === 'none') font.scheme = scheme;
  const vertAlign = val(element, S, 'vertAlign');
  if (vertAlign === 'superscript' || vertAlign === 'subscript') font.vertAlign = vertAlign;
  const underline = first(element, S, 'u');
  if (underline) {
    const value = underline.getAttribute('val') ?? 'single';
    if (
      value === 'none' ||
      value === 'single' ||
      value === 'double' ||
      value === 'singleAccounting' ||
      value === 'doubleAccounting'
    )
      font.underline = value === 'none' ? false : value;
  }
  const color = first(element, S, 'color');
  if (color) {
    const rgb = color.getAttribute('rgb');
    const theme = color.getAttribute('theme');
    const indexed = color.getAttribute('indexed');
    if (rgb !== null) font.color = { argb: rgb };
    else if (theme !== null) {
      font.color = { theme: Number(theme) };
      const tint = color.getAttribute('tint');
      if (tint !== null) font.color.tint = Number(tint);
    } else if (indexed !== null) font.color = { indexed: Number(indexed) };
  }
  return font;
}

function nativeFontStyles(xml: XMLDocument | undefined): Array<NativeFont | undefined> {
  if (!xml) return [];
  const definitions = first(xml, S, 'fonts');
  const fonts = definitions ? Array.from(definitions.children).map(nativeFont) : [];
  const formats = first(xml, S, 'cellXfs');
  return formats
    ? Array.from(formats.children).map((format) => {
        const fontId = Number(format.getAttribute('fontId') ?? 0);
        return Number.isSafeInteger(fontId) && fontId >= 0 ? fonts[fontId] : undefined;
      })
    : [];
}

function nativeSheetFonts(
  xml: XMLDocument,
  styles: Array<NativeFont | undefined>
): NativeSheetFonts {
  const fonts: NativeSheetFonts = { styles, cells: new Map(), rows: new Map(), columns: new Map() };
  for (const cell of xmlElements(xml, S, 'c')) {
    const address = cell.getAttribute('r');
    if (!address) continue;
    const style = cell.getAttribute('s');
    // A missing s inherits; s="0" explicitly selects the default format.
    fonts.cells.set(address, style === null ? undefined : Number(style));
  }
  for (const row of xmlElements(xml, S, 'row')) {
    const style = row.getAttribute('s');
    if (style !== null) fonts.rows.set(Number(row.getAttribute('r')), Number(style));
  }
  for (const column of xmlElements(xml, S, 'col')) {
    const style = column.getAttribute('style');
    if (style === null) continue;
    const start = Number(column.getAttribute('min'));
    const end = Number(column.getAttribute('max'));
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end < start ||
      end > 16384
    )
      throw new Error('工作簿列样式范围无效。');
    for (let index = start; index <= end; index++) fonts.columns.set(index, Number(style));
  }
  return fonts;
}

function restoreNativeFonts(worksheet: ExcelJS.Worksheet, native: NativeSheetFonts) {
  const restore = (base: Partial<ExcelJS.Font> | undefined, original: NativeFont | undefined) => {
    if (!base && !original) return undefined;
    const font: NativeFont = { ...base, ...original };
    if (font.color) font.color = { ...font.color };
    return font;
  };
  // Row/column font setters propagate to cells, overwriting explicit fonts. Restore styles directly.
  for (const [index, style] of native.rows) {
    // ExcelJS 4.4 exposes this runtime property but omits it from Row's declarations.
    const row = worksheet.getRow(index) as ExcelJS.Row & { style: Partial<ExcelJS.Style> };
    const font = restore(row.font, native.styles[style]);
    if (font) row.style = { ...row.style, font };
  }
  for (const [index, style] of native.columns) {
    const column = worksheet.getColumn(index);
    const font = restore(column.font, native.styles[style]);
    if (font) column.style = { ...column.style, font };
  }
  for (const [address, explicit] of native.cells) {
    const point = studioParseAddress(address);
    if (!point) continue;
    const rowStyle = native.rows.get(point.row);
    const columnStyle = native.columns.get(point.col);
    const cell = worksheet.getCell(address);
    let style = explicit;
    let base: Partial<ExcelJS.Font> | undefined = cell.font;
    if (style === undefined) {
      if (rowStyle !== undefined && native.styles[rowStyle]) {
        style = rowStyle;
        base = worksheet.getRow(point.row).font;
      } else if (columnStyle !== undefined && native.styles[columnStyle]) {
        style = columnStyle;
        base = worksheet.getColumn(point.col).font;
      } else style = 0;
    }
    const font = restore(base, native.styles[style]);
    if (font) cell.style = { ...cell.style, font };
  }
}

async function readMetadata(zip: JSZip): Promise<Map<number, SheetMetadata>> {
  const workbook = xmlDocument(await zip.file('xl/workbook.xml')!.async('string'));
  const workbookRels = await relationships(zip, 'xl/workbook.xml');
  const metadata = new Map<number, SheetMetadata>();
  const stylesEntry = zip.file('xl/styles.xml');
  const stylesXml = stylesEntry ? xmlDocument(await stylesEntry.async('string')) : undefined;
  const fontStyles = nativeFontStyles(stylesXml);
  const differential = stylesXml && first(stylesXml, S, 'dxfs');
  const styles = differential ? Array.from(differential.children) : [];
  if (differential) {
    ruleShape(differential, ['dxf'], ['count']);
    if (differential.hasAttribute('count') && ruleInteger(differential, 'count') !== styles.length)
      throw new Error('工作簿差异样式数量无效。');
  }
  let mergedCells = 0;
  let storedCells = 0;
  let hyperlinkCount = 0;
  const referencedCharts = new Set<string>();
  const referencedDrawings = new Set<string>();
  for (const sheet of xmlElements(workbook, S, 'sheet')) {
    const path = workbookRels.get(sheet.getAttributeNS(R, 'id') ?? '');
    const entry = path && zip.file(path);
    if (!entry || !path) throw new Error('工作表关系无效。');
    const xml = xmlDocument(await entry.async('string'));
    const nativeRelations = await readRelationships(zip, path);
    const rels = internalRelationships(path, nativeRelations);
    const sheetId = Number(sheet.getAttribute('sheetId'));
    const hyperlinks = readHyperlinks(xml, nativeRelations, sheetId);
    hyperlinkCount += hyperlinks.length;
    if (hyperlinkCount > 100000) throw new Error('工作簿最多支持 100,000 个超链接。');
    const merges = xmlElements(xml, S, 'mergeCell').map((node) => node.getAttribute('ref') ?? '');
    const nativeCells = xmlElements(xml, S, 'c');
    storedCells += nativeCells.length;
    if (storedCells > STUDIO_SHEET_LIMITS.storedCells)
      throw new Error('工作簿包含超过 100,000 个已使用单元格。');
    const numericInputs = new Map<string, string>();
    for (const cell of nativeCells) {
      if (first(cell, S, 'f')) continue;
      const address = cell.getAttribute('r');
      const input = first(cell, S, 'v')?.textContent?.trim();
      const type = cell.getAttribute('t');
      if (!address || !input) continue;
      if (
        (!type || type === 'n') &&
        NUMERIC_RULE_FORMULA.test(input) &&
        Number.isFinite(Number(input))
      )
        numericInputs.set(address, input);
      else if (type === 'd') {
        // ISO dates describe Gregorian days; numeric dates already contain Excel's leap day.
        const serial = dateSerial(new Date(input));
        if (Number.isFinite(serial))
          numericInputs.set(address, String(serial < 61 ? serial - 1 : serial));
      }
    }
    for (const input of merges) {
      const range = studioParseRange(input);
      if (
        !range ||
        range.lastRow > STUDIO_SHEET_LIMITS.rows ||
        range.lastCol > STUDIO_SHEET_LIMITS.columns
      )
        throw new Error('工作簿合并区域超出支持范围。');
      const area = (range.lastRow - range.firstRow + 1) * (range.lastCol - range.firstCol + 1);
      mergedCells += area;
      if (
        area > STUDIO_SHEET_LIMITS.clipboardCells ||
        mergedCells > STUDIO_SHEET_LIMITS.storedCells
      )
        throw new Error('工作簿合并占位单元格超出支持范围，请缩小区域后重试。');
    }
    const pane = first(xml, S, 'pane');
    let freeze: StudioSheet['freeze'];
    if (pane?.getAttribute('state') === 'frozen' || pane?.getAttribute('state') === 'frozenSplit')
      freeze = {
        rows: Number(pane.getAttribute('ySplit') ?? 0),
        columns: Number(pane.getAttribute('xSplit') ?? 0),
      };
    else if (pane) throw new Error('当前支持冻结窗格，暂不支持拆分窗格。');
    const autoFilter = first(xml, S, 'autoFilter');
    let filter: StudioSheet['filter'];
    if (autoFilter) {
      const range = studioParseRange(autoFilter.getAttribute('ref') ?? '');
      if (!range) throw new Error('工作表筛选范围无效。');
      filter = { range: studioRangeAddress(range), columns: {} };
      for (const column of xmlElements(autoFilter, S, 'filterColumn')) {
        const filters = xmlElements(column, S, 'filter');
        const customs = xmlElements(column, S, 'customFilter');
        if (
          filters.length + customs.length !== 1 ||
          first(column, S, 'top10') ||
          first(column, S, 'dynamicFilter') ||
          first(column, S, 'colorFilter') ||
          first(column, S, 'iconFilter')
        )
          throw new Error('当前支持每列单一文字或数字条件，暂不支持多值、颜色或动态筛选。');
        const condition = filters[0] ?? customs[0];
        const value = condition.getAttribute('val') ?? '';
        let operator: 'contains' | 'equals' | 'greater' | 'less' = 'equals';
        let comparison = value;
        if (customs.length) {
          const native = condition.getAttribute('operator') ?? 'equal';
          if (native === 'greaterThan') operator = 'greater';
          else if (native === 'lessThan') operator = 'less';
          else if (native !== 'equal') throw new Error('工作表包含暂不支持的筛选条件。');
          else if (value.startsWith('*') && value.endsWith('*')) {
            operator = 'contains';
            comparison = value.slice(1, -1).replace(/~([~*?])/g, '$1');
          } else if (/[?*]/.test(value.replace(/~[~*?]/g, '')))
            throw new Error('暂不支持复杂通配符筛选。');
          else comparison = value.replace(/~([~*?])/g, '$1');
        }
        filter.columns[studioColumnLabel(range.firstCol + Number(column.getAttribute('colId')))] = {
          operator,
          value: comparison,
        };
      }
    }
    const charts: StudioSheetChart[] = [];
    for (const drawing of xmlElements(xml, S, 'drawing')) {
      const drawingPath = rels.get(drawing.getAttributeNS(R, 'id') ?? '');
      const drawingEntry = drawingPath && zip.file(drawingPath);
      if (!drawingEntry || !drawingPath) throw new Error('工作表图表关系无效。');
      referencedDrawings.add(drawingPath);
      const drawingXml = xmlDocument(await drawingEntry.async('string'));
      const drawingRels = await relationships(zip, drawingPath);
      if (['pic', 'sp', 'grpSp', 'cxnSp'].some((name) => first(drawingXml, XDR, name)))
        throw new Error('暂不支持含图片或绘图对象的工作表。');
      const refs = xmlElements(drawingXml, C, 'chart');
      if (!refs.length) throw new Error('工作表包含暂不支持的绘图对象。');
      for (const ref of refs) {
        const chartPath = drawingRels.get(ref.getAttributeNS(R, 'id') ?? '');
        const chartEntry = chartPath && zip.file(chartPath);
        if (!chartEntry || !chartPath) throw new Error('图表关系无效。');
        referencedCharts.add(chartPath);
        charts.push(
          importedChart(
            xmlDocument(await chartEntry.async('string')),
            sheet.getAttribute('name') ?? '',
            chartPath
          )
        );
      }
    }
    metadata.set(sheetId, {
      name: sheet.getAttribute('name') ?? '',
      numericInputs,
      fonts: nativeSheetFonts(xml, fontStyles),
      rowLayout: nativeRowLayout(xml),
      hyperlinks,
      merges,
      freeze,
      filter,
      charts,
      ...readSheetRules(xml, styles, sheetId),
      pageBreaks: {
        rowBreaks: readPageBreaks(xml, 'rowBreaks'),
        colBreaks: readPageBreaks(xml, 'colBreaks'),
      },
    });
  }
  for (const path of Object.keys(zip.files)) {
    if (
      (/^xl\/charts\/[^/]+\.xml$/.test(path) && !referencedCharts.has(path)) ||
      (/^xl\/drawings\/[^/]+\.xml$/.test(path) && !referencedDrawings.has(path))
    )
      throw new Error('工作簿含无法识别的图表或绘图对象，已取消导入以免丢失内容。');
  }
  return metadata;
}

async function checkSupportedWorkbook(source: Blob) {
  if (source.size > 20 * 1024 * 1024) throw new Error('首版支持最大 20 MB 的 XLSX 文件。');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await source.arrayBuffer());
  } catch {
    throw new Error('无法读取此工作簿，请导入有效的 .xlsx 文件。');
  }
  const names = Object.keys(zip.files);
  const expandedSize = Object.values(zip.files).reduce((size, entry) => {
    const data = entry as unknown as { _data?: { uncompressedSize?: number } };
    return size + (data._data?.uncompressedSize ?? 0);
  }, 0);
  if (names.length > 10000 || expandedSize > 100 * 1024 * 1024)
    throw new Error('工作簿解压后的内容过大，请缩小文件后重试。');
  if (!names.includes('xl/workbook.xml')) throw new Error('此文件不是有效的 XLSX 工作簿。');
  if (
    names.some(
      (name) =>
        /^xl\/(?:chartsheets|dialogSheets|pivotTables|pivotCache|externalLinks|activeX|embeddings|tables|queryTables|slicers|slicerCaches|timelines|ctrlProps|media)\//.test(
          name
        ) || /vbaProject|_xmlsignatures|xl\/connections\.xml/.test(name)
    )
  )
    throw new Error(
      '此工作簿包含图片、数据表、透视表、外部连接、宏或其他不受支持的对象。请在 Excel 或 WPS 中打开原文件。'
    );
  const workbookXml = await zip.file('xl/workbook.xml')!.async('string');
  if (/<workbookProtection\b/.test(workbookXml))
    throw new Error('受保护的工作簿暂不支持在线修改。');
  if (/<sheet\b[^>]*\bstate="(?:hidden|veryHidden)"/.test(workbookXml))
    throw new Error('含隐藏工作表的工作簿暂不支持在线修改。');
  if (/<definedName\b[^>]*\bname="(?!_xlnm\.)/.test(workbookXml))
    throw new Error(
      '此工作簿包含命名区域，首版尚不能完整计算与保存。请在 Excel 或 WPS 中打开原文件。'
    );
  for (const name of names) {
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(name)) continue;
    const xml = await zip.file(name)!.async('string');
    if (/<sheetProtection\b/.test(xml)) throw new Error('受保护的工作表暂不支持在线修改。');
    if (/<f\b[^>]*\bt="(?:array|dataTable)"/.test(xml))
      throw new Error(
        '此工作簿含数组公式或模拟运算表，首版尚不支持。请在 Excel 或 WPS 中打开原文件。'
      );
  }
  return readMetadata(zip);
}

function dateSerial(value: Date): number {
  // ExcelJS uses the same fixed epoch for numeric dates on both sides of serial 60.
  return value.getTime() / 86400000 + 25569;
}

function importedInput(cell: ExcelJS.Cell, nativeNumericInput?: string): string {
  if (cell.type === ExcelJS.ValueType.Formula) return `=${cell.formula}`;
  // Prefer the XML value because ExcelJS rounds fractional days to milliseconds.
  if (cell.value instanceof Date) return nativeNumericInput ?? String(dateSerial(cell.value));
  if (typeof cell.value === 'number' || typeof cell.value === 'boolean') return String(cell.value);
  if (typeof cell.value === 'object' && cell.value && 'error' in cell.value)
    return String(cell.value.error);
  const text = cell.text;
  // Excel text that resembles a value or formula must remain text on round-trip.
  if (typeof studioInputValue(text) !== 'string' || /^[='#]/.test(text)) return `'${text}`;
  return text;
}

function rgb(color: Partial<ExcelJS.Color> | undefined): string | undefined {
  return color?.argb && /^[\da-f]{8}$/i.test(color.argb) ? `#${color.argb.slice(2)}` : undefined;
}

function argb(color: string): string | undefined {
  return /^#[\da-f]{6}$/i.test(color) ? `FF${color.slice(1).toUpperCase()}` : undefined;
}

function importedCell(cell: ExcelJS.Cell, nativeNumericInput?: string): StudioCell {
  const result: StudioCell = { input: importedInput(cell, nativeNumericInput) };
  if (cell.font?.name !== undefined) result.fontFamily = cell.font.name;
  if (cell.font?.size !== undefined) result.fontSize = cell.font.size;
  if (cell.font?.bold !== undefined) result.bold = cell.font.bold;
  if (cell.font?.italic !== undefined) result.italic = cell.font.italic;
  if (cell.font?.underline !== undefined) {
    if (
      cell.font.underline !== true &&
      cell.font.underline !== false &&
      cell.font.underline !== 'single'
    )
      throw new Error('暂不支持非单线下划线的单元格。');
    result.underline = !!cell.font.underline;
  }
  const color = rgb(cell.font?.color);
  if (color) result.color = color;
  if (cell.fill?.type === 'pattern' && cell.fill.pattern === 'solid') {
    const background = rgb(cell.fill.fgColor);
    if (background) result.background = background;
  }
  if (cell.numFmt && cell.numFmt !== 'General') result.numberFormat = cell.numFmt;
  const align = cell.alignment?.horizontal;
  if (align === 'left' || align === 'center' || align === 'right') result.align = align;
  if (cell.alignment?.wrapText !== undefined) result.wrap = cell.alignment.wrapText;
  const vertical = cell.alignment?.vertical;
  if (vertical === 'top' || vertical === 'middle' || vertical === 'bottom')
    result.verticalAlign = vertical;
  if (cell.border && Object.keys(cell.border).length) {
    const borders: StudioCell['borders'] = {};
    for (const side of studioBorderSides) {
      const border = cell.border[side];
      if (!border?.style || !studioBorderStyles.includes(border.style)) continue;
      const color = rgb(border.color);
      borders[side] = { style: border.style, ...(color ? { color } : {}) };
    }
    if (Object.keys(borders).length) result.borders = borders;
  }
  return result;
}

function validateDocument(document: StudioExcelDocument) {
  if (!document.sheets.length || document.sheets.length > STUDIO_SHEET_LIMITS.sheets)
    throw new Error('首版支持 1–32 张工作表。');
  const ids = new Set<string>();
  let count = 0;
  for (const sheet of document.sheets) {
    if (ids.has(sheet.id)) throw new Error('工作表标识重复。');
    ids.add(sheet.id);
    const issue = studioSheetNameIssue(document, sheet.id, sheet.name);
    if (issue) throw new Error(issue);
    if (
      !Number.isInteger(sheet.rowCount) ||
      !Number.isInteger(sheet.columnCount) ||
      sheet.rowCount < 1 ||
      sheet.columnCount < 1 ||
      sheet.rowCount > STUDIO_SHEET_LIMITS.rows ||
      sheet.columnCount > STUDIO_SHEET_LIMITS.columns
    )
      throw new Error('首版支持每张工作表最多 10,000 行、256 列。');
    for (const [address, cell] of Object.entries(sheet.cells)) {
      const position = studioParseAddress(address);
      if (
        !position ||
        position.row > sheet.rowCount ||
        position.col > sheet.columnCount ||
        typeof cell.input !== 'string' ||
        cell.input.length > 32767
      )
        throw new Error('工作簿包含无效或超出工作表范围的单元格。');
      if (++count > STUDIO_SHEET_LIMITS.storedCells)
        throw new Error('首版支持一个工作簿最多 100,000 个已使用单元格。');
    }
    if (sheet.merges && (!Array.isArray(sheet.merges) || sheet.merges.length > 1000))
      throw new Error('合并区域数量超出支持范围。');
    if (
      sheet.structureEdits &&
      (!Array.isArray(sheet.structureEdits) ||
        sheet.structureEdits.length > 500 ||
        sheet.structureEdits.some((edit) => {
          const limit =
            edit?.axis === 'row' ? STUDIO_SHEET_LIMITS.rows : STUDIO_SHEET_LIMITS.columns;
          return (
            !edit ||
            !['row', 'column'].includes(edit.axis) ||
            !['insert', 'delete'].includes(edit.type) ||
            !Number.isInteger(edit.index) ||
            !Number.isInteger(edit.count) ||
            edit.index < 1 ||
            edit.count < 1 ||
            edit.index > limit ||
            edit.count > limit
          );
        }))
    )
      throw new Error('工作表包含无效的行列修改记录，请重新打开原文件。');
    let checked: StudioExcelDocument = {
      ...document,
      sheets: document.sheets.map((item) =>
        item.id === sheet.id
          ? { ...item, merges: [], freeze: undefined, filter: undefined, charts: [] }
          : item
      ),
    };
    for (const entry of sheet.merges ?? []) {
      const range = studioParseRange(entry);
      if (!range) throw new Error('合并区域无效。');
      checked = studioMergeCells(checked, sheet.id, {
        anchor: { row: range.firstRow, col: range.firstCol },
        focus: { row: range.lastRow, col: range.lastCol },
      });
    }
    if (sheet.freeze)
      checked = studioSetFreeze(checked, sheet.id, sheet.freeze.rows, sheet.freeze.columns);
    if (sheet.filter) checked = studioSetFilter(checked, sheet.id, sheet.filter);
    if (sheet.charts && (!Array.isArray(sheet.charts) || sheet.charts.length > 20))
      throw new Error('每張工作表最多支持 20 个图表。');
    const chartIds = new Set<string>();
    for (const chart of sheet.charts ?? []) {
      if (
        !chart.id ||
        chartIds.has(chart.id) ||
        !['bar', 'line'].includes(chart.type) ||
        typeof chart.title !== 'string' ||
        chart.title.length > 256
      )
        throw new Error('图表属性无效。');
      chartIds.add(chart.id);
      checked = studioAddChart(checked, sheet.id, chart.range, chart.type);
    }
  }
  if (!isOfficeStudioDocument(document))
    throw new Error('工作簿草稿、条件格式或数据验证属性无效或超出支持范围。');
}

async function loadWorkbook(source: Blob): Promise<{
  workbook: ExcelJS.Workbook;
  metadata: Map<number, SheetMetadata>;
}> {
  const metadata = await checkSupportedWorkbook(source);
  const workbook = new ExcelJS.Workbook();
  try {
    // Native links/rules are rebuilt separately. Links otherwise replace values/formulas with text.
    await workbook.xlsx.load(await source.arrayBuffer(), {
      ignoreNodes: ['conditionalFormatting', 'dataValidations', 'hyperlinks'],
    });
  } catch {
    throw new Error('无法解析此工作簿，请导入有效的 .xlsx 文件。');
  }
  if (workbook.properties.date1904)
    throw new Error('首版暂不支持使用 1904 日期系统的工作簿。请在 Excel 或 WPS 中打开原文件。');
  if (!workbook.worksheets.length) throw new Error('工作簿中没有工作表。');
  // ExcelJS 4.4 reads <sz> with parseInt. Keep native decimals and inherited fonts before any edits.
  for (const worksheet of workbook.worksheets) {
    const native = metadata.get(worksheet.id);
    if (native) restoreNativeFonts(worksheet, native.fonts);
  }
  return { workbook, metadata };
}

function importedDocument(
  workbook: ExcelJS.Workbook,
  metadata: Map<number, SheetMetadata>,
  name: string
): StudioExcelDocument {
  let count = 0;
  const sheets: StudioSheet[] = workbook.worksheets.map((sheet) => {
    if (
      sheet.rowCount > STUDIO_SHEET_LIMITS.rows ||
      sheet.columnCount > STUDIO_SHEET_LIMITS.columns ||
      (sheet.columns?.length ?? 0) > STUDIO_SHEET_LIMITS.columns
    )
      throw new Error('首版支持每张工作表最多 10,000 行、256 列。此文件超出了支持范围。');
    const cells: Record<string, StudioCell> = {};
    const advanced = metadata.get(sheet.id);
    const rowLayout = advanced?.rowLayout;
    sheet.eachRow({ includeEmpty: true }, (row) =>
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.type === ExcelJS.ValueType.Merge) return;
        const value = importedCell(cell, advanced?.numericInputs.get(cell.address));
        if (value.input === '' && Object.keys(value).length === 1) return;
        if (++count > STUDIO_SHEET_LIMITS.storedCells)
          throw new Error('首版支持一个工作簿最多 100,000 个已使用单元格。');
        cells[cell.address] = value;
      })
    );
    const columnWidths: Record<string, number> = {};
    for (
      let col = 1;
      col <=
      Math.min(
        STUDIO_SHEET_LIMITS.columns,
        Math.max(sheet.columnCount, sheet.columns?.length ?? 0)
      );
      col++
    ) {
      const width = sheet.getColumn(col).width;
      if (width !== undefined) columnWidths[studioColumnLabel(col)] = width * 7 + 5;
    }
    const ruleRanges = [
      ...(advanced?.conditionalFormats ?? []),
      ...(advanced?.dataValidations ?? []),
    ].map((rule) => studioParseRange(rule.range)!);
    const linkRanges = (advanced?.hyperlinks ?? [])
      .map((link) => studioParseRange(link.ref)!)
      .filter(
        (range) =>
          range.lastRow <= STUDIO_SHEET_LIMITS.rows && range.lastCol <= STUDIO_SHEET_LIMITS.columns
      );
    const linkRows = linkRanges.reduce((maximum, range) => Math.max(maximum, range.lastRow), 0);
    const linkColumns = linkRanges.reduce((maximum, range) => Math.max(maximum, range.lastCol), 0);
    return {
      id: `xlsx-sheet-${sheet.id}`,
      name: sheet.name,
      cells,
      rowCount: Math.max(
        200,
        sheet.rowCount,
        rowLayout?.lastRow ?? 0,
        ...ruleRanges.map((range) => range.lastRow),
        linkRows
      ),
      columnCount: Math.max(
        26,
        sheet.columnCount,
        ...ruleRanges.map((range) => range.lastCol),
        linkColumns
      ),
      ...(Object.keys(columnWidths).length ? { columnWidths } : {}),
      defaultRowHeight:
        rowLayout?.defaultRowHeight ||
        sheet.properties.defaultRowHeight ||
        STUDIO_SHEET_LIMITS.defaultRowHeight,
      rowHeights: { ...rowLayout?.rowHeights },
      hiddenRows: [...(rowLayout?.hiddenRows ?? [])],
      ...(advanced
        ? {
            merges: advanced.merges,
            freeze: advanced.freeze,
            filter: advanced.filter,
            charts: advanced.charts,
            hyperlinks: advanced.hyperlinks,
            ...(advanced.conditionalFormats.length
              ? { conditionalFormats: advanced.conditionalFormats }
              : {}),
            ...(advanced.dataValidations.length
              ? { dataValidations: advanced.dataValidations }
              : {}),
          }
        : {}),
    };
  });
  // Empty cells referenced by dropdowns still need to be addressable in the editor's grid.
  for (const sheet of sheets)
    for (const validation of sheet.dataValidations ?? []) {
      if (validation.type !== 'list' || !validation.source || validation.source === '=#REF!')
        continue;
      const reference = listSourceReference(validation.source);
      const target = reference.name
        ? sheets.find((entry) => entry.name.toLowerCase() === reference.name?.toLowerCase())
        : sheet;
      if (!target) throw new Error('数据验证引用的工作表不存在。');
      const range = studioParseRange(reference.range)!;
      target.rowCount = Math.max(target.rowCount, range.lastRow);
      target.columnCount = Math.max(target.columnCount, range.lastCol);
    }
  const selected = workbook.views?.[0]?.activeTab ?? 0;
  const document: StudioExcelDocument = {
    version: 1,
    id: `xlsx-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    name,
    kind: 'excel',
    sheets,
    activeSheetId: sheets[selected]?.id ?? sheets[0].id,
  };
  const calculation = studioCalculate(document);
  for (const sheet of sheets) {
    const native = metadata.get(Number(sheet.id.slice('xlsx-sheet-'.length)))?.rowLayout;
    const filtered = studioFilteredRows({ ...sheet, hiddenRows: [] }, calculation);
    const hidden = new Set(sheet.hiddenRows);
    if (native?.defaultHidden) {
      const visible = new Set(native.visibleRows);
      for (let row = 1; row <= sheet.rowCount; row++) if (!visible.has(row)) hidden.add(row);
    }
    // XLSX stores a single hidden flag for manual hides and filter results.
    // Exclude current filter results so clearing the filter restores those rows.
    sheet.hiddenRows = [...hidden].filter((row) => !filtered.has(row)).sort((a, b) => a - b);
  }
  validateDocument(document);
  return document;
}

export async function importStudioExcel(source: Blob, name: string): Promise<StudioExcelDocument> {
  const { workbook, metadata } = await loadWorkbook(source);
  return importedDocument(workbook, metadata, name);
}

function hydrateHyperlinksFromMetadata(
  document: StudioExcelDocument,
  metadata: Map<number, SheetMetadata>
): StudioExcelDocument {
  const sourceIdentity = (sheet: StudioSheet) => {
    const id = /^xlsx-sheet-(\d+)$/.exec(sheet.id)?.[1];
    return id === undefined ? undefined : Number(id);
  };
  const matched = document.sheets.flatMap((sheet) => {
    const id = sourceIdentity(sheet);
    const native = id === undefined ? undefined : metadata.get(id);
    if (id !== undefined && !native)
      throw new Error('草稿引用的原工作表不存在，请重新打开原文件。');
    return native ? [{ sheet, id: id!, native }] : [];
  });
  const newSheets = document.sheets.filter(
    (sheet) => sheet.hyperlinks === undefined && sourceIdentity(sheet) === undefined
  );
  let legacy: StudioSheet[] = matched
    .filter(({ sheet }) => sheet.hyperlinks === undefined)
    .map(({ sheet, native }) => ({
      ...sheet,
      name: native.name,
      hyperlinks: native.hyperlinks.map((link) => ({ ...link })),
    }));
  if (!legacy.length && !newSheets.length) return document;
  // Modern arrays already follow edits; only the source metadata of legacy sheets is replayed.
  for (const { sheet, native } of matched)
    for (const edit of sheet.structureEdits ?? [])
      legacy = legacy.map((owner) =>
        studioTransformSheetHyperlinks(owner, { ...sheet, name: native.name }, edit)
      );
  const retained = new Set(matched.map(({ id }) => id));
  for (const [id, native] of metadata) {
    if (retained.has(id)) continue;
    const removed: StudioSheet = {
      id: `xlsx-sheet-${id}`,
      name: native.name,
      cells: {},
      rowCount: 200,
      columnCount: 26,
    };
    legacy = legacy.map((owner) => studioDeleteSheetHyperlinks(owner, removed));
  }
  // Host-controlled name swaps need the same two-phase renaming as the workbook itself.
  const occupiedNames = new Set([
    ...document.sheets.map((sheet) => sheet.name.toLowerCase()),
    ...[...metadata.values()].map((sheet) => sheet.name.toLowerCase()),
  ]);
  const renames = matched
    .filter(({ sheet, native }) => sheet.name !== native.name)
    .map(({ sheet, native, id }) => {
      let temporary = `_zui_link_${id}`;
      while (occupiedNames.has(temporary.toLowerCase())) temporary += '_';
      occupiedNames.add(temporary.toLowerCase());
      return { oldName: native.name, name: sheet.name, temporary };
    });
  for (const rename of renames)
    legacy = legacy.map((owner) =>
      studioRenameSheetHyperlinks(owner, rename.oldName, rename.temporary)
    );
  for (const rename of renames)
    legacy = legacy.map((owner) =>
      studioRenameSheetHyperlinks(owner, rename.temporary, rename.name)
    );
  const resolved = new Map(legacy.map((sheet) => [sheet.id, sheet.hyperlinks]));
  for (const sheet of newSheets) resolved.set(sheet.id, []);
  return {
    ...document,
    sheets: document.sheets.map((sheet) =>
      resolved.has(sheet.id) ? { ...sheet, hyperlinks: resolved.get(sheet.id)! } : sheet
    ),
  };
}

/** Restore missing source metadata before editing an older workspace or history entry. */
export async function hydrateStudioExcelHyperlinks(
  document: StudioExcelDocument,
  source: Blob
): Promise<StudioExcelDocument> {
  if (
    document.sheets.every(
      (sheet) =>
        sheet.hyperlinks !== undefined &&
        sheet.defaultRowHeight !== undefined &&
        sheet.rowHeights !== undefined &&
        sheet.hiddenRows !== undefined
    )
  )
    return document;
  validateDocument(document);
  const metadata = await checkSupportedWorkbook(source);
  const linked = hydrateHyperlinksFromMetadata(document, metadata);
  const calculation = studioCalculate(linked);
  const hydrated = {
    ...linked,
    sheets: linked.sheets.map((sheet) => {
      if (
        sheet.defaultRowHeight !== undefined &&
        sheet.rowHeights !== undefined &&
        sheet.hiddenRows !== undefined
      )
        return sheet;
      const id = /^xlsx-sheet-(\d+)$/.exec(sheet.id)?.[1];
      const native = id === undefined ? undefined : metadata.get(Number(id))?.rowLayout;
      if (!native) return sheet;
      const edits = sheet.structureEdits ?? [];
      const heights: Record<string, number> = {};
      for (const [index, height] of Object.entries(native.rowHeights)) {
        const row = transformSourceIndex(Number(index), 'row', edits);
        if (row !== undefined && row <= sheet.rowCount) heights[String(row)] = height;
      }
      const sourceHidden = new Set(native.hiddenRows);
      if (native.defaultHidden) {
        const visible = new Set(native.visibleRows);
        const sourceRows = edits.reduce(
          (rows, edit) =>
            edit.axis === 'row' ? rows + (edit.type === 'insert' ? -edit.count : edit.count) : rows,
          sheet.rowCount
        );
        for (let row = 1; row <= sourceRows; row++) if (!visible.has(row)) sourceHidden.add(row);
      }
      const filtered = studioFilteredRows({ ...sheet, hiddenRows: [] }, calculation);
      const hidden = [...sourceHidden]
        .flatMap((index) => {
          const row = transformSourceIndex(index, 'row', edits);
          return row !== undefined && row <= sheet.rowCount && !filtered.has(row) ? [row] : [];
        })
        .sort((a, b) => a - b);
      return {
        ...sheet,
        defaultRowHeight: sheet.defaultRowHeight ?? native.defaultRowHeight ?? 18,
        rowHeights: sheet.rowHeights ?? heights,
        hiddenRows: sheet.hiddenRows ?? hidden,
      };
    }),
  };
  validateDocument(hydrated);
  return hydrated;
}

function exportedValue(cell: StudioCell): ExcelJS.CellValue {
  const input = cell.input;
  if (input.startsWith('=')) return { formula: input.slice(1) };
  if (input === '') return null;
  if (excelErrors.includes(input as (typeof excelErrors)[number]))
    return { error: input as ExcelJS.CellErrorValue['error'] };
  return studioInputValue(input, cell.numberFormat);
}

function updateCell(target: ExcelJS.Cell, cell: StudioCell) {
  const original = importedCell(target);
  if (
    cell.input !== original.input ||
    (cell.numberFormat === '@') !== (original.numberFormat === '@')
  )
    target.value = exportedValue(cell);
  if (cell.fontFamily !== undefined && cell.fontFamily !== original.fontFamily) {
    const font = { ...target.font, name: cell.fontFamily };
    // Explicit font selection releases the theme binding, as in Office's font setter.
    delete font.scheme;
    target.font = font;
  }
  if (cell.fontSize !== undefined && cell.fontSize !== original.fontSize)
    target.font = { ...target.font, size: cell.fontSize };
  if (cell.bold !== undefined && cell.bold !== original.bold)
    target.font = { ...target.font, bold: cell.bold };
  if (cell.italic !== undefined && cell.italic !== original.italic)
    target.font = { ...target.font, italic: cell.italic };
  if (cell.underline !== undefined && cell.underline !== original.underline)
    target.font = { ...target.font, underline: cell.underline };
  if (cell.color !== undefined && cell.color !== original.color) {
    const color = argb(cell.color);
    if (color) target.font = { ...target.font, color: { argb: color } };
  }
  if (cell.background !== undefined && cell.background !== original.background) {
    const background = argb(cell.background);
    if (background)
      target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: background } };
    else if (cell.background === 'none') target.fill = { type: 'pattern', pattern: 'none' };
  }
  if (cell.numberFormat !== undefined && cell.numberFormat !== original.numberFormat)
    target.numFmt = cell.numberFormat;
  if (cell.align !== undefined && cell.align !== original.align)
    target.alignment = {
      ...target.alignment,
      horizontal: cell.align === 'general' ? undefined : cell.align,
    };
  if (cell.wrap !== undefined && cell.wrap !== original.wrap)
    target.alignment = { ...target.alignment, wrapText: cell.wrap };
  if (cell.verticalAlign !== undefined && cell.verticalAlign !== original.verticalAlign)
    target.alignment = { ...target.alignment, vertical: cell.verticalAlign };
  if (
    cell.borders !== undefined &&
    JSON.stringify(cell.borders) !== JSON.stringify(original.borders)
  ) {
    const next: Partial<ExcelJS.Borders> = Object.keys(cell.borders).length
      ? { ...target.border }
      : {};
    for (const side of studioBorderSides) {
      const border = cell.borders[side];
      if (border)
        next[side] = {
          style: border.style,
          color: border.color ? { argb: argb(border.color)! } : { argb: 'FF000000' },
        };
      else delete next[side];
    }
    target.border = next;
  }
}

function transformSourceIndex(
  index: number,
  axis: StudioSheetStructureEdit['axis'],
  edits: StudioSheetStructureEdit[]
): number | undefined {
  let transformed: number | undefined = index;
  for (const edit of edits) {
    if (transformed === undefined) break;
    if (edit.axis === axis) transformed = studioTransformSheetIndex(transformed, edit);
  }
  return transformed;
}

function transformSourceRange(
  input: string | undefined,
  edits: StudioSheetStructureEdit[]
): string | undefined {
  let range = input;
  for (const edit of edits) {
    if (!range) break;
    range = studioTransformSheetRange(range, edit);
  }
  return range;
}

function replaySourceStructure(target: ExcelJS.Worksheet, edits: StudioSheetStructureEdit[]) {
  if (!edits.length) return;
  const cloneStyle = (style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> =>
    JSON.parse(JSON.stringify(style));
  const rows: {
    index: number;
    height: number | undefined;
    hidden: boolean;
    outlineLevel: number;
    style: Partial<ExcelJS.Style>;
    cells: {
      col: number;
      value: ExcelJS.CellValue;
      style: Partial<ExcelJS.Style>;
      note?: ExcelJS.Comment | string;
    }[];
  }[] = [];
  target.eachRow({ includeEmpty: true }, (row, index) => {
    const cells: (typeof rows)[number]['cells'] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (cell.value === null && !cell.note && !Object.keys(cell.style).length) return;
      cells.push({
        col,
        value:
          cell.type === ExcelJS.ValueType.Formula
            ? { formula: cell.formula, result: cell.result }
            : cell.value,
        style: cloneStyle(cell.style),
        ...(cell.note ? { note: JSON.parse(JSON.stringify(cell.note)) } : {}),
      });
    });
    rows.push({
      index,
      height: row.height,
      hidden: row.hidden ?? false,
      outlineLevel: row.outlineLevel ?? 0,
      style: cloneStyle(row.model?.style ?? {}),
      cells,
    });
  });
  const columns = (target.columns ?? []).map((column, offset) => ({
    index: offset + 1,
    width: column.width,
    hidden: column.hidden ?? false,
    outlineLevel: column.outlineLevel ?? 0,
    style: cloneStyle(column.style ?? {}),
  }));
  // ExcelJS splices do not move every row attribute or note, and tail deletions can leave cells.
  // Restore the coordinate-mapped source snapshot after splicing, before applying model edits.
  for (const edit of edits) {
    const blanks = edit.type === 'insert' ? Array.from({ length: edit.count }, () => []) : [];
    const remove = edit.type === 'delete' ? edit.count : 0;
    if (edit.axis === 'row') target.spliceRows(edit.index, remove, ...blanks);
    else target.spliceColumns(edit.index, remove, ...blanks);
  }
  target.eachRow({ includeEmpty: true }, (row, number) => {
    row.model = { number, cells: [], hidden: false, outlineLevel: 0, style: {} };
  });
  for (const column of target.columns ?? []) {
    Reflect.deleteProperty(column, 'width');
    column.hidden = false;
    column.outlineLevel = 0;
    column.style = {};
  }
  for (const column of columns) {
    const index = transformSourceIndex(column.index, 'column', edits);
    if (index === undefined) continue;
    const restored = target.getColumn(index);
    restored.width = column.width;
    restored.hidden = column.hidden;
    restored.outlineLevel = column.outlineLevel;
    restored.style = column.style;
  }
  for (const row of rows) {
    const index = transformSourceIndex(row.index, 'row', edits);
    if (index === undefined) continue;
    const restored = target.getRow(index);
    // Assigning Row.model clears its cells, so restore the row before its cell snapshots.
    restored.model = {
      number: index,
      cells: [],
      ...(row.height !== undefined ? { height: row.height } : {}),
      hidden: row.hidden,
      outlineLevel: row.outlineLevel,
      style: row.style,
    };
    for (const cell of row.cells) {
      const col = transformSourceIndex(cell.col, 'column', edits);
      if (col === undefined) continue;
      const targetCell = restored.getCell(col);
      targetCell.value = cell.value;
      targetCell.style = cell.style;
      if (cell.note) targetCell.note = cell.note;
    }
  }
  for (const key of ['printArea', 'printTitlesRow', 'printTitlesColumn'] as const) {
    const input = target.pageSetup[key];
    if (!input) continue;
    const range = input
      .split('&&')
      .map((part) => transformSourceRange(part, edits)?.replace(/\$/g, ''))
      .filter(Boolean)
      .join('&&');
    if (range) target.pageSetup[key] = range;
    else delete target.pageSetup[key];
  }
}

export async function exportStudioExcel(
  document: StudioExcelDocument,
  source?: Blob
): Promise<Blob> {
  validateDocument(document);
  const loaded = source ? await loadWorkbook(source) : undefined;
  // Validate native metadata before a draft can replace it, using the already loaded workbook.
  if (loaded) {
    importedDocument(loaded.workbook, loaded.metadata, document.name);
    document = hydrateHyperlinksFromMetadata(document, loaded.metadata);
    validateDocument(document);
  }
  const workbook = loaded?.workbook ?? new ExcelJS.Workbook();
  if (!source) workbook.creator = 'ZUI Office Studio';
  const matched = new Map<string, ExcelJS.Worksheet>();
  for (const sheet of document.sheets) {
    const originalId = /^xlsx-sheet-(\d+)$/.exec(sheet.id);
    const existing =
      originalId && source ? workbook.getWorksheet(Number(originalId[1])) : undefined;
    if (source && originalId && !existing)
      throw new Error('草稿引用的原工作表不存在，请重新打开原文件。');
    if (existing) matched.set(sheet.id, existing);
  }
  // Temporary names allow host-controlled renames without intermediate collisions.
  for (const [id, sheet] of matched) sheet.name = `_zui_${id.replace(/[^\da-z]/gi, '').slice(-20)}`;
  const retainedIds = new Set([...matched.values()].map((sheet) => sheet.id));
  const pageBreaks = new Map(
    [...matched].map(([id, target]) => [id, loaded!.metadata.get(target.id)!.pageBreaks])
  );
  for (const sheet of [...workbook.worksheets])
    if (!retainedIds.has(sheet.id)) workbook.removeWorksheet(sheet.id);
  for (const sheet of document.sheets) {
    const target = matched.get(sheet.id) ?? workbook.addWorksheet(sheet.name);
    target.name = sheet.name;
    // ExcelJS aliases merged cells to the master. Unmerge before applying model changes.
    let originalMerges = [...(target.model.merges ?? [])];
    const mergedStyles = new Map<string, Partial<ExcelJS.Style>>();
    const edits = matched.has(sheet.id) ? (sheet.structureEdits ?? []) : [];
    const oldFilter =
      typeof target.autoFilter === 'string' ? studioParseRange(target.autoFilter) : undefined;
    const previouslyFilteredRows =
      oldFilter && oldFilter.lastRow > oldFilter.firstRow
        ? studioParseRange(
            transformSourceRange(
              `${studioColumnLabel(oldFilter.firstCol)}${oldFilter.firstRow + 1}:${studioColumnLabel(oldFilter.lastCol)}${oldFilter.lastRow}`,
              edits
            ) ?? ''
          )
        : undefined;
    for (const input of originalMerges) {
      const range = studioParseRange(input)!;
      for (let row = range.firstRow; row <= range.lastRow; row++)
        for (let col = range.firstCol; col <= range.lastCol; col++) {
          const address = `${studioColumnLabel(col)}${row}`;
          mergedStyles.set(address, JSON.parse(JSON.stringify(target.getCell(address).style)));
        }
      target.unMergeCells(input);
    }
    for (const [address, style] of mergedStyles) target.getCell(address).style = style;
    replaySourceStructure(target, edits);
    if (sheet.defaultRowHeight !== undefined)
      target.properties.defaultRowHeight = sheet.defaultRowHeight;
    else if (!matched.has(sheet.id))
      target.properties.defaultRowHeight = STUDIO_SHEET_LIMITS.defaultRowHeight;
    if (sheet.rowHeights !== undefined) {
      target.eachRow({ includeEmpty: true }, (row) => {
        row.height = sheet.rowHeights![String(row.number)];
      });
      for (const [index, height] of Object.entries(sheet.rowHeights))
        target.getRow(Number(index)).height = height;
    }
    if (sheet.hiddenRows !== undefined)
      target.eachRow({ includeEmpty: true }, (row) => {
        row.hidden = false;
      });
    if (edits.length) {
      originalMerges = originalMerges.flatMap((range) => {
        const transformed = transformSourceRange(range, edits);
        const parsed = transformed && studioParseRange(transformed);
        return parsed && (parsed.firstRow !== parsed.lastRow || parsed.firstCol !== parsed.lastCol)
          ? [studioRangeAddress(parsed)]
          : [];
      });
      const movedStyles: [string, Partial<ExcelJS.Style>][] = [];
      for (const [address, style] of mergedStyles) {
        const position = studioParseAddress(address)!;
        const row = transformSourceIndex(position.row, 'row', edits);
        const col = transformSourceIndex(position.col, 'column', edits);
        if (row !== undefined && col !== undefined)
          movedStyles.push([`${studioColumnLabel(col)}${row}`, style]);
      }
      mergedStyles.clear();
      for (const entry of movedStyles) mergedStyles.set(...entry);
    }
    for (const [address, cell] of Object.entries(sheet.cells))
      updateCell(target.getCell(address), cell);
    for (const [label, width] of Object.entries(sheet.columnWidths ?? {})) {
      const position = studioParseAddress(`${label}1`);
      if (
        !position ||
        position.col > STUDIO_SHEET_LIMITS.columns ||
        !Number.isFinite(width) ||
        width < 12 ||
        width > 4000
      )
        throw new Error('工作表含无效的列宽。');
      const column = target.getColumn(position.col);
      const original = column.width === undefined ? undefined : column.width * 7 + 5;
      if (original !== width) column.width = (width - 5) / 7;
    }
    for (const merge of sheet.merges ?? []) {
      const range = studioParseRange(merge)!;
      const master = `${studioColumnLabel(range.firstCol)}${range.firstRow}`;
      const unchanged =
        JSON.stringify(target.getCell(master).style) === JSON.stringify(mergedStyles.get(master));
      const editedBorders = new Map<string, Partial<ExcelJS.Borders>>();
      for (let row = range.firstRow; row <= range.lastRow; row++)
        for (let col = range.firstCol; col <= range.lastCol; col++) {
          const address = `${studioColumnLabel(col)}${row}`;
          if (sheet.cells[address]?.borders !== undefined)
            editedBorders.set(address, { ...target.getCell(address).border });
        }
      target.mergeCells(merge);
      if (originalMerges.includes(merge))
        for (let row = range.firstRow; row <= range.lastRow; row++)
          for (let col = range.firstCol; col <= range.lastCol; col++) {
            const address = `${studioColumnLabel(col)}${row}`;
            const previous = mergedStyles.get(address);
            if (editedBorders.has(address)) {
              target.getCell(address).style = {
                ...target.getCell(address).style,
                border: editedBorders.get(address),
              };
              continue;
            }
            if (!previous || address === master) continue;
            target.getCell(address).style = unchanged
              ? previous
              : { ...target.getCell(address).style, border: previous.border ?? {} };
          }
      if (!originalMerges.includes(merge))
        for (const [address, border] of editedBorders)
          target.getCell(address).style = { ...target.getCell(address).style, border };
    }
    if (sheet.freeze) {
      target.views =
        sheet.freeze.rows || sheet.freeze.columns
          ? [
              {
                state: 'frozen',
                xSplit: sheet.freeze.columns,
                ySplit: sheet.freeze.rows,
                topLeftCell: `${studioColumnLabel(sheet.freeze.columns + 1)}${sheet.freeze.rows + 1}`,
              },
            ]
          : [{ state: 'normal' }];
    } else if (edits.length && target.views?.some((view) => view.state === 'frozen'))
      target.views = target.views.map((view) => ({ ...view, state: 'normal' }));
    if (previouslyFilteredRows)
      for (let row = previouslyFilteredRows.firstRow; row <= previouslyFilteredRows.lastRow; row++)
        target.getRow(row).hidden = false;
    target.autoFilter = sheet.filter?.range;
  }
  const calculated = studioCalculate(document);
  for (const sheet of document.sheets) {
    const target = workbook.getWorksheet(sheet.name)!;
    for (const row of studioHiddenRows(sheet, calculated)) target.getRow(row).hidden = true;
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (!cell.input.startsWith('=')) continue;
      const key = `${sheet.id}:${address}`;
      const result = calculated.values.get(key);
      const error = calculated.errors.get(key);
      target.getCell(address).value = {
        formula: cell.input.slice(1),
        ...(error && excelErrors.includes(error as (typeof excelErrors)[number])
          ? { result: { error: error as ExcelJS.CellErrorValue['error'] } }
          : result !== undefined
            ? { result }
            : {}),
      };
    }
  }
  workbook.calcProperties.fullCalcOnLoad = true;
  const activeName = document.sheets.find((sheet) => sheet.id === document.activeSheetId)?.name;
  const activeTab = Math.max(
    0,
    workbook.worksheets.findIndex((sheet) => sheet.name === activeName)
  );
  workbook.views = workbook.views?.length
    ? workbook.views.map((view) => ({
        ...view,
        activeTab,
        firstSheet: Math.min(document.sheets.length - 1, Math.max(0, view.firstSheet ?? 0)),
      }))
    : [{ x: 0, y: 0, width: 1200, height: 800, visibility: 'visible', firstSheet: 0, activeTab }];
  const bytes = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(new Uint8Array(bytes));
  await writeAdvancedParts(zip, workbook, document, calculated, pageBreaks);
  return new Blob(
    [new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))],
    { type: XLSX_MIME }
  );
}

function filterXml(sheet: StudioSheet): string {
  if (!sheet.filter) return '';
  const range = studioParseRange(sheet.filter.range)!;
  const conditions = Object.entries(sheet.filter.columns)
    .map(([label, condition]) => {
      const id = studioParseAddress(`${label}1`)!.col - range.firstCol;
      const escaped = condition.value.replace(/[~*?]/g, '~$&');
      const operator =
        condition.operator === 'greater'
          ? 'greaterThan'
          : condition.operator === 'less'
            ? 'lessThan'
            : 'equal';
      const value = condition.operator === 'contains' ? `*${escaped}*` : escaped;
      const body =
        condition.operator === 'equals'
          ? `<filters><filter val="${escapeXml(condition.value)}"/></filters>`
          : `<customFilters><customFilter operator="${operator}" val="${escapeXml(value)}"/></customFilters>`;
      return `<filterColumn colId="${id}">${body}</filterColumn>`;
    })
    .join('');
  return `<autoFilter ref="${escapeXml(sheet.filter.range)}">${conditions}</autoFilter>`;
}

const CHART_COLOURS = [
  '287C70',
  '648FD1',
  'D4A14A',
  '8E6DC4',
  'C66F79',
  '6B9D54',
  '528EAC',
  'A5795C',
];

function chartXml(
  sheet: StudioSheet,
  chart: StudioSheetChart,
  calculation: ReturnType<typeof studioCalculate>
): string {
  const range = studioParseRange(chart.range)!;
  const data = studioChartData(sheet, chart, calculation, true);
  const prefix = `'${sheet.name.replace(/'/g, "''")}'!`;
  const absolute = (column: number, row: number) => `$${studioColumnLabel(column)}$${row}`;
  const categoryRef = `${prefix}${absolute(range.firstCol, range.firstRow + 1)}:${absolute(range.firstCol, range.lastRow)}`;
  const categoryCache = `<c:strCache><c:ptCount val="${data.categories.length}"/>${data.categories.map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXml(value)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const series = data.series
    .map((item, index) => {
      const col = range.firstCol + index + 1;
      const titleRef = `${prefix}${absolute(col, range.firstRow)}`;
      const valueRef = `${prefix}${absolute(col, range.firstRow + 1)}:${absolute(col, range.lastRow)}`;
      const values = `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${item.values.length}"/>${item.values.map((value, point) => (value === null ? '' : `<c:pt idx="${point}"><c:v>${value}</c:v></c:pt>`)).join('')}</c:numCache>`;
      return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:f>${escapeXml(titleRef)}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(item.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${CHART_COLOURS[index]}"/></a:solidFill><a:ln w="25400"><a:solidFill><a:srgbClr val="${CHART_COLOURS[index]}"/></a:solidFill></a:ln></c:spPr>${chart.type === 'line' ? '<c:marker><c:symbol val="none"/></c:marker>' : ''}<c:cat><c:strRef><c:f>${escapeXml(categoryRef)}</c:f>${categoryCache}</c:strRef></c:cat><c:val><c:numRef><c:f>${escapeXml(valueRef)}</c:f>${values}</c:numRef></c:val>${chart.type === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
    })
    .join('');
  const graph =
    chart.type === 'bar'
      ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="150"/><c:axId val="100001"/><c:axId val="100002"/></c:barChart>`
      : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="0"/><c:smooth val="0"/><c:axId val="100001"/><c:axId val="100002"/></c:lineChart>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:date1904 val="0"/><c:lang val="zh-CN"/><c:style val="2"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN"/><a:t>${escapeXml(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${graph}<c:catAx><c:axId val="100001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="100002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="100002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="100001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function pageBreakXml(
  name: 'rowBreaks' | 'colBreaks',
  entries: NativePageBreak[],
  edits: StudioSheetStructureEdit[]
): string {
  const axis = name === 'rowBreaks' ? 'row' : 'column';
  const spanLimit = axis === 'row' ? 16384 : 1048576;
  const transformed = entries.flatMap((entry) => {
    const id = entry.id ? transformSourceIndex(entry.id, axis, edits) : 0;
    if (id === undefined) return [];
    if (entry.min === 0 && entry.max === spanLimit - 1) return [{ ...entry, id }];
    const source =
      axis === 'row'
        ? `${studioColumnLabel(entry.min + 1)}:${studioColumnLabel(entry.max + 1)}`
        : `${entry.min + 1}:${entry.max + 1}`;
    const range = transformSourceRange(source, edits);
    if (!range) return [];
    const [start, end] = range.replace(/\$/g, '').split(':');
    const min = axis === 'row' ? studioParseAddress(`${start}1`)!.col - 1 : Number(start) - 1;
    const max = axis === 'row' ? studioParseAddress(`${end}1`)!.col - 1 : Number(end) - 1;
    return [{ ...entry, id, min, max }];
  });
  if (!transformed.length) return '';
  const manual = transformed.filter((entry) => entry.man === 1).length;
  return `<${name} count="${transformed.length}" manualBreakCount="${manual}">${transformed.map((entry) => `<brk id="${entry.id}" min="${entry.min}" max="${entry.max}" man="${entry.man}"${entry.pt !== undefined ? ` pt="${entry.pt}"` : ''}/>`).join('')}</${name}>`;
}

function nativeRuleFormula(value: string): string {
  return value.startsWith('=') ? value.slice(1) : value;
}

async function writeRuleStyles(zip: JSZip, document: StudioExcelDocument) {
  let source = await zip.file('xl/styles.xml')!.async('string');
  const xml = xmlDocument(source);
  const formats = first(xml, S, 'numFmts');
  const knownFormats = new Map(
    (formats ? Array.from(formats.children) : []).map((format) => [
      format.getAttribute('formatCode') ?? '',
      Number(format.getAttribute('numFmtId')),
    ])
  );
  let formatIndex = Array.from(xml.getElementsByTagName('*')).reduce(
    (maximum, element) =>
      element.hasAttribute('numFmtId')
        ? Math.max(maximum, Number(element.getAttribute('numFmtId')))
        : maximum,
    163
  );
  const newFormats: string[] = [];
  const differentials: string[] = [];
  const pooled = new Map<string, number>();
  const ids = new Map<StudioSheetConditionalFormat, number>();
  for (const sheet of document.sheets)
    for (const rule of sheet.conditionalFormats ?? []) {
      const style = rule.style;
      if (style === undefined) continue;
      const font =
        (style.bold === undefined ? '' : `<b val="${style.bold ? 1 : 0}"/>`) +
        (style.italic === undefined ? '' : `<i val="${style.italic ? 1 : 0}"/>`) +
        (style.underline === undefined ? '' : `<u val="${style.underline ? 'single' : 'none'}"/>`) +
        (style.color === undefined ? '' : `<color rgb="${argb(style.color)!}"/>`);
      let numberFormat = '';
      if (style.numberFormat !== undefined) {
        let id = knownFormats.get(style.numberFormat);
        if (id === undefined) {
          id = ++formatIndex;
          knownFormats.set(style.numberFormat, id);
          newFormats.push(
            `<numFmt numFmtId="${id}" formatCode="${escapeXml(style.numberFormat)}"/>`
          );
        }
        numberFormat = `<numFmt numFmtId="${id}" formatCode="${escapeXml(style.numberFormat)}"/>`;
      }
      const fill =
        style.background === undefined
          ? ''
          : `<fill><patternFill patternType="solid"><fgColor rgb="${argb(style.background)!}"/><bgColor indexed="64"/></patternFill></fill>`;
      const dxf = `<dxf>${font ? `<font>${font}</font>` : ''}${numberFormat}${fill}</dxf>`;
      let id = pooled.get(dxf);
      if (id === undefined) {
        id = differentials.length;
        pooled.set(dxf, id);
        differentials.push(dxf);
      }
      ids.set(rule, id);
    }
  if (newFormats.length) {
    const existing = formats ? Array.from(formats.children).length : 0;
    const extras = newFormats.join('');
    if (formats)
      source = source.replace(
        /<numFmts\b[^>]*(?:\/>|>([\s\S]*?)<\/numFmts>)/,
        (_match, body: string | undefined) =>
          `<numFmts count="${existing + newFormats.length}">${body ?? ''}${extras}</numFmts>`
      );
    else
      source = source.replace(
        /(?=<fonts\b)/,
        `<numFmts count="${newFormats.length}">${extras}</numFmts>`
      );
  }
  const dxfs = `<dxfs count="${differentials.length}">${differentials.join('')}</dxfs>`;
  if (/<dxfs\b/.test(source))
    source = source.replace(/<dxfs\b[^>]*(?:\/>|>[\s\S]*?<\/dxfs>)/, dxfs);
  else source = source.replace(/(?=<(?:tableStyles|colors|extLst)\b|<\/styleSheet>)/, dxfs);
  zip.file('xl/styles.xml', source);
  return ids;
}

function ruleAttribute(name: string, value: string | boolean | number | undefined): string {
  return value === undefined
    ? ''
    : ` ${name}="${escapeXml(typeof value === 'boolean' ? String(Number(value)) : String(value))}"`;
}

function conditionalFormatsXml(
  sheet: StudioSheet,
  styles: Map<StudioSheetConditionalFormat, number>
): string {
  return (sheet.conditionalFormats ?? [])
    .map((rule) => {
      let attributes =
        ruleAttribute('type', rule.type) +
        ruleAttribute('priority', rule.priority) +
        ruleAttribute('stopIfTrue', rule.stopIfTrue) +
        ruleAttribute('dxfId', styles.get(rule));
      let body = '';
      switch (rule.type) {
        case 'cellIs':
          attributes += ruleAttribute('operator', rule.operator);
          body = rule.formulae
            .map((formula) => `<formula>${escapeXml(nativeRuleFormula(formula))}</formula>`)
            .join('');
          break;
        case 'expression':
          body = `<formula>${escapeXml(nativeRuleFormula(rule.formula))}</formula>`;
          break;
        case 'containsText':
          attributes +=
            ruleAttribute('operator', 'containsText') + ruleAttribute('text', rule.text);
          body = `<formula>${escapeXml(containsTextFormula(rule.text, rule.range.split(':')[0]))}</formula>`;
          break;
        case 'top10':
          attributes +=
            ruleAttribute('rank', rule.rank) +
            ruleAttribute('percent', rule.percent) +
            ruleAttribute('bottom', rule.bottom);
          break;
        case 'aboveAverage':
          attributes += ruleAttribute('aboveAverage', rule.aboveAverage);
          break;
        case 'colorScale': {
          const points = rule.colors.map((_color, index) =>
            index === 0
              ? '<cfvo type="min"/>'
              : index === rule.colors.length - 1
                ? '<cfvo type="max"/>'
                : '<cfvo type="percentile" val="50"/>'
          );
          body = `<colorScale>${points.join('')}${rule.colors.map((color) => `<color rgb="${argb(color)!}"/>`).join('')}</colorScale>`;
          break;
        }
      }
      return `<conditionalFormatting sqref="${escapeXml(rule.range)}"><cfRule${attributes}${body ? `>${body}</cfRule>` : '/>'}</conditionalFormatting>`;
    })
    .join('');
}

function dataValidationsXml(sheet: StudioSheet): string {
  const rules = sheet.dataValidations ?? [];
  if (!rules.length) return '';
  const body = rules
    .map((rule) => {
      let attributes =
        ruleAttribute('type', rule.type) +
        ruleAttribute('sqref', rule.range) +
        ruleAttribute('allowBlank', rule.allowBlank) +
        ruleAttribute('showInputMessage', rule.showInputMessage) +
        ruleAttribute('promptTitle', rule.inputTitle) +
        ruleAttribute('prompt', rule.inputMessage) +
        ruleAttribute('showErrorMessage', rule.showErrorMessage) +
        ruleAttribute('errorStyle', rule.errorStyle) +
        ruleAttribute('errorTitle', rule.errorTitle) +
        ruleAttribute('error', rule.errorMessage);
      let firstFormula: string;
      let secondFormula: string | undefined;
      if (rule.type === 'list')
        firstFormula = rule.values ? `"${rule.values.join(',')}"` : nativeRuleFormula(rule.source!);
      else if (rule.type === 'custom') firstFormula = nativeRuleFormula(rule.formula);
      else {
        attributes += ruleAttribute('operator', rule.operator);
        firstFormula = nativeRuleFormula(rule.formula1);
        secondFormula = rule.formula2 === undefined ? undefined : nativeRuleFormula(rule.formula2);
      }
      return `<dataValidation${attributes}><formula1>${escapeXml(firstFormula)}</formula1>${secondFormula === undefined ? '' : `<formula2>${escapeXml(secondFormula)}</formula2>`}</dataValidation>`;
    })
    .join('');
  return `<dataValidations count="${rules.length}">${body}</dataValidations>`;
}

function hyperlinkParts(sheet: StudioSheet, worksheet: string, relationshipsXml: string) {
  const relationships = xmlDocument(relationshipsXml);
  const usedIds = new Set(
    Array.from(relationships.documentElement.children)
      .filter((node) => !(node.getAttribute('Type') ?? '').endsWith('/hyperlink'))
      .map((node) => node.getAttribute('Id') ?? '')
  );
  relationshipsXml = relationshipsXml.replace(
    /<Relationship\b[^>]*(?:\/>|>[\s\S]*?<\/Relationship>)/g,
    (node) => (/\bType\s*=\s*(["'])[^"']*\/hyperlink\1/.test(node) ? '' : node)
  );
  const additions: string[] = [];
  let nextId = 1;
  const links = (sheet.hyperlinks ?? []).map((link) => {
    let attributes = ruleAttribute('ref', link.ref);
    if (link.target !== undefined) {
      let id = `rIdZuiHyperlink${nextId++}`;
      while (usedIds.has(id)) id = `rIdZuiHyperlink${nextId++}`;
      usedIds.add(id);
      attributes += ruleAttribute('r:id', id);
      additions.push(
        `<Relationship Id="${id}" Type="${HYPERLINK_RELATIONSHIP}" Target="${escapeXml(link.target)}" TargetMode="External"/>`
      );
    }
    attributes +=
      ruleAttribute('location', link.location) +
      ruleAttribute('tooltip', link.tooltip) +
      ruleAttribute('display', link.display);
    return `<hyperlink${attributes}/>`;
  });
  worksheet = worksheet.replace(/<hyperlinks\b[^>]*(?:\/>|>[\s\S]*?<\/hyperlinks>)/g, '');
  if (links.length)
    worksheet = worksheet.replace(
      /(?=<(?:printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>)/,
      `<hyperlinks>${links.join('')}</hyperlinks>`
    );
  if (additions.length)
    relationshipsXml = relationshipsXml.replace(
      '</Relationships>',
      `${additions.join('')}</Relationships>`
    );
  return { worksheet, relationships: relationshipsXml };
}

async function writeAdvancedParts(
  zip: JSZip,
  workbook: ExcelJS.Workbook,
  document: StudioExcelDocument,
  calculation: ReturnType<typeof studioCalculate>,
  pageBreaks: Map<string, SheetMetadata['pageBreaks']>
) {
  const ruleStyles = await writeRuleStyles(zip, document);
  let contentTypes = await zip.file('[Content_Types].xml')!.async('string');
  contentTypes = contentTypes.replace(
    /<Override\b[^>]*\bPartName="\/xl\/(?:charts|drawings)\/[^"]+\.xml"[^>]*\/>/g,
    ''
  );
  for (const name of Object.keys(zip.files))
    if (
      /^xl\/charts\//.test(name) ||
      /^xl\/drawings\/(?:[^/]+\.xml|_rels\/[^/]+\.xml\.rels)$/.test(name)
    )
      zip.remove(name);
  const writtenWorkbook = xmlDocument(await zip.file('xl/workbook.xml')!.async('string'));
  const workbookRels = await relationships(zip, 'xl/workbook.xml');
  const sheetPaths = new Map(
    xmlElements(writtenWorkbook, S, 'sheet').map((entry) => [
      entry.getAttribute('name')!,
      workbookRels.get(entry.getAttributeNS(R, 'id') ?? '')!,
    ])
  );
  let chartIndex = 0;
  for (const sheet of document.sheets) {
    const path = sheetPaths.get(sheet.name);
    if (!path) throw new Error('导出工作表关系无效。');
    let worksheet = await zip.file(path)!.async('string');
    worksheet = worksheet.replace(/<drawing\b[^>]*\/>/g, '');
    worksheet = worksheet.replace(
      /<(?:conditionalFormatting|dataValidations)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:conditionalFormatting|dataValidations)>)/g,
      ''
    );
    // Rules already carry the current model coordinates; never replay structure logs here.
    const rules = conditionalFormatsXml(sheet, ruleStyles) + dataValidationsXml(sheet);
    if (rules)
      worksheet = worksheet.replace(
        /(?=<(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>)/,
        rules
      );
    // ExcelJS drops row/column print breaks on read; keep these native parts outside its model.
    const printing = pageBreaks.get(sheet.id);
    if (printing) {
      const breaks =
        pageBreakXml('rowBreaks', printing.rowBreaks, sheet.structureEdits ?? []) +
        pageBreakXml('colBreaks', printing.colBreaks, sheet.structureEdits ?? []);
      worksheet = worksheet.replace(
        /<(?:rowBreaks|colBreaks)\b[^>]*(?:\/>|>[\s\S]*?<\/(?:rowBreaks|colBreaks)>)/g,
        ''
      );
      if (breaks)
        worksheet = worksheet.replace(
          /(?=<(?:customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>)/,
          breaks
        );
    }
    const filters = filterXml(sheet);
    if (/<autoFilter\b/.test(worksheet))
      worksheet = worksheet.replace(/<autoFilter\b[^>]*(?:\/>|>[\s\S]*?<\/autoFilter>)/g, filters);
    else if (filters)
      worksheet = worksheet.replace(
        /(?=<(?:sortState|dataConsolidate|customSheetViews|mergeCells|phoneticPr|conditionalFormatting|dataValidations|hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|drawing|extLst)\b|<\/worksheet>)/,
        filters
      );
    const relPath = relationshipPart(path);
    let rels = zip.file(relPath)
      ? await zip.file(relPath)!.async('string')
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PR}"></Relationships>`;
    rels = rels.replace(/<Relationship\b[^>]*\bType="[^"]*\/drawing"[^>]*\/>/g, '');
    const linkedParts = hyperlinkParts(sheet, worksheet, rels);
    worksheet = linkedParts.worksheet;
    rels = linkedParts.relationships;
    if (sheet.charts?.length) {
      const drawingName = `zuiDrawing${workbook.getWorksheet(sheet.name)!.id}`;
      const drawingPath = `xl/drawings/${drawingName}.xml`;
      const anchors: string[] = [];
      const chartRels: string[] = [];
      for (let index = 0; index < sheet.charts.length; index++) {
        const chart = sheet.charts[index];
        const nativeIndex = ++chartIndex;
        const chartName = `zuiChart${nativeIndex}.xml`;
        const relation = `rIdChart${index + 1}`;
        zip.file(`xl/charts/${chartName}`, chartXml(sheet, chart, calculation));
        contentTypes = contentTypes.replace(
          '</Types>',
          `<Override PartName="/xl/charts/${chartName}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`
        );
        chartRels.push(
          `<Relationship Id="${relation}" Type="${R}/chart" Target="../charts/${chartName}"/>`
        );
        const row = Math.max(
          0,
          Math.min(10000, studioParseRange(chart.range)!.lastRow + 2 + index * 18)
        );
        anchors.push(
          `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + 16}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 1}" name="${escapeXml(chart.title || `图表 ${index + 1}`)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="${relation}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
        );
      }
      zip.file(
        drawingPath,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${A}">${anchors.join('')}</xdr:wsDr>`
      );
      zip.file(
        `xl/drawings/_rels/${drawingName}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${chartRels.join('')}</Relationships>`
      );
      contentTypes = contentTypes.replace(
        '</Types>',
        `<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
      );
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="rIdZuiDrawing" Type="${R}/drawing" Target="../drawings/${drawingName}.xml"/></Relationships>`
      );
      worksheet = worksheet.replace(
        /(?=<(?:legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>)/,
        '<drawing r:id="rIdZuiDrawing"/>'
      );
    }
    zip.file(path, worksheet);
    zip.file(relPath, rels);
  }
  zip.file('[Content_Types].xml', contentTypes);
}
