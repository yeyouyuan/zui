import JSZip from 'jszip';
import type { WordChanges } from './office-model';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export interface WordParagraph {
  index: number;
  text: string;
  style: string;
  table: boolean;
}
export interface WordSource {
  zip: JSZip;
  document: XMLDocument;
  paragraphs: Element[];
  entries: WordParagraph[];
}
function tokenText(token: Element): string {
  return token.localName === 'br'
    ? '\n'
    : token.localName === 'tab'
      ? '\t'
      : (token.textContent ?? '');
}
function paragraphTexts(paragraph: Element): Element[] {
  return Array.from(paragraph.getElementsByTagNameNS(W, '*')).filter((text) => {
    if (!['t', 'br', 'tab'].includes(text.localName)) return false;
    let parent = text.parentElement;
    while (parent && parent !== paragraph) {
      if (parent.namespaceURI === W && parent.localName === 'p') return false;
      parent = parent.parentElement;
    }
    return true;
  });
}
export async function loadWord(source: Blob): Promise<WordSource> {
  const zip = await JSZip.loadAsync(await source.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('未找到 Word 正文。请使用有效的 .docx 文件；旧版 .doc 请先转换。');
  const xml = await file.async('string');
  if (xml.length > 12 * 1024 * 1024)
    throw new Error('Word 正文过大，当前编辑器支持 12 MB 以内的正文 XML。');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length)
    throw new Error('Word 正文结构无法解析。');
  const body = document.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('Word 文档缺少正文。');
  const paragraphs = Array.from(body.getElementsByTagNameNS(W, 'p'));
  if (paragraphs.length > 10000) throw new Error('当前 Word 编辑器最多支持 10,000 个段落。');
  const entries = paragraphs.map((paragraph, index) => ({
    index,
    text: paragraphTexts(paragraph).map(tokenText).join(''),
    style: paragraph.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') ?? '',
    table: (() => {
      let parent = paragraph.parentElement;
      while (parent && parent !== body) {
        if (parent.namespaceURI === W && parent.localName === 'tc') return true;
        parent = parent.parentElement;
      }
      return false;
    })(),
  }));
  return { zip, document, paragraphs, entries };
}

/** Edit the smallest differing interval, preserving unaffected runs and ZIP parts. */
export async function exportWord(source: Blob, changes: WordChanges): Promise<Blob> {
  const model = await loadWord(source);
  for (const [key, value] of Object.entries(changes.paragraphs)) {
    const paragraph = model.paragraphs[Number(key)];
    if (!paragraph) throw new Error('草稿指向不存在的 Word 段落。');
    const texts = paragraphTexts(paragraph);
    const original = texts.map(tokenText).join('');
    if (value === original) continue;
    if (!texts.length) {
      const run = model.document.createElementNS(W, 'w:r');
      const text = model.document.createElementNS(W, 'w:t');
      run.append(text);
      paragraph.append(run);
      texts.push(text);
    }
    let start = 0,
      end = 0;
    while (start < original.length && start < value.length && original[start] === value[start])
      start++;
    while (
      end < original.length - start &&
      end < value.length - start &&
      original[original.length - end - 1] === value[value.length - end - 1]
    )
      end++;
    const inserted = value.slice(start, value.length - end);
    const removedEnd = original.length - end;
    let offset = 0,
      applied = false;
    texts.forEach((text, index) => {
      const old = tokenText(text);
      const nextOffset = offset + old.length;
      const receivesInsertion = !applied && (start < nextOffset || index === texts.length - 1);
      const before = old.slice(0, Math.max(0, Math.min(old.length, start - offset)));
      const after = old.slice(Math.max(0, Math.min(old.length, removedEnd - offset)));
      if ((nextOffset > start && offset < removedEnd) || receivesInsertion) {
        const replacement = before + (receivesInsertion ? inserted : '') + after;
        const fragment = model.document.createDocumentFragment();
        for (const part of replacement.split(/(\n|\t)/)) {
          const node = model.document.createElementNS(
            W,
            part === '\n' ? 'w:br' : part === '\t' ? 'w:tab' : 'w:t'
          );
          if (node.localName === 't') {
            node.textContent = part;
            node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
          }
          fragment.append(node);
        }
        text.replaceWith(fragment);
      }
      if (receivesInsertion) applied = true;
      offset = nextOffset;
    });
  }
  model.zip.file('word/document.xml', new XMLSerializer().serializeToString(model.document));
  return model.zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
