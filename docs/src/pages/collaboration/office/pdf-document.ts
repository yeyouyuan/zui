import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  degrees,
  rgb,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PdfChanges } from './office-model';

export interface PdfField {
  name: string;
  type: 'text' | 'checkbox' | 'choice';
  value: string | boolean;
  options?: string[];
  readOnly: boolean;
}
let fontBytes: Promise<ArrayBuffer> | undefined;
async function chineseFont() {
  if (!fontBytes)
    fontBytes = fetch(`${import.meta.env.BASE_URL}office-pdf-assets/NotoSansSC.ttf`)
      .then((response) => {
        if (!response.ok) throw new Error('中文字体加载失败，请重试。');
        return response.arrayBuffer();
      })
      .catch((error) => {
        fontBytes = undefined;
        throw error;
      });
  return fontBytes;
}
export async function loadPdfInfo(source: Blob): Promise<{ pages: number; fields: PdfField[] }> {
  const document = await PDFDocument.load(await source.arrayBuffer(), { updateMetadata: false });
  if (document.getPageCount() > 200) throw new Error('当前 PDF 编辑器支持最多 200 页。');
  const fields = document
    .getForm()
    .getFields()
    .flatMap((field): PdfField[] => {
      const base = { name: field.getName(), readOnly: field.isReadOnly() };
      if (field instanceof PDFTextField)
        return [{ ...base, type: 'text', value: field.getText() ?? '' }];
      if (field instanceof PDFCheckBox)
        return [{ ...base, type: 'checkbox', value: field.isChecked() }];
      if (field instanceof PDFDropdown)
        return [
          {
            ...base,
            type: 'choice',
            value: field.getSelected()[0] ?? '',
            options: field.getOptions(),
          },
        ];
      if (field instanceof PDFRadioGroup)
        return [
          {
            ...base,
            type: 'choice',
            value: field.getSelected() ?? '',
            options: field.getOptions(),
          },
        ];
      return [];
    });
  return { pages: document.getPageCount(), fields };
}
export async function exportPdf(source: Blob, changes: PdfChanges): Promise<Blob> {
  if (
    !changes.marks.length &&
    !Object.keys(changes.rotations).length &&
    !Object.keys(changes.fields).length
  )
    return source;
  const document = await PDFDocument.load(await source.arrayBuffer(), { updateMetadata: false });
  document.registerFontkit(fontkit);
  const needsFont =
    changes.marks.some((mark) => mark.type === 'text') || Object.keys(changes.fields).length > 0;
  const font = needsFont
    ? // Fontkit subsetting loses some glyph outlines in this font, despite valid text extraction.
      // Embed the full reconstructed TrueType font so form appearances and Chinese marks render.
      await document.embedFont(await chineseFont(), { subset: false })
    : undefined;
  for (const [index, rotation] of Object.entries(changes.rotations)) {
    const page = document.getPages()[Number(index)];
    if (!page) throw new Error('草稿指向不存在的 PDF 页面。');
    page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
  }
  for (const mark of changes.marks) {
    const page = document.getPages()[mark.page];
    if (!page) throw new Error('标注指向不存在的 PDF 页面。');
    if (mark.x < 0 || mark.y < 0 || mark.x > page.getWidth() || mark.y > page.getHeight())
      throw new Error('标注位置超出 PDF 页面。');
    if (mark.type === 'highlight') {
      page.drawRectangle({
        x: mark.x,
        y: mark.y,
        width: Math.min(160, page.getWidth() - mark.x),
        height: Math.min(20, page.getHeight() - mark.y),
        color: rgb(1, 0.78, 0.16),
        opacity: 0.3,
      });
    } else if (mark.text && font) {
      const characters = new Set(font.getCharacterSet());
      if (
        [...mark.text].some(
          (character) => character !== '\n' && !characters.has(character.codePointAt(0)!)
        )
      )
        throw new Error('新增文字含有当前字体未覆盖的字符，请替换该字符后再保存。');
      page.drawText(mark.text, {
        x: mark.x,
        y: mark.y,
        font,
        size: mark.size,
        color: rgb(0.13, 0.2, 0.3),
        maxWidth: Math.max(10, page.getWidth() - mark.x - 12),
        lineHeight: mark.size * 1.35,
      });
    }
  }
  const form = document.getForm();
  for (const [name, value] of Object.entries(changes.fields)) {
    const field = form.getField(name);
    if (field.isReadOnly()) throw new Error(`${name} 是只读表单字段。`);
    if (field instanceof PDFTextField && typeof value === 'string') field.setText(value);
    else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFDropdown && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else throw new Error(`${name} 的表单值无效。`);
  }
  if (Object.keys(changes.fields).length && font) form.updateFieldAppearances(font);
  return new Blob([new Uint8Array(await document.save({ updateFieldAppearances: false }))], {
    type: 'application/pdf',
  });
}
