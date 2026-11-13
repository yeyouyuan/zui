'use client';

import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { StudioPdfRenderer, StudioPdfSearchResult, StudioPdfSession } from '@zui/react';

GlobalWorkerOptions.workerSrc = workerUrl;

const abortError = () => new DOMException('PDF 页面渲染已取消。', 'AbortError');
const quarterTurn = (angle: number) => ((angle % 360) + 360) % 360;

interface PendingRender {
  cancelled: boolean;
  task?: RenderTask;
  cancel(): void;
}

interface SearchSegment {
  from: number;
  to: number;
  rect: StudioPdfSearchResult['rect'];
}

const searchable = (text: string) =>
  text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');

function textRectangle(item: TextItem, ascent = 0.8, descent = -0.2) {
  const [a, b, c, d, x, y] = item.transform;
  const baseLength = Math.hypot(a, b) || 1;
  const upLength = Math.hypot(c, d) || 1;
  const base = [a / baseLength, b / baseLength];
  const up = [c / upLength, d / upLength];
  const height = Math.abs(item.height) || upLength;
  const width = Math.abs(item.width);
  const points = [0, width].flatMap((along) =>
    [descent * height, ascent * height].map((above) => [
      x + base[0] * along + up[0] * above,
      y + base[1] * along + up[1] * above,
    ])
  );
  const left = Math.min(...points.map((point) => point[0]));
  const bottom = Math.min(...points.map((point) => point[1]));
  return {
    x: left,
    y: bottom,
    width: Math.max(...points.map((point) => point[0])) - left,
    height: Math.max(...points.map((point) => point[1])) - bottom,
  };
}

function combinedRectangle(segments: SearchSegment[]) {
  const left = Math.min(...segments.map(({ rect }) => rect.x));
  const bottom = Math.min(...segments.map(({ rect }) => rect.y));
  return {
    x: left,
    y: bottom,
    width: Math.max(...segments.map(({ rect }) => rect.x + rect.width)) - left,
    height: Math.max(...segments.map(({ rect }) => rect.y + rect.height)) - bottom,
  };
}

/** PDF.js and its worker/assets belong to the host, never to the UI package. */
export const studioPdfRenderer: StudioPdfRenderer = {
  async load(source): Promise<StudioPdfSession> {
    if (!source.size || source.size > 50 * 1024 * 1024)
      throw new Error('请选择非空且不超过 50 MB 的 PDF 文件。');
    const loading = getDocument({
      data: new Uint8Array(await source.arrayBuffer()),
      disableWorkerRendering: true,
      cMapUrl: `${import.meta.env.BASE_URL}office-pdf-assets/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${import.meta.env.BASE_URL}office-pdf-assets/standard_fonts/`,
      wasmUrl: `${import.meta.env.BASE_URL}office-pdf-assets/wasm/`,
    });
    let pdf;
    try {
      pdf = await loading.promise;
      if (pdf.numPages < 1 || pdf.numPages > 200)
        throw new Error('当前 PDF 编辑器支持 1 至 200 页。');
    } catch (error) {
      void loading.destroy().catch(() => undefined);
      if (error instanceof Error && error.name === 'PasswordException')
        throw new Error('此 PDF 已加密，请先解除密码保护后再编辑。');
      throw error;
    }

    let destroyed = false;
    let disposing: Promise<void> | undefined;
    const pending = new Map<HTMLCanvasElement, PendingRender>();
    const textCache = new Map<number, { text: string; segments: SearchSegment[] }>();

    return {
      pageCount: pdf.numPages,
      async search(query, options = {}) {
        const assertCurrent = () => {
          if (destroyed || options.signal?.aborted) throw abortError();
        };
        assertCurrent();
        if (typeof query !== 'string' || query.length > 256)
          throw new Error('PDF 查找文字最多支持 256 个字符。');
        const needle = searchable(query).trim();
        if (!needle) return [];
        const results: StudioPdfSearchResult[] = [];
        for (let pageIndex = 0; pageIndex < pdf.numPages && results.length < 1000; pageIndex++) {
          assertCurrent();
          let content = textCache.get(pageIndex);
          if (!content) {
            const page = await pdf.getPage(pageIndex + 1);
            assertCurrent();
            const extracted = await page.getTextContent();
            assertCurrent();
            let text = '';
            const segments: SearchSegment[] = [];
            for (const item of extracted.items) {
              if (!('str' in item) || !item.str) continue;
              const normalized = searchable(item.str);
              if (text.endsWith(' ') && normalized.startsWith(' ')) text = text.slice(0, -1);
              const from = text.length;
              text += normalized;
              const style = extracted.styles[item.fontName];
              const rect = textRectangle(item, style?.ascent, style?.descent);
              if (Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0)
                segments.push({ from, to: text.length, rect });
              if (item.hasEOL && !text.endsWith(' ')) text += ' ';
              if (text.length > 1_000_000) throw new Error('此 PDF 页面文字过多，无法完整查找。');
            }
            content = { text, segments };
            // Keep searches bounded even when a document has hundreds of text-heavy pages.
            if (textCache.size >= 8) textCache.delete(textCache.keys().next().value!);
            textCache.set(pageIndex, content);
          }
          let index = 0;
          while (results.length < 1000 && (index = content.text.indexOf(needle, index)) >= 0) {
            const matched = content.segments.filter(
              (segment) => segment.from < index + needle.length && segment.to > index
            );
            if (matched.length)
              results.push({
                page: pageIndex,
                text: content.text
                  .slice(Math.max(0, index - 24), index + needle.length + 40)
                  .trim(),
                rect: combinedRectangle(matched),
              });
            index += Math.max(1, needle.length);
          }
        }
        assertCurrent();
        return results;
      },
      async render(pageIndex, canvas, options) {
        if (destroyed || options.signal?.aborted) throw abortError();
        if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pdf.numPages)
          throw new Error('PDF 页码无效。');
        if (!Number.isFinite(options.scale) || options.scale < 0.25 || options.scale > 4)
          throw new Error('PDF 缩放须在 25% 至 400% 之间。');
        if (!Number.isFinite(options.rotation) || options.rotation % 90 !== 0)
          throw new Error('PDF 页面旋转须为 90 度的整数倍。');

        pending.get(canvas)?.cancel();
        const request: PendingRender = {
          cancelled: false,
          cancel() {
            this.cancelled = true;
            this.task?.cancel();
          },
        };
        pending.set(canvas, request);
        const cancel = () => request.cancel();
        options.signal?.addEventListener('abort', cancel, { once: true });
        const assertCurrent = () => {
          if (
            destroyed ||
            request.cancelled ||
            options.signal?.aborted ||
            pending.get(canvas) !== request
          )
            throw abortError();
        };

        try {
          const page = await pdf.getPage(pageIndex + 1);
          assertCurrent();
          const viewport = page.getViewport({
            scale: options.scale,
            rotation: quarterTurn(page.rotate + options.rotation),
          });
          if (
            !Number.isFinite(viewport.width) ||
            !Number.isFinite(viewport.height) ||
            viewport.width <= 0 ||
            viewport.height <= 0 ||
            viewport.width > 16384 ||
            viewport.height > 16384 ||
            viewport.width * viewport.height > 16_000_000
          )
            throw new Error('此页尺寸过大，请降低缩放比例后重试。');

          const desiredRatio = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
          const ratio = Math.min(
            desiredRatio,
            Math.sqrt(16_000_000 / (viewport.width * viewport.height)),
            16384 / viewport.width,
            16384 / viewport.height
          );
          const temporary = canvas.ownerDocument.createElement('canvas');
          temporary.width = Math.ceil(viewport.width * ratio);
          temporary.height = Math.ceil(viewport.height * ratio);
          const context = temporary.getContext('2d');
          if (!context) throw new Error('当前环境无法创建 PDF 画布。');
          request.task = page.render({
            canvas: temporary,
            canvasContext: context,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          });
          await request.task.promise;
          assertCurrent();

          const destination = canvas.getContext('2d');
          if (!destination) throw new Error('当前环境无法显示 PDF 画布。');
          canvas.width = temporary.width;
          canvas.height = temporary.height;
          destination.drawImage(temporary, 0, 0);
          return {
            width: viewport.width,
            height: viewport.height,
            toPdfPoint: (x, y) => viewport.convertToPdfPoint(x, y) as [number, number],
            toViewportPoint: (x, y) => viewport.convertToViewportPoint(x, y) as [number, number],
          };
        } catch (error) {
          if (request.cancelled || destroyed || options.signal?.aborted) throw abortError();
          throw error;
        } finally {
          options.signal?.removeEventListener('abort', cancel);
          if (pending.get(canvas) === request) pending.delete(canvas);
        }
      },
      destroy() {
        if (!destroyed) {
          destroyed = true;
          for (const request of pending.values()) request.cancel();
          pending.clear();
          textCache.clear();
          disposing = loading.destroy();
        }
        return disposing;
      },
    };
  },
};
