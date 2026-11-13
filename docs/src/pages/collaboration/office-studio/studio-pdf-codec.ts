'use client';

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFName,
  EncryptedPDFError,
  StandardFonts,
  LineCapStyle,
  LineJoinStyle,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  setLineWidth,
  setLineCap,
  setLineJoin,
  setStrokingRgbColor,
  moveTo,
  lineTo,
  stroke,
  type PDFField,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { StudioPdfDocument, StudioPdfField, StudioPdfMark } from '@zui/react';

const MAX_PAGES = 200;
const quarterTurn = (angle: number) => ((angle % 360) + 360) % 360;
let fontBytes: Promise<ArrayBuffer> | undefined;

async function loadSource(source: Blob) {
  if (!source.size || source.size > 50 * 1024 * 1024)
    throw new Error('请选择非空且不超过 50 MB 的 PDF 文件。');
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(await source.arrayBuffer(), { updateMetadata: false });
  } catch (error) {
    if (
      error instanceof EncryptedPDFError ||
      // pdf-lib's ES5 Error subclasses can lose their name and prototype.
      (error instanceof Error &&
        error.message.startsWith('Input document to `PDFDocument.load` is encrypted.'))
    )
      throw new Error('此 PDF 已加密，请先解除密码保护后再编辑。');
    throw new Error('无法读取此 PDF，文件可能损坏或格式不受支持。');
  }
  if (pdf.getPageCount() < 1 || pdf.getPageCount() > MAX_PAGES)
    throw new Error('当前 PDF 编辑器支持 1 至 200 页。');
  // getForm() deletes XFA automatically, so inspect the source dictionary first.
  if (pdf.catalog.AcroForm()?.has(PDFName.of('XFA')))
    throw new Error('此 PDF 使用 XFA 动态表单，当前编辑器暂不支持。');
  for (const page of pdf.getPages()) {
    if (!Number.isFinite(page.getRotation().angle) || page.getRotation().angle % 90 !== 0)
      throw new Error('PDF 含有不受支持的页面旋转。');
    pageBounds(page);
  }
  return pdf;
}

function pageBounds(page: PDFPage) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const left = Math.max(media.x, crop.x);
  const bottom = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  if (![left, bottom, right, top].every(Number.isFinite) || right <= left || top <= bottom)
    throw new Error('PDF 页面边界无效。');
  return { left, bottom, right, top };
}

function readWidgets(pdf: PDFDocument, field: PDFField): NonNullable<StudioPdfField['widgets']> {
  const pages = pdf.getPages();
  return field.acroField.getWidgets().flatMap((widget, widgetIndex) => {
    // Hidden/NoView widgets retain their original data but have no visual control.
    if (widget.getFlags() & (2 | 32)) return [];
    const pageRef = widget.P();
    const page = pages.findIndex(
      (entry) =>
        (pageRef && entry.ref.toString() === pageRef.toString()) ||
        entry.node
          .Annots()
          ?.asArray()
          .some((ref) => pdf.context.lookup(ref) === widget.dict)
    );
    const rectangle = widget.getRectangle();
    if (page < 0) throw new Error(`表单“${field.getName()}”的控件未关联页面，无法进行页面内编辑。`);
    if (
      !Object.values(rectangle).every(Number.isFinite) ||
      rectangle.width <= 0 ||
      rectangle.height <= 0
    )
      throw new Error(`表单“${field.getName()}”含有无效的控件位置。`);
    const angle = widget.getAppearanceCharacteristics()?.getRotation() ?? 0;
    if (!Number.isFinite(angle) || angle % 90 !== 0)
      throw new Error(`表单“${field.getName()}”含有不受支持的控件旋转。`);
    const option = field instanceof PDFRadioGroup ? field.getOptions()[widgetIndex] : undefined;
    if (field instanceof PDFRadioGroup && option === undefined)
      throw new Error(`单选表单“${field.getName()}”的控件选项不完整。`);
    return [
      {
        page,
        ...rectangle,
        rotation: quarterTurn(angle),
        ...(option === undefined ? {} : { option }),
      },
    ];
  });
}

function readFields(pdf: PDFDocument): StudioPdfField[] {
  const names = new Set<string>();
  return pdf
    .getForm()
    .getFields()
    .map((field): StudioPdfField => {
      const name = field.getName();
      if (!name || names.has(name)) throw new Error('PDF 含有重复或空的表单字段名称。');
      names.add(name);
      const base = { name, readOnly: field.isReadOnly() };
      let result: StudioPdfField;
      if (field instanceof PDFTextField) {
        if (field.isRichFormatted() || field.isPassword() || field.isFileSelector())
          throw new Error(`表单“${name}”使用富文本、密码或文件选择功能，当前编辑器暂不支持。`);
        const value = field.getText() ?? '';
        if (value.length > 10_000 || (!field.isMultiline() && /[\r\n]/.test(value)))
          throw new Error(`表单“${name}”的文字长度或换行状态暂不支持完整编辑。`);
        result = {
          ...base,
          type: 'text',
          value,
          multiline: field.isMultiline(),
        };
      } else if (field instanceof PDFCheckBox) {
        result = { ...base, type: 'checkbox', value: field.isChecked() };
      } else if (field instanceof PDFDropdown) {
        if (field.isMultiselect() || field.isEditable() || field.getSelected().length > 1)
          throw new Error(`表单“${name}”使用多选或可编辑下拉框，当前编辑器暂不支持。`);
        if (
          field.acroField
            .getOptions()
            .some(
              (option) =>
                option.display && option.display.decodeText() !== option.value.decodeText()
            )
        )
          throw new Error(`表单“${name}”的显示标签与存储值不同，当前编辑器暂不支持完整编辑。`);
        if (field.getSelected().some((value) => !field.getOptions().includes(value)))
          throw new Error(`表单“${name}”包含未定义的选中值，当前编辑器暂不支持完整编辑。`);
        result = {
          ...base,
          type: 'choice',
          value: field.getSelected()[0] ?? '',
          options: field.getOptions(),
        };
      } else if (field instanceof PDFRadioGroup) {
        result = {
          ...base,
          type: 'choice',
          value: field.getSelected() ?? '',
          options: field.getOptions(),
        };
      } else {
        throw new Error(`表单“${name}”包含签名、按钮或列表等不受支持的字段，无法完整编辑此 PDF。`);
      }
      result.widgets = readWidgets(pdf, field);
      return result;
    });
}

export async function importStudioPdf(source: Blob, name: string): Promise<StudioPdfDocument> {
  const pdf = await loadSource(source);
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || '文档.pdf',
    kind: 'pdf',
    pageCount: pdf.getPageCount(),
    marks: [],
    rotations: {},
    fields: readFields(pdf),
  };
}

function color(value: string | undefined, fallback: string) {
  const hex = value ?? fallback;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('PDF 标注颜色须为六位十六进制色值。');
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255
  );
}

function validateMark(mark: StudioPdfMark, pdf: PDFDocument, ids: Set<string>) {
  if (
    !mark ||
    typeof mark.id !== 'string' ||
    !mark.id ||
    ids.has(mark.id) ||
    !Number.isInteger(mark.page) ||
    mark.page < 0 ||
    mark.page >= pdf.getPageCount() ||
    !['text', 'highlight', 'rectangle', 'ink'].includes(mark.type) ||
    ![mark.x, mark.y, mark.size].every(Number.isFinite) ||
    mark.size < 6 ||
    mark.size > 144 ||
    typeof mark.text !== 'string' ||
    mark.text.length > 10_000
  )
    throw new Error('PDF 标注数据无效。');
  ids.add(mark.id);
  color(mark.color, mark.type === 'highlight' ? '#f5c542' : '#253044');
  const box = pageBounds(pdf.getPages()[mark.page]);
  if (mark.x < box.left || mark.y < box.bottom || mark.x > box.right || mark.y > box.top)
    throw new Error('标注位置超出 PDF 可见页面。');
  if (mark.type === 'highlight' || mark.type === 'rectangle') {
    const width = mark.width ?? 120;
    const height = mark.height ?? 18;
    const border = mark.type === 'rectangle' ? (mark.lineWidth ?? 2) / 2 : 0;
    if (
      ![width, height].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      mark.x - border < box.left - 0.01 ||
      mark.y - border < box.bottom - 0.01 ||
      mark.x + width + border > box.right + 0.01 ||
      mark.y + height + border > box.top + 0.01
    )
      throw new Error('绘图标注尺寸超出 PDF 可见页面。');
  }
  if (mark.type === 'rectangle' || mark.type === 'ink') {
    const width = mark.lineWidth ?? 2;
    if (!Number.isFinite(width) || width < 0.5 || width > 40)
      throw new Error('PDF 绘图线宽须在 0.5 至 40 点之间。');
    if (
      mark.type === 'ink' &&
      (!Array.isArray(mark.points) ||
        mark.points.length < 2 ||
        mark.points.length > 10000 ||
        mark.points.some(
          (point) =>
            !Array.isArray(point) ||
            point.length !== 2 ||
            !point.every(Number.isFinite) ||
            point[0] - width / 2 < box.left - 0.01 ||
            point[0] + width / 2 > box.right + 0.01 ||
            point[1] - width / 2 < box.bottom - 0.01 ||
            point[1] + width / 2 > box.top + 0.01
        ))
    )
      throw new Error('PDF 笔迹必须包含 2 至 10,000 个页面范围内的有效坐标。');
  }
}

async function annotationFont(pdf: PDFDocument, texts: string[]): Promise<PDFFont | undefined> {
  if (!texts.length) return undefined;
  let font: PDFFont;
  if (
    texts.some((text) =>
      [...text].some(
        (character) =>
          character !== '\n' &&
          character !== '\r' &&
          (character.codePointAt(0)! < 32 || character.codePointAt(0)! > 126)
      )
    )
  ) {
    if (!fontBytes) {
      fontBytes = fetch(`${import.meta.env.BASE_URL}office-pdf-assets/NotoSansSC.ttf`)
        .then((response) => {
          if (!response.ok) throw new Error('中文字体加载失败，请重试。');
          return response.arrayBuffer();
        })
        .catch((error) => {
          fontBytes = undefined;
          throw error;
        });
    }
    pdf.registerFontkit(fontkit);
    // The reconstructed Noto font must retain its outlines; subsetting loses glyphs.
    font = await pdf.embedFont(await fontBytes, { subset: false });
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
  }
  const characters = new Set(font.getCharacterSet());
  if (
    texts.some((text) =>
      [...text].some(
        (character) =>
          character !== '\n' && character !== '\r' && !characters.has(character.codePointAt(0)!)
      )
    )
  )
    throw new Error('新增文字或表单值包含当前字体未覆盖的字符，请替换后再保存。');
  return font;
}

function sameWidgets(left: StudioPdfField['widgets'], right: StudioPdfField['widgets']) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((widget, index) => {
      const other = right[index];
      return (
        other &&
        widget.page === other.page &&
        widget.x === other.x &&
        widget.y === other.y &&
        widget.width === other.width &&
        widget.height === other.height &&
        (widget.rotation ?? 0) === (other.rotation ?? 0) &&
        widget.option === other.option
      );
    })
  );
}

/** Apply changes to the original PDF's page streams and original AcroForm. */
export async function exportStudioPdf(document: StudioPdfDocument, source: Blob): Promise<Blob> {
  const pdf = await loadSource(source);
  const originalFields = readFields(pdf);
  if (
    document.version !== 1 ||
    document.kind !== 'pdf' ||
    document.pageCount !== pdf.getPageCount() ||
    !Array.isArray(document.marks) ||
    document.marks.length > 2000 ||
    !Array.isArray(document.fields) ||
    document.fields.length !== originalFields.length ||
    !document.rotations ||
    typeof document.rotations !== 'object' ||
    Array.isArray(document.rotations)
  )
    throw new Error('PDF 草稿与原文件不匹配。');

  const ids = new Set<string>();
  document.marks.forEach((mark) => validateMark(mark, pdf, ids));
  if (document.marks.reduce((total, mark) => total + (mark.points?.length ?? 0), 0) > 100_000)
    throw new Error('PDF 笔迹点数过多，当前最多支持 100,000 个坐标。');
  const rotations = Object.entries(document.rotations).map(([key, angle]) => {
    const page = Number(key);
    if (
      !Number.isInteger(page) ||
      String(page) !== key ||
      page < 0 ||
      page >= pdf.getPageCount() ||
      !Number.isFinite(angle) ||
      angle % 90 !== 0
    )
      throw new Error('PDF 草稿包含无效的页面旋转。');
    return { page, angle: quarterTurn(angle) };
  });

  const changedFields: StudioPdfField[] = [];
  const fieldNames = new Set<string>();
  for (const field of document.fields) {
    const original = originalFields.find((entry) => entry.name === field.name);
    if (
      !original ||
      fieldNames.has(field.name) ||
      field.type !== original.type ||
      field.readOnly !== original.readOnly ||
      JSON.stringify(field.options) !== JSON.stringify(original.options) ||
      (field.multiline !== undefined && field.multiline !== original.multiline) ||
      (field.widgets !== undefined && !sameWidgets(field.widgets, original.widgets)) ||
      typeof field.value !== typeof original.value ||
      (typeof field.value === 'string' && field.value.length > 10_000)
    )
      throw new Error('PDF 草稿的表单结构或字段值与原文件不匹配。');
    fieldNames.add(field.name);
    if (field.value !== original.value) {
      if (original.readOnly) throw new Error(`表单“${field.name}”为只读，不能修改。`);
      if (
        field.type === 'choice' &&
        field.value !== '' &&
        !original.options?.includes(String(field.value))
      )
        throw new Error(`表单“${field.name}”的选项无效。`);
      const native = pdf.getForm().getField(field.name);
      if (
        native instanceof PDFTextField &&
        native.getMaxLength() !== undefined &&
        String(field.value).length > native.getMaxLength()!
      )
        throw new Error(`表单“${field.name}”超过原字段允许的文字长度。`);
      changedFields.push(field);
    }
  }

  if (!document.marks.length && !rotations.some((entry) => entry.angle) && !changedFields.length)
    return source;
  const form = pdf.getForm();
  const texts = [
    ...document.marks.filter((mark) => mark.type === 'text' && mark.text).map((mark) => mark.text),
    ...changedFields
      .filter((field) => {
        const native = form.getField(field.name);
        return native instanceof PDFTextField || native instanceof PDFDropdown;
      })
      .map((field) => String(field.value)),
  ];
  const font = await annotationFont(pdf, texts);
  for (const entry of rotations) {
    const page = pdf.getPages()[entry.page];
    page.setRotation(degrees(quarterTurn(page.getRotation().angle + entry.angle)));
  }
  for (const mark of document.marks) {
    const page = pdf.getPages()[mark.page];
    if (mark.type === 'highlight') {
      page.drawRectangle({
        x: mark.x,
        y: mark.y,
        width: mark.width ?? 120,
        height: mark.height ?? 18,
        color: color(mark.color, '#f5c542'),
        opacity: 0.3,
      });
    } else if (mark.type === 'rectangle') {
      page.drawRectangle({
        x: mark.x,
        y: mark.y,
        width: mark.width ?? 120,
        height: mark.height ?? 18,
        borderColor: color(mark.color, '#253044'),
        borderWidth: mark.lineWidth ?? 2,
      });
    } else if (mark.type === 'ink') {
      const points = mark.points!;
      const ink = color(mark.color, '#253044');
      page.pushOperators(
        pushGraphicsState(),
        setLineWidth(mark.lineWidth ?? 2),
        setLineCap(LineCapStyle.Round),
        setLineJoin(LineJoinStyle.Round),
        setStrokingRgbColor(ink.red, ink.green, ink.blue),
        moveTo(points[0][0], points[0][1]),
        ...points.slice(1).map(([x, y]) => lineTo(x, y)),
        stroke(),
        popGraphicsState()
      );
    } else if (mark.text && font) {
      const text = mark.text.replace(/\r\n?/g, '\n');
      const box = pageBounds(page);
      const lines = text.split('\n');
      const ascent = font.heightAtSize(mark.size, { descender: false });
      const descent = font.heightAtSize(mark.size) - ascent;
      if (
        lines.some((line) => font.widthOfTextAtSize(line, mark.size) > box.right - mark.x + 0.01) ||
        mark.y + ascent > box.top + 0.01 ||
        mark.y - (lines.length - 1) * mark.size * 1.35 - descent < box.bottom - 0.01
      )
        throw new Error('文字标注超出 PDF 可见页面，请移动位置、缩小字号或换行后保存。');
      page.drawText(text, {
        x: mark.x,
        y: mark.y,
        font,
        size: mark.size,
        color: color(mark.color, '#253044'),
        lineHeight: mark.size * 1.35,
      });
    }
  }

  for (const field of changedFields) {
    const native = form.getField(field.name);
    if (native instanceof PDFTextField) {
      native.setText(String(field.value));
      if (font) native.updateAppearances(font);
    } else if (native instanceof PDFCheckBox) {
      if (field.value) native.check();
      else native.uncheck();
      if (native.needsAppearancesUpdate()) native.updateAppearances();
    } else if (native instanceof PDFDropdown) {
      if (field.value) native.select(String(field.value));
      else native.clear();
      if (font) native.updateAppearances(font);
    } else if (native instanceof PDFRadioGroup) {
      if (field.value) native.select(String(field.value));
      else native.clear();
      if (native.needsAppearancesUpdate()) native.updateAppearances();
    }
  }
  return new Blob([new Uint8Array(await pdf.save({ updateFieldAppearances: false }))], {
    type: 'application/pdf',
  });
}
