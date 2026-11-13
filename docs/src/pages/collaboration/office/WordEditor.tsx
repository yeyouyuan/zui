import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { exportWord, loadWord, type WordSource } from './word-document';
import type { EditorProps, WordChanges } from './office-model';

export default function WordEditor({
  source,
  changes,
  disabled,
  onChange,
  onExporter,
}: EditorProps<WordChanges>) {
  const [model, setModel] = useState<WordSource | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState('');
  const [fitWidth, setFitWidth] = useState(true);
  const [rendering, setRendering] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const updateScale = useRef<() => void>(() => {});
  useEffect(() => {
    const container = preview.current;
    if (!container) return;
    updateScale.current = () => {
      const content = viewport.current?.firstElementChild as HTMLElement | null;
      if (!content) return;
      const pages = content.querySelectorAll<HTMLElement>('section.office-docx');
      const width = Math.max(0, ...Array.from(pages, (page) => page.offsetWidth));
      const padding = getComputedStyle(container);
      const available =
        container.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
      content.style.zoom = String(fitWidth && width ? Math.min(1, available / width) : 1);
    };
    const observer = new ResizeObserver(() => updateScale.current());
    observer.observe(container);
    updateScale.current();
    return () => observer.disconnect();
  }, [fitWidth, model]);
  useEffect(() => {
    let active = true;
    void loadWord(source)
      .then((model) => {
        if (active) setModel(model);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [source]);
  useEffect(() => {
    onExporter(model && !error ? () => exportWord(source, changes) : null);
    return () => onExporter(null);
  }, [source, changes, model, error, onExporter]);
  useEffect(() => {
    if (!model) return;
    let active = true;
    const timer = setTimeout(() => {
      setRendering(true);
      const target = document.createElement('div');
      void exportWord(source, changes)
        .then((blob) =>
          renderAsync(blob, target, undefined, {
            className: 'office-docx',
            inWrapper: true,
            renderHeaders: false,
            renderFooters: false,
            renderComments: false,
            renderAltChunks: false,
            ignoreLastRenderedPageBreak: true,
            useBase64URL: true,
          })
        )
        .then(() => {
          if (active && viewport.current) {
            viewport.current.replaceChildren(target);
            updateScale.current();
            setRendering(false);
          }
        })
        .catch((error) => {
          if (active) {
            setError(error.message);
            setRendering(false);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [source, changes, model]);
  const current = model?.entries[selected];
  const candidates =
    model?.entries.filter(
      (entry) =>
        (entry.text || entry.index === selected) &&
        (!search || entry.text.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    ) ?? [];
  return (
    <>
      <p className="office-help">
        修改正文和表格内文字，预览会同步更新。原文件中的图片、样式与其他文档部分随 DOCX
        保留；浏览器分页可能与 Word 有差异。页眉、页脚和复杂对象请在 Word 中编辑。
      </p>
      {error && (
        <p className="office-error" role="alert">
          {error}
        </p>
      )}
      {!model && !error && (
        <p className="office-loading" role="status">
          正在解析 Word 文档…
        </p>
      )}
      {model && (
        <div className="office-word-layout">
          <aside className="office-word-inspector" aria-label="Word 文字编辑">
            <label>
              查找段落
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="office-paragraphs" role="group" aria-label="Word 段落列表">
              {candidates.slice(0, 200).map((entry) => (
                <button
                  key={entry.index}
                  type="button"
                  aria-pressed={selected === entry.index}
                  onClick={() => setSelected(entry.index)}
                >
                  <span>
                    {entry.table
                      ? '表格'
                      : entry.style.toLowerCase().includes('heading')
                        ? '标题'
                        : '段落'}{' '}
                    {entry.index + 1}
                  </span>
                  {changes.paragraphs[String(entry.index)] ?? entry.text ?? '空段落'}
                </button>
              ))}
              {candidates.length > 200 && <p>显示前 200 项，请搜索定位其他段落。</p>}
            </div>
            {current && (
              <label>
                编辑段落 {selected + 1}
                <textarea
                  aria-label={`编辑 Word 段落 ${selected + 1}`}
                  rows={7}
                  disabled={disabled}
                  value={changes.paragraphs[String(selected)] ?? current.text}
                  onChange={(event) =>
                    onChange({
                      paragraphs: { ...changes.paragraphs, [String(selected)]: event.target.value },
                    })
                  }
                />
              </label>
            )}
            <label>
              页面显示
              <select
                aria-label="Word 页面显示"
                value={fitWidth ? 'fit' : 'actual'}
                onChange={(event) => setFitWidth(event.target.value === 'fit')}
              >
                <option value="fit">适合宽度</option>
                <option value="actual">原始大小 · 100%</option>
              </select>
            </label>
          </aside>
          <div
            ref={preview}
            className="office-word-preview"
            role="region"
            tabIndex={0}
            aria-label="Word 页面预览"
            aria-busy={rendering}
          >
            {rendering && (
              <span className="office-preview-status" role="status">
                更新预览…
              </span>
            )}
            <div ref={viewport} />
          </div>
        </div>
      )}
    </>
  );
}
