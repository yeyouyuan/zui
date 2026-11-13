import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PageViewport,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '@zui/react';
import { exportPdf, loadPdfInfo, type PdfField } from './pdf-document';
import type { EditorProps, PdfChanges } from './office-model';

GlobalWorkerOptions.workerSrc = workerUrl;
export default function PdfEditor({
  source,
  changes,
  disabled,
  onChange,
  onExporter,
}: EditorProps<PdfChanges>) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fields, setFields] = useState<PdfField[]>([]);
  const [pages, setPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [mode, setMode] = useState<'read' | 'text' | 'highlight'>('read');
  const [text, setText] = useState('');
  const [size, setSize] = useState(16);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<PageViewport | null>(null);
  const [canvasAspect, setCanvasAspect] = useState(0.71);
  const [pageText, setPageText] = useState('');
  useEffect(() => {
    let active = true;
    void loadPdfInfo(source)
      .then((info) => {
        if (active) {
          setPages(info.pages);
          setFields(info.fields);
          setReady(true);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [source]);
  useEffect(() => {
    onExporter(ready ? () => exportPdf(source, changes) : null);
    return () => onExporter(null);
  }, [source, changes, ready, onExporter]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let loading: ReturnType<typeof getDocument> | undefined;
    const timer = setTimeout(() => {
      setRendering(true);
      setError('');
      void exportPdf(source, changes)
        .then((blob) => blob.arrayBuffer())
        .then((bytes) => {
          if (!active) return;
          loading = getDocument({
            data: new Uint8Array(bytes),
            disableWorkerRendering: true,
            cMapUrl: `${import.meta.env.BASE_URL}office-pdf-assets/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${import.meta.env.BASE_URL}office-pdf-assets/standard_fonts/`,
            wasmUrl: `${import.meta.env.BASE_URL}office-pdf-assets/wasm/`,
          });
          return loading.promise;
        })
        .then((result) => {
          if (result && active) setPdf(result);
        })
        .catch((error) => {
          if (active) {
            setError(error.message);
            setRendering(false);
          }
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      if (loading) void loading.destroy();
    };
  }, [source, changes, ready]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true);
    viewport.current = null;
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (!active || !canvas.current) return;
        const view = page.getViewport({ scale: 1.4 * zoom });
        const temporary = document.createElement('canvas');
        temporary.width = view.width;
        temporary.height = view.height;
        task = page.render({
          canvas: temporary,
          canvasContext: temporary.getContext('2d')!,
          viewport: view,
        });
        return task.promise.then(async () => {
          if (!active || !canvas.current) return;
          canvas.current.width = temporary.width;
          canvas.current.height = temporary.height;
          canvas.current.getContext('2d')!.drawImage(temporary, 0, 0);
          viewport.current = view;
          setCanvasAspect(view.width / view.height);
          setRendering(false);
          const text = await page.getTextContent();
          if (active)
            setPageText(text.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        });
      })
      .catch((error) => {
        if (active && error.name !== 'RenderingCancelledException') {
          setError(error.message);
          setRendering(false);
        }
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [pdf, pageNumber, zoom]);
  const addMark = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || mode === 'read' || rendering || !viewport.current || !canvas.current) return;
    if (mode === 'text' && !text.trim()) {
      setError('请先填写新增文字，再点击页面放置。');
      return;
    }
    const box = canvas.current.getBoundingClientRect();
    const [x, y] = viewport.current.convertToPdfPoint(
      ((event.clientX - box.left) * viewport.current.width) / box.width,
      ((event.clientY - box.top) * viewport.current.height) / box.height
    );
    onChange({
      ...changes,
      marks: [
        ...changes.marks,
        {
          id: crypto.randomUUID(),
          page: pageNumber - 1,
          type: mode,
          x,
          y,
          text: mode === 'text' ? text : '',
          size,
        },
      ],
    });
    setMode('read');
  };
  return (
    <>
      <p className="office-help">
        可填写 PDF
        表单、补充文字、添加高亮和旋转页面。原有正文暂不支持原位改写；新增标注可在保存前修改或移除。表单导出后保持可填写。
      </p>
      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      <div className="office-pdf-tools">
        <div role="group" aria-label="PDF 编辑工具">
          <Button
            size="sm"
            variant="outline"
            aria-pressed={mode === 'read'}
            onClick={() => setMode('read')}
          >
            阅读
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={mode === 'text'}
            disabled={disabled || !ready}
            onClick={() => setMode('text')}
          >
            添加文字
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={mode === 'highlight'}
            disabled={disabled || !ready}
            onClick={() => setMode('highlight')}
          >
            添加高亮
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !ready}
            onClick={() =>
              onChange({
                ...changes,
                rotations: {
                  ...changes.rotations,
                  [String(pageNumber - 1)]:
                    ((changes.rotations[String(pageNumber - 1)] ?? 0) + 90) % 360,
                },
              })
            }
          >
            旋转当前页
          </Button>
        </div>
        <label>
          缩放
          <select
            aria-label="PDF 缩放"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            <option value={0.8}>80%</option>
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
          </select>
        </label>
      </div>
      <div className="office-pdf-layout">
        <div
          className="office-pdf-viewport"
          role="region"
          tabIndex={0}
          aria-label="PDF 页面预览"
          aria-busy={rendering}
        >
          {rendering && (
            <span className="office-preview-status" role="status">
              正在渲染 PDF…
            </span>
          )}
          <div
            className="office-pdf-paper"
            style={{ aspectRatio: canvasAspect, width: `${zoom * 100}%` }}
          >
            <canvas
              ref={canvas}
              role="img"
              aria-label={`${pageNumber} / ${pages || '…'} 页 PDF 画布，下方可展开页面文字`}
              data-tool={mode}
              onClick={addMark}
            />
          </div>
          <div className="office-pdf-pagination">
            <Button
              size="sm"
              variant="outline"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((number) => number - 1)}
            >
              上一页
            </Button>
            <span>
              {pageNumber} / {pages || '…'} 页
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pageNumber >= pages}
              onClick={() => setPageNumber((number) => number + 1)}
            >
              下一页
            </Button>
          </div>
          <details className="office-pdf-page-text">
            <summary>页面文字</summary>
            <p>{pageText || '此页没有可提取的文字，可能为扫描图片。'}</p>
          </details>
        </div>
        <aside className="office-pdf-inspector" aria-label="PDF 标注与表单">
          <h3>补充与标注</h3>
          <label>
            新增文字
            <textarea
              aria-label="PDF 新增文字"
              disabled={disabled}
              rows={3}
              maxLength={1000}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <label>
            字号
            <input
              aria-label="PDF 新增文字字号"
              type="number"
              min={8}
              max={48}
              value={size}
              disabled={disabled}
              onChange={(event) =>
                setSize(Math.max(8, Math.min(48, Number(event.target.value) || 16)))
              }
            />
          </label>
          {mode !== 'read' && (
            <p className="office-notice">点击页面放置。键盘操作可使用下方“放在当前页左下角”。</p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !ready || !text.trim()}
            onClick={() => {
              onChange({
                ...changes,
                marks: [
                  ...changes.marks,
                  {
                    id: crypto.randomUUID(),
                    page: pageNumber - 1,
                    type: 'text',
                    x: 36,
                    y: 36,
                    text,
                    size,
                  },
                ],
              });
            }}
          >
            放在当前页左下角
          </Button>
          {changes.marks.map((mark, index) => (
            <div className="office-pdf-mark" key={mark.id}>
              <button type="button" onClick={() => setPageNumber(mark.page + 1)}>
                第 {mark.page + 1} 页 · {mark.type === 'text' ? '文字' : '高亮'} {index + 1}
              </button>
              {mark.type === 'text' && (
                <textarea
                  aria-label={`PDF 标注 ${index + 1}`}
                  disabled={disabled}
                  value={mark.text}
                  onChange={(event) =>
                    onChange({
                      ...changes,
                      marks: changes.marks.map((current) =>
                        current.id === mark.id ? { ...current, text: event.target.value } : current
                      ),
                    })
                  }
                />
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...changes,
                    marks: changes.marks.filter((current) => current.id !== mark.id),
                  })
                }
              >
                移除标注 {index + 1}
              </Button>
            </div>
          ))}
          <h3>表单字段</h3>
          {!fields.length && <p className="office-help">此文件没有可填写的 PDF 表单。</p>}
          {fields.map((field) => {
            const value = changes.fields[field.name] ?? field.value;
            return (
              <label key={field.name}>
                {field.name}
                {field.type === 'checkbox' ? (
                  <input
                    aria-label={`PDF 表单 ${field.name}`}
                    type="checkbox"
                    checked={Boolean(value)}
                    disabled={disabled || field.readOnly}
                    onChange={(event) =>
                      onChange({
                        ...changes,
                        fields: { ...changes.fields, [field.name]: event.target.checked },
                      })
                    }
                  />
                ) : field.type === 'choice' ? (
                  <select
                    aria-label={`PDF 表单 ${field.name}`}
                    value={String(value)}
                    disabled={disabled || field.readOnly}
                    onChange={(event) =>
                      onChange({
                        ...changes,
                        fields: { ...changes.fields, [field.name]: event.target.value },
                      })
                    }
                  >
                    <option value="">未选择</option>
                    {field.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`PDF 表单 ${field.name}`}
                    value={String(value)}
                    disabled={disabled || field.readOnly}
                    onChange={(event) =>
                      onChange({
                        ...changes,
                        fields: { ...changes.fields, [field.name]: event.target.value },
                      })
                    }
                  />
                )}
              </label>
            );
          })}
        </aside>
      </div>
    </>
  );
}
