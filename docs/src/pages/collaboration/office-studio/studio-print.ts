import {
  isOfficeStudioDocument,
  type OfficeStudioDocument,
  type StudioExcelDocument,
  type StudioRichNode,
  type StudioSheetChart,
  type StudioWordDocument,
} from '@zui/react';
import {
  studioCalculate,
  studioCellAddress,
  studioColumnLabel,
  studioChartData,
  studioDisplayCell,
  studioHiddenRows,
  studioMergedRange,
  studioParseAddress,
  studioParseRange,
  type SheetCalculation,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-model';
import { studioConditionalCellStyle } from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-rules';
import {
  studioBorderCss,
  studioBorderSides,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-cell-style';
import {
  studioCellHyperlink,
  studioResolveSheetHyperlink,
} from '../../../../../packages/ui/src/components/OfficeStudio/studio-sheet-hyperlinks';
import type { StudioSheet } from '../../../../../packages/ui/src/components/OfficeStudio/studio-types';
import { exportStudioFile } from './studio-files';

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );
const color = (value: unknown) =>
  typeof value === 'string' && /^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value) ? value : '';
const amount = (value: unknown, unit: string, min = -500, max = 1000) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? `${value}${unit}`
    : '';
const alignment = (value: unknown) =>
  ['left', 'center', 'right', 'justify'].includes(String(value)) ? String(value) : '';
// A font is one name, including punctuation and XML whitespace, rather than a CSS list.
const fontFamily = (value: string) =>
  `"${value.replace(/["\\\t\n\r]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`;

function rich(node: StudioRichNode, page: number, total: number): string {
  let text =
    node.type === 'text'
      ? escape(node.text)
      : (node.content ?? []).map((child) => rich(child, page, total)).join('');
  for (const mark of node.marks ?? []) {
    const tag = (
      {
        bold: 'strong',
        italic: 'em',
        underline: 'u',
        strike: 's',
        superscript: 'sup',
        subscript: 'sub',
      } as Record<string, string>
    )[mark.type];
    if (tag) text = `<${tag}>${text}</${tag}>`;
    else if (mark.type === 'textStyle') {
      const attrs = mark.attrs ?? {};
      const styles: string[] = [];
      if (color(attrs.color)) styles.push(`color:${color(attrs.color)}`);
      if (color(attrs.backgroundColor))
        styles.push(`background-color:${color(attrs.backgroundColor)}`);
      if (
        typeof attrs.fontFamily === 'string' &&
        attrs.fontFamily.length <= 255 &&
        !/[^\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(attrs.fontFamily)
      )
        styles.push(`font-family:${escape(fontFamily(attrs.fontFamily))}`);
      if (
        typeof attrs.fontSize === 'string' &&
        /^\d+(?:\.\d+)?(?:px|pt)$/.test(attrs.fontSize) &&
        parseFloat(attrs.fontSize) <= 480
      )
        styles.push(`font-size:${attrs.fontSize}`);
      if (styles.length) text = `<span style="${styles.join(';')}">${text}</span>`;
    } else if (mark.type === 'link') {
      const href = mark.attrs?.href;
      if (typeof href === 'string' && /^(?:https?:\/\/|mailto:)/i.test(href))
        text = `<a href="${escape(href)}">${text}</a>`;
    }
  }
  const attrs = node.attrs ?? {};
  const styles: string[] = [];
  if (alignment(attrs.textAlign)) styles.push(`text-align:${alignment(attrs.textAlign)}`);
  for (const [attribute, property] of [
    ['spaceBefore', 'margin-top'],
    ['spaceAfter', 'margin-bottom'],
    ['indentLeft', 'margin-left'],
    ['indentRight', 'margin-right'],
    ['indentFirstLine', 'text-indent'],
  ])
    if (amount(attrs[attribute], 'pt'))
      styles.push(`${property}:${amount(attrs[attribute], 'pt')}`);
  if (amount(attrs.lineHeight, '', 0.5, 10)) styles.push(`line-height:${attrs.lineHeight}`);
  if (color(attrs.backgroundColor)) styles.push(`background-color:${color(attrs.backgroundColor)}`);
  const style = styles.length ? ` style="${styles.join(';')}"` : '';
  if (node.type === 'image') {
    const source =
      typeof attrs.src === 'string' &&
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(attrs.src)
        ? attrs.src
        : '';
    if (!source) throw new Error('打印仅支持已嵌入文档的 PNG/JPEG 图片。');
    return `<img src="${escape(source)}" alt="${escape(attrs.alt)}"${amount(attrs.width, '', 1, 10000) ? ` width="${attrs.width}"` : ''}${amount(attrs.height, '', 1, 10000) ? ` height="${attrs.height}"` : ''}>`;
  }
  if (node.type === 'pageNumber') return String(attrs.kind === 'total' ? total : page);
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'horizontalRule') return '<hr>';
  if (node.type === 'pageBreak') return '<div class="studio-print-break"></div>';
  const tag =
    node.type === 'heading'
      ? `h${Number.isInteger(attrs.level) && Number(attrs.level) >= 1 && Number(attrs.level) <= 6 ? attrs.level : 2}`
      : (
          {
            paragraph: 'p',
            bulletList: 'ul',
            orderedList: 'ol',
            listItem: 'li',
            blockquote: 'blockquote',
            table: 'table',
            tableRow: 'tr',
            tableCell: 'td',
            tableHeader: 'th',
          } as Record<string, string>
        )[node.type];
  if (!tag) return text;
  const spans =
    tag === 'td' || tag === 'th'
      ? ['colspan', 'rowspan']
          .map((key) =>
            Number.isInteger(attrs[key]) && Number(attrs[key]) > 1 && Number(attrs[key]) <= 10000
              ? ` ${key}="${attrs[key]}"`
              : ''
          )
          .join('')
      : '';
  const start =
    tag === 'ol' && Number.isInteger(attrs.start) && Number(attrs.start) > 0
      ? ` start="${attrs.start}"`
      : '';
  return `<${tag}${style}${spans}${start}>${text || (tag === 'p' ? '<br>' : '')}</${tag}>`;
}

function wordPages(document: StudioWordDocument) {
  const pages: StudioRichNode[][] = [[]];
  for (const node of document.content.content ?? []) {
    if (node.type === 'pageBreak') pages.push([]);
    else pages.at(-1)!.push(node);
  }
  return pages
    .map((nodes, index) => {
      const total = pages.length;
      const render = (node?: StudioRichNode) => (node ? rich(node, index + 1, total) : '');
      const footer = render(document.footer);
      const containsPage = (node?: StudioRichNode): boolean =>
        !!node && (node.type === 'pageNumber' || (node.content ?? []).some(containsPage));
      return `<section class="studio-print-page"><header>${render(document.header)}</header><article>${nodes.map(render).join('')}</article><footer>${footer}${document.pageNumbers && !containsPage(document.footer) ? `<p class="studio-print-number">${index + 1}</p>` : ''}</footer></section>`;
    })
    .join('');
}

function sheetChart(sheet: StudioSheet, chart: StudioSheetChart, calculation: SheetCalculation) {
  const data = studioChartData(sheet, chart, calculation);
  const values = data.series.flatMap((series) =>
    series.values.filter((value): value is number => value !== null)
  );
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const y = (value: number) => 210 - ((value - min) / (max - min)) * 170;
  const step = 550 / Math.max(1, data.categories.length);
  const palette = [
    '#34765a',
    '#447cb3',
    '#d6a142',
    '#955c91',
    '#cc7863',
    '#52a6a2',
    '#777f48',
    '#74818f',
  ];
  const seriesSvg = data.series
    .map((series, seriesIndex) => {
      const ink = palette[seriesIndex % palette.length];
      if (chart.type === 'bar')
        return series.values
          .map((value, index) => {
            if (value === null) return '';
            const width = Math.max(0.5, (step * 0.8) / Math.max(1, data.series.length));
            return `<rect x="${45 + step * index + step * 0.1 + seriesIndex * width}" y="${Math.min(y(value), y(0))}" width="${width}" height="${Math.max(0.5, Math.abs(y(value) - y(0)))}" fill="${ink}"/>`;
          })
          .join('');
      const segments: string[] = [];
      let points: string[] = [];
      const flush = () => {
        if (points.length)
          segments.push(
            `<polyline points="${points.join(' ')}" fill="none" stroke="${ink}" stroke-width="2"/>`
          );
        points = [];
      };
      series.values.forEach((value, index) => {
        if (value === null) flush();
        else points.push(`${45 + step * (index + 0.5)},${y(value)}`);
      });
      flush();
      return segments.join('');
    })
    .join('');
  const labels = data.categories
    .map((category, index) =>
      index % Math.max(1, Math.ceil(data.categories.length / 12)) === 0
        ? `<text x="${45 + step * (index + 0.5)}" y="233" text-anchor="middle" font-size="10">${escape(category.slice(0, 12))}</text>`
        : ''
    )
    .join('');
  return `<figure class="studio-print-chart"><figcaption>${escape(chart.title)}</figcaption><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 255" role="img" aria-label="${escape(chart.title)}"><line x1="45" x2="595" y1="${y(0)}" y2="${y(0)}" stroke="#aeb6b0"/>${seriesSvg}${labels}</svg><p>${data.series.map((series, index) => `<span style="color:${palette[index % palette.length]}">● ${escape(series.name)}</span>`).join('　')}</p></figure>`;
}

function sheetTable(
  document: StudioExcelDocument,
  sheet: StudioSheet,
  calculation: SheetCalculation
) {
  let rows = 1;
  let columns = 1;
  for (const [address, cell] of Object.entries(sheet.cells)) {
    if (!cell.input && !cell.background && !Object.keys(cell.borders ?? {}).length) continue;
    const position = studioParseAddress(address)!;
    rows = Math.max(rows, position.row);
    columns = Math.max(columns, position.col);
  }
  for (const merge of sheet.merges ?? []) {
    const range = studioParseRange(merge)!;
    rows = Math.max(rows, range.lastRow);
    columns = Math.max(columns, range.lastCol);
  }
  for (const rule of sheet.conditionalFormats ?? []) {
    const range = studioParseRange(rule.range)!;
    rows = Math.max(rows, range.lastRow);
    columns = Math.max(columns, range.lastCol);
  }
  for (const link of sheet.hyperlinks ?? []) {
    const range = studioParseRange(link.ref)!;
    rows = Math.max(rows, range.lastRow);
    columns = Math.max(columns, range.lastCol);
  }
  if (rows * columns > 50000)
    throw new Error(`“${sheet.name}”的打印区域过大，请导出 XLSX 并在 Excel 中设置打印区域。`);
  const hidden = studioHiddenRows(sheet, calculation);
  const body: string[] = [];
  for (let row = 1; row <= rows; row++) {
    if (hidden.has(row)) continue;
    const rowPoints = sheet.rowHeights?.[String(row)] ?? sheet.defaultRowHeight ?? 18;
    const cells: string[] = [];
    for (let col = 1; col <= columns; col++) {
      const merge = studioMergedRange(sheet, { row, col });
      const mergeRows = merge
        ? Array.from(
            { length: merge.lastRow - merge.firstRow + 1 },
            (_, offset) => merge.firstRow + offset
          ).filter((index) => !hidden.has(index))
        : [row];
      if (merge && (mergeRows[0] !== row || merge.firstCol !== col)) continue;
      const address = studioCellAddress(merge?.firstRow ?? row, col);
      const points = mergeRows.reduce(
        (total, index) =>
          total + (sheet.rowHeights?.[String(index)] ?? sheet.defaultRowHeight ?? 18),
        0
      );
      const cell = {
        ...(sheet.cells[address] ?? { input: '' }),
        ...studioConditionalCellStyle(sheet, address, calculation),
      };
      const styles: string[] = [];
      if (cell.fontFamily) styles.push(`font-family:${fontFamily(cell.fontFamily)}`);
      if (amount(cell.fontSize, 'pt', 1, 409))
        styles.push(`font-size:${amount(cell.fontSize, 'pt', 1, 409)}`);
      if (cell?.bold) styles.push('font-weight:700');
      if (cell?.italic) styles.push('font-style:italic');
      if (cell?.underline) styles.push('text-decoration:underline');
      if (color(cell?.color)) styles.push(`color:${color(cell?.color)}`);
      if (color(cell?.background)) styles.push(`background-color:${color(cell?.background)}`);
      if (alignment(cell?.align)) styles.push(`text-align:${cell?.align}`);
      styles.push(
        `vertical-align:${cell.verticalAlign === 'middle' ? 'middle' : cell.verticalAlign === 'top' ? 'top' : 'bottom'}`
      );
      const borders = merge
        ? {
            ...cell.borders,
            right:
              sheet.cells[studioCellAddress(merge.firstRow, merge.lastCol)]?.borders?.right ??
              cell.borders?.right,
            bottom:
              sheet.cells[studioCellAddress(merge.lastRow, merge.firstCol)]?.borders?.bottom ??
              cell.borders?.bottom,
          }
        : cell.borders;
      for (const side of studioBorderSides) {
        const border = borders?.[side];
        if (border) styles.push(`border-${side}:${studioBorderCss(border, '#000000')}`);
      }
      if (cell?.wrap) styles.push('white-space:pre-wrap');
      const spans = merge
        ? ` colspan="${merge.lastCol - col + 1}" rowspan="${Array.from({ length: merge.lastRow - row + 1 }, (_, offset) => row + offset).filter((index) => !hidden.has(index)).length}"`
        : '';
      const link = studioCellHyperlink(document, sheet.id, address, calculation);
      const displayed = studioDisplayCell(
        cell,
        calculation.values.get(`${sheet.id}:${address}`),
        calculation.errors.get(`${sheet.id}:${address}`)
      );
      // A native label can fill a blank cell without replacing a number, formula or text value.
      const text = escape(
        !cell.input && link ? link.display || link.target || link.location || displayed : displayed
      );
      const tooltip = link?.tooltip ? ` title="${escape(link.tooltip)}"` : '';
      const target = link ? studioResolveSheetHyperlink(document, sheet.id, link) : undefined;
      const content =
        target?.kind === 'external'
          ? `<a href="${escape(target.href)}" target="_blank" rel="noopener noreferrer"${tooltip}>${text}</a>`
          : tooltip
            ? `<span${tooltip}>${text}</span>`
            : text;
      cells.push(
        `<td${spans} style="${escape(styles.join(';'))}"><div class="studio-print-cell" style="max-height:${Math.max(0, (points * 4) / 3 - 4)}px">${content}</div></td>`
      );
    }
    body.push(`<tr style="height:${rowPoints}pt">${cells.join('')}</tr>`);
  }
  const cols = Array.from(
    { length: columns },
    (_, index) =>
      `<col style="width:${sheet.columnWidths?.[studioColumnLabel(index + 1)] ?? 112}px">`
  ).join('');
  return `<section class="studio-print-sheet"><h1>${escape(sheet.name)}</h1><table><colgroup>${cols}</colgroup>${body.join('')}</table>${(sheet.charts ?? []).map((chart) => sheetChart(sheet, chart, calculation)).join('')}</section>`;
}

/** Pure and escaped document HTML; no toolbar, scripts, remote images or arbitrary styles. */
export function createStudioPrintHtml(document: OfficeStudioDocument): string {
  if (!isOfficeStudioDocument(document)) throw new Error('文档模型无效，无法打印。');
  if (document.kind === 'pdf') throw new Error('PDF 使用原生 PDF 打印预览。');
  const paper =
    document.kind === 'word'
      ? `${document.page.size} ${document.page.orientation}`
      : 'A4 landscape';
  const margin = document.kind === 'word' ? document.page.margin : 12;
  const calculation = document.kind === 'excel' ? studioCalculate(document) : undefined;
  const content =
    document.kind === 'word'
      ? wordPages(document)
      : document.sheets.map((sheet) => sheetTable(document, sheet, calculation!)).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'"><title>${escape(document.name)}</title><style>
@page{size:${paper};margin:${margin}mm}*{box-sizing:border-box}body{margin:0;color:#253044;background:white;font:12pt/1.6 "Microsoft YaHei","Noto Sans SC",Arial,sans-serif}h1,h2,h3,h4,h5,h6{line-height:1.3;break-after:avoid}h1{font-size:25pt}h2{font-size:19pt}p{margin:0 0 8pt}table{border-collapse:collapse;width:100%;font-size:10pt;table-layout:fixed}td,th{border:1px solid #b8c2bc;padding:5pt;overflow-wrap:anywhere;vertical-align:top}th{background:#edf3ee;text-align:left}tr{break-inside:avoid}img{max-width:100%;height:auto;vertical-align:middle}blockquote{margin:10pt 0;padding-left:12pt;border-left:3px solid #90a59a}a{color:inherit}header,footer{font-size:9pt;color:#5a6c61}header{margin-bottom:12pt}footer{margin-top:14pt}.studio-print-page,.studio-print-sheet{break-after:page}.studio-print-page:last-child,.studio-print-sheet:last-child{break-after:auto}.studio-print-break{break-before:page}.studio-print-number{text-align:center}.studio-print-chart{margin:18pt 0;break-inside:avoid}.studio-print-chart svg{width:100%;max-height:240pt}.studio-print-chart figcaption{font-weight:700}.studio-print-chart p{font-size:9pt}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
${document.kind === 'excel' ? '.studio-print-sheet table{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.15}.studio-print-sheet td{padding:2px 5px;vertical-align:middle}.studio-print-cell{overflow:hidden}' : ''}
</style></head><body>${content}</body></html>`;
}

/** Launch the browser's document print dialog; the user chooses printer or Save as PDF. */
export async function printStudioFile(
  document: OfficeStudioDocument,
  source?: Blob
): Promise<void> {
  const html = document.kind === 'pdf' ? undefined : createStudioPrintHtml(document);
  const pdf = document.kind === 'pdf' ? await exportStudioFile(document, source) : undefined;
  const frame = globalThis.document.createElement('iframe');
  frame.title = `${document.name} 打印预览`;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;inset:0;width:0;height:0;border:0;';
  const url = pdf ? URL.createObjectURL(pdf) : undefined;
  let cleaned = false;
  let loadingHandled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (timer) clearTimeout(timer);
    frame.remove();
    if (url) URL.revokeObjectURL(url);
  };
  await new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('打印预览加载超时，请导出文件后打印。'));
    }, 15000);
    frame.onerror = () => {
      cleanup();
      reject(new Error('打印预览无法加载，请导出文件后打印。'));
    };
    frame.onload = () => {
      if (loadingHandled || cleaned) return;
      loadingHandled = true;
      void (async () => {
        const view = frame.contentWindow;
        if (!view) throw new Error('浏览器没有可用的打印窗口。');
        if (html) {
          await view.document.fonts?.ready;
          await Promise.all(
            Array.from(view.document.images).map((image) =>
              image.complete
                ? Promise.resolve()
                : new Promise<void>((done) => {
                    image.onload = () => done();
                    image.onerror = () => done();
                  })
            )
          );
        }
        if (cleaned) return;
        view.addEventListener('afterprint', cleanup, { once: true });
        if (timer) clearTimeout(timer);
        timer = setTimeout(cleanup, 60000);
        view.focus();
        view.print();
        resolve();
      })().catch((error) => {
        cleanup();
        reject(
          error instanceof Error ? error : new Error('浏览器无法启动打印，请导出文件后打印。')
        );
      });
    };
    if (url) frame.src = url;
    else frame.srcdoc = html!;
    globalThis.document.body.append(frame);
  });
}
