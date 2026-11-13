import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak as DocxPageBreak,
  PageOrientation,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type NumberingDefinition,
  type ParagraphChild,
} from 'docx';
import type { StudioRichNode, StudioWordDocument } from '@zui/react';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TWIPS_PER_MM = 1440 / 25.4;
const UNSUPPORTED_CONTENT = new Set([
  'pict',
  'object',
  'altChunk',
  'sdt',
  'customXml',
  'ins',
  'del',
  'moveFrom',
  'moveTo',
  'footnoteReference',
  'endnoteReference',
  'commentRangeStart',
  'commentRangeEnd',
  'commentReference',
]);
const UNSUPPORTED_RUN = new Set([
  'position',
  'spacing',
  'w',
  'caps',
  'smallCaps',
  'dstrike',
  'emboss',
  'imprint',
  'effect',
  'vanish',
  'specVanish',
  'rtl',
  'bdr',
  'eastAsianLayout',
  'rPrChange',
]);
const HIGHLIGHTS: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  darkGray: '#808080',
  lightGray: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
};
const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];
const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

type Appearance = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  script?: 'superscript' | 'subscript';
};
type Style = {
  run: Appearance;
  paragraph: Record<string, unknown>;
  heading?: number;
  quote?: boolean;
};
type ListInfo = { id: string; level: number; type: 'bulletList' | 'orderedList'; start: number };
type ParsedParagraph = { nodes: StudioRichNode[]; list?: ListInfo; quote?: boolean };
type NumberLevel = { format: string; start: number; template: string };
type ImportContext = {
  styles: Map<string, Style>;
  defaults: Style;
  relationships: Map<string, string>;
  numbering: Map<string, Map<number, NumberLevel>>;
  images: Map<string, string>;
};

function unsupported(feature: string): never {
  throw new Error(
    `此 DOCX 包含首版尚未支持的${feature}。为避免内容丢失，请先在原编辑器中处理该内容。`
  );
}

function elements(parent?: Element | null): Element[] {
  return parent ? Array.from(parent.children) : [];
}

function child(parent: Element | null | undefined, name: string): Element | undefined {
  return elements(parent).find(
    (element) => element.namespaceURI === W && element.localName === name
  );
}

function attr(element: Element | undefined | null, name = 'val'): string {
  return element?.getAttributeNS(W, name) || element?.getAttribute(`w:${name}`) || '';
}

function value(parent: Element | null | undefined, name: string, fallback = ''): string {
  return attr(child(parent, name)) || fallback;
}

function enabled(element: Element | undefined): boolean {
  return !!element && !['0', 'false', 'off', 'none'].includes(attr(element));
}

function number(input: unknown, name: string, min: number, max: number): number {
  const result = Number(input);
  if (!Number.isFinite(result) || result < min || result > max) unsupported(`${name}设置`);
  return result;
}

function colour(input: unknown): string | undefined {
  if (input == null || input === '' || input === 'auto' || input === 'none') return undefined;
  const text = String(input).trim();
  const hex = /^#?([\da-f]{6}|[\da-f]{3})$/i.exec(text)?.[1];
  if (hex)
    return `#${hex.length === 3 ? Array.from(hex, (c) => c + c).join('') : hex}`.toLowerCase();
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(text);
  if (rgb && rgb.slice(1).every((part) => Number(part) <= 255)) {
    return `#${rgb
      .slice(1)
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  unsupported('颜色');
}

function safeFont(input: string): string {
  if (
    !input.trim() ||
    input.length > 255 ||
    /[^\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(input)
  )
    unsupported('字体名称');
  return input;
}

function safeLink(input: string): string {
  let protocol = '';
  try {
    protocol = new URL(input).protocol;
  } catch {
    unsupported('链接地址');
  }
  if (!['http:', 'https:', 'mailto:'].includes(protocol)) unsupported('链接协议');
  return input;
}

async function readXml(
  zip: JSZip,
  name: string,
  required = false
): Promise<XMLDocument | undefined> {
  const entry = zip.file(name);
  if (!entry) {
    if (required) throw new Error('文件不是有效的 DOCX 文档。');
    return;
  }
  const metadata = entry as unknown as { _data?: { uncompressedSize?: number } };
  if ((metadata._data?.uncompressedSize || 0) > MAX_BYTES)
    throw new Error('DOCX 内容过大，首版支持 25 MB 以内的文档。');
  const text = await entry.async('string');
  if (text.length > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('DOCX XML 内容无效。');
  const parsed = new DOMParser().parseFromString(text, 'application/xml');
  if (
    Array.from(parsed.getElementsByTagName('*')).some(
      (element) => element.localName === 'parsererror'
    )
  ) {
    throw new Error('DOCX XML 无法解析，请检查文件是否损坏。');
  }
  return parsed;
}

function resolveTheme(documents: (XMLDocument | undefined)[], theme?: XMLDocument) {
  if (!theme) return;
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const fonts: Record<string, string> = {};
  for (const group of ['major', 'minor']) {
    const source = theme.getElementsByTagNameNS(A, `${group}Font`)[0];
    if (!source) continue;
    const latin = source.getElementsByTagNameNS(A, 'latin')[0]?.getAttribute('typeface') || '';
    const eastAsia =
      source.getElementsByTagNameNS(A, 'ea')[0]?.getAttribute('typeface') ||
      Array.from(source.getElementsByTagNameNS(A, 'font'))
        .find((font) => font.getAttribute('script') === 'Hans')
        ?.getAttribute('typeface') ||
      latin;
    fonts[`${group}Ascii`] = latin;
    fonts[`${group}HAnsi`] = latin;
    fonts[`${group}EastAsia`] = eastAsia;
  }
  const colours: Record<string, string> = {};
  const scheme = theme.getElementsByTagNameNS(A, 'clrScheme')[0];
  for (const entry of elements(scheme)) {
    const source = entry.firstElementChild;
    const hex = source?.getAttribute('lastClr') || source?.getAttribute('val');
    if (hex && /^[\da-f]{6}$/i.test(hex)) colours[entry.localName] = hex;
  }
  Object.assign(colours, {
    text1: colours.dk1,
    text2: colours.dk2,
    background1: colours.lt1,
    background2: colours.lt2,
  });
  for (const xml of documents) {
    if (!xml) continue;
    for (const element of Array.from(xml.getElementsByTagNameNS(W, 'rFonts'))) {
      for (const [fontAttribute, themeAttribute] of [
        ['ascii', 'asciiTheme'],
        ['hAnsi', 'hAnsiTheme'],
        ['eastAsia', 'eastAsiaTheme'],
      ] as const) {
        const family = fonts[attr(element, themeAttribute)];
        if (!attr(element, fontAttribute) && family)
          element.setAttributeNS(W, `w:${fontAttribute}`, family);
      }
    }
    for (const element of Array.from(xml.getElementsByTagNameNS(W, 'color'))) {
      const hex = colours[attr(element, 'themeColor')];
      if (!hex) continue;
      const shade = attr(element, 'themeShade');
      const tint = attr(element, 'themeTint');
      const resolved = [0, 2, 4]
        .map((offset) => {
          let channel = parseInt(hex.slice(offset, offset + 2), 16);
          if (/^[\da-f]{2}$/i.test(shade)) channel *= parseInt(shade, 16) / 255;
          if (/^[\da-f]{2}$/i.test(tint))
            channel = 255 - ((255 - channel) * parseInt(tint, 16)) / 255;
          return Math.round(channel).toString(16).padStart(2, '0');
        })
        .join('');
      element.setAttributeNS(W, 'w:val', resolved);
    }
  }
}

function runProperties(properties?: Element, base: Appearance = {}): Appearance {
  const result = { ...base };
  for (const property of elements(properties)) {
    if (UNSUPPORTED_RUN.has(property.localName) && enabled(property)) unsupported('文字效果或修订');
  }
  for (const [tag, key] of [
    ['b', 'bold'],
    ['i', 'italic'],
    ['u', 'underline'],
    ['strike', 'strike'],
  ] as const) {
    const property = child(properties, tag);
    if (
      tag === 'u' &&
      property &&
      attr(property) &&
      !['single', 'none', '0', 'false', 'true', '1'].includes(attr(property))
    )
      unsupported('非单线下划线');
    if (property) result[key] = enabled(property);
  }
  const fonts = child(properties, 'rFonts');
  const family = attr(fonts, 'eastAsia') || attr(fonts, 'ascii') || attr(fonts, 'hAnsi');
  if (
    !family &&
    (attr(fonts, 'eastAsiaTheme') || attr(fonts, 'asciiTheme') || attr(fonts, 'hAnsiTheme'))
  )
    unsupported('无法解析的主题字体');
  if (family) result.fontFamily = safeFont(family);
  const size = value(properties, 'sz');
  if (size) result.fontSize = `${number(size, '字号', 2, 818) / 2}pt`;
  const vertical = value(properties, 'vertAlign');
  if (vertical && !['baseline', 'superscript', 'subscript'].includes(vertical))
    unsupported('文字上下标');
  if (vertical)
    result.script = vertical === 'baseline' ? undefined : (vertical as 'superscript' | 'subscript');
  const colourElement = child(properties, 'color');
  if (colourElement && !attr(colourElement) && attr(colourElement, 'themeColor'))
    unsupported('无法解析的主题颜色');
  if (colourElement) result.color = colour(attr(colourElement)) || '#1f2937';
  const highlight = value(properties, 'highlight');
  if (highlight && highlight !== 'none') {
    if (!HIGHLIGHTS[highlight]) unsupported('文字高亮颜色');
    result.backgroundColor = HIGHLIGHTS[highlight];
  }
  const shading = child(properties, 'shd');
  if (shading) {
    const pattern = attr(shading);
    if (pattern && !['clear', 'solid', 'nil'].includes(pattern)) unsupported('文字底纹图案');
    result.backgroundColor = colour(attr(shading, 'fill'));
  }
  return result;
}

function paragraphProperties(
  properties?: Element,
  base: Record<string, unknown> = {}
): Record<string, unknown> {
  const result = { ...base };
  if (
    child(properties, 'framePr') ||
    child(properties, 'textDirection') ||
    enabled(child(properties, 'bidi')) ||
    child(properties, 'pPrChange') ||
    child(properties, 'tabs')
  )
    unsupported('段落定位、方向或制表位');
  const alignment = value(properties, 'jc');
  if (alignment) {
    if (!['left', 'start', 'center', 'right', 'end', 'both', 'distribute'].includes(alignment))
      unsupported('段落对齐');
    result.textAlign =
      (
        { start: 'left', end: 'right', both: 'justify', distribute: 'justify' } as Record<
          string,
          string
        >
      )[alignment] || alignment;
  }
  const spacing = child(properties, 'spacing');
  if (spacing) {
    for (const [attribute, key] of [
      ['before', 'spaceBefore'],
      ['after', 'spaceAfter'],
    ] as const) {
      const amount = attr(spacing, attribute);
      if (amount) result[key] = number(amount, '段落间距', 0, 10000) / 20;
    }
    const line = attr(spacing, 'line');
    if (line) {
      if (attr(spacing, 'lineRule') && attr(spacing, 'lineRule') !== 'auto')
        unsupported('固定值行距');
      result.lineHeight = number(line, '行距', 120, 2400) / 240;
    }
  }
  const indent = child(properties, 'ind');
  if (indent) {
    for (const [attribute, key] of [
      ['left', 'indentLeft'],
      ['right', 'indentRight'],
      ['firstLine', 'indentFirstLine'],
    ] as const) {
      const amount = attr(indent, attribute);
      if (amount) result[key] = number(amount, '段落缩进', -10000, 10000) / 20;
    }
    const hanging = attr(indent, 'hanging');
    if (hanging) result.indentFirstLine = -number(hanging, '悬挂缩进', 0, 10000) / 20;
  }
  return result;
}

function parseStyles(xml?: XMLDocument): { defaults: Style; styles: Map<string, Style> } {
  const root = xml?.documentElement;
  const defaults: Style = {
    run: runProperties(
      child(child(root, 'docDefaults'), 'rPrDefault')
        ? child(child(child(root, 'docDefaults'), 'rPrDefault'), 'rPr')
        : undefined
    ),
    paragraph: paragraphProperties(child(child(child(root, 'docDefaults'), 'pPrDefault'), 'pPr')),
  };
  const definitions = new Map(
    elements(root)
      .filter((element) => element.localName === 'style')
      .map((element) => [attr(element, 'styleId'), element])
  );
  const styles = new Map<string, Style>();
  const resolve = (id: string, path: string[] = []): Style => {
    if (styles.has(id)) return styles.get(id)!;
    const source = definitions.get(id);
    if (!source) return defaults;
    if (path.includes(id) || path.length > 20) throw new Error('DOCX 样式存在循环引用。');
    const baseId = value(source, 'basedOn');
    const base = baseId
      ? resolve(baseId, [...path, id])
      : attr(source, 'type') === 'character'
        ? { run: {}, paragraph: {} }
        : defaults;
    const styleName = value(source, 'name', id);
    const heading =
      /^(?:Heading|heading|标题)\s*([1-6])$/i.exec(styleName)?.[1] ||
      /^(?:Heading|标题)([1-6])$/i.exec(id)?.[1];
    const outline = value(child(source, 'pPr'), 'outlineLvl');
    const level = heading
      ? Number(heading)
      : outline && Number(outline) < 6
        ? Number(outline) + 1
        : base.heading;
    const result: Style = {
      run: runProperties(child(source, 'rPr'), base.run),
      paragraph: paragraphProperties(child(source, 'pPr'), base.paragraph),
      heading: level,
      quote: id === 'ZuiQuote' || base.quote,
    };
    styles.set(id, result);
    return result;
  };
  // Unhandled template styles are marked, then rejected if document content actually uses them.
  for (const [id, source] of definitions) {
    const simple: Style = {
      run: {},
      paragraph: {},
      heading: /^(?:Heading|标题)\s*([1-6])$/i.test(value(source, 'name', id))
        ? Number(/([1-6])$/.exec(value(source, 'name', id))?.[1])
        : undefined,
    };
    if (
      !elements(child(source, 'rPr')).some((element) => UNSUPPORTED_RUN.has(element.localName)) &&
      !child(child(source, 'pPr'), 'tabs')
    ) {
      try {
        resolve(id);
      } catch {
        styles.set(id, { ...simple, paragraph: { studioUnsupported: true } });
      }
    } else styles.set(id, { ...simple, paragraph: { studioUnsupported: true } });
  }
  return { defaults, styles };
}

function parseNumbering(xml?: XMLDocument): Map<string, Map<number, NumberLevel>> {
  const result = new Map<string, Map<number, NumberLevel>>();
  const abstracts = new Map<string, Map<number, NumberLevel>>();
  const root = xml?.documentElement;
  for (const definition of elements(root).filter(
    (element) => element.localName === 'abstractNum'
  )) {
    const levels = new Map<number, NumberLevel>();
    for (const level of elements(definition).filter((element) => element.localName === 'lvl')) {
      levels.set(Number(attr(level, 'ilvl')), {
        format: value(level, 'numFmt'),
        start: Number(value(level, 'start', '1')),
        template: value(level, 'lvlText'),
      });
    }
    abstracts.set(attr(definition, 'abstractNumId'), levels);
  }
  for (const definition of elements(root).filter((element) => element.localName === 'num')) {
    const levels = new Map(abstracts.get(value(definition, 'abstractNumId')) || []);
    for (const override of elements(definition).filter(
      (element) => element.localName === 'lvlOverride'
    )) {
      const index = Number(attr(override, 'ilvl'));
      const base = levels.get(index);
      if (base)
        levels.set(index, {
          ...base,
          start: Number(value(override, 'startOverride', String(base.start))),
        });
    }
    result.set(attr(definition, 'numId'), levels);
  }
  return result;
}

function marks(appearance: Appearance): NonNullable<StudioRichNode['marks']> {
  const result: NonNullable<StudioRichNode['marks']> = [];
  for (const key of ['bold', 'italic', 'underline', 'strike'] as const)
    if (appearance[key]) result.push({ type: key });
  if (appearance.script) result.push({ type: appearance.script });
  const attrs: Record<string, unknown> = {};
  for (const key of ['fontFamily', 'fontSize', 'color', 'backgroundColor'] as const)
    if (appearance[key]) attrs[key] = appearance[key];
  if (Object.keys(attrs).length) result.push({ type: 'textStyle', attrs });
  return result;
}

function pageFieldKind(instruction: string): 'current' | 'total' {
  const match = /^(PAGE|NUMPAGES)(?:\s+\\\*\s+(?:MERGEFORMAT|Arabic))*$/i.exec(instruction.trim());
  if (!match) unsupported('页码以外的域或非阿拉伯页码');
  return match[1].toUpperCase() === 'NUMPAGES' ? 'total' : 'current';
}

function parseComplexField(
  items: Element[],
  firstIndex: number,
  inherited: Appearance,
  context: ImportContext
) {
  const beginning = child(items[firstIndex], 'fldChar');
  if (attr(beginning, 'fldCharType') !== 'begin') unsupported('不完整的域');
  let instruction = '';
  let result = '';
  let separated = false;
  let started = false;
  let appearance = inherited;
  for (let index = firstIndex; index < items.length; index++) {
    const run = items[index];
    if (run.namespaceURI !== W || run.localName !== 'r') unsupported('复杂域布局');
    const properties = child(run, 'rPr');
    const characterStyle = context.styles.get(value(properties, 'rStyle'));
    if (characterStyle?.paragraph.studioUnsupported) unsupported('文字样式');
    if (properties && (separated || index === firstIndex))
      appearance = runProperties(properties, { ...inherited, ...characterStyle?.run });
    const runItems = elements(run);
    for (let runIndex = 0; runIndex < runItems.length; runIndex++) {
      const item = runItems[runIndex];
      if (item.localName === 'rPr') continue;
      if (item.namespaceURI !== W) unsupported('域内的扩展内容');
      if (item.localName === 'fldChar') {
        if (['1', 'true', 'on'].includes(attr(item, 'fldLock'))) unsupported('锁定域');
        const type = attr(item, 'fldCharType');
        if (type === 'begin') {
          if (index !== firstIndex || started) unsupported('嵌套域');
          started = true;
        } else if (type === 'separate') {
          if (separated) unsupported('无效的域');
          separated = true;
        } else if (type === 'end') {
          if (result && !/^\s*\d+\s*$/.test(result)) unsupported('非阿拉伯页码缓存');
          const tail = run.cloneNode(false) as Element;
          if (properties) tail.appendChild(properties.cloneNode(true));
          for (const remaining of runItems.slice(runIndex + 1)) {
            if (remaining.localName !== 'rPr') tail.appendChild(remaining.cloneNode(true));
          }
          return {
            lastIndex: index,
            nodes: [
              {
                type: 'pageNumber',
                attrs: { kind: pageFieldKind(instruction) },
                marks: marks(appearance),
              } as StudioRichNode,
              ...parseRun(tail, context, inherited),
            ],
          };
        } else unsupported('域标记');
      } else if (item.localName === 'instrText' && !separated)
        instruction += item.textContent || '';
      else if (item.localName === 't' && separated) result += item.textContent || '';
      else unsupported('页码域中的文字或对象');
    }
  }
  unsupported('不完整的域');
}

function parseDrawing(drawing: Element, context: ImportContext): StudioRichNode {
  const inlines = drawing.getElementsByTagNameNS(WP, 'inline');
  if (drawing.getElementsByTagNameNS(WP, 'anchor').length || inlines.length !== 1)
    unsupported('浮动、锚定或非图片绘图');
  const inline = inlines[0];
  const pictures = inline.getElementsByTagNameNS(PIC, 'pic');
  const blips = inline.getElementsByTagNameNS(A, 'blip');
  if (pictures.length !== 1 || blips.length !== 1) unsupported('绘图、组合对象或非图片图形');
  const blip = blips[0];
  const id = blip.getAttributeNS(R, 'embed') || '';
  if (!id || blip.getAttributeNS(R, 'link') || !context.images.has(id))
    unsupported('外部链接图片或缺失的内嵌图片');
  for (const transform of Array.from(inline.getElementsByTagNameNS(A, 'xfrm'))) {
    if (
      Number(transform.getAttribute('rot') || 0) !== 0 ||
      ['1', 'true'].includes(transform.getAttribute('flipH') || '') ||
      ['1', 'true'].includes(transform.getAttribute('flipV') || '')
    )
      unsupported('图片旋转或翻转');
  }
  for (const crop of Array.from(inline.getElementsByTagNameNS(A, 'srcRect')))
    if (['l', 't', 'r', 'b'].some((key) => Number(crop.getAttribute(key) || 0) !== 0))
      unsupported('图片裁剪');
  if (Array.from(blip.children).some((node) => node.localName !== 'extLst'))
    unsupported('图片效果');
  for (const list of elements(blip))
    for (const extension of elements(list)) {
      if (
        extension.localName !== 'ext' ||
        elements(extension).some((node) => !['useLocalDpi', 'creationId'].includes(node.localName))
      )
        unsupported('SVG 或图片扩展效果');
    }
  for (const fill of Array.from(inline.getElementsByTagNameNS(A, 'fillRect')))
    if (['l', 't', 'r', 'b'].some((key) => Number(fill.getAttribute(key) || 0) !== 0))
      unsupported('图片裁剪');
  if (inline.getElementsByTagNameNS(A, 'tile').length) unsupported('图片平铺');
  let drawingLink: string | undefined;
  for (const clickable of Array.from(inline.getElementsByTagNameNS(A, 'hlinkClick'))) {
    const target = context.relationships.get(clickable.getAttributeNS(R, 'id') || '');
    if (!target) unsupported('文档内部绘图链接');
    const href = safeLink(target);
    if (drawingLink && drawingLink !== href) unsupported('冲突的图片链接');
    drawingLink = href;
  }
  for (const properties of Array.from(inline.getElementsByTagNameNS(PIC, 'spPr'))) {
    if (
      elements(properties).some((node) => !['xfrm', 'prstGeom', 'noFill'].includes(node.localName))
    )
      unsupported('图片边框或形状效果');
    for (const geometry of elements(properties).filter((node) => node.localName === 'prstGeom'))
      if (
        geometry.getAttribute('prst') !== 'rect' ||
        geometry.getElementsByTagNameNS(A, 'gd').length
      )
        unsupported('非矩形图片');
  }
  const extent = inline.getElementsByTagNameNS(WP, 'extent')[0];
  const properties = inline.getElementsByTagNameNS(WP, 'docPr')[0];
  return {
    type: 'image',
    attrs: {
      src: context.images.get(id),
      width: number(Number(extent?.getAttribute('cx')) / 9525, '图片宽度', 1, 2000),
      height: number(Number(extent?.getAttribute('cy')) / 9525, '图片高度', 1, 2000),
      alt: (properties?.getAttribute('descr') || properties?.getAttribute('name') || '').slice(
        0,
        1000
      ),
    },
    ...(drawingLink ? { marks: [{ type: 'link', attrs: { href: drawingLink } }] } : {}),
  };
}

function parseRun(
  run: Element,
  context: ImportContext,
  inherited: Appearance,
  link?: string
): StudioRichNode[] {
  const properties = child(run, 'rPr');
  const characterStyle = context.styles.get(value(properties, 'rStyle'));
  if (characterStyle?.paragraph.studioUnsupported) unsupported('文字样式');
  const appearance = runProperties(properties, { ...inherited, ...characterStyle?.run });
  const runMarks = marks(appearance);
  if (link) runMarks.push({ type: 'link', attrs: { href: link } });
  const result: StudioRichNode[] = [];
  for (const item of elements(run)) {
    if (item.namespaceURI !== W) unsupported('公式或扩展对象');
    if (item.localName === 'rPr' || item.localName === 'lastRenderedPageBreak') continue;
    if (
      item.localName === 't' ||
      item.localName === 'tab' ||
      item.localName === 'noBreakHyphen' ||
      item.localName === 'softHyphen'
    ) {
      const text =
        item.localName === 't'
          ? item.textContent || ''
          : (
              { tab: '\t', noBreakHyphen: '\u2011', softHyphen: '\u00ad' } as Record<string, string>
            )[item.localName];
      if (text)
        result.push({ type: 'text', text, ...(runMarks.length ? { marks: runMarks } : {}) });
    } else if (item.localName === 'br' || item.localName === 'cr') {
      const type = attr(item, 'type');
      if (type === 'column') unsupported('分栏换行');
      result.push({ type: type === 'page' ? 'pageBreak' : 'hardBreak' });
    } else if (item.localName === 'drawing') {
      const image = parseDrawing(item, context);
      const drawingLink = image.marks?.find((mark) => mark.type === 'link')?.attrs?.href;
      if (link && drawingLink && drawingLink !== link) unsupported('冲突的图片链接');
      const imageMarks = [
        ...runMarks,
        ...(image.marks || []).filter(
          (mark) => !runMarks.some((existing) => existing.type === mark.type)
        ),
      ];
      result.push({ ...image, ...(imageMarks.length ? { marks: imageMarks } : {}) });
    } else unsupported('内嵌对象或域');
  }
  return result;
}

function parseParagraph(element: Element, context: ImportContext): ParsedParagraph {
  const properties = child(element, 'pPr');
  const styleId = value(properties, 'pStyle');
  const style = context.styles.get(styleId) || context.defaults;
  if (style.paragraph.studioUnsupported) unsupported('段落样式');
  const attrs = paragraphProperties(properties, style.paragraph);
  const appearance = runProperties(child(properties, 'rPr'), style.run);
  const inline: StudioRichNode[] = [];
  const paragraphItems = elements(element);
  for (let index = 0; index < paragraphItems.length; index++) {
    const item = paragraphItems[index];
    if (item.namespaceURI !== W) unsupported('公式或扩展对象');
    if (['pPr', 'proofErr', 'bookmarkStart', 'bookmarkEnd'].includes(item.localName)) continue;
    if (item.localName === 'r' && child(item, 'fldChar')) {
      const parsed = parseComplexField(paragraphItems, index, appearance, context);
      inline.push(...parsed.nodes);
      index = parsed.lastIndex;
    } else if (item.localName === 'fldSimple') {
      if (['1', 'true', 'on'].includes(attr(item, 'fldLock'))) unsupported('锁定域');
      const kind = pageFieldKind(attr(item, 'instr'));
      const cachedRuns = elements(item);
      let cachedText = '';
      let cachedAppearance: Appearance | undefined;
      for (const run of cachedRuns) {
        if (run.namespaceURI !== W || run.localName !== 'r') unsupported('页码域缓存中的对象');
        const properties = child(run, 'rPr');
        const characterStyle = context.styles.get(value(properties, 'rStyle'));
        if (characterStyle?.paragraph.studioUnsupported) unsupported('文字样式');
        const runAppearance = runProperties(properties, { ...appearance, ...characterStyle?.run });
        if (
          cachedAppearance &&
          JSON.stringify(marks(cachedAppearance)) !== JSON.stringify(marks(runAppearance))
        )
          unsupported('混合格式的页码域缓存');
        cachedAppearance ||= runAppearance;
        for (const child of elements(run)) {
          if (child.namespaceURI !== W || !['rPr', 't'].includes(child.localName))
            unsupported('页码域缓存中的对象');
          if (child.localName === 't') cachedText += child.textContent || '';
        }
      }
      if (cachedText && !/^\s*\d+\s*$/.test(cachedText)) unsupported('非阿拉伯页码缓存');
      inline.push({
        type: 'pageNumber',
        attrs: { kind },
        marks: marks(cachedAppearance || appearance),
      });
    } else if (item.localName === 'r') inline.push(...parseRun(item, context, appearance));
    else if (item.localName === 'hyperlink') {
      const id = item.getAttributeNS(R, 'id') || item.getAttribute('r:id') || '';
      const target = context.relationships.get(id);
      if (!target || attr(item, 'anchor')) unsupported('文档内部链接');
      for (const run of elements(item)) {
        if (run.localName !== 'r') unsupported('链接内容');
        inline.push(...parseRun(run, context, appearance, safeLink(target)));
      }
    } else unsupported('段落内的对象、控件或修订');
  }
  const listProperties = child(properties, 'numPr');
  let list: ListInfo | undefined;
  const numId = value(listProperties, 'numId');
  if (numId && numId !== '0') {
    const level = number(value(listProperties, 'ilvl', '0'), '列表层级', 0, 8);
    const definition = context.numbering.get(numId)?.get(level);
    if (!definition || !['bullet', 'decimal'].includes(definition.format))
      unsupported('列表编号格式');
    if (definition.format === 'decimal' && definition.template !== `%${level + 1}.`)
      unsupported('复合列表编号');
    number(definition.start, '列表起始编号', 1, 100000);
    list = {
      id: numId,
      level,
      type: definition.format === 'bullet' ? 'bulletList' : 'orderedList',
      start: definition.start,
    };
  }
  const border = child(properties, 'pBdr');
  if (styleId === 'ZuiRule' || (border && child(border, 'bottom') && !inline.length))
    return { nodes: [{ type: 'horizontalRule' }] };
  if (border && styleId !== 'ZuiQuote') unsupported('段落边框');
  const base: StudioRichNode = {
    type: style.heading ? 'heading' : 'paragraph',
    ...(Object.keys(attrs).length || style.heading
      ? { attrs: { ...attrs, ...(style.heading ? { level: style.heading } : {}) } }
      : {}),
  };
  const nodes: StudioRichNode[] = [];
  if (enabled(child(properties, 'pageBreakBefore'))) nodes.push({ type: 'pageBreak' });
  let segment: StudioRichNode[] = [];
  for (const part of inline) {
    if (part.type === 'pageBreak') {
      if (segment.length) nodes.push({ ...base, content: segment });
      nodes.push(part);
      segment = [];
    } else segment.push(part);
  }
  if (segment.length || !nodes.length)
    nodes.push({ ...base, ...(segment.length ? { content: segment } : {}) });
  if (list && (nodes.length !== 1 || !['paragraph', 'heading'].includes(nodes[0].type)))
    unsupported('列表内分页符');
  return { nodes, list, quote: style.quote };
}

function parseBlocks(parent: Element, context: ImportContext): StudioRichNode[] {
  const output: StudioRichNode[] = [];
  const stack: { list: StudioRichNode; id: string; item: StudioRichNode }[] = [];
  for (const element of elements(parent)) {
    if (['sectPr', 'tcPr'].includes(element.localName)) continue;
    if (element.namespaceURI !== W) unsupported('公式或扩展对象');
    if (element.localName === 'tbl') {
      stack.length = 0;
      output.push(parseTable(element, context));
      continue;
    }
    if (element.localName !== 'p') unsupported('正文对象、控件或修订');
    const parsed = parseParagraph(element, context);
    if (!parsed.list) {
      stack.length = 0;
      if (parsed.quote) {
        const previous = output.at(-1);
        if (previous?.type === 'blockquote') previous.content!.push(...parsed.nodes);
        else output.push({ type: 'blockquote', content: parsed.nodes });
      } else output.push(...parsed.nodes);
      continue;
    }
    const info = parsed.list;
    if (info.level > stack.length) unsupported('缺少上级的嵌套列表');
    stack.splice(info.level + 1);
    if (
      !stack[info.level] ||
      stack[info.level].id !== info.id ||
      stack[info.level].list.type !== info.type
    ) {
      const list: StudioRichNode = {
        type: info.type,
        ...(info.type === 'orderedList' ? { attrs: { start: info.start } } : {}),
        content: [],
      };
      if (info.level === 0) output.push(list);
      else stack[info.level - 1].item.content!.push(list);
      stack[info.level] = { list, id: info.id, item: { type: 'listItem', content: [] } };
    }
    const item: StudioRichNode = { type: 'listItem', content: parsed.nodes };
    stack[info.level].list.content!.push(item);
    stack[info.level].item = item;
  }
  return output;
}

function parseTable(element: Element, context: ImportContext): StudioRichNode {
  const properties = child(element, 'tblPr');
  if (child(properties, 'tblpPr') || enabled(child(properties, 'bidiVisual')))
    unsupported('浮动或反向表格');
  const grid = elements(child(element, 'tblGrid')).map((column) => Number(attr(column, 'w')) / 15);
  const rows: StudioRichNode[] = [];
  let previousMerges = new Map<number, StudioRichNode>();
  for (const row of elements(element).filter((item) => item.localName === 'tr')) {
    if (child(child(row, 'trPr'), 'gridBefore') || child(child(row, 'trPr'), 'gridAfter'))
      unsupported('不规则表格行');
    const isHeader = enabled(child(child(row, 'trPr'), 'tblHeader'));
    const cells: StudioRichNode[] = [];
    const merges = new Map<number, StudioRichNode>();
    let column = 0;
    for (const cell of elements(row).filter((item) => item.localName === 'tc')) {
      const cellProperties = child(cell, 'tcPr');
      if (child(cellProperties, 'textDirection') || child(cellProperties, 'hMerge'))
        unsupported('表格文字方向或旧式合并');
      const colspan = number(value(cellProperties, 'gridSpan', '1'), '合并列数', 1, 100);
      const merge = child(cellProperties, 'vMerge');
      const content = parseBlocks(cell, context);
      if (merge && attr(merge) !== 'restart') {
        const origin = previousMerges.get(column);
        if (!origin || origin.attrs?.colspan !== colspan) unsupported('无效的纵向合并表格');
        if (content.some((node) => node.type !== 'paragraph' || node.content?.length))
          unsupported('合并区域内的隐藏文字');
        origin.attrs!.rowspan = Number(origin.attrs!.rowspan) + 1;
        for (let offset = 0; offset < colspan; offset++) merges.set(column + offset, origin);
      } else {
        const backgroundColor = colour(attr(child(cellProperties, 'shd'), 'fill'));
        const colwidth = grid.slice(column, column + colspan);
        const node: StudioRichNode = {
          type: isHeader ? 'tableHeader' : 'tableCell',
          attrs: {
            colspan,
            rowspan: 1,
            colwidth:
              colwidth.length === colspan &&
              colwidth.every((width) => Number.isFinite(width) && width > 0)
                ? colwidth
                : null,
            ...(backgroundColor ? { backgroundColor } : {}),
          },
          content: content.length ? content : [{ type: 'paragraph' }],
        };
        cells.push(node);
        if (merge)
          for (let offset = 0; offset < colspan; offset++) merges.set(column + offset, node);
      }
      column += colspan;
    }
    rows.push({ type: 'tableRow', content: cells });
    previousMerges = merges;
  }
  if (!rows.length || !rows[0].content?.length) unsupported('空表格');
  return { type: 'table', content: rows };
}

function parsePage(body: Element): StudioWordDocument['page'] {
  const sections = Array.from(body.getElementsByTagNameNS(W, 'sectPr'));
  if (sections.length > 1) unsupported('多节页面布局');
  const section = sections[0];
  if (section && section.parentElement !== body) unsupported('分节符');
  if (Number(attr(child(section, 'cols'), 'num') || 1) > 1) unsupported('分栏布局');
  if (enabled(child(section, 'titlePg'))) unsupported('不同首页的页眉页脚');
  const size = child(section, 'pgSz');
  const width = Number(attr(size, 'w') || Math.round(210 * TWIPS_PER_MM));
  const height = Number(attr(size, 'h') || Math.round(297 * TWIPS_PER_MM));
  const orientation =
    width > height || attr(size, 'orient') === 'landscape' ? 'landscape' : 'portrait';
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  let paper: 'A4' | 'Letter';
  if (Math.abs(short - 210 * TWIPS_PER_MM) < 40 && Math.abs(long - 297 * TWIPS_PER_MM) < 40)
    paper = 'A4';
  else if (Math.abs(short - 12240) < 40 && Math.abs(long - 15840) < 40) paper = 'Letter';
  else unsupported('自定义纸张尺寸');
  const margins = child(section, 'pgMar');
  if (Number(attr(margins, 'gutter') || 0) !== 0) unsupported('装订线页边距');
  const amounts = ['top', 'right', 'bottom', 'left'].map((side) =>
    Number(attr(margins, side) || Math.round(20 * TWIPS_PER_MM))
  );
  if (amounts.some((amount) => !Number.isFinite(amount) || Math.abs(amount - amounts[0]) > 10))
    unsupported('不等宽页边距');
  return {
    size: paper,
    orientation,
    margin: Math.round(number(amounts[0] / TWIPS_PER_MM, '页边距', 5, 60) * 10) / 10,
    ...(attr(margins, 'header') &&
    (child(section, 'headerReference') ||
      Math.abs(Number(attr(margins, 'header')) - Math.round(12.5 * TWIPS_PER_MM)) > 1)
      ? {
          headerDistance:
            Math.round(
              number(Number(attr(margins, 'header')) / TWIPS_PER_MM, '页眉距离', 0, 80) * 10
            ) / 10,
        }
      : {}),
    ...(attr(margins, 'footer') &&
    (child(section, 'footerReference') ||
      Math.abs(Number(attr(margins, 'footer')) - Math.round(12.5 * TWIPS_PER_MM)) > 1)
      ? {
          footerDistance:
            Math.round(
              number(Number(attr(margins, 'footer')) / TWIPS_PER_MM, '页脚距离', 0, 80) * 10
            ) / 10,
        }
      : {}),
  };
}

function packageTarget(part: string, target: string): string {
  let resolved: URL;
  try {
    resolved = new URL(target, `https://zui-docx.invalid/${part}`);
  } catch {
    unsupported('无效的文档关系');
  }
  if (resolved!.origin !== 'https://zui-docx.invalid' || resolved!.search || resolved!.hash)
    unsupported('外部图片或页眉页脚引用');
  try {
    return decodeURIComponent(resolved!.pathname).replace(/^\//, '');
  } catch {
    unsupported('无效的文档关系路径');
  }
}

function imageFormat(bytes: Uint8Array): 'png' | 'jpg' {
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  )
    return 'png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  unsupported('PNG/JPEG 以外或损坏的图片');
}

type ImageBudget = { bytes: number; sources: Map<string, string> };

async function partRelationships(zip: JSZip, part: string, budget: ImageBudget) {
  const slash = part.lastIndexOf('/');
  const relationshipsXml = await readXml(
    zip,
    `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`
  );
  const relationships = new Map<string, string>();
  const images = new Map<string, string>();
  const references = new Map<string, { type: string; target: string; external: boolean }>();
  for (const relationship of elements(relationshipsXml?.documentElement)) {
    const id = relationship.getAttribute('Id') || '';
    const type = relationship.getAttribute('Type') || '';
    const target = relationship.getAttribute('Target') || '';
    const external = relationship.getAttribute('TargetMode') === 'External';
    if (references.has(id)) unsupported('重复的文档关系');
    references.set(id, { type, target, external });
    if (type.endsWith('/hyperlink')) relationships.set(id, target);
    if (!type.endsWith('/image') || external) continue;
    const path = packageTarget(part, target);
    let src = budget.sources.get(path);
    if (!src) {
      const entry = zip.file(path);
      if (!entry) unsupported('缺失的图片文件');
      const metadata = entry as unknown as { _data?: { uncompressedSize?: number } };
      if ((metadata._data?.uncompressedSize || 0) > MAX_IMAGE_BYTES)
        unsupported('超过 8 MB 的图片');
      const bytes = await entry.async('uint8array');
      budget.bytes += bytes.length;
      if (bytes.length > MAX_IMAGE_BYTES || budget.bytes > MAX_BYTES) unsupported('过大的图片内容');
      const format = imageFormat(bytes);
      src = `data:image/${format === 'jpg' ? 'jpeg' : 'png'};base64,${await entry.async('base64')}`;
      budget.sources.set(path, src);
    }
    images.set(id, src);
  }
  return { relationships, images, references };
}

function assertSupportedContent(parent: Element) {
  for (const element of Array.from(parent.getElementsByTagName('*')))
    if (UNSUPPORTED_CONTENT.has(element.localName)) unsupported('域、控件、批注、嵌入对象或修订');
}

function containsCurrentPageNumber(node: StudioRichNode): boolean {
  return (
    (node.type === 'pageNumber' && node.attrs?.kind !== 'total') ||
    !!node.content?.some(containsCurrentPageNumber)
  );
}

/** Import a supported DOCX subset without flattening unhandled document content. */
export async function importStudioWord(source: Blob, name: string): Promise<StudioWordDocument> {
  if (source.size > MAX_BYTES) throw new Error('首版支持 25 MB 以内的 DOCX 文档。');
  if (name && !/\.docx$/i.test(name))
    throw new Error('Word 首版支持 .docx；请先转换旧版 .doc 文件。');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await source.arrayBuffer());
  } catch {
    throw new Error('DOCX 无法打开，请检查文件格式或是否被加密。');
  }
  if (Object.keys(zip.files).some((path) => /vbaProject|\/embeddings\/|\/activeX\//i.test(path)))
    unsupported('宏或嵌入文件');
  const [xml, stylesXml, numberingXml, settingsXml, themeXml] = await Promise.all([
    readXml(zip, 'word/document.xml', true),
    readXml(zip, 'word/styles.xml'),
    readXml(zip, 'word/numbering.xml'),
    readXml(zip, 'word/settings.xml'),
    readXml(zip, 'word/theme/theme1.xml'),
  ]);
  resolveTheme([xml, stylesXml], themeXml);
  if (xml!.documentElement.namespaceURI !== W)
    throw new Error('此 Word XML 格式尚未支持，请另存为标准 DOCX。');
  const body = child(xml!.documentElement, 'body');
  if (!body) throw new Error('DOCX 缺少文档正文。');
  if (enabled(child(settingsXml?.documentElement, 'evenAndOddHeaders')))
    unsupported('不同奇偶页的页眉页脚');
  assertSupportedContent(body);
  const page = parsePage(body);
  const budget: ImageBudget = { bytes: 0, sources: new Map() };
  const mainRelationships = await partRelationships(zip, 'word/document.xml', budget);
  const context: ImportContext = {
    ...parseStyles(stylesXml),
    relationships: mainRelationships.relationships,
    images: mainRelationships.images,
    numbering: parseNumbering(numberingXml),
  };
  const content = parseBlocks(body, context);
  const regionDocuments: Pick<StudioWordDocument, 'header' | 'footer' | 'pageNumbers'> = {};
  const section = child(body, 'sectPr');
  for (const region of ['header', 'footer'] as const) {
    const references = elements(section).filter(
      (element) => element.localName === `${region}Reference`
    );
    if (!references.length) continue;
    if (references.length !== 1 || attr(references[0], 'type') !== 'default')
      unsupported('不同首页或奇偶页的页眉页脚');
    const id = references[0].getAttributeNS(R, 'id') || '';
    const relation = mainRelationships.references.get(id);
    if (!relation || relation.external || !relation.type.endsWith(`/${region}`))
      unsupported('缺失的页眉页脚引用');
    const path = packageTarget('word/document.xml', relation.target);
    const regionXml = await readXml(zip, path, true);
    if (
      regionXml!.documentElement.namespaceURI !== W ||
      regionXml!.documentElement.localName !== (region === 'header' ? 'hdr' : 'ftr')
    )
      unsupported('无效的页眉页脚内容');
    resolveTheme([regionXml], themeXml);
    assertSupportedContent(regionXml!.documentElement);
    const relations = await partRelationships(zip, path, budget);
    const nodes = parseBlocks(regionXml!.documentElement, {
      ...context,
      relationships: relations.relationships,
      images: relations.images,
    });
    const model: StudioRichNode = {
      type: 'doc',
      content: nodes.length ? nodes : [{ type: 'paragraph' }],
    };
    regionDocuments[region] = model;
    if (region === 'footer' && containsCurrentPageNumber(model)) regionDocuments.pageNumbers = true;
  }
  return {
    version: 1,
    id: `studio-word-${globalThis.crypto.randomUUID()}`,
    name: name || '未命名.docx',
    kind: 'word',
    content: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] },
    page,
    ...regionDocuments,
  };
}

function checkAttrs(node: StudioRichNode, allowed: string[]) {
  for (const [key, value] of Object.entries(node.attrs || {})) {
    if (value != null && !allowed.includes(key))
      throw new Error(`DOCX 导出尚未支持 ${node.type} 的 ${key} 属性。`);
  }
}

function runOptions(node: StudioRichNode): { options: IRunOptions; href?: string } {
  let href: string | undefined;
  let options: IRunOptions = { text: node.text || '' };
  for (const mark of node.marks || []) {
    if (mark.type === 'bold') options = { ...options, bold: true };
    else if (mark.type === 'italic') options = { ...options, italics: true };
    else if (mark.type === 'underline')
      options = { ...options, underline: { type: UnderlineType.SINGLE } };
    else if (mark.type === 'strike') options = { ...options, strike: true };
    else if (mark.type === 'superscript') options = { ...options, superScript: true };
    else if (mark.type === 'subscript') options = { ...options, subScript: true };
    else if (mark.type === 'link') href = safeLink(String(mark.attrs?.href || ''));
    else if (mark.type === 'textStyle') {
      checkAttrs({ type: 'textStyle', attrs: mark.attrs }, [
        'fontFamily',
        'fontSize',
        'color',
        'backgroundColor',
      ]);
      const attrs = mark.attrs || {};
      if (attrs.fontFamily) options = { ...options, font: safeFont(String(attrs.fontFamily)) };
      if (attrs.fontSize) {
        const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(String(attrs.fontSize));
        if (!match) unsupported('字号单位');
        options = {
          ...options,
          size: number(Number(match[1]) * (match[2] === 'px' ? 0.75 : 1), '字号', 1, 409) * 2,
        };
      }
      if (attrs.color) options = { ...options, color: colour(attrs.color)!.slice(1) };
      if (attrs.backgroundColor)
        options = {
          ...options,
          shading: { type: ShadingType.CLEAR, fill: colour(attrs.backgroundColor)!.slice(1) },
        };
    } else throw new Error(`DOCX 导出尚未支持 ${mark.type} 文字格式。`);
  }
  return { options, href };
}

function inlineChildren(nodes: StudioRichNode[] = []): ParagraphChild[] {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return new TextRun({ break: 1 });
    if (node.type === 'pageNumber') {
      checkAttrs(node, ['kind']);
      if (node.attrs?.kind != null && !['current', 'total'].includes(String(node.attrs.kind)))
        unsupported('页码域');
      const { options, href } = runOptions({ ...node, text: '' });
      if (href) unsupported('包含超链接的页码域');
      return new TextRun({
        ...options,
        children: [node.attrs?.kind === 'total' ? PageNumber.TOTAL_PAGES : PageNumber.CURRENT],
      });
    }
    if (node.type === 'image') {
      checkAttrs(node, ['src', 'width', 'height', 'alt']);
      const { data, type } = embeddedImageData(node.attrs?.src);
      const { options, href } = runOptions({ ...node, text: '' });
      const run = new ImageRun({
        type,
        data,
        transformation: {
          width: number(node.attrs?.width ?? 320, '图片宽度', 1, 2000),
          height: number(node.attrs?.height ?? 180, '图片高度', 1, 2000),
        },
        altText: {
          name: String(node.attrs?.alt || '图片').slice(0, 1000),
          description: String(node.attrs?.alt || '').slice(0, 1000),
          title: String(node.attrs?.alt || '').slice(0, 1000),
        },
        run: options,
      });
      return href ? new ExternalHyperlink({ link: href, children: [run] }) : run;
    }
    if (node.type !== 'text') throw new Error(`DOCX 导出尚未支持 ${node.type} 行内元素。`);
    const { options, href } = runOptions(node);
    const run = new TextRun(options);
    return href ? new ExternalHyperlink({ link: href, children: [run] }) : run;
  });
}

function embeddedImageData(input: unknown) {
  const match =
    typeof input === 'string' && /^data:image\/(png|jpeg);base64,([a-z\d+/]+={0,2})$/i.exec(input);
  if (!match || match[2].length % 4 !== 0 || match[2].length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3))
    unsupported('外部图片地址或无效的内嵌 image 数据');
  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const data = new Uint8Array((base64.length / 4) * 3 - padding);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = 0;
  for (let offset = 0; offset < base64.length; offset += 4) {
    const value =
      (alphabet.indexOf(base64[offset]) << 18) |
      (alphabet.indexOf(base64[offset + 1]) << 12) |
      (Math.max(0, alphabet.indexOf(base64[offset + 2])) << 6) |
      Math.max(0, alphabet.indexOf(base64[offset + 3]));
    if (output < data.length) data[output++] = (value >>> 16) & 255;
    if (output < data.length) data[output++] = (value >>> 8) & 255;
    if (output < data.length) data[output++] = value & 255;
  }
  const type = imageFormat(data);
  if ((type === 'png') !== (match[1].toLowerCase() === 'png')) unsupported('图片类型与内容不一致');
  return { data, type };
}

/** Export the structured editor model as a real, editable DOCX. */
export async function exportStudioWord(document: StudioWordDocument): Promise<Blob> {
  if (document.content.type !== 'doc') throw new Error('Word 文档模型无效。');
  if (
    !['A4', 'Letter'].includes(document.page.size) ||
    !['portrait', 'landscape'].includes(document.page.orientation)
  )
    throw new Error('Word 页面配置无效。');
  const margin = Math.round(number(document.page.margin, '页边距', 5, 60) * TWIPS_PER_MM);
  const numbering: NumberingDefinition[] = [];
  const paragraph = (node: StudioRichNode, options: IParagraphOptions = {}) => {
    checkAttrs(node, [
      'level',
      'textAlign',
      'indentLeft',
      'indentRight',
      'indentFirstLine',
      'spaceBefore',
      'spaceAfter',
      'lineHeight',
    ]);
    const attrs = node.attrs || {};
    const left =
      attrs.indentLeft == null
        ? undefined
        : Math.round(number(attrs.indentLeft, '段落缩进', -500, 500) * 20);
    const right =
      attrs.indentRight == null
        ? undefined
        : Math.round(number(attrs.indentRight, '段落缩进', -500, 500) * 20);
    const firstLine =
      attrs.indentFirstLine == null
        ? undefined
        : Math.round(number(attrs.indentFirstLine, '首行缩进', -500, 500) * 20);
    const align = attrs.textAlign == null ? undefined : ALIGN[String(attrs.textAlign)];
    if (attrs.textAlign != null && !align) unsupported('段落对齐');
    return new Paragraph({
      ...options,
      heading:
        node.type === 'heading'
          ? HEADING_LEVELS[number(attrs.level, '标题级别', 1, 6) - 1]
          : options.heading,
      alignment: align || options.alignment,
      indent:
        left !== undefined || right !== undefined || firstLine !== undefined
          ? {
              left,
              right,
              ...(firstLine !== undefined
                ? firstLine < 0
                  ? { hanging: -firstLine }
                  : { firstLine }
                : {}),
            }
          : options.indent,
      spacing: {
        before:
          attrs.spaceBefore == null
            ? undefined
            : Math.round(number(attrs.spaceBefore, '段前间距', 0, 500) * 20),
        after:
          attrs.spaceAfter == null
            ? undefined
            : Math.round(number(attrs.spaceAfter, '段后间距', 0, 500) * 20),
        line:
          attrs.lineHeight == null
            ? undefined
            : Math.round(number(attrs.lineHeight, '行距', 0.5, 10) * 240),
      },
      children: inlineChildren(node.content),
    });
  };
  const blocks = (nodes: StudioRichNode[], depth = 0): (Paragraph | Table)[] => {
    if (depth > 20) throw new Error('文档嵌套层级过深。');
    const result: (Paragraph | Table)[] = [];
    for (const node of nodes) {
      if (node.type === 'paragraph' || node.type === 'heading') result.push(paragraph(node));
      else if (node.type === 'pageBreak')
        result.push(new Paragraph({ children: [new DocxPageBreak()] }));
      else if (node.type === 'horizontalRule')
        result.push(
          new Paragraph({
            style: 'ZuiRule',
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F2937' } },
          })
        );
      else if (node.type === 'blockquote') {
        checkAttrs(node, []);
        for (const item of node.content || []) {
          if (!['paragraph', 'heading'].includes(item.type))
            throw new Error('DOCX 首版支持由段落组成的引用。');
          result.push(paragraph(item, { style: 'ZuiQuote' }));
        }
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        const renderList = (list: StudioRichNode, level: number) => {
          if (level > 8) throw new Error('DOCX 列表最多支持 9 级。');
          checkAttrs(list, ['start', 'type']);
          if (list.attrs?.type != null && list.attrs.type !== '1')
            unsupported('字母或特殊列表编号');
          const reference = `zui-list-${numbering.length}`;
          numbering.push({
            reference,
            levels: Array.from({ length: 9 }, (_, index) => ({
              level: index,
              format: list.type === 'bulletList' ? LevelFormat.BULLET : LevelFormat.DECIMAL,
              text: list.type === 'bulletList' ? '•' : `%${index + 1}.`,
              start:
                list.type === 'orderedList'
                  ? number(list.attrs?.start ?? 1, '列表起始编号', 1, 100000)
                  : 1,
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: (index + 1) * 720, hanging: 360 } } },
            })),
          });
          for (const item of list.content || []) {
            if (
              item.type !== 'listItem' ||
              !['paragraph', 'heading'].includes(item.content?.[0]?.type || '')
            )
              throw new Error('列表项需要以段落开头。');
            checkAttrs(item, []);
            result.push(paragraph(item.content![0], { numbering: { reference, level } }));
            for (const nested of item.content!.slice(1)) {
              if (!['bulletList', 'orderedList'].includes(nested.type))
                throw new Error(
                  'DOCX 首版支持每个列表项一个段落及嵌套列表，请用 Shift+Enter 在项目内换行。'
                );
              renderList(nested, level + 1);
            }
          }
        };
        renderList(node, 0);
      } else if (node.type === 'table') {
        checkAttrs(node, []);
        const rows = node.content || [];
        if (!rows.length || !rows[0].content?.length) throw new Error('表格缺少行或单元格。');
        const columnWidths: number[] = [];
        for (const cell of rows[0].content) {
          const widths = cell.attrs?.colwidth;
          if (Array.isArray(widths))
            columnWidths.push(
              ...widths.map((width) => Math.round(number(width, '列宽', 1, 5000) * 15))
            );
          else {
            columnWidths.length = 0;
            break;
          }
        }
        result.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            ...(columnWidths.length ? { columnWidths } : {}),
            rows: rows.map((row) => {
              if (row.type !== 'tableRow') throw new Error('表格行模型无效。');
              checkAttrs(row, []);
              return new TableRow({
                tableHeader:
                  !!row.content?.length && row.content.every((cell) => cell.type === 'tableHeader'),
                children: (row.content || []).map((cell) => {
                  if (!['tableCell', 'tableHeader'].includes(cell.type))
                    throw new Error('表格单元格模型无效。');
                  checkAttrs(cell, ['colspan', 'rowspan', 'colwidth', 'backgroundColor']);
                  const background =
                    colour(cell.attrs?.backgroundColor) ||
                    (cell.type === 'tableHeader' ? '#f3f4f6' : undefined);
                  return new TableCell({
                    columnSpan: number(cell.attrs?.colspan ?? 1, '合并列数', 1, 100),
                    rowSpan: number(cell.attrs?.rowspan ?? 1, '合并行数', 1, 10000),
                    ...(background
                      ? { shading: { type: ShadingType.CLEAR, fill: background.slice(1) } }
                      : {}),
                    children: blocks(
                      cell.content?.length ? cell.content : [{ type: 'paragraph' }],
                      depth + 1
                    ),
                  });
                }),
              });
            }),
          })
        );
      } else throw new Error(`DOCX 导出尚未支持 ${node.type} 文档元素。`);
    }
    return result;
  };
  const children = blocks(document.content.content || [{ type: 'paragraph' }]);
  const header = document.header;
  const footer = document.footer;
  if ((header && header.type !== 'doc') || (footer && footer.type !== 'doc'))
    throw new Error('页眉页脚需要有效的 Word 文档模型。');
  const footerChildren = footer ? blocks(footer.content || [{ type: 'paragraph' }]) : [];
  if (document.pageNumbers && (!footer || !containsCurrentPageNumber(footer)))
    footerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT] })],
      })
    );
  const paper =
    document.page.size === 'Letter'
      ? [12240, 15840]
      : [Math.round(210 * TWIPS_PER_MM), Math.round(297 * TWIPS_PER_MM)];
  const file = new DocxDocument({
    creator: 'ZUI Office Studio',
    title: document.name,
    numbering: { config: numbering },
    styles: {
      default: {
        document: {
          run: { font: 'Noto Sans SC', size: 24, color: '1F2937' },
          paragraph: { spacing: { line: 420, after: 156 } },
        },
        heading1: {
          run: { font: 'Noto Sans SC', size: 48, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 480, after: 264 } },
        },
        heading2: {
          run: { font: 'Noto Sans SC', size: 40, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 400, after: 220 } },
        },
        heading3: {
          run: { font: 'Noto Sans SC', size: 32, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 320, after: 176 } },
        },
        heading4: {
          run: { font: 'Noto Sans SC', size: 28, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 280, after: 154 } },
        },
        heading5: {
          run: { font: 'Noto Sans SC', size: 26, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 260, after: 143 } },
        },
        heading6: {
          run: { font: 'Noto Sans SC', size: 24, bold: true, color: '1F2937' },
          paragraph: { spacing: { line: 324, before: 240, after: 132 } },
        },
      },
      paragraphStyles: [
        {
          id: 'ZuiQuote',
          name: 'ZUI Quote',
          basedOn: 'Normal',
          paragraph: {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: '1F2937' } },
          },
        },
        { id: 'ZuiRule', name: 'ZUI Rule', basedOn: 'Normal' },
      ],
    },
    sections: [
      {
        ...(header
          ? {
              headers: {
                default: new Header({
                  children: blocks(header.content || [{ type: 'paragraph' }]),
                }),
              },
            }
          : {}),
        ...(footerChildren.length
          ? { footers: { default: new Footer({ children: footerChildren }) } }
          : {}),
        properties: {
          page: {
            size: {
              width: paper[0],
              height: paper[1],
              orientation:
                document.page.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: margin,
              right: margin,
              bottom: margin,
              left: margin,
              ...(document.page.headerDistance !== undefined || header
                ? {
                    header: Math.round(
                      number(document.page.headerDistance ?? 12.5, '页眉距离', 0, 80) * TWIPS_PER_MM
                    ),
                  }
                : {}),
              ...(document.page.footerDistance !== undefined || footerChildren.length
                ? {
                    footer: Math.round(
                      number(document.page.footerDistance ?? 12.5, '页脚距离', 0, 80) * TWIPS_PER_MM
                    ),
                  }
                : {}),
            },
          },
        },
        children: children.length ? children : [new Paragraph('')],
      },
    ],
  });
  return new Blob([await Packer.toArrayBuffer(file)], { type: MIME });
}
