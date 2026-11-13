import type { SheetCalculation, SheetPosition } from './studio-sheet-model';
import type {
  StudioExcelDocument,
  StudioSheet,
  StudioSheetHyperlink,
  StudioSheetStructureEdit,
} from './studio-types';

interface LinkCell extends SheetPosition {
  absoluteRow: string;
  absoluteCol: string;
  lowercase: boolean;
}

interface LinkRange {
  firstRow: number;
  lastRow: number;
  firstCol: number;
  lastCol: number;
}

const LINK_LIMIT = 100000;
const TEXT_LIMIT = 32767;
interface LinkIndexEntry {
  link: StudioSheetHyperlink;
  order: number;
}
interface RangeIndexEntry extends LinkIndexEntry {
  range: LinkRange;
}
interface RangeIndexNode {
  bounds: LinkRange;
  firstOrder: number;
  entries?: RangeIndexEntry[];
  children?: [RangeIndexNode, RangeIndexNode];
}
interface HyperlinkIndex {
  length: number;
  cells: Map<string, LinkIndexEntry[]>;
  ranges?: RangeIndexNode;
  openable?: { signature: string; index: HyperlinkIndex };
}
const hyperlinkIndexes = new WeakMap<StudioSheetHyperlink[], HyperlinkIndex>();
const workbookSignatures = new WeakMap<StudioExcelDocument, string>();
const OPENABLE_INDEX_NEEDED = Symbol('openable hyperlink index');

function columnLabel(column: number) {
  let result = '';
  while (column > 0) {
    column--;
    result = String.fromCharCode(65 + (column % 26)) + result;
    column = Math.floor(column / 26);
  }
  return result;
}

function linkCell(value: string): LinkCell | undefined {
  const match = /^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)$/i.exec(value.trim());
  if (!match) return;
  const col = [...match[2].toUpperCase()].reduce(
    (sum, char) => sum * 26 + char.charCodeAt(0) - 64,
    0
  );
  const row = Number(match[4]);
  if (!Number.isSafeInteger(row) || row > 1048576 || col > 16384) return;
  return {
    row,
    col,
    absoluteRow: match[3],
    absoluteCol: match[1],
    lowercase: match[2] === match[2].toLowerCase(),
  };
}

function cellText(cell: LinkCell) {
  const label = columnLabel(cell.col);
  return `${cell.absoluteCol}${cell.lowercase ? label.toLowerCase() : label}${cell.absoluteRow}${cell.row}`;
}

function rangeParts(ref: string) {
  const parts = ref.trim().split(':');
  if (parts.length > 2) return;
  const first = linkCell(parts[0]);
  const last = linkCell(parts[1] ?? parts[0]);
  if (!first || !last) return;
  return { first, last, rectangle: parts.length === 2 };
}

function linkRange(ref: string): LinkRange | undefined {
  const parts = rangeParts(ref);
  if (!parts) return;
  return {
    firstRow: Math.min(parts.first.row, parts.last.row),
    lastRow: Math.max(parts.first.row, parts.last.row),
    firstCol: Math.min(parts.first.col, parts.last.col),
    lastCol: Math.max(parts.first.col, parts.last.col),
  };
}

function rangeText(range: LinkRange) {
  const first = `${columnLabel(range.firstCol)}${range.firstRow}`;
  const last = `${columnLabel(range.lastCol)}${range.lastRow}`;
  return first === last ? first : `${first}:${last}`;
}

function overlap(first: LinkRange, second: LinkRange): LinkRange | undefined {
  const result = {
    firstRow: Math.max(first.firstRow, second.firstRow),
    lastRow: Math.min(first.lastRow, second.lastRow),
    firstCol: Math.max(first.firstCol, second.firstCol),
    lastCol: Math.min(first.lastCol, second.lastCol),
  };
  return result.firstRow <= result.lastRow && result.firstCol <= result.lastCol
    ? result
    : undefined;
}

/** Metadata validation deliberately accepts opaque protocols and unresolved destinations. */
export function studioIsSheetHyperlink(value: unknown): value is StudioSheetHyperlink {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === 'string' &&
    link.id.length > 0 &&
    link.id.length <= 128 &&
    typeof link.ref === 'string' &&
    link.ref.length <= 64 &&
    !!linkRange(link.ref) &&
    ['target', 'location', 'tooltip', 'display'].every(
      (key) =>
        link[key] === undefined || (typeof link[key] === 'string' && link[key].length <= TEXT_LIMIT)
    )
  );
}

function contains(range: LinkRange, cell: SheetPosition) {
  return (
    cell.row >= range.firstRow &&
    cell.row <= range.lastRow &&
    cell.col >= range.firstCol &&
    cell.col <= range.lastCol
  );
}

function rangeIndex(entries: RangeIndexEntry[]): RangeIndexNode | undefined {
  if (!entries.length) return;
  const bounds = { firstRow: Infinity, lastRow: 0, firstCol: Infinity, lastCol: 0 };
  let firstOrder = Infinity;
  let rowMin = Infinity,
    rowMax = 0,
    colMin = Infinity,
    colMax = 0;
  for (const entry of entries) {
    bounds.firstRow = Math.min(bounds.firstRow, entry.range.firstRow);
    bounds.lastRow = Math.max(bounds.lastRow, entry.range.lastRow);
    bounds.firstCol = Math.min(bounds.firstCol, entry.range.firstCol);
    bounds.lastCol = Math.max(bounds.lastCol, entry.range.lastCol);
    firstOrder = Math.min(firstOrder, entry.order);
    const row = entry.range.firstRow + entry.range.lastRow;
    const col = entry.range.firstCol + entry.range.lastCol;
    rowMin = Math.min(rowMin, row);
    rowMax = Math.max(rowMax, row);
    colMin = Math.min(colMin, col);
    colMax = Math.max(colMax, col);
  }
  if (entries.length <= 8) return { bounds, firstOrder, entries };
  const rows = rowMax - rowMin >= colMax - colMin;
  entries.sort((a, b) => {
    const primary = rows
      ? a.range.firstRow + a.range.lastRow - b.range.firstRow - b.range.lastRow
      : a.range.firstCol + a.range.lastCol - b.range.firstCol - b.range.lastCol;
    return (
      primary ||
      a.range.firstRow - b.range.firstRow ||
      a.range.lastRow - b.range.lastRow ||
      a.range.firstCol - b.range.firstCol ||
      a.range.lastCol - b.range.lastCol ||
      a.order - b.order
    );
  });
  const middle = Math.floor(entries.length / 2);
  return {
    bounds,
    firstOrder,
    children: [rangeIndex(entries.slice(0, middle))!, rangeIndex(entries.slice(middle))!],
  };
}

function sheetIndex(sheet: StudioSheet): HyperlinkIndex | undefined {
  const links = sheet.hyperlinks;
  if (!links?.length) return;
  // Native lists are immutable model snapshots. Index points and rectangular
  // bounds once; opening a cell searches in source order without materializing
  // every overlapping record. Copying still returns every matching record.
  let index = hyperlinkIndexes.get(links);
  if (!index || index.length !== links.length) {
    index = { length: links.length, cells: new Map() };
    const ranges: RangeIndexEntry[] = [];
    links.forEach((link, order) => {
      const range = linkRange(link.ref);
      if (!range) return;
      if (range.firstRow === range.lastRow && range.firstCol === range.lastCol) {
        const key = rangeText(range);
        const entries = index!.cells.get(key) ?? [];
        entries.push({ link, order });
        index!.cells.set(key, entries);
      } else ranges.push({ link, range, order });
    });
    index.ranges = rangeIndex(ranges);
    hyperlinkIndexes.set(links, index);
  }
  return index;
}

function firstIndexedLink(
  index: HyperlinkIndex,
  cell: SheetPosition,
  accept: (link: StudioSheetHyperlink) => boolean
): StudioSheetHyperlink | undefined {
  let first = index.cells
    .get(`${columnLabel(cell.col)}${cell.row}`)
    ?.find((entry) => accept(entry.link));
  const visit = (node: RangeIndexNode | undefined) => {
    if (!node || !contains(node.bounds, cell) || node.firstOrder >= (first?.order ?? Infinity))
      return;
    if (node.entries) {
      for (const entry of node.entries)
        if (
          entry.order < (first?.order ?? Infinity) &&
          contains(entry.range, cell) &&
          accept(entry.link)
        )
          first = entry;
    } else if (node.children) {
      const [a, b] = node.children;
      visit(a.firstOrder < b.firstOrder ? a : b);
      visit(a.firstOrder < b.firstOrder ? b : a);
    }
  };
  visit(index.ranges);
  return first?.link;
}

function openableIndex(
  document: StudioExcelDocument,
  sheet: StudioSheet,
  source: HyperlinkIndex
): HyperlinkIndex {
  const result: HyperlinkIndex = { length: source.length, cells: new Map() };
  const accept = (entry: LinkIndexEntry) =>
    studioResolveSheetHyperlink(document, sheet.id, entry.link).kind !== 'blocked';
  for (const [address, entries] of source.cells) {
    const valid = entries.filter(accept);
    if (valid.length) result.cells.set(address, valid.length === entries.length ? entries : valid);
  }
  const filter = (node: RangeIndexNode | undefined): RangeIndexNode | undefined => {
    if (!node) return;
    if (node.entries) {
      const entries = node.entries.filter(accept);
      if (!entries.length) return;
      return entries.length === node.entries.length
        ? node
        : {
            bounds: node.bounds,
            firstOrder: Math.min(...entries.map((entry) => entry.order)),
            entries,
          };
    }
    const first = filter(node.children?.[0]);
    const second = filter(node.children?.[1]);
    if (!first) return second;
    if (!second) return first;
    if (first === node.children?.[0] && second === node.children[1]) return node;
    return {
      bounds: node.bounds,
      firstOrder: Math.min(first.firstOrder, second.firstOrder),
      children: [first, second],
    };
  };
  result.ranges = filter(source.ranges);
  return result;
}

function indexedCellHyperlink(
  document: StudioExcelDocument,
  sheet: StudioSheet,
  index: HyperlinkIndex,
  cell: SheetPosition
): StudioSheetHyperlink | undefined {
  let signature = workbookSignatures.get(document);
  if (signature === undefined) {
    signature = JSON.stringify(document.sheets.map(({ id, name }) => [id, name]));
    workbookSignatures.set(document, signature);
  }
  const ownerSignature = `${sheet.id}:${signature}`;
  if (index.openable?.signature === ownerSignature)
    return (
      firstIndexedLink(index.openable.index, cell, () => true) ??
      firstIndexedLink(index, cell, () => true)
    );
  let checked = 0;
  try {
    return (
      firstIndexedLink(index, cell, (link) => {
        if (++checked > 64) throw OPENABLE_INDEX_NEEDED;
        return studioResolveSheetHyperlink(document, sheet.id, link).kind !== 'blocked';
      }) ?? firstIndexedLink(index, cell, () => true)
    );
  } catch (error) {
    if (error !== OPENABLE_INDEX_NEEDED) throw error;
    // Dense overlapping broken links need a cached filtered tree as well as
    // spatial bounds. Its authority is presentation only: opening always calls
    // the resolver again. Names/IDs invalidate local destination eligibility.
    index.openable = { signature: ownerSignature, index: openableIndex(document, sheet, index) };
    return (
      firstIndexedLink(index.openable.index, cell, () => true) ??
      firstIndexedLink(index, cell, () => true)
    );
  }
}

export function studioSheetHyperlinkAt(
  sheet: StudioSheet,
  address: string
): StudioSheetHyperlink | undefined {
  const cell = linkCell(address);
  const index = cell && sheetIndex(sheet);
  return index && firstIndexedLink(index, cell, () => true);
}

export function studioSheetHyperlinksAt(
  sheet: StudioSheet,
  address: string
): StudioSheetHyperlink[] {
  const cell = linkCell(address);
  const index = cell && sheetIndex(sheet);
  if (!index) return [];
  const matches = [...(index.cells.get(`${columnLabel(cell.col)}${cell.row}`) ?? [])];
  const visit = (node: RangeIndexNode | undefined) => {
    if (!node || !contains(node.bounds, cell)) return;
    if (node.entries) {
      for (const entry of node.entries) if (contains(entry.range, cell)) matches.push(entry);
    } else if (node.children) {
      visit(node.children[0]);
      visit(node.children[1]);
    }
  };
  visit(index.ranges);
  return matches.sort((a, b) => a.order - b.order).map((entry) => entry.link);
}

export function studioCellHyperlink(
  document: StudioExcelDocument,
  sheetId: string,
  address: string,
  calculation?: SheetCalculation
): StudioSheetHyperlink | undefined {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) return;
  const cell = linkCell(address);
  if (!cell) return;
  const key = `${columnLabel(cell.col)}${cell.row}`;
  const index = sheetIndex(sheet);
  return (
    (index && indexedCellHyperlink(document, sheet, index, cell)) ??
    calculation?.hyperlinks.get(`${sheetId}:${key}`)
  );
}

function workbookLocation(value: string) {
  const text = value.trim().replace(/^#/, '');
  const match = /^(?:(?:'((?:[^']|'')+)'|([^'!]+))!\s*)?([^!]+)$/.exec(text);
  if (!match) return;
  const range = rangeParts(match[3]);
  if (!range) return;
  return {
    sheetName: match[1] !== undefined ? match[1].replace(/''/g, "'") : match[2]?.trim(),
    range: match[3],
    parts: range,
  };
}

export type StudioSheetHyperlinkResolution =
  | { kind: 'external'; href: string }
  | { kind: 'internal'; sheetId: string; ref: string; anchor: SheetPosition; focus: SheetPosition }
  | { kind: 'blocked'; reason: string };

function hasControlCharacters(value: string) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** Resolve immediately before opening; stored/imported text is never executable authority. */
export function studioResolveSheetHyperlink(
  document: StudioExcelDocument,
  sheetId: string,
  link: StudioSheetHyperlink
): StudioSheetHyperlinkResolution {
  if (!studioIsSheetHyperlink(link)) return { kind: 'blocked', reason: '超链接元数据无效。' };
  const target = link.target?.trim() ?? '';
  if (target && !target.startsWith('#')) {
    if (
      hasControlCharacters(link.target ?? '') ||
      !/^(?:https?:\/\/[^/\\?#\s]|mailto:)/i.test(target)
    )
      return { kind: 'blocked', reason: '此链接目标仅作为元数据保留，不能打开。' };
    try {
      const url = new URL(target);
      if (
        (['http:', 'https:'].includes(url.protocol) && !url.hostname) ||
        (url.protocol === 'mailto:' && !url.pathname)
      )
        return { kind: 'blocked', reason: '请填写完整的网页或邮件地址。' };
      if (!['http:', 'https:', 'mailto:'].includes(url.protocol))
        return { kind: 'blocked', reason: '此链接协议不能打开。' };
      if (link.location) url.hash = link.location.replace(/^#/, '');
      return { kind: 'external', href: url.href };
    } catch {
      return { kind: 'blocked', reason: '请填写完整的网页或邮件地址。' };
    }
  }
  const value = link.location || target;
  if (/^#REF!$/i.test(value.trim())) return { kind: 'blocked', reason: '链接目标已删除。' };
  const location = workbookLocation(value);
  if (!location) return { kind: 'blocked', reason: '无法解析此工作簿中的链接位置。' };
  const destination = location.sheetName
    ? document.sheets.find(
        (sheet) => sheet.name.toLocaleLowerCase() === location.sheetName!.toLocaleLowerCase()
      )
    : document.sheets.find((sheet) => sheet.id === sheetId);
  if (!destination) return { kind: 'blocked', reason: '链接指向的工作表不存在。' };
  const range = linkRange(location.range)!;
  if (range.lastRow > 10000 || range.lastCol > 256)
    return { kind: 'blocked', reason: '链接位置超出当前支持的 10,000 行、256 列范围。' };
  return {
    kind: 'internal',
    sheetId: destination.id,
    ref: rangeText(range),
    anchor: { row: range.firstRow, col: range.firstCol },
    focus: { row: range.lastRow, col: range.lastCol },
  };
}

function freshId(base: string, used: Set<string>) {
  let id = base.slice(0, 128);
  for (let index = 1; used.has(id); index++) {
    const suffix = `-${index}`;
    id = base.slice(0, 128 - suffix.length) + suffix;
  }
  used.add(id);
  return id;
}

function subtract(range: LinkRange, cut: LinkRange): LinkRange[] {
  const intersection = overlap(range, cut);
  if (!intersection) return [range];
  const result: LinkRange[] = [];
  if (range.firstRow < intersection.firstRow)
    result.push({ ...range, lastRow: intersection.firstRow - 1 });
  if (range.lastRow > intersection.lastRow)
    result.push({ ...range, firstRow: intersection.lastRow + 1 });
  if (range.firstCol < intersection.firstCol)
    result.push({ ...intersection, firstCol: range.firstCol, lastCol: intersection.firstCol - 1 });
  if (range.lastCol > intersection.lastCol)
    result.push({ ...intersection, firstCol: intersection.lastCol + 1, lastCol: range.lastCol });
  return result;
}

function removeRanges(sheet: StudioSheet, cuts: LinkRange[]): StudioSheet {
  if (!sheet.hyperlinks?.length || !cuts.length) return sheet;
  const used = new Set(sheet.hyperlinks.map((link) => link.id));
  const links: StudioSheetHyperlink[] = [];
  let changed = false;
  let work = 0;
  for (const link of sheet.hyperlinks) {
    const original = linkRange(link.ref)!;
    let remaining = [original];
    for (const cut of cuts) {
      if (!overlap(original, cut)) continue;
      if (++work > 1000000) throw new Error('超链接区域拆分过多，请缩小选区。');
      remaining = remaining.flatMap((range) => subtract(range, cut));
      if (!remaining.length) break;
    }
    if (remaining.length === 1 && rangeText(remaining[0]) === rangeText(original)) {
      links.push(link);
      continue;
    }
    changed = true;
    remaining.forEach((range, index) =>
      links.push({
        ...link,
        id: index === 0 ? link.id : freshId(`${link.id}-part`, used),
        ref: rangeText(range),
      })
    );
    if (links.length > LINK_LIMIT) throw new Error('超链接区域超过 100,000 条记录，请缩小选区。');
  }
  return changed ? { ...sheet, hyperlinks: links } : sheet;
}

function updateSheet(document: StudioExcelDocument, sheetId: string, sheet: StudioSheet) {
  if (document.sheets.find((item) => item.id === sheetId) === sheet) return document;
  if (
    document.sheets.reduce(
      (total, item) =>
        total +
        (item.id === sheetId ? (sheet.hyperlinks?.length ?? 0) : (item.hyperlinks?.length ?? 0)),
      0
    ) > LINK_LIMIT
  )
    throw new Error('每个工作簿最多支持 100,000 条超链接记录。');
  return {
    ...document,
    sheets: document.sheets.map((item) => (item.id === sheetId ? sheet : item)),
  };
}

export function studioSetSheetHyperlink(
  document: StudioExcelDocument,
  sheetId: string,
  link: StudioSheetHyperlink
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (sheet.hyperlinks === undefined) throw new Error('请先补齐源文件的超链接元数据，再编辑链接。');
  if (!studioIsSheetHyperlink(link)) throw new Error('超链接记录或单元格位置无效。');
  const range = linkRange(link.ref)!;
  const previous = sheet.hyperlinks.find((entry) => entry.id === link.id);
  const sameRef = !!previous && rangeText(linkRange(previous.ref)!) === rangeText(range);
  if (!sameRef && (range.lastRow > 10000 || range.lastCol > 256))
    throw new Error('超链接位置超出 10,000 行、256 列范围。');
  if (!previous || previous.target !== link.target || previous.location !== link.location) {
    const destination = studioResolveSheetHyperlink(document, sheetId, link);
    if (destination.kind === 'blocked') throw new Error(destination.reason);
  }
  if (sameRef)
    return updateSheet(document, sheetId, {
      ...sheet,
      hyperlinks: sheet.hyperlinks.map((entry) =>
        entry.id === link.id ? { ...link, ref: rangeText(range) } : entry
      ),
    });
  for (const merge of sheet.merges ?? []) {
    const merged = linkRange(merge)!;
    if (
      overlap(range, merged) &&
      !(
        range.firstRow <= merged.firstRow &&
        range.lastRow >= merged.firstRow &&
        range.firstCol <= merged.firstCol &&
        range.lastCol >= merged.firstCol
      )
    )
      throw new Error('合并单元格的链接需要包含左上角，请先拆分该区域。');
  }
  const others = { ...sheet, hyperlinks: sheet.hyperlinks.filter((entry) => entry.id !== link.id) };
  const next = removeRanges(others, [range]);
  return updateSheet(document, sheetId, {
    ...next,
    rowCount: Math.max(sheet.rowCount, range.lastRow),
    columnCount: Math.max(sheet.columnCount, range.lastCol),
    hyperlinks: [...next.hyperlinks!, { ...link, ref: rangeText(range) }],
  });
}

export function studioRemoveSheetHyperlink(
  document: StudioExcelDocument,
  sheetId: string,
  id: string
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  if (!sheet.hyperlinks?.some((link) => link.id === id)) return document;
  return updateSheet(document, sheetId, {
    ...sheet,
    hyperlinks: sheet.hyperlinks.filter((link) => link.id !== id),
  });
}

export function studioRemoveSheetHyperlinks(
  document: StudioExcelDocument,
  sheetId: string,
  ref: string
): StudioExcelDocument {
  const sheet = document.sheets.find((item) => item.id === sheetId);
  if (!sheet) throw new Error('工作表不存在。');
  const range = linkRange(ref);
  if (!range) throw new Error('超链接单元格位置无效。');
  return updateSheet(document, sheetId, removeRanges(sheet, [range]));
}

/** Clipboard fragments keep original destination strings, including unresolved metadata. */
export function studioCopySheetHyperlinks(sheet: StudioSheet, ref: string): StudioSheetHyperlink[] {
  const range = linkRange(ref);
  if (!range) throw new Error('复制区域无效。');
  return (sheet.hyperlinks ?? []).flatMap((link) => {
    const clipped = overlap(linkRange(link.ref)!, range);
    return clipped ? [{ ...link, ref: rangeText(clipped) }] : [];
  });
}

function cellCuts(addresses: string[]): LinkRange[] {
  const rows = new Map<number, number[]>();
  for (const address of addresses) {
    const cell = linkCell(address);
    if (!cell) throw new Error('超链接单元格位置无效。');
    const columns = rows.get(cell.row) ?? [];
    columns.push(cell.col);
    rows.set(cell.row, columns);
  }
  const result: LinkRange[] = [];
  const previous = new Map<string, LinkRange>();
  for (const [row, columns] of [...rows].sort(([a], [b]) => a - b)) {
    const sorted = [...new Set(columns)].sort((a, b) => a - b);
    for (let index = 0; index < sorted.length; index++) {
      const firstCol = sorted[index];
      while (sorted[index + 1] === sorted[index] + 1) index++;
      const lastCol = sorted[index];
      const key = `${firstCol}:${lastCol}`;
      const above = previous.get(key);
      if (above?.lastRow === row - 1) above.lastRow = row;
      else {
        const range = { firstRow: row, lastRow: row, firstCol, lastCol };
        result.push(range);
        previous.set(key, range);
      }
    }
  }
  return result;
}

/** Only explicitly assigned cells are replaced; ragged or untouched cells retain links. */
export function studioPatchSheetHyperlinks(
  sheet: StudioSheet,
  assignments: Record<string, StudioSheetHyperlink | StudioSheetHyperlink[] | null>,
  clearRefs: string[] = []
): StudioSheet {
  const entries = Object.entries(assignments);
  if (!entries.length && !clearRefs.length) return sheet;
  const copied = new Map<
    string,
    { link: StudioSheetHyperlink; addresses: string[]; after: Set<string>; before: number }
  >();
  let coverage = 0;
  for (const [address, value] of entries) {
    let previous: string | undefined;
    for (const link of Array.isArray(value) ? value : value ? [value] : []) {
      if (++coverage > 500000) throw new Error('复制或填充的超链接范围组合过多，请缩小选区。');
      if (!studioIsSheetHyperlink(link)) throw new Error('复制的超链接元数据无效。');
      const group = copied.get(link.id) ?? {
        link,
        addresses: [],
        after: new Set<string>(),
        before: 0,
      };
      if (
        ['target', 'location', 'tooltip', 'display'].some(
          (key) =>
            group.link[key as keyof StudioSheetHyperlink] !==
            link[key as keyof StudioSheetHyperlink]
        )
      )
        throw new Error('复制来源包含同一编号的不同超链接，请重新复制。');
      group.addresses.push(address);
      copied.set(link.id, group);
      if (previous && previous !== link.id && !copied.get(previous)!.after.has(link.id)) {
        copied.get(previous)!.after.add(link.id);
        group.before++;
      }
      previous = link.id;
    }
  }
  // Row traversal can encounter a later range before an earlier overlapping
  // range. Preserve each source cell's relative order when grouping copies.
  const ordered = [...copied.values()].filter((group) => group.before === 0);
  for (let index = 0; index < ordered.length; index++)
    for (const id of ordered[index].after) {
      const group = copied.get(id)!;
      if (--group.before === 0) ordered.push(group);
    }
  if (ordered.length !== copied.size) throw new Error('复制来源的超链接顺序不一致，请重新复制。');
  if (sheet.hyperlinks === undefined && copied.size)
    throw new Error('请先补齐源文件的超链接元数据，再粘贴或填充链接。');
  const cuts = clearRefs.map((ref) => {
    const range = linkRange(ref);
    if (!range) throw new Error('超链接单元格位置无效。');
    return range;
  });
  const next = removeRanges(sheet, [...cuts, ...cellCuts(entries.map(([address]) => address))]);
  const used = new Set(next.hyperlinks?.map((link) => link.id));
  const links = [...(next.hyperlinks ?? [])];
  for (const { addresses, link } of ordered) {
    for (const range of cellCuts(addresses)) {
      links.push({ ...link, id: freshId(link.id, used), ref: rangeText(range) });
      if (links.length > LINK_LIMIT) throw new Error('超链接区域超过 100,000 条记录，请缩小选区。');
    }
  }
  return copied.size ? { ...next, hyperlinks: links } : next;
}

function transformRange(ref: string, edit: StudioSheetStructureEdit): string | undefined {
  const parsed = rangeParts(ref);
  if (!parsed) return ref;
  const { first, last, rectangle } = parsed;
  const axis = edit.axis === 'row' ? 'row' : 'col';
  const lower = Math.min(first[axis], last[axis]);
  const upper = Math.max(first[axis], last[axis]);
  let start: number;
  let end: number;
  if (edit.type === 'insert') {
    start = lower >= edit.index ? lower + edit.count : lower;
    end = upper >= edit.index ? upper + edit.count : upper;
  } else {
    const deletedEnd = edit.index + edit.count - 1;
    if (lower >= edit.index && upper <= deletedEnd) return;
    start = lower < edit.index ? lower : Math.max(lower, deletedEnd + 1) - edit.count;
    end = upper > deletedEnd ? upper - edit.count : Math.min(upper, edit.index - 1);
  }
  if (end > (axis === 'row' ? 1048576 : 16384)) throw new Error('超链接位置超出 Excel 引用范围。');
  const movedFirst = { ...first, [axis]: first[axis] <= last[axis] ? start : end };
  const movedLast = { ...last, [axis]: first[axis] <= last[axis] ? end : start };
  return rectangle ? `${cellText(movedFirst)}:${cellText(movedLast)}` : cellText(movedFirst);
}

function mapLocalTargets(sheet: StudioSheet, map: (value: string) => string): StudioSheet {
  if (sheet.hyperlinks === undefined) return sheet;
  let changed = false;
  const hyperlinks = sheet.hyperlinks.map((link) => {
    if (link.target?.trim() && !link.target.trim().startsWith('#')) return link;
    const target = link.target ? map(link.target) : link.target;
    const location = link.location ? map(link.location) : link.location;
    if (target === link.target && location === link.location) return link;
    changed = true;
    return {
      ...link,
      ...(target !== undefined ? { target } : {}),
      ...(location !== undefined ? { location } : {}),
    };
  });
  return changed ? { ...sheet, hyperlinks } : sheet;
}

export function studioTransformSheetHyperlinks(
  sheet: StudioSheet,
  affectedSheet: StudioSheet,
  edit: StudioSheetStructureEdit
): StudioSheet {
  const originalName = sheet.name;
  let next = sheet;
  if (sheet.id === affectedSheet.id && sheet.hyperlinks !== undefined) {
    let changed = false;
    const hyperlinks = sheet.hyperlinks.flatMap((link) => {
      const ref = transformRange(link.ref, edit);
      if (ref === undefined) {
        changed = true;
        return [];
      }
      if (ref === link.ref) return [link];
      changed = true;
      return [{ ...link, ref }];
    });
    if (changed) next = { ...sheet, hyperlinks };
  }
  return mapLocalTargets(next, (value) => {
    const parsed = workbookLocation(value);
    if (
      !parsed ||
      (parsed.sheetName ?? originalName).toLocaleLowerCase() !==
        affectedSheet.name.toLocaleLowerCase()
    )
      return value;
    const range = transformRange(parsed.range, edit);
    if (!range) return '#REF!';
    if (range === parsed.range) return value;
    return value.slice(0, value.lastIndexOf(parsed.range)) + range;
  });
}

export function studioRenameSheetHyperlinks(
  sheet: StudioSheet,
  oldName: string,
  newName: string
): StudioSheet {
  return mapLocalTargets(sheet, (value) => {
    const parsed = workbookLocation(value);
    if (!parsed?.sheetName || parsed.sheetName.toLocaleLowerCase() !== oldName.toLocaleLowerCase())
      return value;
    return `${value.trim().startsWith('#') ? '#' : ''}'${newName.replace(/'/g, "''")}'!${parsed.range}`;
  });
}

export function studioDeleteSheetHyperlinks(
  sheet: StudioSheet,
  removedSheet: StudioSheet
): StudioSheet {
  return mapLocalTargets(sheet, (value) => {
    const parsed = workbookLocation(value);
    return parsed?.sheetName?.toLocaleLowerCase() === removedSheet.name.toLocaleLowerCase()
      ? '#REF!'
      : value;
  });
}
