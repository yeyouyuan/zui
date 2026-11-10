import { useEffect, useId, useState } from 'react';
import { validateCatalogJson, type CatalogItem } from './builder-catalog-data';
import { builderId } from './builder-model';

export function BuilderDataField({
  value,
  onChange,
  readOnly,
  label,
  kind,
}: {
  value: unknown;
  onChange: (value: unknown[]) => void;
  readOnly?: boolean;
  label: string;
  kind: 'items' | 'rows';
}) {
  const id = useId();
  const [json, setJson] = useState(kind === 'rows');
  const [draft, setDraft] = useState(JSON.stringify(value ?? [], null, 2));
  const [error, setError] = useState('');
  const [visual, setVisual] = useState<CatalogItem[]>(
    (Array.isArray(value) ? value : []) as CatalogItem[]
  );
  useEffect(() => {
    setDraft(JSON.stringify(value ?? [], null, 2));
    setError('');
    setVisual((Array.isArray(value) ? value : []) as CatalogItem[]);
  }, [value]);
  const list = visual;
  const update = (next: unknown[]) => {
    if (kind === 'items') setVisual(next as CatalogItem[]);
    try {
      onChange(validateCatalogJson(next, kind));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '数据格式不正确');
    }
  };
  return (
    <div className="studio-data-field">
      <div className="studio-data-field-heading">
        <label htmlFor={`${id}-json`}>{label}</label>
        {kind === 'items' && (
          <button type="button" onClick={() => setJson(!json)}>
            {json ? '可视编辑' : 'JSON'}
          </button>
        )}
      </div>
      {json ? (
        <>
          <textarea
            id={`${id}-json`}
            aria-label={`${label} JSON`}
            rows={12}
            value={draft}
            disabled={readOnly}
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value);
              setError('');
            }}
          />
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              try {
                update(validateCatalogJson(JSON.parse(draft), kind));
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'JSON 格式不正确');
              }
            }}
          >
            应用数据
          </button>
          <p>
            数据通过校验后才会替换画布内容。
            {kind === 'items'
              ? '层级数据可通过 children 数组嵌套。'
              : '列的 value 对应每行数据的字段名。'}
          </p>
        </>
      ) : (
        <>
          {list.map((item, index) => (
            <details key={index} className="studio-data-item">
              <summary>{item.label || `选项 ${index + 1}`}</summary>
              {(['value', 'label', 'description', 'content', 'href'] as const).map((key) => (
                <label className="studio-control" key={key}>
                  <span>
                    {
                      {
                        value: '唯一值',
                        label: '名称',
                        description: '描述',
                        content: '正文 / 单元格',
                        href: '目标链接',
                      }[key]
                    }
                  </span>
                  {key === 'content' ? (
                    <textarea
                      aria-label={`第 ${index + 1} 项正文`}
                      value={item[key] || ''}
                      disabled={readOnly}
                      rows={3}
                      onChange={(event) =>
                        update(
                          list.map((entry, i) =>
                            i === index ? { ...entry, [key]: event.target.value } : entry
                          )
                        )
                      }
                    />
                  ) : (
                    <input
                      aria-label={`第 ${index + 1} 项${{ value: '唯一值', label: '名称', description: '描述', href: '目标链接' }[key]}`}
                      value={item[key] || ''}
                      disabled={readOnly}
                      onChange={(event) =>
                        update(
                          list.map((entry, i) =>
                            i === index ? { ...entry, [key]: event.target.value } : entry
                          )
                        )
                      }
                    />
                  )}
                </label>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={!!item.disabled}
                  disabled={readOnly}
                  onChange={(event) =>
                    update(
                      list.map((entry, i) =>
                        i === index ? { ...entry, disabled: event.target.checked } : entry
                      )
                    )
                  }
                />{' '}
                禁用此项
              </label>
              {item.children && (
                <small>此项包含 {item.children.length} 个子项，请切换 JSON 编辑层级。</small>
              )}
              <div className="studio-data-item-actions">
                <button
                  type="button"
                  disabled={readOnly || index === 0}
                  onClick={() => {
                    const next = [...list];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    update(next);
                  }}
                >
                  上移
                </button>
                <button
                  type="button"
                  disabled={readOnly || index === list.length - 1}
                  onClick={() => {
                    const next = [...list];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    update(next);
                  }}
                >
                  下移
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => update(list.filter((_, i) => index !== i))}
                >
                  删除项
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            disabled={readOnly || list.length >= 100}
            onClick={() => update([...list, { value: builderId('item'), label: '新选项' }])}
          >
            添加选项
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
